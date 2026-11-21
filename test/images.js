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
/* Waits for n saves (encoding a big JPG can take a moment on a busy
   machine), then returns everything saved so far. */
async function saved(page, n = 1) {
  if (n > 0) {
    await page.waitForFunction((n) => window.__saved.length >= n, { timeout: 5000 }, n).catch(() => {});
  }
  return page.evaluate(() => window.__saved);
}

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
    await wait(500);
    ok((await saved(page, 0)).length === 0, 'pixelate: will not save with nothing hidden');

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

  // ---------------------------------------------------------- rotate and flip
  {
    const page = await open('rotate-flip');
    await give(page, small);   // 400 x 300, red block in the top-left corner
    const red = (p) => p[0] > 200 && p[1] < 60 && p[2] < 60;
    let img = await shown(page, '#out');
    ok(img && img.w === 400 && img.h === 300 && red(img.topLeft), 'rotate: starts as the original');

    await page.click('#turns [data-turn="90"]');
    await wait(150);
    img = await shown(page, '#out');
    ok(img && img.w === 300 && img.h === 400, 'rotate: turning right swaps width and height', JSON.stringify(img && [img.w, img.h]));
    ok(red(await pixel(page, 297, 2)), 'rotate: the top-left corner goes to the top right');

    // mirror after a turn still mirrors left-right on screen
    await page.click('#turns [data-flip="h"]');
    await wait(150);
    ok(red(await pixel(page, 2, 2)), 'rotate: mirror after a turn flips left-right as seen');

    await page.click('#reset');
    await page.click('#turns [data-turn="180"]');
    await wait(150);
    ok(red(await pixel(page, 397, 297)), 'rotate: upside down puts the corner bottom right');
    await page.click('#turns [data-flip="v"]');
    await wait(150);
    ok(red(await pixel(page, 397, 2)), 'rotate: flip top to bottom');

    // straightening with trim gives a smaller picture with no empty corners
    await page.click('#reset');
    await page.$eval('#fine', (e) => { e.value = 10; e.dispatchEvent(new Event('input')); });
    await wait(150);
    img = await shown(page, '#out');
    ok(img && img.w < 400 && img.h < 300 && img.corner[3] === 255 && img.bottomRight[3] === 255,
       'rotate: trimming leaves no see-through corners', JSON.stringify(img && [img.w, img.h, img.corner, img.bottomRight]));
    await page.select('#corners', 'fill');
    await wait(150);
    img = await shown(page, '#out');
    ok(img && img.w > 400 && img.h > 300 && img.bottomRight[0] === 255 && img.bottomRight[1] === 255,
       'rotate: "keep everything" grows the picture and fills the corners', JSON.stringify(img && [img.w, img.h, img.bottomRight]));
    await page.click('#save');
    await wait(400);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-rotated.jpg', 'rotate: saves small-rotated.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- photo filters
  {
    const page = await open('photo-filters');
    await give(page, small);
    let img = await shown(page, '#out');
    const orig = img.centre;
    await page.click('#looks [data-look="bw"]');
    await wait(150);
    img = await shown(page, '#out');
    const c = img.centre;
    ok(Math.abs(c[0] - c[1]) <= 2 && Math.abs(c[1] - c[2]) <= 2, 'filters: black and white has no colour', JSON.stringify(c));
    ok(await page.$eval('#grayscale', (e) => e.value) === '100', 'filters: a look sets the sliders');

    await page.click('#looks [data-look="none"]');
    await page.$eval('#brightness', (e) => { e.value = 160; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(150);
    img = await shown(page, '#out');
    ok(img.centre[0] + img.centre[1] + img.centre[2] > orig[0] + orig[1] + orig[2] + 60,
       'filters: brightness lightens', JSON.stringify([orig, img.centre]));
    ok(!(await page.$$eval('#looks .btn.primary', (b) => b.length)), 'filters: moving a slider clears the look');

    // holding the button shows the original
    await page.$eval('#hold', (e) => e.scrollIntoView({ block: 'center' }));
    const hold = await (await page.$('#hold')).boundingBox();
    await page.mouse.move(hold.x + 5, hold.y + 5);
    await page.mouse.down();
    await wait(100);
    img = await shown(page, '#out');
    ok(Math.abs(img.centre[0] - orig[0]) <= 2, 'filters: holding shows the original');
    await page.mouse.up();
    await wait(100);
    img = await shown(page, '#out');
    ok(img.centre[0] > orig[0] + 10, 'filters: letting go shows the edit again');

    await page.$eval('#warmth', (e) => { e.value = 50; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(150);
    const warm = (await shown(page, '#out')).centre;
    ok(warm[0] - warm[2] > img.centre[0] - img.centre[2], 'filters: warmth adds orange', JSON.stringify([img.centre, warm]));

    await page.$eval('#blur', (e) => { e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(200);
    ok((await shown(page, '#out')).corner[3] === 255, 'filters: soften keeps the edges solid');
    await page.click('#save');
    await wait(400);
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-edited.jpg', 'filters: saves small-edited.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- colour picker
  {
    const page = await open('image-color-picker');
    await give(page, small);   // red block is the top-left 100 x 75
    await page.$eval('#view', (e) => e.scrollIntoView({ block: 'center' }));
    const box = await (await page.$('#view')).boundingBox();
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1);
    await wait(100);
    const hex = await text(page, 'hex');
    ok(/^#F[A-F0-9]0[0-9A-F]0[0-9A-F]$/.test(hex) || /^#(F|E)[0-9A-F]{5}$/.test(hex) && parseInt(hex.slice(3, 5), 16) < 40,
       'picker: clicking the red corner reads red', hex);
    ok(/^rgb\(\d+, \d+, \d+\)$/.test(await text(page, 'rgb')), 'picker: gives RGB');
    ok(/^hsl\((35\d|[0-9]|1[0-9]), \d+%, \d+%\)$/.test(await text(page, 'hsl')), 'picker: and HSL with a red hue', await text(page, 'hsl'));
    ok(/^Pixel 40, 30/.test(await text(page, 'where')), 'picker: says which pixel', await text(page, 'where'));

    // the palette finds the red block among the main colours
    const chips = await page.$$eval('#palette .chip', (cs) => cs.map((c) => c.dataset.hex));
    ok(chips.length >= 2 && chips.length <= 8, 'picker: lists the main colours', chips.join(' '));
    ok(chips.some((h) => parseInt(h.slice(1, 3), 16) > 200 && parseInt(h.slice(3, 5), 16) < 60),
       'picker: the red block is one of them', chips.join(' '));
    const shares = await page.$$eval('#palette .chip span', (s) => s.map((x) => parseInt(x.textContent, 10)));
    ok(shares.every((n, i) => i === 0 || n <= shares[i - 1]), 'picker: biggest share first', shares.join(','));
    await page.close();
  }

  // ---------------------------------------------------------- passport photo
  {
    const page = await open('passport-photo');
    await give(page, photo);   // 2400 x 1600
    ok(!(await page.$eval('#editor-panel', (e) => e.hidden)), 'passport: the editor opens');
    const fw = await page.$eval('#frame', (e) => [e.width, e.height]);
    ok(Math.abs(fw[0] / fw[1] - 35 / 45) < 0.01, 'passport: the frame is 35:45', JSON.stringify(fw));

    // 4 x 6 at 300 dpi is 1200 x 1800, and six 35 x 45 photos fit
    let sh = await page.$eval('#sheet', (e) => [e.width, e.height]);
    ok(sh[0] === 1200 && sh[1] === 1800, 'passport: a 4x6 sheet is 1200 x 1800 pixels', JSON.stringify(sh));
    ok(await page.$eval('#copies', (e) => e.value) === '6', 'passport: six photos fit on 4x6');
    ok(/6 photos of 35 × 45 mm/.test(await text(page, 'sheet-note')), 'passport: and says so', await text(page, 'sheet-note'));

    await page.select('#paper', 'a4');
    await wait(300);
    sh = await page.$eval('#sheet', (e) => [e.width, e.height]);
    ok(sh[0] === 2480 && sh[1] === 3508, 'passport: A4 is 2480 x 3508', JSON.stringify(sh));
    ok(await page.$eval('#copies', (e) => e.value) === '30', 'passport: thirty fit on A4', await page.$eval('#copies', (e) => e.value));

    await page.select('#size', '51x51');
    await page.select('#paper', '4x6');
    await page.select('#copies', '2');
    await wait(300);
    ok(/2 photos of 51 × 51 mm/.test(await text(page, 'sheet-note')), 'passport: 2x2 inch, two copies');
    // the photo at 300 dpi: 51 mm is 602 px; the third slot stays white
    const sheetPx = await page.evaluate(() => {
      const c = document.getElementById('sheet');
      const d = c.getContext('2d');
      return [Array.from(d.getImageData(600, 1700, 1, 1).data), Array.from(d.getImageData(c.width / 2, 300, 1, 1).data)];
    });
    ok(sheetPx[0][0] === 255 && sheetPx[0][1] === 255, 'passport: unused space stays white');

    // dragging the photo changes what is framed, and stays inside the photo
    await page.select('#size', '35x45');
    await wait(200);
    await page.$eval('#frame-wrap', (e) => e.scrollIntoView({ block: 'center' }));
    const before = await page.evaluate(() => Array.from(document.getElementById('frame').getContext('2d').getImageData(5, 5, 1, 1).data));
    const fb = await (await page.$('#frame-wrap')).boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    await page.mouse.move(fb.x + fb.width / 2 + 3000, fb.y + fb.height / 2 + 3000, { steps: 4 });
    await page.mouse.up();
    await wait(200);
    const after = await page.evaluate(() => Array.from(document.getElementById('frame').getContext('2d').getImageData(5, 5, 1, 1).data));
    ok(after[0] > 200 && after[1] < 60, 'passport: dragging far moves to the photo edge (the red corner)', JSON.stringify([before, after]));

    await page.$eval('#tilt', (e) => { e.value = 10; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
    await wait(200);
    const corners = await page.evaluate(() => {
      const c = document.getElementById('frame'), d = c.getContext('2d');
      return [d.getImageData(0, 0, 1, 1).data, d.getImageData(c.width - 1, c.height - 1, 1, 1).data]
        .map((p) => Array.from(p));
    });
    ok(corners.every((p) => !(p[0] === 255 && p[1] === 255 && p[2] === 255)),
       'passport: straightening leaves no blank corners', JSON.stringify(corners));

    await page.click('#save-one');
    await page.click('#save-sheet');
    const s = await saved(page, 2);
    ok(s.length === 2 && s[0].name === 'passport-photo-35x45mm.jpg' && s[1].name === 'passport-photos-4x6.jpg',
       'passport: saves one photo and the sheet', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- meme maker
  {
    const page = await open('meme-maker');
    await give(page, small);
    // compare against the picture with no text at all
    await page.$eval('#top', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await page.$eval('#bottom', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await snap(page);
    await page.$eval('#top', (e) => { e.value = 'Top words'; e.dispatchEvent(new Event('input')); });
    await wait(150);
    ok(await changed(page, 0, 0, 400, 80) > 0.05 && await changed(page, 0, 220, 400, 80) === 0,
       'meme: top text goes at the top only');
    // white letters with black outline: both appear in the text area
    const tones = await page.evaluate(() => {
      const d = document.getElementById('out').getContext('2d').getImageData(0, 0, 400, 80).data;
      let white = 0, black = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) white++;
        if (d[i] < 20 && d[i + 1] < 20 && d[i + 2] < 20) black++;
      }
      return [white, black];
    });
    ok(tones[0] > 200 && tones[1] > 200, 'meme: white letters with a black outline', JSON.stringify(tones));

    // a very long line wraps and shrinks but stays inside the picture
    await page.$eval('#bottom', (e) => {
      e.value = 'this is a very long bottom line that cannot possibly fit on one line of a small picture';
      e.dispatchEvent(new Event('input'));
    });
    await wait(150);
    const edges = await page.evaluate(() => {
      const d = document.getElementById('out').getContext('2d');
      return [d.getImageData(0, 150, 2, 150).data, d.getImageData(398, 150, 2, 150).data];
    });
    ok(await changed(page, 0, 150, 400, 150) > 0.03, 'meme: long bottom text is drawn');
    ok(await changed(page, 0, 150, 3, 150) === 0 && await changed(page, 397, 150, 3, 150) === 0,
       'meme: and wraps inside the edges');

    await page.select('#style', 'caption');
    await page.$eval('#caption', (e) => { e.value = 'A caption'; e.dispatchEvent(new Event('input')); });
    await wait(150);
    let img = await shown(page, '#out');
    ok(img && img.w === 400 && img.h > 300, 'meme: a caption adds a strip above', JSON.stringify(img && [img.w, img.h]));
    ok(img && img.corner[0] === 255 && img.corner[1] === 255, 'meme: the strip is white');
    ok(img && img.bottomRight[0] !== 255, 'meme: the picture sits below it');
    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-meme.jpg', 'meme: saves small-meme.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- collage
  {
    const page = await open('photo-collage');
    const input = await page.$('#file');
    await input.uploadFile(small, photo, small);
    await wait(1200);
    ok(await page.$$eval('#thumbs .thumb', (t) => t.length) === 3, 'collage: three photos are added at once');
    let img = await shown(page, '#out');
    ok(img && img.w === 2000 && img.h === 2000, 'collage: a 2000 px square', JSON.stringify(img && [img.w, img.h]));
    ok(await page.$eval('#layouts .btn.primary', (b) => b.dataset.layout) === '3a', 'collage: picks a 3-photo layout');
    ok(img && img.corner[0] === 255, 'collage: the spacing shows the background');

    // 2% spacing of 2000 px is 40 px: photo inside the box, background in the gap
    const isWhite = (p) => p[0] === 255 && p[1] === 255 && p[2] === 255;
    ok(!isWhite(await pixel(page, 60, 60)), 'collage: photo 1 fills the first box');
    ok(isWhite(await pixel(page, 1000, 1000)), 'collage: the gap between boxes is background');
    ok(isWhite(await pixel(page, 20, 1000)), 'collage: and so is the border');

    await page.$eval('#gap', (e) => { e.value = 0; e.dispatchEvent(new Event('input')); });
    await wait(200);
    ok(!isWhite(await pixel(page, 0, 0)) && !isWhite(await pixel(page, 1000, 1000)),
       'collage: with no spacing the photos meet the edges and each other');

    await page.select('#shape', '1.7778');
    await wait(200);
    img = await shown(page, '#out');
    ok(img && img.w === 2000 && img.h === 1125, 'collage: wide 16:9 is 2000 x 1125', JSON.stringify(img && [img.w, img.h]));

    // a layout for more photos than there are: says how many to add
    await page.click('#layouts [data-layout="4a"]');
    await wait(200);
    ok(/Add 1 more photo/.test(await text(page, 'note')), 'collage: asks for one more photo', await text(page, 'note'));
    await page.click('#layouts [data-layout="2a"]');
    await wait(200);
    ok(/last 1 photo is left out/.test(await text(page, 'note')), 'collage: says when a photo is left out', await text(page, 'note'));

    // removing a photo
    await page.click('#thumbs [data-remove="0"]');
    await wait(200);
    ok(await page.$$eval('#thumbs .thumb', (t) => t.length) === 2, 'collage: a photo can be removed');
    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'collage.jpg', 'collage: saves collage.jpg', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- splitter
  {
    const page = await open('image-splitter');
    await page.evaluate(() => {
      window.__blobs = [];
      const d = window.CJA_IMG.download;
      window.CJA_IMG.download = function (blob, name) { window.__blobs.push({ blob, name }); d.call(this, blob, name); };
    });
    await give(page, photo);   // 2400 x 1600
    ok(/9 pieces, each 800 × 533/.test(await text(page, 'note')), 'split: 3 x 3 of 2400 x 1600', await text(page, 'note'));
    await page.click('#presets [data-c="3"][data-r="1"]');
    await wait(300);
    ok(/3 pieces, each 800 × 800/.test(await text(page, 'note')), 'split: a square panorama of 3', await text(page, 'note'));
    await page.click('#presets [data-c="2"][data-r="2"]');
    await page.select('#fit', 'no');
    await wait(300);
    ok(/4 pieces, each 1200 × 800/.test(await text(page, 'note')), 'split: four quarters', await text(page, 'note'));
    const firstPiece = await page.evaluate(() => {
      const c = document.querySelector('#pieces canvas');
      return [c.width, c.height, Array.from(c.getContext('2d').getImageData(5, 5, 1, 1).data)];
    });
    ok(firstPiece[0] === 1200 && firstPiece[2][0] > 200 && firstPiece[2][1] < 60,
       'split: piece 1 is the top-left quarter (red corner)', JSON.stringify(firstPiece));

    await page.click('#save-zip');
    await page.waitForFunction(() => window.__blobs.length > 0, { timeout: 8000 }).catch(() => {});
    const z = await page.evaluate(async () => {
      const b = window.__blobs[0];
      if (!b) return null;
      const bytes = new Uint8Array(await b.blob.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      return { name: b.name, b64: btoa(s) };
    });
    ok(z && z.name === 'photo-pieces.zip', 'split: saves photo-pieces.zip', z && z.name);
    if (z) {
      const zipFile = path.join(tmp, z.name);
      fs.writeFileSync(zipFile, Buffer.from(z.b64, 'base64'));
      const outDir = path.join(tmp, 'unzipped');
      fs.mkdirSync(outDir);
      let listed = '';
      try {
        /* Windows 10 and 11 include bsdtar, which reads zip files. */
        const tar = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe');
        listed = require('child_process').execFileSync(tar, ['-xvf', zipFile, '-C', outDir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) { listed = 'tar failed: ' + e.message; }
      const names = fs.readdirSync(outDir).sort();
      ok(names.join(',') === 'photo-01.png,photo-02.png,photo-03.png,photo-04.png',
         'split: the zip unpacks to four numbered pieces', names.join(',') + ' ' + listed);
      // each piece is a real PNG of the right size
      const sizes = names.map((n) => {
        const b = fs.readFileSync(path.join(outDir, n));
        return b.slice(1, 4).toString() === 'PNG' ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : 'not png';
      });
      ok(sizes.every((s) => s === '1200x800'), 'split: every piece is a 1200 x 800 PNG', sizes.join(','));
    }
    await page.close();
  }

  // ---------------------------------------------------------- ascii art
  {
    const page = await open('image-to-ascii');
    await give(page, small);   // 400 x 300: red top-left quarter on a green-blue gradient
    let art = await page.$eval('#art', (e) => e.textContent);
    let lines = art.split('\n');
    ok(lines.length === 38, 'ascii: 100 wide gives 38 lines for a 4:3 picture', lines.length);
    ok(Math.max(...lines.map((l) => l.length)) <= 100, 'ascii: no line wider than asked');
    ok(/^[@%#*+=\-:. \n]+$/.test(art), 'ascii: only the classic characters are used');

    await page.$eval('#width', (e) => { e.value = 40; e.dispatchEvent(new Event('input')); });
    await page.select('#set', 'binary');
    await wait(150);
    art = await page.$eval('#art', (e) => e.textContent);
    ok(/^[10 \n]+$/.test(art) && art.split('\n').length === 15, 'ascii: ones and zeros, 40 wide', art.split('\n').length);

    // a pure white picture is all spaces; swapping makes it solid
    const white = path.join(tmp, 'white.png');
    const wdata = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 80; c.height = 40;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 80, 40);
      return c.toDataURL('image/png');
    });
    fs.writeFileSync(white, Buffer.from(wdata.split(',')[1], 'base64'));
    await page.select('#set', 'classic');
    await give(page, white);
    art = await page.$eval('#art', (e) => e.textContent);
    ok(art.trim() === '', 'ascii: white comes out as blank');
    await page.$eval('#invert', (e) => { e.checked = true; e.dispatchEvent(new Event('change')); });
    await wait(150);
    art = await page.$eval('#art', (e) => e.textContent);
    ok(/^@+$/.test(art.split('\n')[0]), 'ascii: swapping makes it solid', art.split('\n')[0]);

    await page.click('#save-txt');
    await page.click('#save-png');
    const s = await saved(page, 2);
    ok(s.length === 2 && s[0].name === 'white-ascii.txt' && s[1].name === 'white-ascii.png',
       'ascii: saves as text and as a picture', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- remove background
  {
    /* A test picture: off-white background with a little noise, a red ring
       with a white hole in the middle (the hole is NOT joined to the edge),
       and a soft grey shadow edge on the ring. */
    const page = await open('remove-background');
    const ringFile = path.join(tmp, 'ring.jpg');
    const rdata = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 200;
      const x = c.getContext('2d');
      x.fillStyle = '#f7f7f5'; x.fillRect(0, 0, 300, 200);
      x.filter = 'blur(2px)';   // a soft edge, like a real photo
      x.fillStyle = '#c0161e'; x.beginPath(); x.arc(150, 100, 70, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f7f7f5'; x.beginPath(); x.arc(150, 100, 30, 0, Math.PI * 2); x.fill();
      return c.toDataURL('image/jpeg', 0.95);
    });
    fs.writeFileSync(ringFile, Buffer.from(rdata.split(',')[1], 'base64'));
    await give(page, ringFile);

    const hexShown = await text(page, 'bg-hex');
    const bgRgb = [1, 3, 5].map((i) => parseInt(hexShown.slice(i, i + 2), 16));
    ok(bgRgb.every((n) => Math.abs(n - 246) < 6), 'background: finds the off-white from the edges', hexShown);

    let corner = await pixel(page, 2, 2), ring = await pixel(page, 150, 45), hole = await pixel(page, 150, 100);
    ok(corner[3] === 0, 'background: the outside becomes see-through', JSON.stringify(corner));
    ok(ring[3] === 255 && ring[0] > 150 && ring[1] < 60, 'background: the red ring stays solid', JSON.stringify(ring));
    ok(hole[3] === 255, 'background: the hole inside is kept (not joined to the edge)', JSON.stringify(hole));
    ok(/% of the picture was background/.test(await text(page, 'note')), 'background: says how much was removed');

    // the soft edge: some pixels at the ring's outer edge are half see-through,
    // and have no pale halo left (red, not pink)
    const edge = await page.evaluate(() => {
      const d = document.getElementById('out').getContext('2d').getImageData(150, 25, 1, 15).data;
      const out = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20 && d[i + 3] < 235) out.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
      return out;
    });
    ok(edge.length > 0, 'background: edges are softened', JSON.stringify(edge));
    ok(edge.every((p) => p[0] > 120 && p[1] < 110), 'background: softened edges stay red, not pale', JSON.stringify(edge));

    await page.select('#where', 'all');
    await wait(300);
    hole = await pixel(page, 150, 100);
    ok(hole[3] === 0, 'background: "everywhere" also clears the hole');

    // replace with blue
    await page.select('#replace', 'colour');
    await page.$eval('#newbg', (e) => { e.value = '#0044cc'; e.dispatchEvent(new Event('change')); });
    await wait(300);
    corner = await pixel(page, 2, 2);
    ok(corner[3] === 255 && corner[2] > 190 && corner[0] < 20, 'background: a new colour fills behind', JSON.stringify(corner));
    ring = await pixel(page, 150, 45);
    ok(ring[0] > 150 && ring[2] < 80, 'background: and the ring is still red on top', JSON.stringify(ring));

    // clicking the ring picks red as "background" instead
    await page.select('#replace', 'clear');
    await page.select('#where', 'edges');
    await page.$eval('#out', (e) => e.scrollIntoView({ block: 'center' }));
    const ob = await (await page.$('#out')).boundingBox();
    await page.mouse.click(ob.x + ob.width * 150 / 300, ob.y + ob.height * 45 / 200);
    await wait(300);
    const picked = await text(page, 'bg-hex');
    ok(parseInt(picked.slice(1, 3), 16) > 150 && parseInt(picked.slice(3, 5), 16) < 60, 'background: clicking picks that colour', picked);
    ok(/Very little matched/.test(await text(page, 'note')), 'background: red is not joined to the edge, so it says little matched',
       await text(page, 'note'));

    // a signature preset, then save as a see-through PNG
    await page.click('#presets [data-preset="signature"]');
    await wait(300);
    ok(await page.$eval('#tol', (e) => e.value) === '35' && await page.$eval('#where', (e) => e.value) === 'all',
       'background: the signature preset sets its values');
    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'ring-no-background.png' && s[0].type === 'image/png',
       'background: saves ring-no-background.png', JSON.stringify(s));
    await page.close();
  }

  // ---------------------------------------------------------- svg to png
  {
    const page = await open('svg-to-png');
    const svgFile = path.join(tmp, 'logo.svg');
    // viewBox only, a red circle on nothing, with a thin line to show sharpness
    fs.writeFileSync(svgFile, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">' +
      '<circle cx="25" cy="25" r="20" fill="#e00000"/><rect x="60" y="10" width="30" height="30" fill="#0050ff"/></svg>');
    const input = await page.$('#file');
    await input.uploadFile(svgFile);
    await wait(800);
    let img = await shown(page, '#out');
    // 100 wide is small, so it starts at 600 (100 x 6) -> 600 x 300
    ok(img && img.w === 600 && img.h === 300, 'svg: draws at the starting size', JSON.stringify(img && [img.w, img.h]));
    ok(img && img.corner[3] === 0, 'svg: see-through by default');
    const red = await pixel(page, 150, 150), blue = await pixel(page, 450, 150);
    ok(red[0] > 220 && red[3] === 255, 'svg: the circle is drawn', JSON.stringify(red));
    ok(blue[2] > 220 && blue[3] === 255, 'svg: the square is drawn', JSON.stringify(blue));

    // drawn sharp at the new size: the square's edge is a clean step, not a blur
    await page.click('#sizes [data-w="2048"]');
    await wait(800);
    img = await shown(page, '#out');
    ok(img && img.w === 2048 && img.h === 1024, 'svg: 2048 wide', JSON.stringify(img && [img.w, img.h]));
    const step = await page.evaluate(() => {
      const d = document.getElementById('out').getContext('2d');
      // the square starts at x = 60/100 * 2048 = 1228.8
      return [d.getImageData(1226, 500, 1, 1).data[3], d.getImageData(1231, 500, 1, 1).data[3]];
    });
    ok(step[0] === 0 && step[1] === 255, 'svg: edges stay sharp at a large size', JSON.stringify(step));

    await page.select('#bg-mode', 'colour');
    await page.$eval('#bg', (e) => { e.value = '#000000'; e.dispatchEvent(new Event('change')); });
    await wait(600);
    const c = await pixel(page, 2, 2);
    ok(c[3] === 255 && c[0] === 0, 'svg: a background colour fills the empty parts', JSON.stringify(c));

    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'logo-2048px.png' && s[0].type === 'image/png', 'svg: saves logo-2048px.png', JSON.stringify(s));

    // pasting code works the same
    await page.$eval('#code', (e) => {
      e.value = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#00aa00"/></svg>';
      e.dispatchEvent(new Event('input'));
    });
    await wait(800);
    img = await shown(page, '#out');
    ok(img && img.w === 520 && img.h === 520 && img.centre[1] > 150, 'svg: pasted code is drawn', JSON.stringify(img && [img.w, img.h, img.centre]));
    await page.close();
  }

  // ---------------------------------------------------------- image compare
  {
    const page = await open('image-compare');
    // "after" = the small picture with a blue square painted on it
    const afterFile = path.join(tmp, 'small-after.png');
    const adata = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.fillStyle = '#0000ff'; x.fillRect(300, 200, 40, 40);   // 1600 changed pixels
      return c.toDataURL('image/png');
    }, 'data:image/jpeg;base64,' + fs.readFileSync(small).toString('base64'));
    fs.writeFileSync(afterFile, Buffer.from(adata.split(',')[1], 'base64'));
    const beforeFile = path.join(tmp, 'small-before.png');
    // the before picture saved losslessly too, so only the square differs
    const bdata = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/png');
    }, 'data:image/jpeg;base64,' + fs.readFileSync(small).toString('base64'));
    fs.writeFileSync(beforeFile, Buffer.from(bdata.split(',')[1], 'base64'));

    await (await page.$('#file-a')).uploadFile(beforeFile);
    await wait(500);
    ok(await page.$eval('#view-panel', (e) => e.hidden), 'compare: waits for the second picture');
    await (await page.$('#file-b')).uploadFile(afterFile);
    await wait(600);
    ok(!(await page.$eval('#view-panel', (e) => e.hidden)), 'compare: shows once both are chosen');

    // slider: the after picture shows to the right of the divider only
    await page.$eval('#stage', (e) => e.scrollIntoView({ block: 'center' }));
    const sb = await (await page.$('#stage')).boundingBox();
    await page.mouse.click(sb.x + sb.width * 0.9, sb.y + sb.height / 2);
    await wait(150);
    ok(await page.$eval('#divider', (e) => e.style.left) === (Math.round(90 * 1000) / 1000) + '%' ||
       /^(89|90)\./.test(await page.$eval('#divider', (e) => e.style.left)),
       'compare: clicking moves the divider', await page.$eval('#divider', (e) => e.style.left));
    // the after picture is cut at the divider by a clip
    ok(/inset\(0(px)? 0(px)? 0(px)? (89|90)/.test(await page.$eval('#after-layer', (e) => e.style.clipPath)),
       'compare: the after picture is cut at the divider', await page.$eval('#after-layer', (e) => e.style.clipPath));

    // drag the divider to the far left: the whole after picture shows
    await page.mouse.move(sb.x + sb.width * 0.9, sb.y + sb.height / 2);
    await page.mouse.down();
    await page.mouse.move(sb.x - 50, sb.y + sb.height / 2, { steps: 4 });
    await page.mouse.up();
    ok(/^0%$/.test(await page.$eval('#divider', (e) => e.style.left)), 'compare: dragging past the edge stops at 0');

    // differences: exactly the 40 x 40 square
    await page.click('#modes [data-mode="diff"]');
    await wait(300);
    ok(/1,600 pixels differ/.test(await text(page, 'note')), 'compare: finds exactly the changed square', await text(page, 'note'));
    const dpx = await page.evaluate(() => {
      const d = document.getElementById('diff').getContext('2d');
      return [Array.from(d.getImageData(320, 220, 1, 1).data), Array.from(d.getImageData(50, 250, 1, 1).data)];
    });
    ok(dpx[0][0] > 200 && dpx[0][1] < 50, 'compare: changed pixels are red', JSON.stringify(dpx[0]));
    ok(dpx[1][0] === dpx[1][1] && dpx[1][1] === dpx[1][2], 'compare: the rest is grey', JSON.stringify(dpx[1]));

    // the same picture twice: no differences
    await (await page.$('#file-b')).uploadFile(beforeFile);
    await wait(600);
    ok(/No differences/.test(await text(page, 'note')), 'compare: identical pictures match');

    // a resized copy is stretched to match, and said so
    await (await page.$('#file-b')).uploadFile(photo);
    await wait(800);
    ok(/different sizes/.test(await text(page, 'note')), 'compare: different sizes are explained');

    await page.click('#modes [data-mode="side"]');
    await wait(200);
    ok(!(await page.$eval('#mode-side', (e) => e.hidden)) && await page.$eval('#side-b', (e) => e.width) === 400,
       'compare: side by side at the same size');
    await page.click('#swap');
    await wait(400);
    ok((await text(page, 'drop-a')).indexOf('photo.png') !== -1, 'compare: swap exchanges before and after');
    await page.close();
  }

  // ---------------------------------------------------------- screenshot beautifier
  {
    const page = await open('screenshot-beautifier');
    await give(page, small);   // 400 x 300
    let img = await shown(page, '#out');
    // u = 1; bar 34; window 400 x 334; padding 8% of 400 = 32 -> 464 x 398
    ok(img && img.w === 464 && img.h === 398, 'screenshot: padding and title bar add up', JSON.stringify(img && [img.w, img.h]));
    ok(img && img.corner[3] === 255 && img.corner[2] > 200, 'screenshot: a gradient background (blue start)', JSON.stringify(img && img.corner));
    // the three window dots: red at the first dot position
    const dot = await pixel(page, 32 + 18, 32 + 17);
    ok(dot[0] > 230 && dot[1] < 120, 'screenshot: the red window dot', JSON.stringify(dot));
    // the screenshot itself sits below the bar: its red corner
    const shot = await pixel(page, 32 + 30, 32 + 34 + 20);
    ok(shot[0] > 200 && shot[1] < 60, 'screenshot: the screenshot sits under the bar', JSON.stringify(shot));

    await page.select('#frame', 'none');
    await page.$eval('#pad', (e) => { e.value = 0; e.dispatchEvent(new Event('input')); });
    await page.$eval('#radius', (e) => { e.value = 0; e.dispatchEvent(new Event('input')); });
    await wait(150);
    img = await shown(page, '#out');
    ok(img && img.w === 400 && img.h === 300, 'screenshot: no frame and no padding is the screenshot itself',
       JSON.stringify(img && [img.w, img.h]));

    await page.select('#shape', '1.7778');
    await page.$eval('#pad', (e) => { e.value = 8; e.dispatchEvent(new Event('input')); });
    await wait(150);
    img = await shown(page, '#out');
    ok(img && Math.abs(img.w / img.h - 16 / 9) < 0.01, 'screenshot: 16:9 shape', JSON.stringify(img && [img.w, img.h]));

    await page.click('#swatches [data-i="8"]');
    await wait(150);
    img = await shown(page, '#out');
    ok(img && img.corner[0] === 17 && img.corner[1] === 17, 'screenshot: a plain dark background', JSON.stringify(img && img.corner));

    // a long title is shortened rather than running over the buttons
    await page.select('#frame', 'windows');
    await page.$eval('#title', (e) => { e.value = 'A very long window title '.repeat(10); e.dispatchEvent(new Event('input')); });
    await wait(150);
    ok((await shown(page, '#out')).w > 0, 'screenshot: a long title still draws');

    await page.click('#save');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'small-framed.png' && s[0].type === 'image/png',
       'screenshot: saves small-framed.png', JSON.stringify(s));
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
