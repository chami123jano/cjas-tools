/* Takes the screenshots shown in the README, into screenshots/.
   Run with:  node scripts/screenshots.js
   It makes its own sample PDF and video, so nothing personal is shown. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { launchEdge } = require('../test/edge');

const SRC = path.join(__dirname, '..', 'src');
const OUT = path.join(__dirname, '..', 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.json': 'application/json' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const f = path.join(SRC, decodeURIComponent(req.url.split('?')[0]));
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-shots-'));
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await launchEdge();

  async function open(file, theme) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem('cja-theme', t); } catch (e) { /* none */ } }, theme || 'light');
    await page.goto(base + file, { waitUntil: 'load' });
    await wait(400);
    return page;
  }
  async function shot(page, name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    await page.close();
    console.log('  ' + name + '.png');
  }

  // the home page, light and dark
  await shot(await open('index.html'), 'home');
  await shot(await open('index.html', 'dark'), 'home-dark');

  // Organize PDF with a sample four-page PDF
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const colours = [rgb(0.18, 0.43, 0.96), rgb(0.12, 0.62, 0.33), rgb(0.85, 0.45, 0.1), rgb(0.6, 0.25, 0.75)];
    ['Cover', 'Chapter 1', 'Chapter 2', 'Notes'].forEach((t, i) => {
      const p = doc.addPage([420, 595]);
      p.drawRectangle({ x: 0, y: 470, width: 420, height: 125, color: colours[i] });
      p.drawText(t, { x: 36, y: 515, size: 40, font, color: rgb(1, 1, 1) });
      for (let k = 0; k < 12; k++) p.drawRectangle({ x: 36, y: 420 - k * 28, width: 300 - (k % 3) * 60, height: 9, color: rgb(0.82, 0.84, 0.88) });
    });
    const file = path.join(tmp, 'report.pdf');
    fs.writeFileSync(file, await doc.save());
    const page = await open('tools/organize-pdf.html');
    await (await page.$('#file')).uploadFile(file);
    await page.waitForFunction(() => !document.getElementById('options').hidden && document.querySelectorAll('#grid canvas, #grid img').length >= 4, { timeout: 30000 });
    await wait(800);
    await shot(page, 'organize-pdf');
  }

  // Add Subtitles, with Sinhala and Tamil, in dark mode
  {
    const page = await open('tools/add-subtitles.html', 'dark');
    const b64 = await page.evaluate(() => new Promise((resolve) => {
      const c = document.createElement('canvas'); c.width = 960; c.height = 540;
      const g = c.getContext('2d');
      const rec = new MediaRecorder(c.captureStream(25), { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => new Blob(chunks).arrayBuffer().then((ab) => {
        const u = new Uint8Array(ab); let s = '';
        for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
        resolve(btoa(s));
      });
      let t = 0;
      const draw = setInterval(() => {
        const sky = g.createLinearGradient(0, 0, 0, 540);
        sky.addColorStop(0, '#ff9a5a'); sky.addColorStop(0.55, '#ffcf7a'); sky.addColorStop(0.56, '#2a6f97'); sky.addColorStop(1, '#123b55');
        g.fillStyle = sky; g.fillRect(0, 0, 960, 540);
        g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(480, 290, 70, 0, Math.PI * 2); g.fill();
        t++;
      }, 40);
      rec.start();
      setTimeout(() => { rec.stop(); clearInterval(draw); }, 3000);
    }));
    const file = path.join(tmp, 'sunset.webm');
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    await (await page.$('#file')).uploadFile(file);
    await page.waitForFunction(() => !document.getElementById('options').hidden, { timeout: 180000 });
    await page.$eval('#typed', (e) => {
      e.value = ['0:00 - 0:02.5 ශ්‍රී ලංකාවට සාදරයෙන් පිළිගනිමු | இலங்கைக்கு வரவேற்கிறோம்'].join('\n');
      e.dispatchEvent(new Event('input'));
    });
    await page.$eval('#player', (v) => new Promise((r) => { v.onseeked = r; v.currentTime = 1.2; }));
    await wait(800);
    await page.evaluate(() => { const c = document.getElementById('preview'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 230); });
    await page.screenshot({ path: path.join(OUT, 'add-subtitles.png') });
    await page.close();
    console.log('  add-subtitles.png');
  }

  // Sri Lanka PAYE tax calculator with a salary filled in
  {
    const page = await open('tools/paye-tax-calculator.html');
    await page.$eval('#salary', (e) => { e.value = '350000'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await wait(400);
    await shot(page, 'paye-tax');
  }

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
