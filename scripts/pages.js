/* Keeps the shared lines at the top of every page the same: the icon in the
   browser tab, and (from Day 46) the details search engines and link
   previews read.

   They sit between <!-- cja:head --> and <!-- /cja:head --> just after the
   style sheet line. Run after adding a tool:   npm run pages
   The tests fail if a page is out of date (node scripts/pages.js --check). */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const START = '<!-- cja:head -->';
const END = '<!-- /cja:head -->';

/* Every page: the home page, the About page, and each tool. */
function pages() {
  const list = ['index.html', 'about.html'].filter((f) => fs.existsSync(path.join(SRC, f)));
  fs.readdirSync(path.join(SRC, 'tools')).filter((f) => f.endsWith('.html')).sort()
    .forEach((f) => list.push('tools/' + f));
  return list;
}

function block(file) {
  const up = file.indexOf('/') === -1 ? '' : '../';
  return [
    START,
    '<link rel="icon" href="' + up + 'assets/icon.svg" type="image/svg+xml">',
    '<link rel="icon" href="' + up + 'assets/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="' + up + 'assets/icon-256.png">',
    /* A page set to dark is dark from the first moment, with no white flash. */
    '<script>try{var t=localStorage.getItem("cja-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>',
    END
  ].join('\n');
}

/* The page's text with the block put in, or brought up to date. */
function update(file, html) {
  const want = block(file);
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a !== -1 && b !== -1) return html.slice(0, a) + want + html.slice(b + END.length);
  const css = /<link rel="stylesheet" href="(\.\.\/)?assets\/app\.css">\r?\n/.exec(html);
  if (!css) throw new Error(file + ': no app.css line to put the shared lines after');
  const at = css.index + css[0].length;
  return html.slice(0, at) + want + '\n' + html.slice(at);
}

function run(check) {
  const stale = [];
  pages().forEach((f) => {
    const full = path.join(SRC, f);
    const html = fs.readFileSync(full, 'utf8');
    const next = update(f, html);
    if (next !== html) {
      stale.push(f);
      if (!check) fs.writeFileSync(full, next);
    }
  });
  return stale;
}

module.exports = { pages, block, update, run, SRC };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = run(check);
  if (check) {
    if (stale.length) { console.log('Out of date (run npm run pages): ' + stale.join(', ')); process.exit(1); }
    console.log('All ' + pages().length + ' pages are up to date.');
  } else {
    console.log(stale.length ? 'Updated ' + stale.length + ' pages.' : 'All pages were already up to date.');
  }
}
