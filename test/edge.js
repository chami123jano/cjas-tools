/* Starts the installed Microsoft Edge for the browser tests and connects
   to it.

   puppeteer's own launcher passes a long list of settings, and after an
   Edge update in November 2026 one of them made Edge quit at once. Starting
   Edge here with a short list of settings, then connecting, avoids that and
   keeps working whatever puppeteer adds in future.

   Only the Edge started here is closed afterwards, by its own process
   number - never by name, so the user's own browser windows are untouched. */

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const ROOTS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application',
  'C:/Program Files/Microsoft/Edge/Application'
];

function findEdge() {
  for (const root of ROOTS) {
    const exe = path.join(root, 'msedge.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function answering(port) {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:' + port + '/json/version', (res) => { res.resume(); resolve(true); })
      .on('error', () => resolve(false));
  });
}

async function launchEdge(opts = {}) {
  const exe = findEdge();
  if (!exe) throw new Error('Microsoft Edge was not found.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-edge-'));
  const port = await freePort();
  const proc = spawn(exe, [
    opts.headless === false ? '--new-window' : '--headless=new',
    '--user-data-dir=' + dir,
    '--remote-debugging-port=' + port,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--mute-audio',
    /* Tests open several pages at once; without these, Edge slows down the
       ones that are not in front and timings go wrong. */
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--disable-ipc-flooding-protection'
  ].concat(opts.args || [], ['about:blank']), { stdio: 'ignore' });

  for (let i = 0; i < 80 && !(await answering(port)); i++) await new Promise((r) => setTimeout(r, 150));
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + port, defaultViewport: null });

  const close = browser.close.bind(browser);
  browser.close = async () => {
    try { await close(); } catch (e) { /* already closed */ }
    try { process.kill(proc.pid); } catch (e) { /* already gone */ }
    setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* still in use */ } }, 1500);
  };
  return browser;
}

module.exports = { launchEdge, findEdge };
