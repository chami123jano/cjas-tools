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
      if (opts.onLine !== undefined) {
        Object.defineProperty(window.navigator, 'onLine',
          { value: opts.onLine, configurable: true });
      }
    }
  });

  const { window } = dom;
  const { document } = window;

  // The page's <script src> tags are not fetched by jsdom, so the shared
  // files are injected by hand in the same order the page lists them.
  for (const rel of ['assets/tools.js', 'assets/app.js']) {
    const code = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const el = document.createElement('script');
    el.textContent = code;
    document.body.appendChild(el);
  }
  for (const vendor of html.match(/vendor\/[\w.]+\.js/g) || []) {
    const code = fs.readFileSync(path.join(SRC, 'assets', vendor), 'utf8');
    const el = document.createElement('script');
    el.textContent = code;
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
