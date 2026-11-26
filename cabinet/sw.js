/* The Cabinet — service worker. App shell is cached for offline use.
   Your records live in IndexedDB, not here. */
const VERSION = 'cabinet-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/cabinet.css',
  './js/core.js', './js/model.js', './js/ui.js', './js/backup.js', './js/demo.js',
  './js/views/library.js', './js/views/deckform.js', './js/views/interview.js', './js/views/profile.js',
  './js/views/journal.js', './js/views/finder.js', './js/views/archive.js', './js/app.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && !k.startsWith('cabinet-fonts')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache-first, kept across app updates.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('cabinet-fonts').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try { const res = await fetch(req); c.put(req, res.clone()); return res; } catch (err) { return hit || Response.error(); }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // App shell: network-first so updates arrive, falling back to cache offline.
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
  );
});
