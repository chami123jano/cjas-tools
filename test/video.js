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
  async function makeClip(file, w, h, secs, sound = true, heavy = false) {
    const maker = await browser.newPage();
    await maker.goto(base + 'video-to-mp3.html');
    const b64 = await maker.evaluate((w, h, secs, sound, heavy) => new Promise((resolve) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      const ac = new AudioContext();
      const osc = ac.createOscillator(); osc.frequency.value = 440;
      const gain = ac.createGain(); gain.gain.value = 0.3;
      const dest = ac.createMediaStreamDestination();
      osc.connect(gain).connect(dest); osc.start();
      const stream = new MediaStream([...c.captureStream(25).getVideoTracks(), ...(sound ? dest.stream.getAudioTracks() : [])]);
      /* 'heavy' is like a phone camera: a high bitrate and a grainy picture. */
      const rec = new MediaRecorder(stream, Object.assign({ mimeType: sound ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8' },
        heavy ? { videoBitsPerSecond: 8000000 } : {}));
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
        if (heavy) for (let k = 0; k < 4000; k++) { g.fillStyle = 'hsl(' + (k * 37 % 360) + ',60%,' + (20 + Math.random() * 40) + '%)'; g.fillRect(Math.random() * w, Math.random() * h, 4, 4); }
        g.fillStyle = '#f80'; g.fillRect((t * 8) % (w - 60), h / 2 - 30, 60, 60);
        g.fillStyle = '#fff'; g.font = '40px sans-serif'; g.fillText(String(Math.floor(t / 25)), 20, 50);
        t++;
      }, 40);
      rec.start();
      setTimeout(() => { rec.stop(); clearInterval(draw); }, secs * 1000);
    }), w, h, secs, sound, heavy);
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
    const big = await makeClip(path.join(tmp, 'wedding.webm'), 1280, 720, 3, true, true);
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
    if (await page.$eval('#save', (b) => b.hidden || b.offsetParent === null)) {
      ok(false, 'compress: offers to save', 'status: ' + await text(page, 'status') + ' / note: ' + await text(page, 'note') +
         ' / sizes ' + await text(page, 's-before') + ' to ' + await text(page, 's-after'));
    } else await page.click('#save');
    const s = await saved(page, 1, 5000);
    ok(s[0] && s[0].name === 'wedding-compressed.mp4', 'compress: saves wedding-compressed.mp4');
    if (s[0]) {
      const m = await mediaInfo(page, s[0].b64, 'video/mp4');
      ok(m.width === 640 && m.height === 360 && m.duration > 2.5, 'compress: 640 x 360 and plays in the browser', JSON.stringify(m));
    }
    await page.close();
  }

  /* Brightness of areas of one frame of a saved video: the four corners
     (each a tenth of the width and height) of the picture at `time`. */
  async function corners(page, b64, type, time) {
    return page.evaluate((b64, type, time) => new Promise((resolve) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const v = document.createElement('video');
      v.muted = true;
      v.src = URL.createObjectURL(new Blob([u], { type }));
      v.onloadeddata = () => { v.currentTime = time; };
      v.onseeked = () => {
        const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
        const g = c.getContext('2d'); g.drawImage(v, 0, 0);
        const area = (x0, y0) => {
          const w = Math.round(c.width * 0.18), h = Math.round(c.height * 0.18);
          const d = g.getImageData(x0 * (c.width - w), y0 * (c.height - h), w, h).data;
          let bright = 0;
          for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) bright++;
          return bright;
        };
        resolve({ w: c.width, h: c.height, tl: area(0, 0), tr: area(1, 0), bl: area(0, 1), br: area(1, 1) });
      };
      v.onerror = () => resolve({ error: true });
    }), b64, type, time);
  }

  // ---------------------------------------------------------- video to gif
  {
    const page = await open('video-to-gif');
    await (await page.$('#file')).uploadFile(clip);
    await ready(page);
    ok(/The first 0:0[34] is chosen/.test(await text(page, 'info')), 'gif: starts with the first few seconds', await text(page, 'info'));
    ok(/480 × 270, \d+ pictures/.test(await text(page, 'plan')), 'gif: 480 wide keeps the shape (270 high)', await text(page, 'plan'));
    await page.$eval('#to', (e) => { e.value = '0:02.0'; e.dispatchEvent(new Event('change')); });
    ok(/0:02\.0 long, 480 × 270, 24 pictures/.test(await text(page, 'plan')), 'gif: 2 seconds at 12 a second is 24 pictures', await text(page, 'plan'));
    await page.click('#go');
    await page.waitForFunction(() => !document.getElementById('result').hidden || /could not|stopped/.test(document.getElementById('status').textContent),
      { timeout: 120000 }).catch(() => {});
    const shown = await page.$eval('#gif', (i) => new Promise((r) => (i.complete ? r([i.naturalWidth, i.naturalHeight]) : (i.onload = () => r([i.naturalWidth, i.naturalHeight])))));
    ok(shown[0] === 480 && shown[1] === 270, 'gif: the preview shows a 480 x 270 GIF', JSON.stringify(shown));
    await page.click('#save');
    const s = await saved(page);
    ok(s[0] && s[0].name === 'holiday.gif', 'gif: saves holiday.gif', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const b = s[0].bytes;
      ok(b.slice(0, 6).toString() === 'GIF89a' && b.readUInt16LE(6) === 480 && b.readUInt16LE(8) === 270, 'gif: a real GIF, 480 x 270');
      ok(b.indexOf(Buffer.from('NETSCAPE2.0')) > 0, 'gif: it loops');
      // every picture in a GIF starts with a graphic control block (21 F9 04)
      let frames = 0;
      for (let i = 0; i < b.length - 2; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04) frames++;
      ok(frames >= 20 && frames <= 26, 'gif: about 24 pictures in it', frames);
    }
    await page.close();
  }

  // ---------------------------------------------------------- rotate and flip
  {
    const page = await open('rotate-video');
    await (await page.$('#file')).uploadFile(clip);
    await ready(page);
    ok(/Nothing turned yet/.test(await text(page, 'plan')) && await page.$eval('#go', (b) => b.disabled), 'rotate: nothing to save until turned');
    // the original: the white seconds counter is in the top-left corner
    const orig = await corners(page, fs.readFileSync(clip).toString('base64'), 'video/webm', 2.2);
    ok(orig.tl > 50 && orig.tr < 5, 'rotate: the test video has its counter top left', JSON.stringify(orig));

    await page.click('#turns [data-turn="90"]');
    ok(/360 × 640/.test(await text(page, 'plan')), 'rotate: turned right, it becomes 360 x 640', await text(page, 'plan'));
    ok(/rotate\(90deg\)/.test(await page.$eval('#player', (v) => v.style.transform)), 'rotate: the preview turns at once');
    await page.click('#go');
    let s = await saved(page, 1, 180000);
    ok(s[0] && s[0].name === 'holiday-turned.mp4', 'rotate: saves holiday-turned.mp4', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const c = await corners(page, s[0].b64, 'video/mp4', 2.2);
      ok(c.w === 360 && c.h === 640, 'rotate: the saved video is 360 x 640', JSON.stringify(c));
      ok(c.tr > 50 && c.tl < 5, 'rotate: turned right, the top-left counter is now top right', JSON.stringify(c));
      const m = await mediaInfo(page, s[0].b64, 'video/mp4');
      ok(m.duration > 3.3, 'rotate: the whole video is kept', m.duration);
    }

    // mirror only: the counter moves to the top right of a 640 x 360 picture
    await page.evaluate(() => { window.__saved = []; });
    await page.click('#reset');
    await page.click('#turns [data-flip="h"]');
    await page.click('#go');
    s = await saved(page, 1, 180000);
    if (s[0]) {
      const c = await corners(page, s[0].b64, 'video/mp4', 2.2);
      ok(c.w === 640 && c.tr > 50 && c.tl < 5, 'rotate: mirrored, the counter is top right', JSON.stringify(c));
    } else ok(false, 'rotate: mirrored video saved');
    await page.close();
  }

  /* What the engine itself says about a saved file. */
  async function probeSaved(page, b64, name) {
    return page.evaluate(async (b64, name) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return window.CJA_FF.probe(name, u);
    }, b64, name);
  }
  /* A 6 second 440 Hz tone as WAV, to use as music. */
  const music = path.join(tmp, 'song.wav');
  {
    const rate = 44100, n = rate * 6, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
    b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * 9000), 44 + i * 2);
    fs.writeFileSync(music, b);
  }

  // ---------------------------------------------------------- join videos
  {
    const silentWide = await makeClip(path.join(tmp, 'drone.webm'), 1280, 720, 2, false);
    const page = await open('join-videos');
    await (await page.$('#file')).uploadFile(clip, silentWide);
    await page.waitForFunction(() => document.querySelectorAll('#list .file-row').length === 2, { timeout: 180000 }).catch(() => {});
    const rows = await page.$eval('#list', (e) => e.textContent);
    ok(/holiday\.webm/.test(rows) && /drone\.webm/.test(rows) && /no sound/.test(rows), 'join: both clips listed; the silent one noticed', rows);
    ok(/2 clips, 0:0[56] in all, at 640 × 360/.test(await text(page, 'plan')), 'join: plan at the first clip\'s size', await text(page, 'plan'));
    await page.click('#go');
    const s = await saved(page, 1, 240000);
    ok(s[0] && s[0].name === 'joined.mp4', 'join: saves joined.mp4', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const m = await mediaInfo(page, s[0].b64, 'video/mp4');
      ok(m.width === 640 && m.height === 360 && m.duration > 5.2 && m.duration < 6.6, 'join: one 640 x 360 video, both clips long', JSON.stringify(m));
      const p = await probeSaved(page, s[0].b64, 'check.mp4');
      ok(p.video && p.audio && p.videoCodec === 'h264' && p.audioCodec === 'aac', 'join: H.264 picture and AAC sound', JSON.stringify(p));
      // the second clip (wide 1280 x 720) is fitted, not stretched: the frame from it still shows its counter top left
      const c = await corners(page, s[0].b64, 'video/mp4', m.duration - 0.6);
      ok(c.w === 640 && c.tl > 5, 'join: the second clip appears after the first', JSON.stringify(c));
    }
    await page.close();
  }

  // ---------------------------------------------------------- video sound
  {
    const page = await open('video-sound');
    await (await page.$('#file')).uploadFile(clip);
    await page.waitForFunction(() => !document.getElementById('options').hidden, { timeout: 180000 }).catch(() => {});
    ok(/The video will have no sound/.test(await text(page, 'plan')), 'sound: remove is the first choice');
    await page.click('#go');
    let s = await saved(page);
    ok(s[0] && s[0].name === 'holiday-silent.webm', 'sound: saves holiday-silent.webm', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const p = await probeSaved(page, s[0].b64, 'check.webm');
      ok(p.video && !p.audio && p.width === 640, 'sound: the saved video has no sound', JSON.stringify(p));
      ok(Math.abs(p.duration - 4) < 0.5, 'sound: and is still the full length', p.duration);
    }

    // replace with music
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'replace');
    ok(/Choose the music/.test(await text(page, 'plan')) && await page.$eval('#go', (b) => b.disabled), 'sound: asks for the music');
    await (await page.$('#music')).uploadFile(music);
    await page.waitForFunction(() => /Music: song\.wav/.test(document.getElementById('plan').textContent), { timeout: 60000 }).catch(() => {});
    ok(/cut to the video/.test(await text(page, 'plan')), 'sound: a longer song is cut to the video', await text(page, 'plan'));
    await page.click('#go');
    s = await saved(page);
    ok(s[0] && s[0].name === 'holiday-music.webm', 'sound: saves holiday-music.webm', s[0] ? s[0].name : await text(page, 'status'));
    if (s[0]) {
      const p = await probeSaved(page, s[0].b64, 'check2.webm');
      ok(p.video && p.audio && p.audioCodec === 'vorbis', 'sound: a WebM gets WebM sound (Vorbis)', JSON.stringify(p));
      ok(p.duration < 4.6, 'sound: no longer than the video', p.duration);
    }

    // add music under the existing sound
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'add');
    await page.click('#go');
    s = await saved(page);
    if (s[0]) {
      const p = await probeSaved(page, s[0].b64, 'check3.webm');
      ok(p.audio && p.video, 'sound: music added under the sound', JSON.stringify(p));
    } else ok(false, 'sound: added music saved', await text(page, 'status') + ' | ' + (await page.evaluate(() => window.CJA_FF.logs().slice(-8).join(' / '))));

    // a 1.5 second jingle repeats to fill the 4 second video
    const jingle = path.join(tmp, 'jingle.wav');
    fs.writeFileSync(jingle, Buffer.concat([fs.readFileSync(music).slice(0, 44), fs.readFileSync(music).slice(44, 44 + 44100 * 2 * 1.5)]));
    { const j = fs.readFileSync(jingle); j.writeUInt32LE(j.length - 8, 4); j.writeUInt32LE(j.length - 44, 40); fs.writeFileSync(jingle, j); }
    await page.evaluate(() => { window.__saved = []; });
    await page.select('#mode', 'replace');
    await (await page.$('#music')).uploadFile(jingle);
    await page.waitForFunction(() => /Music: jingle\.wav/.test(document.getElementById('plan').textContent), { timeout: 60000 }).catch(() => {});
    ok(/repeats to fill/.test(await text(page, 'plan')), 'sound: a short jingle is set to repeat', await text(page, 'plan'));
    await page.click('#go');
    s = await saved(page);
    if (s[0]) {
      const p = await probeSaved(page, s[0].b64, 'check4.webm');
      const sound = await page.evaluate(async (b64) => {
        const bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return new AudioContext().decodeAudioData(u.buffer).then((b) => b.duration, () => -1);
      }, s[0].b64);
      ok(p.audio && sound > 3.3, 'sound: the repeated jingle lasts the whole video', 'sound ' + sound + ' s');
    } else ok(false, 'sound: repeated jingle saved', await text(page, 'status'));
    await page.close();
  }

  // ---------------------------------------------------------- the engine restarts itself after a crash
  {
    /* This build of FFmpeg crashes when its Opus encoder gets stereo sound;
       the tools avoid that, so it is used here on purpose to check that a
       crash gives a clear message and the next job still works. */
    const page = await open('video-sound');
    const r = await page.evaluate(async () => {
      const n = 48000, d = new Float32Array(n);
      for (let i = 0; i < n; i++) d[i] = Math.sin(i / 10) * 0.2;
      const wav = window.CJA_AUDIO.wavBytes([d, d], 48000);
      const first = await window.CJA_FF.run(['-i', 'a.wav', '-c:a', 'libopus', 'a.webm'], { 'a.wav': wav }, 'a.webm')
        .then(() => 'no crash', (e) => e.message);
      const second = await window.CJA_FF.run(['-i', 'a.wav', '-c:a', 'libmp3lame', 'a.mp3'], { 'a.wav': wav }, 'a.mp3')
        .then((x) => 'OK ' + x.length, (e) => 'ERROR ' + e.message);
      return [first, second];
    });
    ok(/restarted/.test(r[0]), 'engine: a crash gives a clear message', r[0]);
    ok(/^OK \d+/.test(r[1]), 'engine: and the next job works after the restart', r[1]);
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
