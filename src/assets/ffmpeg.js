/* The video engine: FFmpeg, built to run in the browser (ffmpeg.wasm).

   The engine is a 32 MB file, so it is loaded only when a tool needs it:
   - In the desktop app it comes from the app's own copy, so it works with
     no internet.
   - On the website it comes from the jsDelivr CDN, so it does not use up
     GitHub's free traffic, and the browser keeps it for next time. If the
     CDN cannot be reached, the website's own copy is used instead.

   Nothing is uploaded: files are handed to the engine inside the browser.
   See vendor/ffmpeg/THIRD-PARTY.txt for the engine's licence and source. */
(function () {
  var here = document.currentScript && document.currentScript.src;
  var LOCAL = here ? new URL('vendor/ffmpeg/', here).href : '../assets/vendor/ffmpeg/';
  var CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/';
  var inApp = location.hostname === 'tauri.localhost' || location.protocol === 'tauri:';

  var ff = null, loading = null, logs = [];

  function script(src) {
    return new Promise(function (resolve, reject) {
      if (window.FFmpegWASM) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('The video engine could not be started.')); };
      document.head.appendChild(s);
    });
  }

  /* Downloads a file, reporting progress, and hands back a local blob
     address so the engine does not download it a second time. */
  function fetchWithProgress(url, onProgress) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('Download failed (' + res.status + ')');
      var total = +res.headers.get('Content-Length') || 32232419;
      if (!res.body || !res.body.getReader) {
        return res.blob();
      }
      var reader = res.body.getReader(), got = 0, parts = [];
      return (function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(parts);
          parts.push(r.value);
          got += r.value.length;
          if (onProgress) onProgress(got, total);
          return pump();
        });
      })();
    }).then(function (blob) {
      return URL.createObjectURL(new Blob([blob], { type: url.slice(-5) === '.wasm' ? 'application/wasm' : 'text/javascript' }));
    });
  }

  function startFrom(base, onProgress) {
    var engine = new FFmpegWASM.FFmpeg();
    engine.on('log', function (e) { logs.push(e.message); if (logs.length > 400) logs.shift(); });
    return Promise.all([
      fetchWithProgress(base + 'ffmpeg-core.js'),
      fetchWithProgress(base + 'ffmpeg-core.wasm', onProgress)
    ]).then(function (urls) {
      return engine.load({ coreURL: urls[0], wasmURL: urls[1] }).then(function () { return engine; });
    });
  }

  var FF = {
    LOCAL: LOCAL,
    CDN: CDN,
    inApp: inApp,

    /* Loads the engine once. onProgress(got, total) during the download. */
    load: function (onProgress) {
      if (ff) return Promise.resolve(ff);
      if (loading) return loading;
      loading = script(LOCAL + 'ffmpeg.js').then(function () {
        var first = inApp ? LOCAL : CDN;
        return startFrom(first, onProgress).catch(function (e) {
          if (first === LOCAL) throw e;
          /* The CDN could not be reached: use the website's own copy. */
          return startFrom(LOCAL, onProgress);
        });
      }).then(function (engine) {
        ff = engine;
        return ff;
      }).catch(function (e) {
        loading = null;
        throw new Error('The video engine could not be loaded. ' + (inApp ? '' : 'Check the internet connection - the engine downloads once, about 32 MB. ') +
          '(' + (e && e.message) + ')');
      });
      return loading;
    },

    /* Runs FFmpeg on files. inputs: { name: Uint8Array }. Returns the
       bytes of `output`. onProgress(fraction 0-1). The working files are
       removed afterwards so memory is given back. */
    run: function (args, inputs, output, onProgress) {
      return FF.load().then(function (engine) {
        var names = Object.keys(inputs);
        logs = [];
        var listener = function (p) {
          if (onProgress && isFinite(p.progress)) onProgress(Math.max(0, Math.min(1, p.progress)));
        };
        engine.on('progress', listener);
        return names.reduce(function (p, n) {
          /* A copy, because the engine takes over the data it is given and
             the tool may need the original again (another format, a retry). */
          return p.then(function () { return engine.writeFile(n, inputs[n].slice()); });
        }, Promise.resolve()).then(function () {
          return engine.exec(args);
        }).then(function (code) {
          if (code !== 0) throw new Error(FF.reason());
          return engine.readFile(output);
        }).then(function (data) {
          engine.off('progress', listener);
          names.concat([output]).forEach(function (n) { engine.deleteFile(n).catch(function () {}); });
          return data;
        }, function (e) {
          engine.off('progress', listener);
          /* A crash inside the engine leaves it unusable, so it is closed
             and started afresh for the next job. */
          if (e && (e.name === 'RuntimeError' || /RuntimeError|memory access|unreachable/.test(String(e.message || e)))) {
            try { engine.terminate(); } catch (x) { /* already gone */ }
            ff = null; loading = null;
            throw new Error('The video engine ran into a problem with this file and has been restarted. Please try again, or try a different setting.');
          }
          names.concat([output]).forEach(function (n) { engine.deleteFile(n).catch(function () {}); });
          throw e instanceof Error ? e : new Error(String(e));
        });
      });
    },

    /* Like run, for commands that write many files (pictures every few
       seconds): returns every file whose name starts with `prefix`, in
       name order, as [{ name, data }]. */
    runFiles: function (args, inputs, prefix, onProgress) {
      return FF.load().then(function (engine) {
        var names = Object.keys(inputs);
        logs = [];
        var listener = function (p) {
          if (onProgress && isFinite(p.progress)) onProgress(Math.max(0, Math.min(1, p.progress)));
        };
        engine.on('progress', listener);
        var made = [];
        return names.reduce(function (p, n) {
          return p.then(function () { return engine.writeFile(n, inputs[n].slice()); });
        }, Promise.resolve()).then(function () {
          return engine.exec(args);
        }).then(function (code) {
          if (code !== 0) throw new Error(FF.reason());
          return engine.listDir('/');
        }).then(function (list) {
          made = list.filter(function (f) { return !f.isDir && f.name.indexOf(prefix) === 0; })
            .map(function (f) { return f.name; }).sort();
          return made.reduce(function (p, n) {
            return p.then(function (out) {
              return engine.readFile(n).then(function (data) { out.push({ name: n, data: data }); return out; });
            });
          }, Promise.resolve([]));
        }).then(function (files) {
          engine.off('progress', listener);
          names.concat(made).forEach(function (n) { engine.deleteFile(n).catch(function () {}); });
          return files;
        }, function (e) {
          engine.off('progress', listener);
          names.concat(made).forEach(function (n) { engine.deleteFile(n).catch(function () {}); });
          throw e instanceof Error ? e : new Error(String(e));
        });
      });
    },

    /* Looks at a media file without changing it: length, picture size,
       and whether it has sound and picture. Read from FFmpeg's own report. */
    probe: function (name, bytes) {
      return FF.load().then(function (engine) {
        logs = [];
        return engine.writeFile(name, bytes.slice()).then(function () {
          return engine.exec(['-hide_banner', '-i', name]);
        }).then(function () {
          engine.deleteFile(name).catch(function () {});
          return FF.parse(logs.join('\n'));
        });
      });
    },

    /* Reads FFmpeg's description of a file. Kept separate so it can be
       tested on sample text. */
    parse: function (text) {
      var info = { duration: NaN, width: 0, height: 0, video: false, audio: false, fps: 0, videoCodec: '', audioCodec: '' };
      var d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
      if (d) info.duration = +d[1] * 3600 + +d[2] * 60 + parseFloat(d[3]);
      var v = /Stream #[^\n]*Video:\s*([a-z0-9_]+)[^\n]*?(\d{2,5})x(\d{2,5})/i.exec(text);
      if (v) { info.video = true; info.videoCodec = v[1]; info.width = +v[2]; info.height = +v[3]; }
      var f = /Stream #[^\n]*Video:[^\n]*?(\d+(?:\.\d+)?) fps/.exec(text);
      if (f) info.fps = parseFloat(f[1]);
      var a = /Stream #[^\n]*Audio:\s*([a-z0-9_]+)/i.exec(text);
      if (a) { info.audio = true; info.audioCodec = a[1]; }
      /* Phones often store an upright video sideways with a note saying
         "turn this a quarter". FFmpeg obeys the note when it works on the
         video, so the size reported here is the size as it will be shown:
         width and height are swapped for a quarter turn. */
      var r = /displaymatrix: rotation of (-?\d+(?:\.\d+)?) degrees/.exec(text) || /\brotate\s*:\s*(-?\d+)/.exec(text);
      if (r) {
        info.rotation = ((Math.round(parseFloat(r[1])) % 360) + 360) % 360;
        if (info.rotation === 90 || info.rotation === 270) {
          var w = info.width; info.width = info.height; info.height = w;
        }
      }
      return info;
    },

    /* The last few lines FFmpeg wrote, turned into a short reason. */
    reason: function () {
      var tail = logs.slice(-12).join('\n');
      if (/Invalid data found|could not find codec|Invalid argument/i.test(tail)) return 'This file could not be read - it may be damaged or a kind the engine does not know.';
      if (/memory|OOM|Aborted/i.test(tail)) return 'The file is too big to handle in the browser. Try a shorter or smaller video.';
      return 'The video engine stopped with an error.';
    },

    logs: function () { return logs.slice(); },

    /* The usual first step of a video tool: read the file, start the
       engine, and look at the file. onStatus(text) reports progress.
       Resolves { bytes, ext, base, name, size, info }. */
    open: function (file, onStatus) {
      var say = onStatus || function () {};
      var ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name) || [0, 'mp4'])[1].toLowerCase();
      var out = { ext: ext, base: file.name.replace(/\.[^.]+$/, '') || 'video', name: file.name, size: file.size };
      say('Reading the file...');
      return file.arrayBuffer().then(function (ab) {
        out.bytes = new Uint8Array(ab);
        return FF.load(function (got, total) { say(FF.progressText(got, total)); });
      }).then(function () {
        say('Looking at the file...');
        return FF.probe('probe.' + ext, out.bytes);
      }).then(function (info) {
        out.info = info;
        return out;
      });
    },

    /* "about 1:20 left", worked out from how far along it is. */
    timeLeft: function (started, fraction) {
      var secs = (Date.now() - started) / 1000;
      if (!(fraction > 0.03)) return '';
      var left = secs / fraction - secs;
      if (left < 3) return '';
      var m = Math.floor(left / 60), s = Math.round(left % 60);
      return ', about ' + (m ? m + ' min ' : '') + s + ' s left';
    },

    /* A progress bar shared by the video tools. */
    progressText: function (got, total) {
      return 'Getting the video engine ready: ' + (got / 1048576).toFixed(1) + ' of ' + (total / 1048576).toFixed(0) +
        ' MB' + (inApp ? '' : ' (downloaded once, then kept by the browser)');
    }
  };

  window.CJA_FF = FF;
})();
