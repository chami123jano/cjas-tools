/* Shared shell for every page: header, sidebar, search, theme.
   Pages declare what they are with <body data-page="home"> or
   <body data-page="tool" data-slug="...">. Everything else is worked out here. */

(function () {
  var body = document.body;
  var page = body.dataset.page || 'home';
  var root = page === 'home' ? '' : '../';

  /* ---------- theme ---------- */

  function readTheme() {
    try { return localStorage.getItem('cja-theme'); } catch (e) { return null; }
  }

  function applyTheme(t) {
    if (t) document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var next = current ? (current === 'dark' ? 'light' : 'dark') : (dark ? 'light' : 'dark');
    applyTheme(next);
    try { localStorage.setItem('cja-theme', next); } catch (e) { /* private window */ }
  }

  applyTheme(readTheme());

  /* ---------- header ---------- */

  function buildHeader() {
    var hdr = document.createElement('header');
    hdr.className = 'hdr';
    hdr.innerHTML =
      '<a class="brand" href="' + root + 'index.html">' +
        '<span class="brand-mark">CJA</span>' +
        '<span class="brand-text">Cja’s Tools</span>' +
      '</a>' +
      '<div class="search-wrap">' +
        '<input id="search" type="text" placeholder="Search tools…" ' +
        'autocomplete="off" spellcheck="false">' +
      '</div>' +
      '<button class="icon-btn" id="theme-btn" title="Light / dark" ' +
      'aria-label="Switch between light and dark">◐</button>';
    body.insertBefore(hdr, body.firstChild);
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
  }

  /* ---------- sidebar ---------- */

  function builtCount(catId) {
    return TOOLS.filter(function (t) { return t.category === catId; }).length;
  }

  function buildSidebar(activeCat) {
    var nav = document.createElement('nav');
    nav.className = 'side';
    var html = '<div class="side-title">Categories</div>';
    html += '<a href="' + root + 'index.html"' +
            (activeCat ? '' : ' class="on"') + '>' +
            '<span>✨</span><span>All tools</span>' +
            '<span class="count">' + TOOLS.length + '</span></a>';
    CATEGORIES.forEach(function (c) {
      var n = builtCount(c.id);
      html += '<a href="' + root + 'index.html?cat=' + c.id + '"' +
              (activeCat === c.id ? ' class="on"' : '') + '>' +
              '<span>' + c.icon + '</span><span>' + c.name + '</span>' +
              '<span class="count">' + n + '/' + c.planned + '</span></a>';
    });
    nav.innerHTML = html;
    return nav;
  }

  /* ---------- helpers other tools use ---------- */

  var toastEl = null;
  var toastTimer = null;

  window.CT = {
    toast: function (msg) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.className = 'toast';
        document.body.appendChild(toastEl);
      }
      toastEl.textContent = msg;
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
    },

    copy: function (text) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { CT.toast('Copied'); },
          function () { CT.toast('Could not copy'); }
        );
        return;
      }
      /* file:// and older webviews have no clipboard API */
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); CT.toast('Copied'); }
      catch (e) { CT.toast('Could not copy'); }
      document.body.removeChild(ta);
    },

    /* Rounds sensibly for display: no trailing .00, but keeps real decimals.
       maximumFractionDigits has to be passed through - toLocaleString caps
       at three decimals by default, which would quietly throw away the
       precision the caller just asked for. */
    num: function (n, places) {
      if (!isFinite(n)) return '—';
      var p = places === undefined ? 2 : places;
      return parseFloat(n.toFixed(p))
        .toLocaleString('en-US', { maximumFractionDigits: p });
    }
  };

  /* ---------- home page ---------- */

  function card(t) {
    return '<a class="card" href="' + root + 'tools/' + t.slug + '.html">' +
           '<strong>' + t.name + '</strong><span>' + t.desc + '</span></a>';
  }

  function renderHome(mount, activeCat, query) {
    var q = (query || '').trim().toLowerCase();
    var list = TOOLS;

    if (activeCat) {
      list = list.filter(function (t) { return t.category === activeCat; });
    }
    if (q) {
      list = TOOLS.filter(function (t) {
        var hay = (t.name + ' ' + t.desc + ' ' + t.keywords.join(' ')).toLowerCase();
        return hay.indexOf(q) !== -1;
      });
    }

    if (!list.length) {
      mount.innerHTML = '<div class="empty">' +
        (q ? 'No tool matches “' + q + '” yet.'
           : 'Nothing in this category yet.') +
        '<br>More arrive with every update.</div>';
      return;
    }

    /* When searching, one flat list reads better than grouped sections. */
    if (q) {
      mount.innerHTML = '<div class="group"><h2>' + list.length +
        ' result' + (list.length === 1 ? '' : 's') + '</h2>' +
        '<div class="grid">' + list.map(card).join('') + '</div></div>';
      return;
    }

    var html = '';
    CATEGORIES.forEach(function (c) {
      var inCat = list.filter(function (t) { return t.category === c.id; });
      if (!inCat.length) return;
      html += '<div class="group"><h2>' + c.icon + ' ' + c.name +
              '<span class="soon">' + inCat.length + ' of ' + c.planned + '</span></h2>' +
              '<div class="grid">' + inCat.map(card).join('') + '</div></div>';
    });
    mount.innerHTML = html;
  }

  /* ---------- wire it up ---------- */

  buildHeader();

  var params = new URLSearchParams(window.location.search);
  var activeCat = params.get('cat');
  if (activeCat && !CATEGORIES.some(function (c) { return c.id === activeCat; })) {
    activeCat = null;
  }

  var shell = document.querySelector('.shell');
  if (shell) shell.insertBefore(buildSidebar(activeCat), shell.firstChild);

  var searchInput = document.getElementById('search');

  if (page === 'home') {
    var mount = document.getElementById('tool-list');
    var heading = document.getElementById('hero-title');
    var sub = document.getElementById('hero-sub');

    if (activeCat) {
      var c = CATEGORIES.find(function (x) { return x.id === activeCat; });
      if (heading) heading.textContent = c.icon + ' ' + c.name;
      if (sub) sub.textContent = builtCount(activeCat) + ' of ' + c.planned + ' built so far.';
    }

    renderHome(mount, activeCat, '');

    searchInput.addEventListener('input', function () {
      var q = searchInput.value;
      if (heading) {
        heading.textContent = q ? 'Search' :
          (activeCat ? CATEGORIES.find(function (x) { return x.id === activeCat; }).name
                     : 'All tools');
      }
      renderHome(mount, activeCat, q);
    });
  } else {
    /* On a tool page, typing in the search box takes you home with that query. */
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        window.location.href = root + 'index.html?q=' +
          encodeURIComponent(searchInput.value.trim());
      }
    });
  }

  /* A query handed over from a tool page. */
  var handedOver = params.get('q');
  if (handedOver && page === 'home') {
    searchInput.value = handedOver;
    searchInput.dispatchEvent(new Event('input'));
  }

  /* Press / anywhere to jump to search. */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== searchInput &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault();
      searchInput.focus();
    }
  });
})();
