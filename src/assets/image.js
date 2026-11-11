/* Shared plumbing for the image tools: picking a picture, loading it,
   working out sizes, and saving the result. Everything happens in the
   browser's own canvas - no picture ever leaves the device.

   The size and name helpers are plain functions so they can be tested
   without a browser. */
(function () {
  var TYPES = {
    'image/jpeg': { ext: 'jpg', name: 'JPG', lossy: true },
    'image/png': { ext: 'png', name: 'PNG', lossy: false },
    'image/webp': { ext: 'webp', name: 'WebP', lossy: true }
  };

  var IMG = {
    TYPES: TYPES,

    /* For putting a file name into the page safely. */
    escape: function (s) {
      return String(s).replace(/[<>&"]/g, function (c) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c];
      });
    },

    /* 1536 -> "1.5 KB". */
    bytes: function (n) {
      if (!isFinite(n) || n < 0) return '—';
      if (n < 1024) return n + ' bytes';
      if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
      return (n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1) + ' MB';
    },

    /* photo.jpeg + ("png", "-small") -> photo-small.png */
    rename: function (name, ext, suffix) {
      var base = String(name || 'image').replace(/\.[^.\/\\]+$/, '') || 'image';
      return base + (suffix || '') + '.' + ext;
    },

    /* Scales w x h to fit inside maxW x maxH, keeping the shape. A missing
       limit means "no limit on that side". Never enlarges unless asked. */
    fit: function (w, h, maxW, maxH, allowLarger) {
      var sx = maxW > 0 ? maxW / w : Infinity;
      var sy = maxH > 0 ? maxH / h : Infinity;
      var s = Math.min(sx, sy);
      if (!isFinite(s)) s = 1;
      if (!allowLarger) s = Math.min(s, 1);
      return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
    },

    /* Keeps a crop rectangle inside the picture and at least 1 pixel. */
    clampRect: function (r, w, h) {
      var x = Math.max(0, Math.min(Math.round(r.x), w - 1));
      var y = Math.max(0, Math.min(Math.round(r.y), h - 1));
      var cw = Math.max(1, Math.min(Math.round(r.width), w - x));
      var ch = Math.max(1, Math.min(Math.round(r.height), h - y));
      return { x: x, y: y, width: cw, height: ch };
    },

    /* The biggest rectangle of a given shape (ratio = width / height) that
       fits in the picture, centred. */
    ratioRect: function (w, h, ratio) {
      var cw = w, ch = Math.round(w / ratio);
      if (ch > h) { ch = h; cw = Math.round(h * ratio); }
      return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), width: cw, height: ch };
    },

    /* Whether this browser can write a format. Every browser writes PNG;
       WebP depends on the engine (Safari could not until 2023). */
    canEncode: function (type) {
      try {
        var c = document.createElement('canvas');
        c.width = c.height = 1;
        return c.toDataURL(type).indexOf('data:' + type) === 0;
      } catch (e) { return false; }
    },

    /* Loads a File into an <img>. Rejects with a message a person can act
       on when the file is not a picture the browser can open. */
    load: function (file) {
      return new Promise(function (resolve, reject) {
        if (!file) { reject(new Error('No file chosen')); return; }
        if (file.type && file.type.indexOf('image/') !== 0) {
          reject(new Error('That is not a picture (' + (file.type || 'unknown type') + ')'));
          return;
        }
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          resolve({
            img: img, url: url, name: file.name || 'image', size: file.size,
            type: file.type, width: img.naturalWidth, height: img.naturalHeight
          });
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('This picture could not be opened. HEIC photos from iPhones ' +
            'need converting first; JPG, PNG, WebP, GIF and BMP all work.'));
        };
        img.src = url;
      });
    },

    /* A canvas of the given size, optionally with a picture drawn on it. */
    canvas: function (w, h) {
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    },

    /* Canvas -> Blob. JPG has no transparency, so a background (white
       unless another colour is given) is put behind it first rather than
       letting see-through areas go black. */
    toBlob: function (canvas, type, quality, background) {
      var src = canvas;
      if (type === 'image/jpeg') {
        src = IMG.canvas(canvas.width, canvas.height);
        var ctx = src.getContext('2d');
        ctx.fillStyle = background || '#ffffff';
        ctx.fillRect(0, 0, src.width, src.height);
        ctx.drawImage(canvas, 0, 0);
      }
      return new Promise(function (resolve, reject) {
        src.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('The picture could not be saved in that format'));
        }, type, quality);
      });
    },

    download: function (blob, name) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    },

    /* Wires up a drop zone: click to choose, drag a file on, or paste a
       copied picture anywhere on the page. */
    dropZone: function (zone, input, onFile) {
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
        var f = e.dataTransfer && e.dataTransfer.files[0];
        if (f) onFile(f);
      });
      input.addEventListener('change', function () {
        if (input.files[0]) onFile(input.files[0]);
        input.value = '';
      });
      document.addEventListener('paste', function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image/') === 0) {
            onFile(items[i].getAsFile());
            return;
          }
        }
      });
    }
  };

  window.CJA_IMG = IMG;
})();
