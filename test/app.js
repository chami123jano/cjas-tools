/* Checks the built desktop app itself, not just the pages in a browser.

   The app runs pages inside WebView2, from its own built-in server, so
   things like background workers and WebAssembly (used to draw PDFs) can
   behave differently than on the website. This starts the built .exe with
   a debugging port, drives the PDF tools inside it, and closes it again.

   Run after "npx tauri build" with: node test/app.js [path-to-exe]

   Only the process this script starts is closed, by its own process
   number - never by name, so no other program is touched. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const { PDFDocument } = require('pdf-lib');

const EXE = process.argv[2] || path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'app.exe');
const PORT = 9333;

let pass = 0, fail = 0;
const failures = [];
function ok(cond, label, detail) {
  if (cond) pass++;
  else { fail++; failures.push(label + (detail ? '\n      ' + detail : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function portOpen() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:' + PORT + '/json/version', (res) => { res.resume(); resolve(true); })
      .on('error', () => resolve(false));
  });
}

(async () => {
  if (!fs.existsSync(EXE)) { console.log('Build the app first: ' + EXE + ' was not found.'); process.exit(2); }
  if (await portOpen()) { console.log('Something is already using port ' + PORT + '; not starting.'); process.exit(2); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-app-'));
  const pdf = path.join(tmp, 'four.pdf');
  const doc = await PDFDocument.create();
  for (let k = 1; k <= 4; k++) doc.addPage([200 + k, 400]);
  fs.writeFileSync(pdf, await doc.save());

  const app = spawn(EXE, [], {
    env: Object.assign({}, process.env, { WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=' + PORT }),
    stdio: 'ignore'
  });
  let browser = null;
  try {
    for (let i = 0; i < 40 && !(await portOpen()); i++) await wait(250);
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
    const page = (await browser.pages())[0];
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const root = page.url().replace(/[^/]*$/, '');
    ok(/Cja/.test(await page.title()), 'app: the home page opens', await page.title());

    const capture = () => page.evaluate(() => {
      window.__saved = null;
      window.CJA_IMG.download = (blob, name) => { window.__saved = name + ' ' + blob.size; };
    });

    await page.goto(root + 'tools/split-pdf.html');
    await (await page.$('#file')).uploadFile(pdf);
    const drawn = await page.waitForFunction(() =>
      [...document.querySelectorAll('#grid canvas')].filter((c) => c.width > 10).length === 4, { timeout: 15000 })
      .then(() => true, () => false);
    ok(drawn, 'app: PDF.js draws PDF pages inside the app');
    await capture();
    await page.type('#pages', '2-3');
    await page.click('#go');
    await page.waitForFunction(() => window.__saved, { timeout: 8000 }).catch(() => {});
    ok(/^four-extract\.pdf \d+/.test(await page.evaluate(() => window.__saved || '')), 'app: split saves a PDF');

    await page.goto(root + 'tools/pdf-to-images.html');
    await (await page.$('#file')).uploadFile(pdf);
    await page.waitForFunction(() => !document.getElementById('options').hidden, { timeout: 8000 }).catch(() => {});
    await capture();
    await page.$eval('#pages', (e) => { e.value = '1'; e.dispatchEvent(new Event('input')); });
    await page.click('#go');
    await page.waitForFunction(() => window.__saved, { timeout: 8000 }).catch(() => {});
    ok(/^four-page-01\.jpg \d+/.test(await page.evaluate(() => window.__saved || '')), 'app: pages become pictures');

    await page.goto(root + 'tools/image-compress.html');
    ok(!!(await page.$('#drop')), 'app: an image tool opens');

    ok(errors.length === 0, 'app: no script errors', errors.join(' | '));
  } catch (e) {
    ok(false, 'app: could not drive the app', e.message);
  } finally {
    if (browser) browser.disconnect();
    /* Closes exactly the app this script started. */
    try { process.kill(app.pid); } catch (e) { /* already closed */ }
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log('');
  failures.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed (inside the desktop app)');
  process.exit(fail ? 1 : 0);
})();
