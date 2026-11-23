/* Shared plumbing for the PDF tools.

   Two libraries do the heavy lifting, both kept in assets/vendor so they
   work with no internet:
   - pdf-lib builds and edits PDFs (merge, split, rotate, stamp...).
   - PDF.js, from Mozilla, draws pages as pictures and reads their text.
     It is loaded only when a page actually needs it, because it is large.

   Nothing is uploaded: every file is read and written in the browser.
   The page-range reader is a plain function so it can be tested alone. */
(function () {
  /* Where this script lives, so the vendor files are found from any page. */
  var here = document.currentScript && document.currentScript.src;
  var VENDOR = here ? new URL('vendor/pdfjs/', here).href : '../assets/vendor/pdfjs/';
  var viewer = null;   // the PDF.js module, once loaded

  var PDF = {
    VENDOR: VENDOR,

    /* "1-3, 5, 8-" with 10 pages -> [0, 1, 2, 4, 7, 8, 9] (counting from 0).
       Also: "-3" (up to 3), "all", "odd", "even". Order is kept as typed,
       so "3, 1, 2" reorders; a page typed twice is used once.
       Returns { pages } or { error } with a message a person can act on. */
    parseRanges: function (text, total) {
      var s = String(text || '').trim().toLowerCase();
      if (!s || s === 'all') return { pages: range(1, total) };
      var out = [], seen = {};
      function add(n) { if (!seen[n]) { seen[n] = 1; out.push(n - 1); } }
      /* "1 - 3", "1 to 3" and "1–3" all become "1-3"; then commas,
         semicolons or spaces separate the parts. */
      s = s.replace(/\s*(?:-|–|\bto\b)\s*/g, '-');
      var parts = s.split(/[\s,;]+/).filter(Boolean);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        var m;
        if (p === 'odd' || p === 'even') {
          for (var k = p === 'odd' ? 1 : 2; k <= total; k += 2) add(k);
        } else if ((m = /^(\d+)?-(\d+)?$/.exec(p)) && (m[1] || m[2])) {
          var a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total;
          if (a < 1 || b < 1) return { error: 'Pages start at 1.' };
          if (a > total || b > total) return { error: 'This PDF has ' + total + ' page' + (total === 1 ? '' : 's') + ', so "' + parts[i] + '" goes past the end.' };
          if (a > b) return { error: '"' + parts[i] + '" runs backwards. Write it as ' + b + '-' + a + '.' };
          for (var n = a; n <= b; n++) add(n);
        } else if (/^\d+$/.test(p)) {
          var one = +p;
          if (one < 1) return { error: 'Pages start at 1.' };
          if (one > total) return { error: 'This PDF has ' + total + ' page' + (total === 1 ? '' : 's') + ', so there is no page ' + one + '.' };
          add(one);
        } else {
          return { error: '"' + parts[i] + '" is not a page number. Use numbers like 1-3, 5, 8-.' };
        }
      }
      if (!out.length) return { error: 'No pages chosen.' };
      return { pages: out };
    },

    /* [0,1,2,4,7,8,9] -> "1-3, 5, 8-10": the short way to show a list. */
    describe: function (pages) {
      var nums = pages.map(function (p) { return p + 1; }).sort(function (a, b) { return a - b; });
      var parts = [], start = null, prev = null;
      nums.forEach(function (n) {
        if (start === null) { start = prev = n; return; }
        if (n === prev + 1) { prev = n; return; }
        parts.push(start === prev ? '' + start : start + '-' + prev);
        start = prev = n;
      });
      if (start !== null) parts.push(start === prev ? '' + start : start + '-' + prev);
      return parts.join(', ');
    },

    read: function (file) {
      return file.arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    },

    /* Every PDF starts with %PDF- near the beginning. */
    isPdf: function (bytes) {
      var head = '';
      for (var i = 0; i < Math.min(bytes.length, 1024); i++) head += String.fromCharCode(bytes[i]);
      return head.indexOf('%PDF-') !== -1;
    },

    /* Opens a PDF for editing with pdf-lib, with messages for the two
       usual problems: not a PDF, and a password on it. */
    open: function (bytes) {
      if (!PDF.isPdf(bytes)) return Promise.reject(new Error('That file is not a PDF.'));
      return PDFLib.PDFDocument.load(bytes, { updateMetadata: false }).catch(function (e) {
        if (/encrypt/i.test(e && e.message)) {
          /* Covers both kinds: a password to open, and "protected" PDFs
             that open freely but forbid changes (common for statements). */
          throw new Error('This PDF is protected, so it cannot be changed here. To make an unprotected copy: ' +
            'open it in your PDF reader (with its password if it asks), choose Print, pick ' +
            '"Microsoft Print to PDF" as the printer, and save.');
        }
        throw new Error('This PDF could not be read. It may be damaged.');
      });
    },

    /* Saves a pdf-lib document as a Blob. */
    save: function (doc) {
      return doc.save().then(function (bytes) {
        return new Blob([bytes], { type: 'application/pdf' });
      });
    },

    /* Loads PDF.js the first time a page needs to draw a PDF. */
    viewer: function () {
      if (viewer) return Promise.resolve(viewer);
      return import(VENDOR + 'pdf.min.js').then(function (lib) {
        lib.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.min.js';
        viewer = lib;
        return lib;
      });
    },

    /* Opens a PDF for drawing with PDF.js. PDF.js takes over the bytes it
       is given, so it gets a copy and the original stays usable. */
    load: function (bytes, password) {
      return PDF.viewer().then(function (lib) {
        return lib.getDocument({
          data: bytes.slice(),
          password: password,
          cMapUrl: VENDOR + 'cmaps/',
          cMapPacked: true,
          standardFontDataUrl: VENDOR + 'standard_fonts/',
          wasmUrl: VENDOR + 'wasm/',
          iccUrl: VENDOR + 'iccs/',
          /* Never run code from inside a PDF. */
          isEvalSupported: false,
          enableXfa: false
        }).promise;
      }).catch(function (e) {
        if (e && e.name === 'PasswordException') {
          var err = new Error(e.code === 2 ? 'That password is not right.' : 'This PDF needs a password.');
          err.needsPassword = true;
          throw err;
        }
        if (e && e.name === 'InvalidPDFException') throw new Error('That file is not a PDF, or it is damaged.');
        throw e;
      });
    },

    /* Frees a PDF.js document's memory. In current PDF.js this is done
       through the task that loaded it. */
    close: function (doc) {
      if (!doc) return;
      try {
        if (doc.loadingTask) doc.loadingTask.destroy();
        else if (doc.destroy) doc.destroy();
      } catch (e) { /* already closed */ }
    },

    /* Draws one page (counting from 1) onto a new canvas, scaled so it is
       `width` pixels wide. White behind it, as on paper. */
    render: function (doc, pageNumber, width) {
      return doc.getPage(pageNumber).then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: width / base.width });
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vp.width));
        c.height = Math.max(1, Math.round(vp.height));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        return page.render({ canvasContext: ctx, canvas: c, viewport: vp }).promise.then(function () {
          page.cleanup();
          return c;
        });
      });
    },

    /* The EXIF "orientation" of a JPG: 1 is upright; 3, 6 and 8 mean the
       camera was turned, and 2, 4, 5, 7 add a mirror. Phones save photos
       this way and expect the viewer to turn them; PDFs do not, so such
       photos must be turned before going in. Returns 1 when not found. */
    jpegOrientation: function (b) {
      if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
      var i = 2;
      while (i + 4 < b.length) {
        if (b[i] !== 0xff) return 1;
        var marker = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
        if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) {
          var t = i + 10;                       // start of the TIFF header
          var le = b[t] === 0x49;               // "II" = little-endian
          var u16 = function (o) { return le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]; };
          var u32 = function (o) { return le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
                                             : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; };
          var ifd = t + u32(t + 4);
          var count = u16(ifd);
          for (var e = 0; e < count; e++) {
            var entry = ifd + 2 + e * 12;
            if (entry + 10 > b.length) return 1;
            if (u16(entry) === 0x0112) return u16(entry + 8) || 1;
          }
          return 1;
        }
        if (marker === 0xda) return 1;          // image data starts: no EXIF
        i += 2 + len;
      }
      return 1;
    },

    /* Turns any picture file into something pdf-lib can place: JPG and PNG
       go in untouched (no quality lost); a turned phone photo, WebP, GIF or
       BMP is redrawn upright by the browser first. */
    imageForPdf: function (file, bytes) {
      var type = file.type;
      if (type === 'image/png' || (type === 'image/jpeg' && PDF.jpegOrientation(bytes) === 1)) {
        return Promise.resolve({ bytes: bytes, type: type });
      }
      return CJA_IMG.load(file).then(function (s) {
        /* Browsers apply the orientation when drawing, so the canvas is upright. */
        var c = CJA_IMG.canvas(s.width, s.height);
        c.getContext('2d').drawImage(s.img, 0, 0);
        URL.revokeObjectURL(s.url);
        var keepAlpha = type !== 'image/jpeg';
        return CJA_IMG.toBlob(c, keepAlpha ? 'image/png' : 'image/jpeg', 0.92).then(function (blob) {
          return blob.arrayBuffer().then(function (ab) {
            return { bytes: new Uint8Array(ab), type: blob.type };
          });
        });
      });
    },

    /* A drop zone for one or many files, used by every PDF tool. */
    fileZone: function (zone, input, onFiles) {
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
        if (e.dataTransfer && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      });
      input.addEventListener('change', function () {
        if (input.files.length) onFiles(Array.from(input.files));
        input.value = '';
      });
    }
  };

  function range(a, b) {
    var out = [];
    for (var i = a; i <= b; i++) out.push(i - 1);
    return out;
  }

  window.CJA_PDF = PDF;
})();
