/* Feeds real sound to the audio tools in Microsoft Edge and reads back
   the WAV files they save, sample by sample.

   The recorder is tested with Edge's built-in fake microphone (a steady
   tone), so no real microphone is used or needed.

   Run with: node test/audio.js */

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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' };
function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(SRC, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(SRC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      const t = TYPES[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': t + (t.indexOf('text') === 0 ? '; charset=utf-8' : '') });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* A stereo WAV: `seconds` of a 440 Hz tone at amplitude `amp`; the right
   channel is silent for the first second so the file has a known shape. */
function makeWav(file, seconds, amp) {
  const rate = 44100, n = Math.round(seconds * rate);
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * amp * 32767);
    buf.writeInt16LE(s, 44 + i * 4);
    buf.writeInt16LE(i < rate ? 0 : s, 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
  return file;
}

/* Reads a 16-bit WAV: channels, rate, seconds and the loudest sample (0-1). */
function readWav(b) {
  if (b.slice(0, 4).toString() !== 'RIFF' || b.slice(8, 12).toString() !== 'WAVE') return null;
  const ch = b.readUInt16LE(22), rate = b.readUInt32LE(24), size = b.readUInt32LE(40);
  const frames = size / (2 * ch);
  let peak = 0;
  for (let i = 44; i < 44 + size; i += 2) peak = Math.max(peak, Math.abs(b.readInt16LE(i)) / 32768);
  const sample = (frame, c) => b.readInt16LE(44 + (frame * ch + c) * 2) / 32768;
  return { ch, rate, seconds: frames / rate, peak, sample, frames };
}

(async () => {
  if (!EDGE) { console.log('Microsoft Edge was not found.'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-audio-'));
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/tools/';
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
  });
  const errors = [];

  async function open(slug) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    page.on('pageerror', (e) => errors.push(slug + ': ' + e.message));
    await page.goto(base + slug + '.html', { waitUntil: 'load' });
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
  async function give(page, file) {
    await (await page.$('#file')).uploadFile(file);
    await page.waitForFunction(() => !/Opening/.test(document.getElementById('drop').textContent), { timeout: 10000 }).catch(() => {});
    await wait(400);
  }
  async function saved(page, n = 1) {
    await page.waitForFunction((n) => window.__saved.length >= n, { timeout: 10000 }, n).catch(() => {});
    const s = await page.evaluate(() => window.__saved);
    return s.map((x) => ({ name: x.name, type: x.type, bytes: Buffer.from(x.b64, 'base64') }));
  }
  const text = (page, id) => page.$eval('#' + id, (e) => e.textContent.trim());
  const setVal = (page, id, v) => page.$eval('#' + id, (e, v) => { e.value = v; e.dispatchEvent(new Event('change')); e.dispatchEvent(new Event('input')); }, v);

  const tone = makeWav(path.join(tmp, 'tone.wav'), 6, 0.25);

  // ---------------------------------------------------------- cutter
  {
    const page = await open('audio-cutter');
    await give(page, tone);
    ok(/0:06 long, stereo/.test(await text(page, 'drop')), 'cutter: reads the file', await text(page, 'drop'));
    ok(await page.$eval('#canvas', (c) => c.width) > 100, 'cutter: draws the waveform');
    ok(/6\.0 long/.test(await text(page, 'plan')), 'cutter: starts with the whole thing', await text(page, 'plan'));

    await setVal(page, 'from', '0:01.5');
    await setVal(page, 'to', '0:04');
    ok(/0:02\.5 long/.test(await text(page, 'plan')), 'cutter: typed times choose 2.5 seconds', await text(page, 'plan'));
    await page.click('#save');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'tone-cut.wav', 'cutter: saves tone-cut.wav');
    let w = s[0] && readWav(s[0].bytes);
    /* The browser opens sound at the computer's own rate (often 48000 a
       second); either rate is full quality. */
    ok(w && Math.abs(w.seconds - 2.5) < 0.01 && w.ch === 2 && (w.rate === 44100 || w.rate === 48000),
       'cutter: a 2.5 second stereo WAV', JSON.stringify(w && [w.seconds, w.ch, w.rate]));
    ok(w && Math.abs(w.peak - 0.25) < 0.01, 'cutter: the sound is unchanged in volume', w && w.peak);

    // cut a part out instead, with fades
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'remove');
    await setVal(page, 'fadein', '1');
    await setVal(page, 'fadeout', '1');
    ok(/0:03\.5 long/.test(await text(page, 'plan')), 'cutter: removing the part leaves 3.5 seconds', await text(page, 'plan'));
    await page.click('#save');
    s = await saved(page);
    w = s[0] && readWav(s[0].bytes);
    ok(w && Math.abs(w.seconds - 3.5) < 0.01, 'cutter: the saved file is 3.5 seconds', w && w.seconds);
    if (w) {
      ok(Math.abs(w.sample(0, 0)) < 0.001 && Math.abs(w.sample(w.frames - 1, 0)) < 0.01, 'cutter: fades start and end in silence');
      // the middle (after the fade) is full volume again
      let mid = 0;
      for (let f = Math.round(w.frames / 2); f < w.frames / 2 + 200; f++) mid = Math.max(mid, Math.abs(w.sample(f, 0)));
      ok(mid > 0.24, 'cutter: full volume between the fades', mid);
    }

    // dragging on the waveform chooses a part
    await page.select('#mode', 'keep');
    const wb = await (await page.$('#wave')).boundingBox();
    await page.mouse.move(wb.x + wb.width * 0.5, wb.y + 50);
    await page.mouse.down();
    await page.mouse.move(wb.x + wb.width * 0.75, wb.y + 50, { steps: 5 });
    await page.mouse.up();
    ok(/^0:03\.0$/.test(await page.$eval('#from', (e) => e.value)) && /^0:04\.5$/.test(await page.$eval('#to', (e) => e.value)),
       'cutter: dragging from half to three quarters chooses 3.0 to 4.5',
       await page.$eval('#from', (e) => e.value) + ' - ' + await page.$eval('#to', (e) => e.value));

    // not a sound file
    const bad = path.join(tmp, 'notes.mp3');
    fs.writeFileSync(bad, 'not really sound');
    await give(page, bad);
    const toast = await page.$eval('.toast', (e) => e.textContent).catch(() => '');
    ok(/could not be opened as sound/.test(toast), 'cutter: a broken file is explained', toast);
    await page.close();
  }

  // ---------------------------------------------------------- volume
  {
    const page = await open('audio-volume');
    await give(page, tone);
    ok(await text(page, 's-now') === '-12.0 dB', 'volume: a 0.25 tone peaks at -12 dB', await text(page, 's-now'));
    await page.click('#loudest');
    ok(await page.$eval('#gain', (e) => e.value) === '11', 'volume: as loud as it can go is +11 dB (to -1 dB)', await page.$eval('#gain', (e) => e.value));
    ok(!/Too loud/.test(await text(page, 'warn')), 'volume: and does not warn');
    await page.click('#save');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'tone-louder.wav', 'volume: saves tone-louder.wav');
    let w = s[0] && readWav(s[0].bytes);
    ok(w && w.peak > 0.85 && w.peak < 0.9, 'volume: the loudest point is now just under -1 dB (0.89)', w && w.peak);

    await page.$eval('#gain', (e) => { e.value = 20; e.dispatchEvent(new Event('input')); });
    ok(/Too loud/.test(await text(page, 'warn')), 'volume: +20 dB warns about crackling');
    await page.evaluate(() => { window.__saved = []; });
    await page.$eval('#gain', (e) => { e.value = -6; e.dispatchEvent(new Event('input')); });
    await page.click('#save');
    s = await saved(page);
    w = s[0] && readWav(s[0].bytes);
    ok(s[0] && s[0].name === 'tone-quieter.wav' && w && Math.abs(w.peak - 0.125) < 0.005, 'volume: -6 dB halves it', w && w.peak);
    await page.close();
  }

  // ---------------------------------------------------------- recorder (fake microphone)
  {
    const page = await open('voice-recorder');
    await page.click('#rec');
    await wait(2200);
    ok(/Recording/.test(await text(page, 'state')), 'recorder: records', await text(page, 'state'));
    ok(/^0:0[12]$/.test(await text(page, 'clock')), 'recorder: the clock runs', await text(page, 'clock'));
    const level = await page.$eval('#level', (e) => parseFloat(e.style.width));
    ok(level > 1, 'recorder: the level meter moves', level);
    await page.click('#pause');
    ok(/Paused/.test(await text(page, 'state')), 'recorder: pauses');
    await wait(1000);
    await page.click('#pause');
    await wait(800);
    await page.click('#stop');
    await page.waitForFunction(() => document.querySelectorAll('.take').length === 1, { timeout: 8000 }).catch(() => {});
    ok(await page.$$eval('.take', (t) => t.length) === 1, 'recorder: the recording is listed');
    const len = await page.$eval('.take span', (e) => e.textContent);
    ok(len === '0:02' || len === '0:03', 'recorder: about 3 seconds, the pause not counted', len);
    await page.click('.take [data-act="wav"]');
    const s = await saved(page);
    ok(s[0] && s[0].name === 'recording-1.wav', 'recorder: saves recording-1.wav');
    const w = s[0] && readWav(s[0].bytes);
    ok(w && w.seconds > 2 && w.seconds < 4 && w.peak > 0.01, 'recorder: a real WAV with sound in it', JSON.stringify(w && [w.seconds, w.peak]));
    await page.evaluate(() => { window.__saved = []; });
    await page.click('.take [data-act="small"]');
    const s2 = await saved(page);
    ok(s2[0] && /^recording-1\.(webm|ogg|m4a)$/.test(s2[0].name) && s2[0].bytes.length < s[0].bytes.length / 3,
       'recorder: the small version is much smaller', s2[0] && s2[0].name + ' ' + s2[0].bytes.length);
    await page.close();
  }

  ok(errors.length === 0, 'no script errors in any audio tool', errors.join('\n      '));
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('');
  failures.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed (audio, in a real browser)');
  process.exit(fail ? 1 : 0);
})();
