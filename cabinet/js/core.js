/* The Cabinet — core utilities, persistence and in-memory store.
   Everything hangs off a single global namespace: window.C */
(function () {
  'use strict';
  const C = (window.C = window.C || {});
  C.views = C.views || {};
  C.state = C.state || {};

  /* ------------------------------------------------------------------ utils */

  C.esc = function (s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  C.attr = C.esc;

  C.uid = function (prefix) {
    const r = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + Date.now().toString(36) + r;
  };

  C.now = () => new Date().toISOString();
  C.today = function () {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  C.MONTHS = MONTHS;
  C.parseDate = function (s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d;
  };
  C.fmtDate = function (s, opts) {
    const d = C.parseDate(s);
    if (!d) return '';
    if (opts === 'short') return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  };
  C.relDays = function (iso) {
    const d = C.parseDate(iso);
    if (!d) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  };

  C.debounce = function (fn, ms) {
    let t;
    const wrapped = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
    wrapped.flush = function (...args) { clearTimeout(t); fn.apply(this, args); };
    return wrapped;
  };

  C.getPath = function (obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  };
  C.setPath = function (obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  };

  C.clone = (o) => JSON.parse(JSON.stringify(o));
  C.uniq = (arr) => Array.from(new Set(arr.filter((x) => x !== undefined && x !== null && x !== '')));
  C.splitCards = function (s) {
    if (!s) return [];
    return String(s)
      .split(/\n|,|;/)
      .map((x) => x.trim())
      .filter(Boolean);
  };
  C.pad = (n, w) => String(n).padStart(w || 3, '0');

  /* ------------------------------------------------------------------ icons */

  const P = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    library: '<rect x="3.5" y="4" width="17" height="16" rx="1"/><path d="M3.5 12h17M10 8h4M10 16h4"/>',
    interview: '<path d="M5 4.5h14v11H9l-4 4z"/><path d="M9 9h6M9 12h4"/>',
    finder: '<circle cx="12" cy="12" r="8"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    journal: '<path d="M6 3.5h11.5v17H6a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 016 3.5z"/><path d="M8.5 8h6M8.5 11h6M8.5 3.5v17"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    grid: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z"/>',
    bookmark: '<path d="M7 3.5h10v17l-5-4-5 4z"/>',
    camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    archive: '<rect x="3.5" y="4" width="17" height="5"/><path d="M5 9v11h14V9M10 13h4"/>',
    edit: '<path d="M15 5l4 4L8.5 19.5H4.5v-4z"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M6 12v7.5h12V12"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    image: '<rect x="4" y="5" width="16" height="14"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    sparkle: '<path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    drawer: '<rect x="2" y="3" width="20" height="18" rx="1"/><rect x="7" y="7" width="10" height="4" rx="0.5"/><path d="M10 15.5h4"/>'
  };
  C.icon = function (name, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
  };

  /* --------------------------------------------------------------- feedback */

  let toastTimer;
  C.toast = function (msg, kind) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      wrap.innerHTML = '<div class="toast"><span class="dot"></span><span class="msg"></span></div>';
      document.body.appendChild(wrap);
    }
    const t = wrap.querySelector('.toast');
    t.className = 'toast ' + (kind || 'saved');
    t.querySelector('.msg').textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  };

  /* Inline "Saved" indicators — any element with [data-save-state] */
  C.markSaving = function () {
    document.querySelectorAll('[data-save-state]').forEach((el) => {
      el.innerHTML = 'Saving…';
    });
  };
  C.markSaved = function () {
    const failed = !C.db.persistent;
    document.querySelectorAll('[data-save-state]').forEach((el) => {
      el.innerHTML = failed
        ? '<span style="color:var(--oxblood)">Not saved to device</span>'
        : '<span class="tick">' + C.icon('check') + '</span> Saved';
    });
  };

  /* ------------------------------------------------------------------ sheets */

  C.openSheet = function (html, onMount) {
    C.closeSheet();
    const back = document.createElement('div');
    back.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = '<div class="grip"></div>' + html;
    back.addEventListener('click', C.closeSheet);
    document.body.appendChild(back);
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';
    C._sheet = { back, sheet };
    const esc = (e) => { if (e.key === 'Escape') C.closeSheet(); };
    document.addEventListener('keydown', esc);
    C._sheet.esc = esc;
    if (onMount) onMount(sheet);
    const f = sheet.querySelector('[autofocus]');
    if (f) setTimeout(() => f.focus(), 50);
    return sheet;
  };
  C.closeSheet = function () {
    if (!C._sheet) return;
    C._sheet.back.remove();
    C._sheet.sheet.remove();
    document.removeEventListener('keydown', C._sheet.esc);
    document.body.style.overflow = '';
    C._sheet = null;
  };

  C.confirm = function (opts) {
    return new Promise((resolve) => {
      C.openSheet(
        '<h3>' + C.esc(opts.title) + '</h3>' +
          (opts.body ? '<p class="muted">' + opts.body + '</p>' : '') +
          '<div class="actions-row stack">' +
          '<button class="btn ' + (opts.danger ? 'primary' : 'primary') + '" data-ok>' + C.esc(opts.ok || 'Confirm') + '</button>' +
          '<button class="btn quiet" data-cancel>' + C.esc(opts.cancel || 'Cancel') + '</button>' +
          '</div>',
        (sheet) => {
          sheet.querySelector('[data-ok]').onclick = () => { C.closeSheet(); resolve(true); };
          sheet.querySelector('[data-cancel]').onclick = () => { C.closeSheet(); resolve(false); };
        }
      );
    });
  };

  C.prompt = function (opts) {
    return new Promise((resolve) => {
      C.openSheet(
        '<h3>' + C.esc(opts.title) + '</h3>' +
          (opts.body ? '<p class="muted">' + opts.body + '</p>' : '') +
          '<form data-form>' +
          (opts.multiline
            ? '<textarea class="textarea" name="v" autofocus placeholder="' + C.attr(opts.placeholder || '') + '">' + C.esc(opts.value || '') + '</textarea>'
            : '<input class="input" name="v" autofocus value="' + C.attr(opts.value || '') + '" placeholder="' + C.attr(opts.placeholder || '') + '">') +
          '<div class="actions-row stack"><button class="btn primary" type="submit">' + C.esc(opts.ok || 'Save') + '</button>' +
          '<button class="btn quiet" type="button" data-cancel>Cancel</button></div></form>',
        (sheet) => {
          sheet.querySelector('[data-form]').onsubmit = (e) => {
            e.preventDefault();
            const v = sheet.querySelector('[name=v]').value.trim();
            C.closeSheet();
            resolve(v);
          };
          sheet.querySelector('[data-cancel]').onclick = () => { C.closeSheet(); resolve(null); };
        }
      );
    });
  };

  C.lightbox = function (src) {
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.innerHTML = '<img alt="" src="' + C.attr(src) + '"><button class="icon-btn" aria-label="Close">' + C.icon('close') + '</button>';
    el.onclick = () => el.remove();
    document.body.appendChild(el);
  };

  /* ------------------------------------------------------------------ images */

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ img, url }); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }
  function toBlob(img, max, quality) {
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
  }
  /* Resizes an uploaded image and stores full + thumbnail versions. Returns photo id. */
  C.ingestPhoto = async function (file) {
    const { img, url } = await loadImage(file);
    try {
      const full = await toBlob(img, 1800, 0.86);
      const thumb = await toBlob(img, 640, 0.8);
      const id = C.uid('ph');
      await C.db.put('photos', { id, full, thumb, type: 'image/jpeg', createdAt: C.now() });
      return id;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const urlCache = {};
  C.photoURL = function (id, size) {
    const key = id + ':' + (size || 'thumb');
    return urlCache[key] || null;
  };
  C.loadPhotoURL = async function (id, size) {
    if (!id) return null;
    const key = id + ':' + (size || 'thumb');
    if (urlCache[key]) return urlCache[key];
    const rec = await C.db.get('photos', id);
    if (!rec) return null;
    const blob = size === 'full' ? rec.full : rec.thumb || rec.full;
    if (!blob) return null;
    urlCache[key] = URL.createObjectURL(blob);
    return urlCache[key];
  };
  C.forgetPhoto = function (id) {
    ['thumb', 'full'].forEach((s) => {
      const k = id + ':' + s;
      if (urlCache[k]) { URL.revokeObjectURL(urlCache[k]); delete urlCache[k]; }
    });
  };
  /* After a render, fill every <img data-photo="id"> from IndexedDB. */
  C.hydratePhotos = function (root) {
    (root || document).querySelectorAll('img[data-photo]').forEach(async (img) => {
      const id = img.getAttribute('data-photo');
      const size = img.getAttribute('data-size') || 'thumb';
      const cached = C.photoURL(id, size);
      if (cached) { img.src = cached; return; }
      const url = await C.loadPhotoURL(id, size);
      if (url) img.src = url;
    });
  };

  C.blobToDataURL = function (blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };
  C.dataURLToBlob = async function (dataURL) {
    const res = await fetch(dataURL);
    return res.blob();
  };

  /* --------------------------------------------------------------- database */
  /* IndexedDB with a transparent in-memory fallback. When the fallback is in
     use, C.db.persistent is false and the interface says so plainly. */

  const DB_NAME = 'the-cabinet';
  const DB_VERSION = 1;
  const STORES = ['decks', 'journal', 'photos', 'meta'];

  const memory = { decks: new Map(), journal: new Map(), photos: new Map(), meta: new Map() };
  let idb = null;

  function req(r) {
    return new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  C.db = {
    persistent: false,
    async open() {
      if (!('indexedDB' in window)) return false;
      try {
        idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open(DB_NAME, DB_VERSION);
          r.onupgradeneeded = () => {
            const d = r.result;
            STORES.forEach((s) => {
              if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
            });
          };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          r.onblocked = () => reject(new Error('blocked'));
        });
        // Probe a write — some private modes open but refuse writes.
        await req(idb.transaction('meta', 'readwrite').objectStore('meta').put({ key: '_probe', at: C.now() }));
        this.persistent = true;
      } catch (e) {
        console.warn('IndexedDB unavailable, using memory only', e);
        idb = null;
        this.persistent = false;
      }
      return this.persistent;
    },
    async all(store) {
      if (!idb) return Array.from(memory[store].values());
      return req(idb.transaction(store).objectStore(store).getAll());
    },
    async get(store, id) {
      if (!idb) return memory[store].get(id);
      return req(idb.transaction(store).objectStore(store).get(id));
    },
    async put(store, value) {
      if (!idb) { memory[store].set(value.id || value.key, value); return; }
      return req(idb.transaction(store, 'readwrite').objectStore(store).put(value));
    },
    async del(store, id) {
      if (!idb) { memory[store].delete(id); return; }
      return req(idb.transaction(store, 'readwrite').objectStore(store).delete(id));
    },
    async clear(store) {
      if (!idb) { memory[store].clear(); return; }
      return req(idb.transaction(store, 'readwrite').objectStore(store).clear());
    }
  };

  /* ------------------------------------------------------------------ store */

  const DEFAULT_SETTINGS = () => ({
    key: 'settings',
    nextCatalogNo: 1,
    view: 'gallery',
    sort: 'added',
    customQuestions: [],
    tags: [],
    lastBackupAt: null,
    persistGranted: null,
    finderLast: null
  });

  C.store = {
    decks: [],
    journal: [],
    settings: DEFAULT_SETTINGS(),

    async load() {
      await C.db.open();
      const [decks, journal, meta] = await Promise.all([C.db.all('decks'), C.db.all('journal'), C.db.get('meta', 'settings')]);
      this.decks = (decks || []).map(C.model.normalizeDeck);
      this.journal = (journal || []).map(C.model.normalizeEntry);
      this.settings = Object.assign(DEFAULT_SETTINGS(), meta || {});
      // Ask the browser not to evict our data (best effort; silent).
      try {
        if (navigator.storage && navigator.storage.persist && C.db.persistent) {
          const already = await navigator.storage.persisted();
          this.settings.persistGranted = already || (await navigator.storage.persist());
        }
      } catch (e) { /* not supported */ }
    },

    deck(id) { return this.decks.find((d) => d.id === id); },
    entry(id) { return this.journal.find((e) => e.id === id); },
    entriesFor(deckId) {
      return this.journal.filter((e) => (e.deckIds || []).includes(deckId)).sort(C.model.byEntryDateDesc);
    },

    async saveDeck(deck, opts) {
      deck.updatedAt = C.now();
      if (!this.deck(deck.id)) this.decks.push(deck);
      C.markSaving();
      await C.db.put('decks', C.clone(deck));
      C.markSaved();
      if (!opts || !opts.silent) C.toast('Saved');
      return deck;
    },
    async deleteDeck(id) {
      const d = this.deck(id);
      if (!d) return;
      if (d.photoId) { await C.db.del('photos', d.photoId); C.forgetPhoto(d.photoId); }
      this.decks = this.decks.filter((x) => x.id !== id);
      await C.db.del('decks', id);
      // Detach from journal entries but keep the entries themselves.
      for (const e of this.journal) {
        if ((e.deckIds || []).includes(id)) {
          e.deckIds = e.deckIds.filter((x) => x !== id);
          e.deletedDeckNames = C.uniq([...(e.deletedDeckNames || []), d.name]);
          await C.db.put('journal', C.clone(e));
        }
      }
      // Remove pairing references
      for (const other of this.decks) {
        if ((other.pairings || []).some((p) => p.deckId === id)) {
          other.pairings = other.pairings.filter((p) => p.deckId !== id);
          await C.db.put('decks', C.clone(other));
        }
      }
    },

    async saveEntry(entry, opts) {
      entry.updatedAt = C.now();
      if (!this.entry(entry.id)) this.journal.push(entry);
      C.markSaving();
      await C.db.put('journal', C.clone(entry));
      C.markSaved();
      if (!opts || !opts.silent) C.toast('Saved');
      return entry;
    },
    async deleteEntry(id) {
      const e = this.entry(id);
      if (!e) return;
      for (const pid of e.photoIds || []) { await C.db.del('photos', pid); C.forgetPhoto(pid); }
      this.journal = this.journal.filter((x) => x.id !== id);
      await C.db.del('journal', id);
      // Remove discoveries that came from this entry
      for (const d of this.decks) {
        const before = (d.discoveries || []).length;
        d.discoveries = (d.discoveries || []).filter((x) => x.entryId !== id);
        if (d.discoveries.length !== before) await C.db.put('decks', C.clone(d));
      }
    },

    async saveSettings(opts) {
      await C.db.put('meta', C.clone(this.settings));
      if (opts && opts.toast) C.toast('Saved');
    },

    allTags() {
      const t = new Set(this.settings.tags || []);
      this.decks.forEach((d) => (d.tags || []).forEach((x) => t.add(x)));
      this.journal.forEach((e) => (e.tags || []).forEach((x) => t.add(x)));
      return Array.from(t).sort((a, b) => a.localeCompare(b));
    },

    nextCatalogNo() {
      const used = this.decks.filter((d) => !d.sample).map((d) => d.catalogNo || 0);
      const n = Math.max(this.settings.nextCatalogNo || 1, (used.length ? Math.max(...used) : 0) + 1);
      this.settings.nextCatalogNo = n + 1;
      this.saveSettings();
      return n;
    }
  };
})();
