/* Keeps the parts every page shares the same, and the website's index for
   search engines up to date. Run after adding or renaming a tool:

     npm run pages

   It writes:
   - the shared lines at the top of every page, between <!-- cja:head -->
     and <!-- /cja:head -->: the icon in the browser tab, the page's proper
     address for search engines, and what a shared link shows (title,
     description, picture);
   - a plain list of every tool on the home page, between <!-- cja:list -->
     and <!-- /cja:list -->, so search engines and browsers without
     JavaScript still find every tool;
   - src/sitemap.xml, the list of pages to give to Google Search Console.

   The tests fail if anything is out of date (node scripts/pages.js --check). */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const SITE = 'https://chami123jano.github.io/cjas-tools/';
const START = '<!-- cja:head -->';
const END = '<!-- /cja:head -->';
const LIST_START = '<!-- cja:list -->';
const LIST_END = '<!-- /cja:list -->';

function registry() {
  const win = {};
  new Function('window', fs.readFileSync(path.join(SRC, 'assets', 'tools.js'), 'utf8'))(win);
  return win;
}

/* Every page: the home page, the About page, and each tool. */
function pages() {
  const list = ['index.html', 'about.html'].filter((f) => fs.existsSync(path.join(SRC, f)));
  fs.readdirSync(path.join(SRC, 'tools')).filter((f) => f.endsWith('.html')).sort()
    .forEach((f) => list.push('tools/' + f));
  return list;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/* Text already written into a page may contain &amp; and the like. */
function unesc(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function url(file) {
  return SITE + (file === 'index.html' ? '' : file);
}

function block(file, html) {
  const up = file.indexOf('/') === -1 ? '' : '../';
  const title = unesc((/<title>([^<]*)<\/title>/.exec(html) || [0, "Cja's Tools"])[1]);
  const desc = unesc((/<meta name="description" content="([^"]*)">/.exec(html) || [0, ''])[1]);
  const lines = [
    START,
    '<link rel="icon" href="' + up + 'assets/icon.svg" type="image/svg+xml">',
    '<link rel="icon" href="' + up + 'assets/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="' + up + 'assets/icon-256.png">',
    /* A page set to dark is dark from the first moment, with no white flash. */
    '<script>try{var t=localStorage.getItem("cja-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>',
    '<link rel="canonical" href="' + url(file) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Cja’s Tools">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:url" content="' + url(file) + '">',
    '<meta property="og:image" content="' + SITE + 'assets/social.png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">'
  ];
  if (file === 'index.html') {
    const n = registry().TOOLS.length;
    lines.push('<script type="application/ld+json">' + JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Cja’s Tools',
      url: SITE,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Windows, any web browser',
      description: n + ' free tools for PDFs, images, video, audio, text, money and more. Files are never uploaded.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      downloadUrl: 'https://github.com/chami123jano/cjas-tools/releases/latest'
    }) + '</script>');
  }
  lines.push(END);
  return lines.join('\n');
}

/* The home page's plain list: the same cards the page draws, grouped. */
function list() {
  const { TOOLS, CATEGORIES } = registry();
  const out = [LIST_START];
  CATEGORIES.forEach((c) => {
    const inCat = TOOLS.filter((t) => t.category === c.id);
    if (!inCat.length) return;
    out.push('<div class="group"><h2>' + c.icon + ' ' + esc(c.name) + '<span class="soon">' + inCat.length + '</span></h2><div class="grid">');
    inCat.forEach((t) => out.push('<a class="card" href="tools/' + t.slug + '.html"><strong>' + esc(t.name) + '</strong><span>' + esc(t.desc) + '</span></a>'));
    out.push('</div></div>');
  });
  out.push(LIST_END);
  return out.join('\n');
}

function between(html, a, b, want, file, after) {
  const i = html.indexOf(a), j = html.indexOf(b);
  if (i !== -1 && j !== -1) return html.slice(0, i) + want + html.slice(j + b.length);
  const m = after.exec(html);
  if (!m) throw new Error(file + ': nowhere to put ' + a);
  const at = m.index + m[0].length;
  return html.slice(0, at) + want + '\n' + html.slice(at);
}

/* The page's text with the shared parts put in, or brought up to date. */
function update(file, html) {
  let next = between(html, START, END, block(file, html), file, /<link rel="stylesheet" href="(\.\.\/)?assets\/app\.css">\r?\n/);
  if (file === 'index.html') next = between(next, LIST_START, LIST_END, list(), file, /<div id="tool-list">\r?\n?/);
  return next;
}

function sitemap() {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages().map((f) => '  <url><loc>' + url(f) + '</loc></url>').join('\n') + '\n</urlset>\n';
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
  const map = path.join(SRC, 'sitemap.xml');
  const want = sitemap();
  if (!fs.existsSync(map) || fs.readFileSync(map, 'utf8') !== want) {
    stale.push('sitemap.xml');
    if (!check) fs.writeFileSync(map, want);
  }
  return stale;
}

module.exports = { pages, block, update, run, sitemap, list, SRC, SITE };

if (require.main === module) {
  const check = process.argv.includes('--check');
  const stale = run(check);
  if (check) {
    if (stale.length) { console.log('Out of date (run npm run pages): ' + stale.join(', ')); process.exit(1); }
    console.log('All ' + pages().length + ' pages and the sitemap are up to date.');
  } else {
    console.log(stale.length ? 'Updated ' + stale.length + ' files.' : 'Everything was already up to date.');
  }
}
