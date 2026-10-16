/* Loads a real tool page in a fake browser so tests can drive the actual
   inputs and read the actual results, rather than a copy of the logic.
   Used by test/run.js - see that file for how a test looks. */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = path.join(__dirname, '..', 'src');

function loadTool(slug, opts = {}) {
  const file = path.join(SRC, 'tools', slug + '.html');
  const html = fs.readFileSync(file, 'utf8');

  // Strip every script from the markup first. jsdom would run the inline
  // ones straight away, before the shared files they depend on exist, and
  // the resulting errors bury real failures in noise. They are injected
  // below instead, in the order the page lists them.
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const dom = new JSDOM(stripped, {
    url: 'https://example.test/tools/' + slug + '.html',
    runScripts: 'dangerously',
    resources: undefined,
    pretendToBeVisual: true,
    beforeParse(window) {
      // jsdom has no matchMedia, which app.js uses for the dark theme
      window.matchMedia = () => ({
        matches: false, addEventListener() {}, removeEventListener() {}
      });
      // nor a real clipboard
      window.navigator.clipboard = {
        writeText: () => Promise.resolve(),
        readText: () => Promise.resolve('')
      };
      // jsdom has no fetch. Tests that need the network pass their own;
      // everything else behaves as if the machine were offline, which is
      // the state these tools have to cope with anyway.
      window.fetch = opts.fetch || (() => Promise.reject(new Error('offline')));

      // jsdom has no canvas, and getContext returns null, so any drawing
      // tool would throw on load. This stub records the calls instead of
      // rendering: enough to prove the code runs and computes the right
      // geometry, but it does NOT verify anything is actually drawn.
      window.HTMLCanvasElement.prototype.getContext = function () {
        if (!this.__ctx) {
          const calls = [];
          const noop = (name) => (...args) => { calls.push([name, ...args]); };
          this.__ctx = {
            calls,
            canvas: this,
            fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
            lineCap: '', lineJoin: '', globalAlpha: 1, textBaseline: '',
            fillRect: noop('fillRect'), clearRect: noop('clearRect'),
            strokeRect: noop('strokeRect'), beginPath: noop('beginPath'),
            closePath: noop('closePath'), moveTo: noop('moveTo'),
            lineTo: noop('lineTo'), stroke: noop('stroke'), fill: noop('fill'),
            arc: noop('arc'), save: noop('save'), restore: noop('restore'),
            translate: noop('translate'), rotate: noop('rotate'),
            scale: noop('scale'), fillText: noop('fillText'),
            strokeText: noop('strokeText'), drawImage: noop('drawImage'),
            setTransform: noop('setTransform'),
            // rough but stable: enough for line-wrapping logic to behave
            measureText: (s) => ({ width: String(s).length * 8 }),
            getImageData: (x, y, w, h) => ({
              width: w, height: h, data: new Uint8ClampedArray(w * h * 4)
            }),
            putImageData: noop('putImageData'),
            createImageData: (w, h) => ({ width: w, height: h })
          };
        }
        return this.__ctx;
      };
      window.HTMLCanvasElement.prototype.toDataURL = function () {
        return 'data:image/png;base64,stub';
      };
      if (opts.onLine !== undefined) {
        Object.defineProperty(window.navigator, 'onLine',
          { value: opts.onLine, configurable: true });
      }
    }
  });

  const { window } = dom;
  const { document } = window;

  // jsdom does not fetch <script src>, so every file the page references is
  // read off disk and injected here, in the order the page lists them. Read
  // from the markup rather than a fixed list, so a page pulling in a new
  // shared file just works instead of failing with an undefined global.
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of srcs) {
    const rel = src.replace(/^(\.\.\/)+/, '');
    const file = path.join(SRC, rel);
    if (!fs.existsSync(file)) {
      throw new Error(slug + '.html references ' + src + ', which does not exist');
    }
    const el = document.createElement('script');
    el.textContent = fs.readFileSync(file, 'utf8');
    document.body.appendChild(el);
  }

  // Finally the page's own inline scripts, which expect the shell to exist.
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const el = document.createElement('script');
    el.textContent = m[1];
    document.body.appendChild(el);
  }

  const $ = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  return {
    window, document, $, byId,

    /* Set a form field and fire the events a real user would cause. */
    set(id, value) {
      const el = byId(id);
      if (!el) throw new Error('no element #' + id);
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = String(value);
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
      return this;
    },

    click(id) {
      byId(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      return this;
    },

    /* Visible text of an element, whitespace collapsed. */
    text(id) {
      const el = byId(id);
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    },

    close() { window.close(); }
  };
}

module.exports = { loadTool, SRC };
