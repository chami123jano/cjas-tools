/* Shared plumbing for the audio tools: opening a sound file, drawing its
   waveform, and saving the result as a WAV file. Everything uses the
   browser's own Web Audio engine - nothing is uploaded.

   The WAV writer and the time formatting are plain functions so they can
   be tested without a browser. */
(function () {
  var ctx = null;
  function context() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('This browser cannot work with sound.');
    if (!ctx) ctx = new AC();
    return ctx;
  }

  var AUDIO = {
    /* 75.5 -> "1:15.5"; 3725 -> "1:02:05". */
    time: function (s, tenths) {
      if (!isFinite(s) || s < 0) s = 0;
      var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      var secText = tenths ? sec.toFixed(1) : String(Math.floor(sec));
      if (+secText < 10) secText = '0' + secText;
      return (h ? h + ':' + (m < 10 ? '0' : '') + m : m) + ':' + secText;
    },

    /* "1:15.5", "75.5", "1:02:05" -> seconds, or NaN. */
    parseTime: function (text) {
      var parts = String(text).trim().split(':');
      if (!parts.length || parts.length > 3 || parts.some(function (p) { return !/^\d+(\.\d+)?$/.test(p); })) return NaN;
      return parts.reduce(function (acc, p) { return acc * 60 + parseFloat(p); }, 0);
    },

    /* Reads any sound file the browser understands (MP3, WAV, M4A, OGG,
       FLAC, and the sound in most videos) into an AudioBuffer. */
    decode: function (file) {
      return file.arrayBuffer().then(function (ab) {
        return new Promise(function (resolve, reject) {
          var done = false;
          var p = context().decodeAudioData(ab, function (b) { done = true; resolve(b); }, function () {
            if (!done) reject(new Error('This file could not be opened as sound. MP3, WAV, M4A, OGG and FLAC all work.'));
          });
          if (p && p.catch) p.catch(function () {
            if (!done) reject(new Error('This file could not be opened as sound. MP3, WAV, M4A, OGG and FLAC all work.'));
          });
        });
      });
    },

    /* A new buffer holding seconds `from` to `to` of the original. */
    slice: function (buf, from, to) {
      var rate = buf.sampleRate;
      var a = Math.max(0, Math.floor(from * rate)), b = Math.min(buf.length, Math.ceil(to * rate));
      var out = AUDIO.create(buf.numberOfChannels, Math.max(1, b - a), rate);
      for (var c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a, b));
      return out;
    },

    create: function (channels, length, rate) {
      return context().createBuffer(channels, length, rate);
    },

    /* The loudest point, from 0 to 1 (1 is the most a file can hold). */
    peak: function (buf) {
      var p = 0;
      for (var c = 0; c < buf.numberOfChannels; c++) {
        var d = buf.getChannelData(c);
        for (var i = 0; i < d.length; i++) { var v = d[i] < 0 ? -d[i] : d[i]; if (v > p) p = v; }
      }
      return p;
    },

    /* Writes 16-bit PCM WAV from channel arrays (Float32Arrays, -1 to 1).
       Kept separate from AudioBuffer so it can be tested on plain arrays. */
    wavBytes: function (channels, rate) {
      var n = channels.length, len = channels[0].length;
      var dataSize = len * n * 2;
      var out = new ArrayBuffer(44 + dataSize);
      var v = new DataView(out);
      function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
      str(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); str(8, 'WAVE');
      str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);   // plain PCM
      v.setUint16(22, n, true); v.setUint32(24, rate, true);
      v.setUint32(28, rate * n * 2, true); v.setUint16(32, n * 2, true); v.setUint16(34, 16, true);
      str(36, 'data'); v.setUint32(40, dataSize, true);
      var o = 44;
      for (var i = 0; i < len; i++) {
        for (var c = 0; c < n; c++) {
          var s = channels[c][i];
          s = s > 1 ? 1 : s < -1 ? -1 : s;           // anything louder is clipped, not wrapped
          v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          o += 2;
        }
      }
      return new Uint8Array(out);
    },

    wav: function (buf) {
      var chans = [];
      for (var c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
      return new Blob([AUDIO.wavBytes(chans, buf.sampleRate)], { type: 'audio/wav' });
    },

    /* Draws the waveform: for each column of pixels, the loudest and
       quietest point in that slice of time. */
    waveform: function (canvas, buf, colour, from, to) {
      var ratio = window.devicePixelRatio || 1;
      var w = canvas.clientWidth || 600, h = canvas.clientHeight || 120;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      var g = canvas.getContext('2d');
      g.clearRect(0, 0, canvas.width, canvas.height);
      var data = buf.getChannelData(0), data2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
      var a = Math.floor((from || 0) * buf.sampleRate), b = Math.ceil((to == null ? buf.duration : to) * buf.sampleRate);
      var per = Math.max(1, (b - a) / canvas.width), mid = canvas.height / 2;
      g.fillStyle = colour || '#4f7cff';
      for (var x = 0; x < canvas.width; x++) {
        var lo = 0, hi = 0, s = Math.floor(a + x * per), e = Math.min(b, Math.floor(s + per));
        for (var i = s; i < e; i += Math.max(1, Math.floor(per / 200))) {
          var val = data2 ? (data[i] + data2[i]) / 2 : data[i];
          if (val < lo) lo = val; if (val > hi) hi = val;
        }
        g.fillRect(x, mid - hi * mid, 1, Math.max(1, (hi - lo) * mid));
      }
    },

    /* Plays part of a buffer; returns a function that stops it. */
    play: function (buf, from, to, onEnd) {
      var c = context();
      if (c.state === 'suspended') c.resume();
      var src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.onended = function () { if (onEnd) onEnd(); };
      src.start(0, from || 0, to != null ? Math.max(0, to - (from || 0)) : undefined);
      var started = c.currentTime;
      var stop = function () { try { src.onended = null; src.stop(); } catch (e) { /* already stopped */ } };
      stop.position = function () { return (from || 0) + (c.currentTime - started); };
      return stop;
    },

    /* A drop zone that takes audio (and video, for its sound). */
    zone: function (zone, input, onFile) {
      zone.addEventListener('click', function () { input.click(); });
      zone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove('over'); });
      });
      zone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) onFile(Array.from(e.dataTransfer.files));
      });
      input.addEventListener('change', function () {
        if (input.files.length) onFile(Array.from(input.files));
        input.value = '';
      });
    }
  };

  window.CJA_AUDIO = AUDIO;
})();
