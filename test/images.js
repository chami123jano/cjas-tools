/* Feeds real pictures to the image tools in Microsoft Edge and checks what
   comes out. jsdom cannot decode or draw pictures, so the logic suite can
   only test the arithmetic; this tests the actual pixels and files.

   Run with: node test/images.js */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const puppeteer = require('puppeteer-core');

const SRC = path.join(__dirname, '..', 'src');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) pass++;
  else { fail++; failures.push(label + (detail ? '\n      ' + detail : '')); }
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(SRC, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Draws a test picture in the browser itself: a photo-like gradient with
   noise (so JPG has something to compress) and a red square in the
   top-left corner (so crops can be checked by colour). */
async function makePicture(page, w, h, type, file) {
  const dataUrl = await page.evaluate((w, h, type) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2a6'); g.addColorStop(1, '#36c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    let seed = 7;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const n = (seed % 60) - 30;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, Math.round(w / 4), Math.round(h / 4));
    return c.toDataURL(type, 0.98);
  }, w, h, type);
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return file;
}

/* Reads the picture shown in an <img> or <canvas> back as size + pixels. */
async function shown(page, sel) {
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    if (el.tagName === 'IMG') {
      if (!el.complete || !el.naturalWidth) {
        await new Promise((r) => { el.onload = r; el.onerror = r; setTimeout(r, 3000); });
      }
    }
    const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(el, 0, 0);
    const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { w, h, topLeft: px(2, 2), centre: px(Math.floor(w / 2), Math.floor(h / 2)),
             corner: px(0, 0), bottomRight: px(w - 1, h - 1) };
  }, sel);
}

const text = (page, id) => page.$eval('#' + id, (e) => e.textContent.trim());
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Saves go through an <a download>; capture the Blob instead of a file. */
async function captureSaves(page) {
  await page.evaluate(() => {
    window.__saved = [];
    const real = window.CJA_IMG.download;
    window.CJA_IMG.download = function (blob, name) {
      window.__saved.push({ name, size: blob.size, type: blob.type });
    };
    window.CJA_IMG.__real = real;
  });
}
const saved = (page) => page.evaluate(() => window.__saved);

(async () => {
  if (!EDGE) { console.log('Microsoft Edge was not found.'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-img-'));
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/tools/';
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });

  const errors = [];
  async function open(slug) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    page.on('pageerror', (e) => errors.push(slug + ': ' + e.message));
    await page.goto(base + slug + '.html', { waitUntil: 'load' });
    await captureSaves(page);
    return page;
  }
  async function give(page, file) {
    const input = await page.$('#file');
    await input.uploadFile(file);
    await wait(900);
  }

  const maker = await browser.newPage();
  const photo = await makePicture(maker, 2400, 1600, 'image/png', path.join(tmp, 'photo.png'));
  const small = await makePicture(maker, 400, 300, 'image/jpeg', path.join(tmp, 'small.jpg'));
  const photoSize = fs.statSync(photo).size;
  await maker.close();

  // ---------------------------------------------------------- compress
  {
    const page = await open('image-compress');
    await give(page, photo);
    const after = await text(page, 's-after');
    const kb = parseFloat(after) * (/MB/.test(after) ? 1024 : 1);
    ok(/KB/.test(after) && kb <= 200, 'compress: a 2400px picture comes out under the 200 KB limit', 'got ' + after);
    ok(!/over the limit/.test(await text(page, 'note')), 'compress: and does not say it missed');
    let img = await shown(page, '#preview');
    ok(img && img.w === 2400 && img.h === 1600, 'compress: keeps the pixel size', JSON.stringify(img && [img.w, img.h]));

    // too small a limit for the pixel count is explained, not silently missed
    await page.$eval('#target', (e) => { e.value = '10'; e.dispatchEvent(new Event('change')); });
    await wait(1500);
    ok(/longest side/.test(await text(page, 'note')), 'compress: an impossible limit suggests fewer pixels');
    await page.$eval('#maxside', (e) => { e.value = '400'; e.dispatchEvent(new Event('change')); });
    await wait(1200);
    img = await shown(page, '#preview');
    ok(img && img.w === 400 && img.h === 267, 'compress: longest side 400 scales to 400 x 267',
       JSON.stringify(img && [img.w, img.h]));
    const after2 = await text(page, 's-after');
    ok(/KB|bytes/.test(after2) && parseFloat(after2) <= 10, 'compress: and then fits under 10 KB', 'got ' + after2);

    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'photo-compressed.jpg' && s[0].type === 'image/jpeg',
       'compress: saves photo-compressed.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- convert
  {
    const page = await open('image-convert');
    await give(page, small);
    await page.select('#format', 'image/png');
    await wait(700);
    ok((await text(page, 's-from')).indexOf('JPG') === 0, 'convert: reads the original as JPG');
    ok(await text(page, 's-to') === 'PNG', 'convert: writes PNG', await text(page, 's-to'));
    ok(/bigger/.test(await text(page, 'note')), 'convert: warns that a photo as PNG gets bigger');
    ok(await page.$eval('#quality-field', (e) => e.hidden), 'convert: PNG has no quality setting');
    await page.select('#format', 'image/webp');
    await wait(700);
    ok(await text(page, 's-to') === 'WebP', 'convert: writes WebP in Edge', await text(page, 's-to'));
    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small.webp' && s[0].type === 'image/webp',
       'convert: saves small.webp', JSON.stringify(s));
    const img = await shown(page, '#preview');
    ok(img && img.topLeft[0] > 200 && img.topLeft[1] < 60, 'convert: the picture survives intact (red corner still red)',
       JSON.stringify(img && img.topLeft));
    await page.close();
  }

  // ---------------------------------------------------------- resize
  {
    const page = await open('image-resize');
    await give(page, photo);
    let img = await shown(page, '#preview');
    ok(img && img.w === 1200 && img.h === 800, 'resize: starts at half size', JSON.stringify(img && [img.w, img.h]));

    // typing a width with the shape locked fills in the height
    await page.$eval('#w', (e) => { e.value = '600'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
    await wait(700);
    ok(await page.$eval('#h', (e) => e.value) === '400', 'resize: locked shape fills in the height');
    img = await shown(page, '#preview');
    ok(img && img.w === 600 && img.h === 400, 'resize: makes 600 x 400', JSON.stringify(img && [img.w, img.h]));
    ok(img && img.topLeft[0] > 200 && img.topLeft[1] < 60, 'resize: content is scaled, not cropped',
       JSON.stringify(img && img.topLeft));

    await page.click('#presets [data-pct="25"]');
    await wait(700);
    img = await shown(page, '#preview');
    ok(img && img.w === 600 && img.h === 400, 'resize: quarter size of 2400 x 1600 is 600 x 400');

    // unlocked: stretching is allowed but flagged
    await page.click('#presets [data-long="800"]');
    await page.$eval('#lock', (e) => { e.checked = false; });
    await page.$eval('#h', (e) => { e.value = '800'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
    await wait(700);
    img = await shown(page, '#preview');
    ok(img && img.w === 800 && img.h === 800, 'resize: unlocked sides change separately', JSON.stringify(img && [img.w, img.h]));
    ok(/stretched/.test(await text(page, 'note')), 'resize: and warns it is stretched');
    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'photo-800x800.png', 'resize: keeps PNG as PNG, named by the new size', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- crop
  {
    const page = await open('image-crop');
    await give(page, photo);
    ok(!(await page.$eval('#editor', (e) => e.hidden)), 'crop: the editor opens');
    ok(await page.$eval('#cx', (e) => e.value) === '240', 'crop: box starts 10% in from the left');
    if (fs.existsSync(path.join(__dirname, 'screenshots'))) {
      await page.screenshot({ path: path.join(__dirname, 'screenshots', 'image-crop-in-use.png') });
    }

    await page.click('#ratios [data-r="1"]');
    ok(await page.$eval('#cw', (e) => e.value) === '1600' && await page.$eval('#ch', (e) => e.value) === '1600',
       'crop: square takes the biggest square');
    ok(await page.$eval('#cx', (e) => e.value) === '400', 'crop: centred');

    // exact numbers: the red top-left quarter is 600 x 400
    await page.click('#ratios [data-r="0"]');
    for (const [id, v] of [['cx', 0], ['cy', 0], ['cw', 600], ['ch', 400]]) {
      await page.$eval('#' + id, (e, v) => { e.value = v; e.dispatchEvent(new Event('change')); }, v);
    }
    // out-of-range numbers are pulled back inside the picture
    await page.$eval('#cw', (e) => { e.value = 99999; e.dispatchEvent(new Event('change')); });
    ok(await page.$eval('#cw', (e) => e.value) === '2400', 'crop: a too-wide box is limited to the picture');
    await page.$eval('#cw', (e) => { e.value = 600; e.dispatchEvent(new Event('change')); });

    // drag the bottom-right corner inwards by 100 screen pixels
    const before = +(await page.$eval('#cw', (e) => e.value));
    const h = await page.$('#box i[data-h="se"]');
    const b = await h.boundingBox();
    await page.mouse.move(b.x + 8, b.y + 8);
    await page.mouse.down();
    await page.mouse.move(b.x - 92, b.y + 8, { steps: 5 });
    await page.mouse.up();
    const afterDrag = +(await page.$eval('#cw', (e) => e.value));
    ok(afterDrag < before && afterDrag > 0, 'crop: dragging a corner resizes the box', before + ' -> ' + afterDrag);
    ok(await page.$eval('#cx', (e) => e.value) === '0', 'crop: the opposite corner stays put');

    await page.$eval('#cw', (e) => { e.value = 600; e.dispatchEvent(new Event('change')); });
    await page.click('#save');
    await wait(600);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'photo-cropped.png', 'crop: saves photo-cropped.png', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- round corners
  {
    const page = await open('round-corners');
    await give(page, small);
    let img = await shown(page, '#out');
    ok(img && img.corner[3] === 0, 'round: the corner pixel is see-through', JSON.stringify(img && img.corner));
    ok(img && img.centre[3] === 255, 'round: the middle is solid');
    await page.select('#shape', 'circle');
    await wait(300);
    img = await shown(page, '#out');
    ok(img && img.w === 300 && img.h === 300, 'round: a circle is cut from the middle square', JSON.stringify(img && [img.w, img.h]));
    await page.select('#corners', 'colour');
    await page.$eval('#colour', (e) => { e.value = '#000000'; e.dispatchEvent(new Event('change')); });
    await wait(300);
    img = await shown(page, '#out');
    ok(img && img.corner[3] === 255 && img.corner[0] === 0, 'round: coloured corners are filled', JSON.stringify(img && img.corner));
    await page.click('#save');
    await wait(500);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-rounded.jpg' && s[0].type === 'image/jpeg',
       'round: coloured corners save as JPG', JSON.stringify(s));
    await page.close();
  }

  /* Statistics over a canvas region: how many pixels differ from a
     snapshot, and how flat the region is (pixelation makes it flatter). */
  const snap = (page) => page.evaluate(() => {
    const c = document.getElementById('out');
    window.__snap = c.getContext('2d').getImageData(0, 0, c.width, c.height).data.slice();
  });
  const changed = (page, x, y, w, h) => page.evaluate((x, y, w, h) => {
    const c = document.getElementById('out');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = (j * c.width + i) * 4;
      if (Math.abs(d[k] - window.__snap[k]) + Math.abs(d[k + 1] - window.__snap[k + 1]) +
          Math.abs(d[k + 2] - window.__snap[k + 2]) > 6) n++;
    }
    return n / (w * h);
  }, x, y, w, h);
  const pixel = (page, x, y) => page.evaluate((x, y) =>
    Array.from(document.getElementById('out').getContext('2d').getImageData(x, y, 1, 1).data), x, y);

  // ---------------------------------------------------------- border
  {
    const page = await open('image-border');
    await give(page, small);
    let img = await shown(page, '#out');
    // 4% of the 300 px short side is 12 px on every side
    ok(img && img.w === 424 && img.h === 324, 'border: 400x300 gains 12 px each side', JSON.stringify(img && [img.w, img.h]));
    ok(img && img.corner[0] === 255 && img.corner[1] === 255, 'border: white by default');
    ok(img && img.centre[0] !== 255, 'border: the picture is inside, untouched');
    await page.select('#style', 'print');
    await wait(200);
    img = await shown(page, '#out');
    ok(img && img.h === 300 + 12 + 48, 'border: photo print is four times deeper at the bottom', JSON.stringify(img && [img.w, img.h]));
    await page.click('#swatches [data-c="#000000"]');
    await wait(200);
    img = await shown(page, '#out');
    ok(img && img.corner[0] === 0, 'border: colour swatches work');
    await page.click('#save');
    await wait(400);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-border.jpg', 'border: saves small-border.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- add text
  {
    const page = await open('add-text-to-image');
    await give(page, small);
    await page.$eval('#text', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await snap(page);
    await page.$eval('#text', (e) => { e.value = 'HELLO'; e.dispatchEvent(new Event('input')); });
    await page.click('#places [data-p="0.5,0.12"]');
    await wait(200);
    const top = await changed(page, 0, 0, 400, 75);
    const bottom = await changed(page, 0, 225, 400, 75);
    ok(top > 0.01 && bottom === 0, 'text: "Top" writes in the top quarter only', top + ' / ' + bottom);

    // dragging on the picture moves the text to where the pointer is
    await page.$eval('#out', (e) => e.scrollIntoView({ block: 'center' }));
    const box = await (await page.$('#out')).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.85, { steps: 4 });
    await page.mouse.up();
    await wait(200);
    ok(await changed(page, 0, 0, 400, 75) === 0 && await changed(page, 0, 225, 400, 75) > 0.01,
       'text: dragging moves it to the bottom');

    // two lines take more height than one
    await page.$eval('#text', (e) => { e.value = 'ONE\nTWO'; e.dispatchEvent(new Event('input')); });
    await page.click('#places [data-p="0.5,0.5"]');
    await wait(200);
    ok(await changed(page, 0, 100, 400, 100) > 0.01, 'text: several lines are drawn');
    await page.click('#save');
    await wait(400);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-text.jpg', 'text: saves small-text.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- watermark
  {
    const page = await open('image-watermark');
    await give(page, small);
    await page.$eval('#text', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await snap(page);
    await page.$eval('#text', (e) => { e.value = 'SAMPLE'; e.dispatchEvent(new Event('input')); });
    await wait(200);
    const br = await changed(page, 200, 150, 200, 150);
    const tl = await changed(page, 0, 0, 200, 150);
    ok(br > 0.01 && tl === 0, 'watermark: bottom right by default', br + ' / ' + tl);
    await page.select('#place', 'tile');
    await wait(200);
    const tiledTl = await changed(page, 0, 0, 200, 150);
    const tiledBr = await changed(page, 200, 150, 200, 150);
    ok(tiledTl > 0.01 && tiledBr > 0.01, 'watermark: repeated covers every part', tiledTl + ' / ' + tiledBr);

    // strength: 100% changes pixels more than 10%
    const diffAt = async (o) => {
      await page.$eval('#opacity', (e, o) => { e.value = o; e.dispatchEvent(new Event('input')); }, o);
      await wait(100);
      return changed(page, 0, 0, 400, 300);
    };
    ok(await diffAt(100) > await diffAt(10), 'watermark: strength changes how visible it is');

    // a logo works too
    await page.select('#kind', 'logo');
    const logoInput = await page.$('#logo');
    await logoInput.uploadFile(small);
    await wait(700);
    ok(await page.$eval('#logo-btn', (e) => e.textContent) === 'small.jpg', 'watermark: a logo can be chosen');
    ok(await changed(page, 0, 0, 400, 300) > 0.01, 'watermark: and is drawn on the picture');
    await page.close();
  }

  // ---------------------------------------------------------- favicon
  {
    const page = await open('favicon-generator');
    await page.evaluate(() => {
      window.__blobs = [];
      const d = window.CJA_IMG.download;
      window.CJA_IMG.download = function (blob, name) { window.__blobs.push({ blob, name }); d.call(this, blob, name); };
    });
    const sizes = await page.$$eval('#icons canvas', (cs) => cs.map((c) => c.width));
    ok(sizes.join(',') === '16,32,48,180,192,512', 'favicon: all six sizes are made', sizes.join(','));
    const centre = await page.evaluate(() => {
      const c = document.querySelectorAll('#icons canvas')[5];
      return Array.from(c.getContext('2d').getImageData(10, 256, 1, 1).data);
    });
    ok(centre[2] > 180 && centre[3] === 255, 'favicon: the letter icon has its background colour', JSON.stringify(centre));
    const corner = await page.evaluate(() => {
      const c = document.querySelectorAll('#icons canvas')[5];
      return c.getContext('2d').getImageData(0, 0, 1, 1).data[3];
    });
    ok(corner === 0, 'favicon: rounded corners are see-through');

    await page.click('#save-ico');
    await page.waitForFunction(() => window.__blobs.some((x) => x.name === 'favicon.ico'), { timeout: 5000 })
      .catch(() => {});
    const ico = await page.evaluate(async () => {
      const b = window.__blobs.find((x) => x.name === 'favicon.ico');
      if (!b) return null;
      const bytes = new Uint8Array(await b.blob.arrayBuffer());
      const dv = new DataView(bytes.buffer);
      const entries = [];
      for (let i = 0; i < dv.getUint16(4, true); i++) {
        const e = 6 + 16 * i;
        const off = dv.getUint32(e + 12, true), len = dv.getUint32(e + 8, true);
        entries.push({
          w: dv.getUint8(e), bpp: dv.getUint16(e + 6, true), len, off,
          png: bytes[off] === 0x89 && bytes[off + 1] === 0x50 && bytes[off + 2] === 0x4e && bytes[off + 3] === 0x47,
          fits: off + len <= bytes.length
        });
      }
      return { type: dv.getUint16(2, true), entries, total: bytes.length };
    });
    ok(ico && ico.type === 1, 'favicon: the .ico header says icon', JSON.stringify(ico));
    ok(ico && ico.entries.map((e) => e.w).join(',') === '16,32,48', 'favicon: the .ico holds 16, 32 and 48');
    ok(ico && ico.entries.every((e) => e.png && e.fits && e.bpp === 32), 'favicon: each entry is a whole PNG at 32 bits');

    // the .ico must open as a real icon in the browser
    const opens = await page.evaluate(() => new Promise((r) => {
      const b = window.__blobs.find((x) => x.name === 'favicon.ico');
      if (!b) { r(-2); return; }
      const img = new Image();
      img.onload = () => r(img.naturalWidth);
      img.onerror = () => r(-1);
      img.src = URL.createObjectURL(b.blob);
    }));
    ok(opens > 0, 'favicon: Edge opens the .ico file as a picture', 'width ' + opens);

    // from a picture
    await page.select('#from', 'picture');
    await wait(100);
    ok(/Choose a picture/.test(await page.$eval('#icons', (e) => e.textContent)), 'favicon: asks for a picture');
    await give(page, small);
    const n = await page.$$eval('#icons canvas', (cs) => cs.length);
    ok(n === 6, 'favicon: a picture makes all six too');
    await page.close();
  }

  // ---------------------------------------------------------- pixelate / blur
  {
    const page = await open('pixelate-blur');
    await give(page, photo);
    await snap(page);
    await page.$eval('#out', (e) => e.scrollIntoView({ block: 'center' }));
    const box = await (await page.$('#out')).boundingBox();
    const toScreen = (x, y) => [box.x + x / 2400 * box.width, box.y + y / 1600 * box.height];

    // drag over the middle of the picture
    let [x1, y1] = toScreen(1000, 600), [x2, y2] = toScreen(1600, 1000);
    await page.mouse.move(x1, y1); await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 5 }); await page.mouse.up();
    await wait(300);
    ok(/1 part hidden/.test(await text(page, 'count')), 'pixelate: one box is counted');
    ok(await changed(page, 1050, 650, 500, 300) > 0.5, 'pixelate: the box is changed');
    ok(await changed(page, 0, 1200, 900, 300) === 0 && await changed(page, 1700, 0, 600, 500) === 0,
       'pixelate: nothing outside the box changes');

    // a click without a drag adds nothing
    await page.mouse.click(...toScreen(200, 1400));
    await wait(200);
    ok(/1 part hidden/.test(await text(page, 'count')), 'pixelate: a plain click is ignored');

    // solid boxes are fully black, and overlapping boxes do not un-hide each other
    await page.select('#mode', 'solid');
    [x1, y1] = toScreen(1400, 800); [x2, y2] = toScreen(2000, 1300);
    await page.mouse.move(x1, y1); await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 5 }); await page.mouse.up();
    await wait(300);
    const blacks = await Promise.all([[1100, 700], [1500, 900], [1900, 1200], [1550, 950]].map(([x, y]) => pixel(page, x, y)));
    ok(blacks.every((p) => p[0] === 0 && p[1] === 0 && p[2] === 0), 'pixelate: solid boxes, overlapping, are all black',
       JSON.stringify(blacks));

    await page.click('#undo');
    await wait(200);
    ok(/1 part hidden/.test(await text(page, 'count')), 'pixelate: undo removes the last box');
    await page.click('#clear');
    await wait(200);
    ok(await changed(page, 0, 0, 2400, 1600) === 0, 'pixelate: clear restores the picture');

    await page.click('#save');
    ok((await saved(page)).length === 0, 'pixelate: will not save with nothing hidden');

    await page.select('#mode', 'blur');
    await page.select('#area', 'all');
    await wait(500);
    ok(await changed(page, 1000, 600, 400, 400) > 0.5, 'pixelate: blur covers the whole picture');
    const edge = await pixel(page, 2399, 1599);
    ok(edge[3] === 255, 'pixelate: blurred edges stay solid, not see-through', JSON.stringify(edge));
    await page.click('#save');
    await wait(800);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'photo-hidden.png', 'pixelate: saves photo-hidden.png', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- not a picture
  {
    const page = await open('image-compress');
    const bad = path.join(tmp, 'notes.txt');
    fs.writeFileSync(bad, 'hello');
    await give(page, bad);
    ok(await page.$eval('#result-panel', (e) => e.hidden), 'a text file is refused, not processed');
    await page.close();
  }

  ok(errors.length === 0, 'no script errors in any image tool', errors.join('\n      '));

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('');
  failures.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed (images, in a real browser)');
  process.exit(fail ? 1 : 0);
})();
