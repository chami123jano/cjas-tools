/* Feeds real PDFs to the PDF tools in Microsoft Edge and opens what they
   save, to check the pages are the right ones in the right order.

   The test PDFs are made here with pdf-lib. Page n of a test PDF is
   (200 + n) points wide, so any saved PDF can be read back as a list of
   original page numbers, just from its page widths.

   Run with: node test/pdfs.js */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const zlib = require('zlib');
const puppeteer = require('puppeteer-core');
const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');

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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(SRC, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      const t = TYPES[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': t + (t.indexOf('text') === 0 ? '; charset=utf-8' : '') });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* A test PDF of n pages, page k being (200 + k) x 400 points with its
   number written large on it. */
async function makePdf(n, file, opts = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let k = 1; k <= n; k++) {
    const page = doc.addPage([200 + k, 400]);
    page.drawText((opts.label || 'Page') + ' ' + k, { x: 20, y: 300, size: 28, font, color: rgb(0, 0, 0) });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  }
  fs.writeFileSync(file, await doc.save());
  return file;
}

/* Reads a saved PDF back as original page numbers (from the widths). */
async function pagesOf(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => Math.round(p.getWidth()) - 200);
}

/* Unpacks a stored (uncompressed) zip, as made by CJA_IMG.zip. */
function unzip(buf) {
  const files = [];
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18), nameLen = buf.readUInt16LE(i + 26), extra = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    const start = i + 30 + nameLen + extra;
    const data = buf.slice(start, start + size);
    files.push({ name, data, crcOk: zlib.crc32 ? zlib.crc32(data) === buf.readUInt32LE(i + 14) : true });
    i = start + size;
  }
  return files;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!EDGE) { console.log('Microsoft Edge was not found.'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-pdf-'));
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/tools/';
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  const errors = [];

  const ten = await makePdf(10, path.join(tmp, 'report.pdf'));
  const three = await makePdf(3, path.join(tmp, 'letter.pdf'), { label: 'Letter' });

  async function open(slug) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    page.on('pageerror', (e) => errors.push(slug + ': ' + e.message));
    page.on('console', (m) => {
      /* The browser asks for a site icon by itself; a missing one is not a fault.
         Other missing files are caught by the response check below. */
      if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push(slug + ' console: ' + m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(slug + ' missing file: ' + r.url());
    });
    await page.goto(base + slug + '.html', { waitUntil: 'load' });
    /* Saves are captured as bytes instead of downloaded. */
    await page.evaluate(() => {
      window.__saved = [];
      window.CJA_IMG.download = function (blob, name) {
        blob.arrayBuffer().then((ab) => {
          const u = new Uint8Array(ab);
          let s = '';
          for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
          window.__saved.push({ name, type: blob.type, b64: btoa(s) });
        });
      };
    });
    return page;
  }
  async function give(page, files, sel = '#file') {
    const input = await page.$(sel);
    await input.uploadFile(...[].concat(files));
    await wait(900);
  }
  async function saved(page, n = 1) {
    await page.waitForFunction((n) => window.__saved.length >= n, { timeout: 10000 }, n).catch(() => {});
    const s = await page.evaluate(() => window.__saved);
    return s.map((x) => ({ name: x.name, type: x.type, bytes: Buffer.from(x.b64, 'base64') }));
  }
  const text = (page, id) => page.$eval('#' + id, (e) => e.textContent.trim());

  // ---------------------------------------------------------- merge
  {
    const page = await open('merge-pdf');
    await give(page, [ten, three]);
    const rows = await page.$$eval('#list .file-row', (r) => r.length);
    ok(rows === 2, 'merge: both PDFs are listed', rows);
    ok(/13 pages in all/.test(await text(page, 'note')), 'merge: counts 13 pages', await text(page, 'note'));
    ok(await page.$eval('#name', (e) => e.value) === 'report-merged', 'merge: names the result after the first file');

    // thumbnails of page 1 arrive from PDF.js
    await page.waitForFunction(() => document.querySelectorAll('#list img.thumb').length === 2, { timeout: 8000 }).catch(() => {});
    ok(await page.$$eval('#list img.thumb', (t) => t.length) === 2, 'merge: a picture of each first page (PDF.js works)');

    // only some pages of the first, then move the second file up
    await page.$eval('[data-range="0"]', (e) => { e.value = '2-4, 9'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok(/7 pages in all/.test(await text(page, 'note')), 'merge: a page range changes the count', await text(page, 'note'));
    await page.$eval('[data-range="0"]', (e) => { e.value = '12'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    ok(/File 1: This PDF has 10 pages/.test(await text(page, 'note')) && await page.$eval('#merge', (b) => b.disabled),
       'merge: a page that does not exist is caught', await text(page, 'note'));
    await page.$eval('[data-range="0"]', (e) => { e.value = '2-4, 9'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('[data-up="1"]');
    await wait(200);
    await page.click('#merge');
    const s = await saved(page);
    ok(s.length === 1 && s[0].name === 'report-merged.pdf', 'merge: saves report-merged.pdf', s.map((x) => x.name).join());
    if (s[0]) {
      const got = await pagesOf(s[0].bytes);
      ok(got.join(',') === '1,2,3,2,3,4,9', 'merge: letter first, then report pages 2-4 and 9', got.join(','));
      const doc = await PDFDocument.load(s[0].bytes);
      ok(doc.getTitle() === 'report-merged', 'merge: the PDF title is set');
    }

    // a picture goes in as its own page
    await page.click('[data-remove="0"]');
    await page.evaluate(() => { window.__saved = []; });
    const jpg = path.join(tmp, 'photo.jpg');
    const data = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 600, 400);
      return c.toDataURL('image/jpeg', 0.9);
    });
    fs.writeFileSync(jpg, Buffer.from(data.split(',')[1], 'base64'));
    await give(page, jpg);
    ok(/A picture, one page/.test(await page.$eval('#list', (e) => e.textContent)), 'merge: a picture is accepted');
    await page.click('#merge');
    const s2 = await saved(page);
    if (s2[0]) {
      const doc = await PDFDocument.load(s2[0].bytes);
      const sizes = doc.getPages().map((p) => Math.round(p.getWidth()) + 'x' + Math.round(p.getHeight()));
      // report pages 2-4 and 9 (the letter was removed), then the picture
      ok(sizes.join(' ') === '202x400 203x400 204x400 209x400 600x400', 'merge: the picture is the last page, at its own size',
         sizes.join(' '));
    } else ok(false, 'merge: saving with a picture');

    // not a PDF
    const bad = path.join(tmp, 'notes.pdf');
    fs.writeFileSync(bad, 'just some text');
    await give(page, bad);
    ok(await page.$$eval('#list .file-row', (r) => r.length) === 2, 'merge: a fake PDF is refused');
    await page.close();
  }

  // ---------------------------------------------------------- split
  {
    const page = await open('split-pdf');
    await give(page, ten);
    ok(!(await page.$eval('#options', (e) => e.hidden)), 'split: options appear');
    ok(await page.$$eval('#grid .page-tile', (t) => t.length) === 10, 'split: ten pages shown');
    await page.waitForFunction(() => document.querySelectorAll('#grid canvas').length === 10 &&
      [...document.querySelectorAll('#grid canvas')].every((c) => c.width > 10), { timeout: 15000 }).catch(() => {});
    ok(await page.$$eval('#grid canvas', (cs) => cs.filter((c) => c.width > 10).length) === 10, 'split: every page is drawn');

    // a drawn page really shows its number: the text area is not blank
    const inked = await page.evaluate(() => {
      const c = document.querySelector('#grid canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 100) dark++;
      return dark;
    });
    ok(inked > 50, 'split: page pictures have the text on them', inked);

    // extract by typing
    await page.type('#pages', '1-3, 8');
    await wait(150);
    ok(/One new PDF with 4 pages \(1-3, 8\)/.test(await text(page, 'plan')), 'split: plan for extracting', await text(page, 'plan'));
    ok(await page.$$eval('#grid .page-tile.on', (t) => t.length) === 4, 'split: chosen pages are highlighted');
    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'report-extract.pdf', 'split: saves report-extract.pdf', s[0] && s[0].name);
    if (s[0]) ok((await pagesOf(s[0].bytes)).join() === '1,2,3,8', 'split: the extract has pages 1, 2, 3, 8');

    // clicking a page adds it
    await page.click('#grid [data-p="9"]');
    ok(await page.$eval('#pages', (e) => e.value) === '1-3, 8, 10', 'split: clicking page 10 adds it', await page.$eval('#pages', (e) => e.value));
    await page.click('#grid [data-p="0"]');
    ok(await page.$eval('#pages', (e) => e.value) === '2-3, 8, 10', 'split: clicking again takes it out');

    // errors
    await page.$eval('#pages', (e) => { e.value = '5-3'; e.dispatchEvent(new Event('input')); });
    ok(/runs backwards/.test(await text(page, 'plan')) && await page.$eval('#go', (b) => b.disabled), 'split: a backwards range is explained');

    // every 3 pages -> 4 files in a zip
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'every');
    await page.$eval('#every', (e) => { e.value = 3; e.dispatchEvent(new Event('input')); });
    await wait(100);
    ok(/4 new PDFs/.test(await text(page, 'plan')), 'split: every 3 pages makes 4 PDFs', await text(page, 'plan'));
    await page.click('#go');
    s = await saved(page);
    ok(s[0] && s[0].name === 'report-split.zip', 'split: saves a zip', s[0] && s[0].name);
    if (s[0]) {
      const files = unzip(s[0].bytes);
      ok(files.length === 4 && files.every((f) => f.crcOk), 'split: four files, checksums right', files.map((f) => f.name).join());
      const got = [];
      for (const f of files) got.push((await pagesOf(f.data)).join('-'));
      ok(got.join(' ') === '1-2-3 4-5-6 7-8-9 10', 'split: grouped in threes', got.join(' '));
      ok(files[3].name === 'report-page-10.pdf' && files[0].name === 'report-pages-1-3.pdf', 'split: files are named by their pages',
         files.map((f) => f.name).join());
    }

    // one per group typed
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'ranges');
    await page.$eval('#pages', (e) => { e.value = '1-2, 5, 9-'; e.dispatchEvent(new Event('input')); });
    await page.click('#go');
    s = await saved(page);
    if (s[0]) {
      const files = unzip(s[0].bytes);
      const got = [];
      for (const f of files) got.push((await pagesOf(f.data)).join('-'));
      ok(got.join(' ') === '1-2 5 9-10', 'split: one PDF per typed group', got.join(' '));
    } else ok(false, 'split: groups saved');

    await page.close();
  }

  // ---------------------------------------------------------- images to pdf
  {
    const page = await open('images-to-pdf');
    // a landscape photo, and a landscape JPG marked "rotate 90" (EXIF 6) like a phone photo
    const mk = (w, h, colour) => page.evaluate((w, h, colour) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = colour; x.fillRect(0, 0, w, h);
      x.fillStyle = '#000'; x.fillRect(0, 0, w / 4, h / 4);
      return c.toDataURL('image/jpeg', 0.9);
    }, w, h, colour);
    const wide = path.join(tmp, 'wide.jpg');
    fs.writeFileSync(wide, Buffer.from((await mk(800, 600, '#3a7')).split(',')[1], 'base64'));
    /* An EXIF block saying "turn 90 degrees clockwise", put right after
       the JPG's start marker. */
    const plain = Buffer.from((await mk(800, 600, '#37a')).split(',')[1], 'base64');
    const tiff = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 255]), exif]);
    const turned = path.join(tmp, 'phone.jpg');
    fs.writeFileSync(turned, Buffer.concat([plain.slice(0, 2), app1, plain.slice(2)]));
    const png = path.join(tmp, 'diagram.png');
    fs.writeFileSync(png, Buffer.from((await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 500;
      c.getContext('2d').fillRect(10, 10, 100, 100);
      return c.toDataURL('image/png');
    })).split(',')[1], 'base64'));

    await give(page, [wide, turned, png]);
    const list = await page.$eval('#list', (e) => e.textContent);
    ok(/1\. wide\.jpg/.test(list) && /3\. diagram\.png/.test(list), 'images: listed in order');
    ok(/600 × 800[^·]*·[^·]*· turned upright/.test(list), 'images: the phone photo is turned upright (now 600 x 800)', list);
    ok(await page.evaluate(() => window.CJA_PDF.jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))) === 1,
       'images: no EXIF means upright');

    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'pictures.pdf', 'images: saves pictures.pdf');
    if (s[0]) {
      const doc = await PDFDocument.load(s[0].bytes);
      const sizes = doc.getPages().map((p) => Math.round(p.getWidth()) + 'x' + Math.round(p.getHeight()));
      ok(sizes.join(' ') === '842x595 595x842 595x842', 'images: A4 sideways for the wide photo, upright for the others', sizes.join(' '));
    }

    // own size, and the order changed
    await page.evaluate(() => { window.__saved = []; });
    await page.click('[data-down="0"]');
    await page.select('#size', 'fit');
    ok(await page.$eval('[data-paper]', (e) => e.hidden), 'images: paper settings hide for "own size"');
    await page.click('#go');
    s = await saved(page);
    if (s[0]) {
      const doc = await PDFDocument.load(s[0].bytes);
      const sizes = doc.getPages().map((p) => Math.round(p.getWidth()) + 'x' + Math.round(p.getHeight()));
      // 150 dpi: 600 px = 288 pt, 800 px = 384 pt
      ok(sizes.join(' ') === '288x384 384x288 144x240', 'images: own sizes at 150 dpi, in the new order', sizes.join(' '));
    }

    // PNG and plain JPG are put in untouched: the JPG's bytes are inside the PDF as they were
    if (s[0]) ok(s[0].bytes.indexOf(fs.readFileSync(wide)) !== -1, 'images: a JPG goes in without being re-saved');
    await page.close();
  }

  // ---------------------------------------------------------- pdf to images
  {
    const page = await open('pdf-to-images');
    await give(page, ten);
    ok(!(await page.$eval('#options', (e) => e.hidden)), 'to images: options appear');
    // page 1 is 201 x 400 points; at 150 dpi that is 419 x 833 pixels
    ok(/10 pictures, the first 419 × 833 pixels, saved together in a \.zip/.test(await text(page, 'plan')),
       'to images: plan with the size at 150 dpi', await text(page, 'plan'));
    await page.$eval('#pages', (e) => { e.value = '3'; e.dispatchEvent(new Event('input')); });
    await page.select('#format', 'image/png');
    await page.select('#dpi', '72');
    ok(/1 picture, the first 203 × 400 pixels\./.test(await text(page, 'plan')), 'to images: one page at 72 dpi', await text(page, 'plan'));
    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'report-page-03.png', 'to images: one page saves as a PNG', s[0] && s[0].name);
    if (s[0]) {
      const b = s[0].bytes;
      ok(b.slice(1, 4).toString() === 'PNG' && b.readUInt32BE(16) === 203 && b.readUInt32BE(20) === 400,
         'to images: a real 203 x 400 PNG', b.readUInt32BE(16) + 'x' + b.readUInt32BE(20));
    }

    // several pages as JPG in a zip
    await page.evaluate(() => { window.__saved = []; });
    await page.$eval('#pages', (e) => { e.value = '1, 10'; e.dispatchEvent(new Event('input')); });
    await page.select('#format', 'image/jpeg');
    await page.select('#dpi', '300');
    await page.click('#go');
    s = await saved(page);
    ok(s[0] && s[0].name === 'report-pages.zip', 'to images: several pages come in a zip');
    if (s[0]) {
      const files = unzip(s[0].bytes);
      ok(files.map((f) => f.name).join() === 'report-page-01.jpg,report-page-10.jpg', 'to images: numbered files', files.map((f) => f.name).join());
      // a JPG's size is in its SOF marker
      const jpgSize = (b) => {
        let i = 2;
        while (i < b.length) {
          const m = b[i + 1], len = b.readUInt16BE(i + 2);
          if (m >= 0xc0 && m <= 0xc2) return b.readUInt16BE(i + 7) + 'x' + b.readUInt16BE(i + 5);
          i += 2 + len;
        }
        return '?';
      };
      // page 10 is 210 x 400 pt: at 300 dpi 875 x 1667
      ok(files[1] && jpgSize(files[1].data) === '875x1667', 'to images: 300 dpi size is right', files[1] && jpgSize(files[1].data));
    }

    // clicking tiles picks pages
    await page.$eval('#pages', (e) => { e.value = ''; e.dispatchEvent(new Event('input')); });
    await page.click('#grid [data-p="4"]');
    ok(await page.$eval('#pages', (e) => e.value) === '5', 'to images: clicking a page picks it');

    // a restricted (no password to open) PDF still works here, through PDF.js
    await give(page, path.join(__dirname, 'fixtures', 'locked-restricted.pdf'));
    ok(/2 page/.test(await text(page, 'drop')), 'to images: a protected PDF that opens freely can still be pictured', await text(page, 'drop'));
    await give(page, path.join(__dirname, 'fixtures', 'locked-password.pdf'));
    const toast = await page.$eval('.toast', (e) => e.textContent).catch(() => '');
    ok(/needs a password/.test(toast), 'to images: a password PDF is explained', toast);
    await page.close();
  }

  // ---------------------------------------------------------- rotate
  {
    const page = await open('rotate-pdf');
    // page 2 of this one is already turned 90, to check turns add up
    const pre = path.join(tmp, 'turned.pdf');
    {
      const doc = await PDFDocument.create();
      for (let k = 1; k <= 4; k++) { const p = doc.addPage([200 + k, 400]); if (k === 2) p.setRotation(degrees(90)); }
      fs.writeFileSync(pre, await doc.save());
    }
    await give(page, pre);
    ok(/No pages turned yet/.test(await text(page, 'plan')), 'rotate: starts with nothing turned');
    await page.click('#grid [data-p="0"]');
    await page.click('#grid [data-p="1"]');
    await page.click('#grid [data-p="1"]');
    ok(/2 pages turned/.test(await text(page, 'plan')), 'rotate: clicks turn pages', await text(page, 'plan'));
    ok(await page.$eval('[data-p="1"] .turn', (e) => e.textContent) === 'upside down', 'rotate: two clicks is upside down');
    ok(await page.$eval('[data-p="0"]', (e) => e.style.getPropertyValue('--turn')) === '90deg', 'rotate: the picture turns too');
    await page.$eval('#pages', (e) => { e.value = '4'; });
    await page.click('#turn-these');
    await page.click('#all [data-all="-90"]');
    // now: p1 0, p2 90, p3 270, p4 0 (extra turns)
    await page.click('#save');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'turned-rotated.pdf', 'rotate: saves turned-rotated.pdf');
    if (s[0]) {
      const doc = await PDFDocument.load(s[0].bytes);
      const angles = doc.getPages().map((p) => p.getRotation().angle);
      // page 2 had 90 already; +90 = 180
      ok(angles.join() === '0,180,270,0', 'rotate: turns are added to existing ones', angles.join());
      ok((await pagesOf(s[0].bytes)).join() === '1,2,3,4', 'rotate: page order unchanged');
    }
    await page.click('#reset');
    ok(/No pages turned yet/.test(await text(page, 'plan')), 'rotate: undo all');
    // a picture that arrives after a turn is turned too (style is on the tile)
    ok(await page.$$eval('#grid .pic canvas', (cs) => cs.length) === 4, 'rotate: every page has its picture');
    await page.close();
  }

  // ---------------------------------------------------------- remove pages
  {
    const page = await open('remove-pages');
    // pages 3 and 6 are blank; the rest have text
    const withBlanks = path.join(tmp, 'scan.pdf');
    {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let k = 1; k <= 6; k++) {
        const p = doc.addPage([200 + k, 400]);
        if (k !== 3 && k !== 6) {
          for (let l = 0; l < 12; l++) p.drawText('Some words on page ' + k, { x: 15, y: 360 - l * 26, size: 14, font });
        }
      }
      fs.writeFileSync(withBlanks, await doc.save());
    }
    await give(page, withBlanks);
    ok(/No pages picked/.test(await text(page, 'plan')) && await page.$eval('#save', (b) => b.disabled), 'remove: nothing picked at first');
    await page.click('#quick [data-q="blank"]');
    await page.waitForFunction(() => document.getElementById('pages').value !== '', { timeout: 10000 }).catch(() => {});
    ok(await page.$eval('#pages', (e) => e.value) === '3, 6', 'remove: finds the two blank pages', await page.$eval('#pages', (e) => e.value));
    await page.click('#grid [data-p="0"]');
    ok(await page.$eval('#pages', (e) => e.value) === '1, 3, 6', 'remove: clicking adds a page');
    ok(await page.$$eval('#grid .page-tile.gone', (t) => t.length) === 3, 'remove: removed pages are crossed out');
    ok(/Removing 3 pages \(1, 3, 6\)\. 3 pages will be left/.test(await text(page, 'plan')), 'remove: says what is left', await text(page, 'plan'));
    await page.click('#save');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'scan-edited.pdf', 'remove: saves scan-edited.pdf');
    if (s[0]) ok((await pagesOf(s[0].bytes)).join() === '2,4,5', 'remove: pages 1, 3 and 6 are gone', (await pagesOf(s[0].bytes)).join());

    await page.$eval('#pages', (e) => { e.value = '1-6'; e.dispatchEvent(new Event('input')); });
    ok(/needs at least one/.test(await text(page, 'plan')) && await page.$eval('#save', (b) => b.disabled), 'remove: cannot remove every page');
    await page.click('#quick [data-q="even"]');
    ok(await page.$eval('#pages', (e) => e.value) === '2, 4, 6', 'remove: even pages');
    await page.close();
  }

  // ---------------------------------------------------------- protected PDFs
  {
    const page = await open('split-pdf');
    for (const f of ['locked-password.pdf', 'locked-restricted.pdf']) {
      await give(page, path.join(__dirname, 'fixtures', f));
      const toast = await page.$eval('.toast', (e) => e.textContent).catch(() => '');
      ok(/protected/.test(toast) && /Microsoft Print to PDF/.test(toast), 'protected: ' + f + ' gets clear steps', toast);
      ok(await page.$eval('#options', (e) => e.hidden), 'protected: ' + f + ' is not opened for splitting');
    }
    await page.close();
  }

  // ---------------------------------------------------------- page ranges, in the browser
  {
    const page = await open('split-pdf');
    const r = await page.evaluate(() => {
      const P = window.CJA_PDF;
      return [P.parseRanges('1 - 3, 5', 10), P.parseRanges('odd', 5), P.parseRanges('8 to', 10), P.parseRanges('0', 10)];
    });
    ok(r[0].pages.join() === '0,1,2,4' && r[1].pages.join() === '0,2,4' && r[2].pages.join() === '7,8,9' && /start at 1/.test(r[3].error),
       'ranges: spaces, odd, "8 to" and 0 handled', JSON.stringify(r));
    await page.close();
  }

  ok(errors.length === 0, 'no script errors in any PDF tool', errors.join('\n      '));

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('');
  failures.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed (PDFs, in a real browser)');
  process.exit(fail ? 1 : 0);
})();
