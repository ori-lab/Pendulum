/* The Cabinet — router and application shell. */
(function () {
  'use strict';
  const C = window.C;
  C.views = C.views || {};

  const ROUTES = [
    [/^\/?$/, 'library'],
    [/^\/library$/, 'library'],
    [/^\/add$/, 'add'],
    [/^\/added\/([^/]+)$/, 'added', ['id']],
    [/^\/deck\/([^/]+)$/, 'profile', ['id']],
    [/^\/interview\/([^/]+)$/, 'interview', ['id']],
    [/^\/interviews$/, 'interviews'],
    [/^\/finder$/, 'finder'],
    [/^\/journal$/, 'journal'],
    [/^\/journal\/new$/, 'entryNew'],
    [/^\/entry\/([^/]+)$/, 'entry', ['id']],
    [/^\/entry\/([^/]+)\/edit$/, 'entryEdit', ['id']],
    [/^\/archive$/, 'archive'],
    [/^\/search$/, 'search']
  ];

  function parse() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    for (const [re, name, keys] of ROUTES) {
      const m = path.match(re);
      if (m) {
        const params = { query };
        (keys || []).forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        return { name, params, path: raw };
      }
    }
    return { name: 'library', params: { query }, path: raw };
  }

  let cleanup = null;
  const scrolls = {};
  let current = null;
  const stack = [];

  /* Debounced autosave helpers; all pending saves flush on navigation. */
  const pending = new Set();
  C.saver = function (fn, ms) {
    let t = null;
    const s = function () {
      clearTimeout(t);
      pending.add(s);
      t = setTimeout(() => { pending.delete(s); fn(); }, ms || 450);
    };
    s.flush = function () {
      if (!pending.has(s)) return;
      clearTimeout(t);
      pending.delete(s);
      return fn();
    };
    return s;
  };
  C._flushSaves = function () { return Promise.all(Array.from(pending).map((s) => s.flush())); };

  C.go = function (hash, replace) {
    if (replace) location.replace(hash);
    else location.hash = hash;
  };
  C.back = function (fallback) {
    if (stack.length > 1) history.back();
    else C.go(fallback || '#/library', true);
  };
  C.rerender = function () { render(true); };
  /* Change the URL without re-rendering (e.g. once a new record exists). */
  C.replaceHash = function (h) {
    history.replaceState(null, '', h);
    stack[stack.length - 1] = h;
    if (current) current = Object.assign({}, current, { path: h.replace(/^#/, '') });
  };

  async function render(keepScroll) {
    const route = parse();
    if (current && !keepScroll) scrolls[current.path] = window.scrollY;
    await C._flushSaves();
    if (cleanup) { try { await cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    C.closeSheet();

    const view = C.views[route.name];
    const app = document.getElementById('app');
    const navHolder = document.getElementById('nav');
    const navKey = view.nav === undefined ? route.name : view.nav;
    document.body.classList.toggle('no-nav', !navKey);
    navHolder.innerHTML = navKey ? C.ui.nav(navKey) : '';

    let html;
    try {
      html = await view.render(route.params);
    } catch (e) {
      console.error(e);
      html = '<div class="empty"><h3>Something went astray</h3><p>' + C.esc(e.message) + '</p><a class="btn" href="#/library">Return to the library</a></div>';
    }
    if (html === null) return; // view redirected
    app.innerHTML = '<div class="view">' + html + '</div>';
    document.title = (view.title ? (typeof view.title === 'function' ? view.title(route.params) : view.title) + ' — ' : '') + 'The Cabinet';
    C.hydratePhotos(app);
    if (view.mount) {
      try { cleanup = (await view.mount(app, route.params)) || null; } catch (e) { console.error(e); }
    }

    const prevPath = current && current.path;
    current = route;
    if (keepScroll) return;
    const y = view.restoreScroll && scrolls[route.path] != null ? scrolls[route.path] : 0;
    window.scrollTo(0, y);
    if (prevPath !== route.path) {
      const h = app.querySelector('h1, h2');
      if (h && !app.querySelector('[autofocus]')) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }

  function track() {
    const p = location.hash || '#/';
    if (stack.length > 1 && stack[stack.length - 2] === p) stack.pop();
    else if (stack[stack.length - 1] !== p) stack.push(p);
  }
  window.addEventListener('hashchange', () => { track(); render(); });

  // Back buttons: prefer real history so scroll positions return.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-back]');
    if (b) { e.preventDefault(); C.back(b.getAttribute('href')); }
  });

  window.addEventListener('pagehide', () => { if (cleanup) cleanup(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && C._flushSaves) C._flushSaves(); });

  async function start() {
    await C.store.load();
    track();
    render();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  document.addEventListener('DOMContentLoaded', start);
})();
