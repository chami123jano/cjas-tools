/* Opens every tool in a real browser engine and reports anything that broke.

   The jsdom suite in run.js checks the logic, but jsdom has no layout, no
   canvas, no real event loop and no real console. This drives the copy of
   Microsoft Edge already installed on Windows - the same engine as Chrome -
   so a script error, a missing file or a page that renders nothing shows up
   here even when every logic test passes.

   Run with: node test/browser.js           (every page)
         or: node test/browser.js braille   (just the pages named)
   Screenshots of every tool land in test/screenshots/ for a visual check. */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');

const SRC = path.join(__dirname, '..', 'src');
const SHOTS = path.join(__dirname, 'screenshots');

const EDGE_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

/* A plain static server on localhost. localhost counts as a secure context,
   so crypto.subtle and the clipboard behave as they would on the https site. */
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(SRC, urlPath === '/' ? 'index.html' : urlPath);
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function slugs() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(SRC, 'assets/tools.js'), 'utf8'))(win);
  return win.TOOLS.map((t) => t.slug);
}

(async () => {
  const edge = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (!edge) {
    console.log('Microsoft Edge was not found, so the browser check cannot run.');
    process.exit(2);
  }

  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS);

  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await puppeteer.launch({
    executablePath: edge,
    headless: true,
    args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions']
  });

  /* node test/browser.js braille pig-latin  - checks only those pages. */
  const only = process.argv.slice(2);
  const list = only.length ? only : ['index'].concat(slugs());
  const report = [];

  for (const slug of list) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });

    const problems = [];

    page.on('pageerror', (err) => problems.push('script error: ' + err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        /* The browser asks for a favicon on its own; that is not the tool. */
        if (/favicon/i.test(text)) return;
        /* Failed requests are reported separately below with their URL. */
        if (/Failed to load resource/i.test(text)) return;
        problems.push('console error: ' + text);
      }
    });
    page.on('requestfailed', (req) => {
      const u = req.url();
      /* Only this site's own files count. The currency tools reach out to an
         exchange-rate service, and being offline is a case they handle. */
      if (u.indexOf(base) === 0 && !/favicon/i.test(u)) {
        problems.push('file failed to load: ' + u.replace(base, ''));
      }
    });
    page.on('response', (res) => {
      const u = res.url();
      if (u.indexOf(base) === 0 && res.status() >= 400 && !/favicon/i.test(u)) {
        problems.push('missing file (' + res.status() + '): ' + u.replace(base, ''));
      }
    });

    const url = slug === 'index' ? base + '/index.html' : base + '/tools/' + slug + '.html';

    try {
      await page.goto(url, { waitUntil: 'load', timeout: 20000 });
      /* Give the page's own start-up code a moment to run and draw. */
      await new Promise((r) => setTimeout(r, 400));

      const check = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const shell = document.querySelector('.shell');
        const header = document.querySelector('.hdr');
        const side = document.querySelector('.side');
        /* A page whose main area is nearly empty has failed to render even
           if nothing threw. */
        const main = document.querySelector('main');
        const visibleText = main ? main.innerText.trim().length : 0;
        /* Anything wider than the window means a horizontal scrollbar. */
        const overflow = document.documentElement.scrollWidth > window.innerWidth + 2;
        return {
          title: document.title,
          h1: h1 ? h1.textContent.trim() : null,
          hasShell: !!shell, hasHeader: !!header, hasSidebar: !!side,
          visibleText: visibleText, overflow: overflow
        };
      });

      if (!check.h1) problems.push('no heading on the page');
      if (!check.hasHeader) problems.push('the shared header did not appear');
      if (!check.hasSidebar) problems.push('the category sidebar did not appear');
      if (check.visibleText < 60) problems.push('the page looks empty (' + check.visibleText + ' characters)');
      if (check.overflow) problems.push('wider than the window - a sideways scrollbar');

      /* The same page at phone width, because that is where layouts break. */
      await page.setViewport({ width: 380, height: 800 });
      await new Promise((r) => setTimeout(r, 150));
      const phoneOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 2);
      if (phoneOverflow) problems.push('sideways scrollbar at phone width');

      await page.setViewport({ width: 1100, height: 900 });
      await page.screenshot({ path: path.join(SHOTS, slug + '.png'), fullPage: false });

      report.push({ slug, h1: check.h1, problems });
    } catch (e) {
      report.push({ slug, h1: null, problems: ['did not load: ' + e.message] });
    }

    await page.close();
  }

  await browser.close();
  server.close();

  const bad = report.filter((r) => r.problems.length);
  console.log('');
  bad.forEach((r) => {
    console.log('PROBLEM  ' + r.slug);
    r.problems.forEach((p) => console.log('         - ' + p));
  });
  console.log('\n' + (report.length - bad.length) + ' of ' + report.length +
    ' pages clean in a real browser, ' + bad.length + ' with problems');
  console.log('Screenshots: ' + SHOTS);
  process.exit(bad.length ? 1 : 0);
})();
