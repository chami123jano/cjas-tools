/* Runs the video tools in Microsoft Edge on real video files and checks
   what they save, by opening the results in the browser itself.

   The test video is made in the browser: a moving picture with a tone,
   recorded to WebM. The engine is loaded from the CDN as the website does,
   and once with the CDN blocked, to prove the fallback copy works.

   Run with: node test/video.js     (needs the internet for the CDN part) */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { launchEdge } = require('./edge');

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

(async () => {
  if (!EDGE) { console.log('Microsoft Edge was not found.'); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cja-video-'));
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/tools/';
  const browser = await launchEdge({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];

  async function open(slug, opts = {}) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    page.on('pageerror', (e) => errors.push(slug + ': ' + e.message));
    if (opts.blockCdn) {
      await page.setRequestInterception(true);
      page.on('request', (r) => (r.url().indexOf('cdn.jsdelivr.net') !== -1 ? r.abort() : r.continue()));
    }
    page.cdnHits = 0;
    page.localHits = 0;
    page.on('response', (r) => {
      if (/ffmpeg-core\.wasm/.test(r.url())) { if (/jsdelivr/.test(r.url())) page.cdnHits++; else page.localHits++; }
    });
    await page.goto(base + slug + '.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      window.__saved = [];
      window.CJA_IMG = window.CJA_IMG || {};
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
  async function saved(page, n = 1, timeout = 120000) {
    await page.waitForFunction((n) => window.__saved.length >= n, { timeout }, n).catch(() => {});
    const s = await page.evaluate(() => window.__saved);
    return s.map((x) => ({ name: x.name, type: x.type, b64: x.b64, bytes: Buffer.from(x.b64, 'base64') }));
  }
  const text = (page, id) => page.$eval('#' + id, (e) => e.textContent.trim());

  /* Opens saved media in the browser: length, picture size, and whether
     it plays as video or audio. */
  async function mediaInfo(page, b64, type) {
    return page.evaluate((b64, type) => new Promise((resolve) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u], { type }));
      const el = document.createElement(type.indexOf('video') === 0 ? 'video' : 'audio');
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        /* Some files only know their length after seeking to the end. */
        const done = () => resolve({ duration: el.duration, width: el.videoWidth || 0, height: el.videoHeight || 0 });
        if (isFinite(el.duration)) done();
        else { el.currentTime = 1e6; el.ontimeupdate = () => { el.ontimeupdate = null; done(); }; }
      };
      el.onerror = () => resolve({ error: el.error && el.error.code });
      el.src = url;
    }), b64, type);
  }

  /* A test video made in the browser: a moving box, a seconds counter and
     a 440 Hz tone, recorded to WebM. */
  async function makeClip(file, w, h, secs) {
    const maker = await browser.newPage();
    await maker.goto(base + 'video-to-mp3.html');
    const b64 = await maker.evaluate((w, h, secs) => new Promise((resolve) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      const ac = new AudioContext();
      const osc = ac.createOscillator(); osc.frequency.value = 440;
      const gain = ac.createGain(); gain.gain.value = 0.3;
      const dest = ac.createMediaStreamDestination();
      osc.connect(gain).connect(dest); osc.start();
      const stream = new MediaStream([...c.captureStream(25).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => new Blob(chunks).arrayBuffer().then((ab) => {
        const u = new Uint8Array(ab); let s = '';
        for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
        resolve(btoa(s));
      });
      let t = 0;
      const draw = setInterval(() => {
        g.fillStyle = '#123'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#f80'; g.fillRect((t * 8) % (w - 60), h / 2 - 30, 60, 60);
        g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText(String(Math.floor(t / 25)), 20, 50);
        t++;
      }, 40);
      rec.start();
      setTimeout(() => { rec.stop(); clearInterval(draw); }, secs * 1000);
    }), w, h, secs);
    await maker.close();
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    return file;
  }
  const clip = await makeClip(path.join(tmp, 'holiday.webm'), 640, 360, 4);

  // ---------------------------------------------------------- video to mp3 (engine from the CDN)
  {
    const page = await open('video-to-mp3');
    await (await page.$('#file')).uploadFile(clip);
    await page.waitForFunction(() => !document.getElementById('options').hidden || /could not/.test(document.getElementById('info').textContent),
      { timeout: 180000 }).catch(() => {});
    const info = await text(page, 'info');
    ok(/A video, 640 × 360, 0:0[34] long/.test(info), 'to mp3: reads the video (engine from the CDN)', info);
    ok(page.cdnHits >= 1 && page.localHits === 0, 'to mp3: the website takes the engine from the CDN', page.cdnHits + ' / ' + page.localHits);
    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'holiday.mp3', 'to mp3: saves holiday.mp3', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const b = s[0].bytes;
      ok(b.slice(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), 'to mp3: a real MP3 file');
      const m = await mediaInfo(page, s[0].b64, 'audio/mpeg');
      /* A browser recording's sound can be a little shorter than its picture. */
      ok(m.duration > 3.3 && m.duration < 4.6, 'to mp3: the right length', JSON.stringify(m));
    }
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#format', 'm4a');
    await page.click('#go');
    s = await saved(page);
    if (s[0]) {
      const m = await mediaInfo(page, s[0].b64, 'audio/mp4');
      ok(s[0].name === 'holiday.m4a' && m.duration > 3.3, 'to mp3: M4A works too', JSON.stringify(m));
    } else ok(false, 'to mp3: M4A saved');
    await page.close();
  }

  async function ready(page) {
    await page.waitForFunction(() => {
      const box = document.getElementById('edit') || document.getElementById('options');
      return (box && !box.hidden) || /could not/.test(document.getElementById('info').textContent);
    }, { timeout: 180000 }).catch(() => {});
  }
  const setVal = (page, id, v) => page.$eval('#' + id, (e, v) => { e.value = v; e.dispatchEvent(new Event('change')); }, v);

  // ---------------------------------------------------------- trim
  {
    const page = await open('trim-video');
    await (await page.$('#file')).uploadFile(clip);
    await ready(page);
    ok(/640 × 360, 0:0[34] long, with sound/.test(await text(page, 'info')), 'trim: reads the video', await text(page, 'info'));
    ok(await page.$eval('#player', (v) => !!v.src), 'trim: the video is shown to play');
    await setVal(page, 'from', '0:01.0');
    await setVal(page, 'to', '0:03.0');
    ok(/0:02\.0 long/.test(await text(page, 'plan')), 'trim: the plan says 2 seconds', await text(page, 'plan'));

    // fast: a WebM again, about 2 seconds (it may start a little early, at a key frame)
    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'holiday-trimmed.webm', 'trim: fast keeps the same kind of file', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const m = await mediaInfo(page, s[0].b64, 'video/webm');
      ok(m.duration > 1.7 && m.duration < 3.2 && m.width === 640, 'trim: fast cut is about 2 seconds and plays', JSON.stringify(m));
    }

    // exact: an MP4 of exactly 2 seconds
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'exact');
    await page.click('#go');
    s = await saved(page);
    ok(s[0] && s[0].name === 'holiday-trimmed.mp4', 'trim: exact makes an MP4', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      ok(s[0].bytes.slice(4, 8).toString() === 'ftyp', 'trim: a real MP4 file');
      const m = await mediaInfo(page, s[0].b64, 'video/mp4');
      ok(Math.abs(m.duration - 2) < 0.15 && m.width === 640 && m.height === 360, 'trim: exactly 2 seconds and plays in the browser', JSON.stringify(m));
    }
    await page.close();
  }

  // ---------------------------------------------------------- compress
  {
    const big = await makeClip(path.join(tmp, 'wedding.webm'), 1280, 720, 3);
    const page = await open('compress-video');
    await (await page.$('#file')).uploadFile(big);
    await ready(page);
    ok(/1280 × 720/.test(await text(page, 'info')), 'compress: reads a 1280 x 720 video', await text(page, 'info'));
    const sizes = await page.$$eval('#size option', (o) => o.map((x) => x.value));
    ok(sizes.join() === '0,480,360', 'compress: offers sizes smaller than the video, never bigger', sizes.join());
    await setVal(page, 'size', '360');
    ok(/640 × 360/.test(await text(page, 'plan')), 'compress: 360p of 1280 x 720 is 640 x 360', await text(page, 'plan'));
    await setVal(page, 'level', '32');
    await page.click('#go');
    await page.waitForFunction(() => !document.getElementById('result').hidden || /could not|stopped|too big/.test(document.getElementById('status').textContent),
      { timeout: 300000 }).catch(() => {});
    ok(!(await page.$eval('#result', (r) => r.hidden)), 'compress: finishes', await text(page, 'status'));
    const saving = await text(page, 's-saved');
    ok(/^\d+%$/.test(saving), 'compress: and is smaller', saving + ' (' + await text(page, 's-before') + ' to ' + await text(page, 's-after') + ')');
    await page.click('#save');
    const s = await saved(page);
    ok(s[0] && s[0].name === 'wedding-compressed.mp4', 'compress: saves wedding-compressed.mp4');
    if (s[0]) {
      const m = await mediaInfo(page, s[0].b64, 'video/mp4');
      ok(m.width === 640 && m.height === 360 && m.duration > 2.5, 'compress: 640 x 360 and plays in the browser', JSON.stringify(m));
    }
    await page.close();
  }

  // ---------------------------------------------------------- a file that is not a video
  {
    const page = await open('trim-video');
    const bad = path.join(tmp, 'notes.mp4');
    fs.writeFileSync(bad, 'this is not a video at all');
    await (await page.$('#file')).uploadFile(bad);
    await page.waitForFunction(() => /could not|not be read/.test(document.getElementById('info').textContent), { timeout: 60000 }).catch(() => {});
    ok(/could not be read as a video/.test(await text(page, 'info')), 'trim: a fake video is explained', await text(page, 'info'));
    await page.close();
  }

  // ---------------------------------------------------------- the CDN blocked: the website's own copy is used
  {
    const page = await open('video-to-mp3', { blockCdn: true });
    await (await page.$('#file')).uploadFile(clip);
    await page.waitForFunction(() => !document.getElementById('options').hidden, { timeout: 180000 }).catch(() => {});
    ok(/A video/.test(await text(page, 'info')) && page.localHits >= 1, 'fallback: with the CDN blocked, the local copy is used',
       await text(page, 'info') + ' / local ' + page.localHits);
    await page.close();
  }

  ok(errors.length === 0, 'no script errors in any video tool', errors.join('\n      '));
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('');
  failures.forEach((f) => console.log('FAIL  ' + f));
  console.log('\n' + pass + ' passed, ' + fail + ' failed (video, in a real browser)');
  process.exit(fail ? 1 : 0);
})();
