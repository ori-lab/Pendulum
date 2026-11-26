/* The Cabinet — reusable interface components and form binding. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = (s) => C.esc(s);

  const ui = (C.ui = {});

  /* ------------------------------------------------------------ deck art */

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  const EMBLEMS = {
    tarot: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1"><rect x="11" y="5" width="18" height="30"/><path d="M20 11v18M14 20h12"/><circle cx="20" cy="20" r="4"/></svg>',
    oracle: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1"><path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20z"/><circle cx="20" cy="20" r="5"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/></svg>',
    lenormand: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1"><rect x="6" y="8" width="12" height="18"/><rect x="22" y="14" width="12" height="18"/><path d="M12 13v8M28 19v8"/></svg>',
    other: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1"><path d="M20 4l14 16-14 16L6 20z"/><path d="M20 12v16"/></svg>'
  };

  /* A typographic cover for decks without a photograph. */
  ui.cover = function (deck) {
    const v = hash(deck.id || deck.name || 'x') % 5;
    return '<div class="cover v' + v + '">' +
      '<div class="c-top">' + esc(M().callNo(deck)) + '</div>' +
      '<div class="c-emblem">' + (EMBLEMS[deck.type] || EMBLEMS.other) + '</div>' +
      '<div class="c-name">' + esc(deck.name || 'Untitled deck') + '</div>' +
      '<div class="c-bot">' + esc(M().typeLabel(deck)) + '</div>' +
      '</div>';
  };

  ui.deckImage = function (deck, size) {
    if (deck.photoId) {
      return '<img alt="' + C.attr(deck.name) + '" data-photo="' + C.attr(deck.photoId) + '" data-size="' + (size || 'thumb') + '" loading="lazy">';
    }
    return ui.cover(deck);
  };

  ui.statusStamp = function (deck, opts) {
    const s = M().status(deck);
    if (s === 'complete') return '<span class="stamp olive' + (opts && opts.tilt ? ' tilt' : '') + '">Interviewed</span>';
    if (s === 'draft') {
      const p = M().progress(deck);
      return '<span class="stamp oxblood">Draft · ' + p.answered + '/' + p.total + '</span>';
    }
    return '<span class="stamp faint">Awaiting interview</span>';
  };

  ui.kindLine = function (deck, n) {
    const parts = [M().typeLabel(deck)];
    const spec = (deck.specialties || []).slice(0, n || 2);
    return esc(parts.concat(spec).join(' · '));
  };

  ui.deckCard = function (deck) {
    return '<a class="deck-card" href="#/deck/' + deck.id + '">' +
      (deck.favorite ? '<span class="bookmark" title="Favourite"><span class="sr-only">Favourite</span></span>' : '') +
      '<div class="mat"><div class="photo">' + ui.deckImage(deck) + (deck.sample ? '<span class="stamp brass sample-flag">Sample</span>' : '') + '</div></div>' +
      '<div class="meta">' +
      '<span class="callno">' + esc(M().callNo(deck)) + '</span>' +
      '<h3>' + esc(deck.name || 'Untitled deck') + '</h3>' +
      '<span class="kind">' + ui.kindLine(deck, 3) + '</span>' +
      '<span class="status">' + ui.statusStamp(deck) + '</span>' +
      '</div></a>';
  };

  ui.deckRow = function (deck) {
    return '<a class="deck-row" href="#/deck/' + deck.id + '">' +
      '<div class="thumb">' + ui.deckImage(deck) + '</div>' +
      '<div><h3>' + esc(deck.name || 'Untitled deck') + (deck.sample ? ' <span class="stamp brass">Sample</span>' : '') + '</h3>' +
      '<div class="sub">' + ui.kindLine(deck, 3) + '</div></div>' +
      '<div class="right">' + (deck.favorite ? '<span class="fav">' + C.icon('bookmark', 'filled') + '<span class="sr-only">Favourite</span></span>' : '') +
      ui.statusStamp(deck) + '</div></a>';
  };

  ui.thumb = function (deck) {
    return '<div class="thumb">' + ui.deckImage(deck) + '</div>';
  };

  /* ------------------------------------------------------------ headers */

  ui.pageHead = function (opts) {
    return '<header class="page-head">' +
      (opts.back ? '<a class="icon-btn" href="' + opts.back + '" aria-label="Back" data-back>' + C.icon('back') + '</a>' : '') +
      (opts.title ? '<span class="label">' + esc(opts.title) + '</span>' : '') +
      '<span class="spacer"></span>' +
      (opts.saveState ? '<span class="save-state" data-save-state></span>' : '') +
      (opts.right || '') +
      '</header>';
  };

  ui.masthead = function (opts) {
    return '<header class="masthead"><div>' +
      (opts.kicker ? '<p class="masthead-kicker">' + esc(opts.kicker) + '</p>' : '') +
      '<h1>' + opts.title + '</h1>' +
      (opts.sub ? '<p class="masthead-sub">' + esc(opts.sub) + '</p>' : '') +
      '</div><div class="masthead-actions">' + (opts.actions || '') + '</div></header>';
  };

  ui.nav = function (active) {
    const item = (id, href, label, icon) =>
      '<a class="nav-item" href="' + href + '"' + (active === id ? ' aria-current="page"' : '') + '>' + C.icon(icon) + '<span>' + label + '</span></a>';
    return '<nav class="bottom-nav" aria-label="Main"><div class="inner">' +
      item('library', '#/library', 'Library', 'library') +
      item('interviews', '#/interviews', 'Interviews', 'interview') +
      '<div class="nav-add"><a href="#/add" aria-label="Add a deck">' + C.icon('plus') + '</a></div>' +
      item('finder', '#/finder', 'Finder', 'finder') +
      item('journal', '#/journal', 'Journal', 'journal') +
      '</div></nav>';
  };

  ui.emptyDrawer = '<svg class="drawer-art" viewBox="0 0 120 80" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4" y="6" width="112" height="70" rx="2"/><rect x="40" y="20" width="40" height="16" rx="1"/><circle cx="44" cy="28" r="1.2" fill="currentColor"/><circle cx="76" cy="28" r="1.2" fill="currentColor"/><path d="M50 52c0-6 20-6 20 0"/><path d="M4 66h112" stroke-dasharray="2 3"/></svg>';

  /* ------------------------------------------------------------ controls */

  ui.chips = function (path, options, selected, opts) {
    const sel = Array.isArray(selected) ? selected : [selected];
    const attr = opts && opts.single ? 'data-pick' : 'data-toggle';
    return '<div class="chips' + (opts && opts.cls ? ' ' + opts.cls : '') + '">' + options.map((o) => {
      const val = typeof o === 'string' ? o : o.id;
      const label = typeof o === 'string' ? o : o.label;
      return '<button type="button" class="chip' + (opts && opts.small ? ' small' : '') + '" ' + attr + '="' + C.attr(path) + '" data-value="' + C.attr(val) + '" aria-pressed="' + sel.includes(val) + '">' + esc(label) + '</button>';
    }).join('') + '</div>';
  };

  ui.choiceGrid = function (path, value, compact) {
    return '<div class="choice-grid' + (compact ? ' compact' : '') + '" role="group">' + M().CHOICES.map((c) =>
      '<button type="button" class="choice" data-pick="' + C.attr(path) + '" data-value="' + c.id + '" aria-pressed="' + (value === c.id) + '"><span class="mark"></span>' + c.label + '</button>'
    ).join('') + '</div>';
  };

  ui.tagInput = function (path, tags, placeholder) {
    const all = C.store.allTags().filter((t) => !(tags || []).includes(t));
    return '<div class="tag-input" data-tags="' + C.attr(path) + '">' +
      '<div class="chips mb0" data-tag-list>' + (tags || []).map((t) =>
        '<button type="button" class="chip small tag-chip" data-remove-tag="' + C.attr(t) + '" aria-label="Remove tag ' + C.attr(t) + '">' + esc(t) + '<span class="x">×</span></button>'
      ).join('') + '</div>' +
      '<input class="input mt8" data-tag-entry placeholder="' + C.attr(placeholder || 'Add a tag and press Enter') + '" enterkeyhint="done" autocomplete="off">' +
      (all.length ? '<div class="chips mt8" data-tag-suggest>' + all.slice(0, 14).map((t) =>
        '<button type="button" class="chip small" data-add-tag="' + C.attr(t) + '">+ ' + esc(t) + '</button>').join('') + '</div>' : '') +
      '</div>';
  };

  ui.field = function (label, inner, hint) {
    return '<label class="field"><span class="label">' + esc(label) + '</span>' + inner + (hint ? '<p class="hint">' + hint + '</p>' : '') + '</label>';
  };
  ui.input = function (path, opts) {
    opts = opts || {};
    return '<input class="input' + (opts.cls ? ' ' + opts.cls : '') + '" data-field="' + C.attr(path) + '" type="' + (opts.type || 'text') + '"' +
      (opts.placeholder ? ' placeholder="' + C.attr(opts.placeholder) + '"' : '') +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') +
      (opts.list ? ' list="' + opts.list + '"' : '') +
      (opts.autofocus ? ' autofocus' : '') + ' autocomplete="off">';
  };
  ui.textarea = function (path, opts) {
    opts = opts || {};
    return '<textarea class="textarea' + (opts.lined ? ' lined' : '') + '" data-field="' + C.attr(path) + '"' +
      (opts.placeholder ? ' placeholder="' + C.attr(opts.placeholder) + '"' : '') +
      (opts.rows ? ' rows="' + opts.rows + '"' : '') + '></textarea>';
  };
  ui.select = function (path, options, placeholder) {
    return '<select class="select" data-field="' + C.attr(path) + '">' +
      '<option value="">' + esc(placeholder || '—') + '</option>' +
      options.map((o) => {
        const v = typeof o === 'string' ? o : o.id;
        const l = typeof o === 'string' ? o : o.label;
        return '<option value="' + C.attr(v) + '">' + esc(l) + '</option>';
      }).join('') + '</select>';
  };

  /* ------------------------------------------------------------ binding
     Two-way binding between DOM controls and a plain object.
     - [data-field="a.b"]     inputs / textareas / selects (text values)
     - [data-pick="a.b"]      single-choice buttons (tap again to clear)
     - [data-toggle="a.b"]    multi-choice buttons (array membership)
     - [data-tags="a.b"]      tag editor
     onChange(path, value) is called after every change; persistence is the
     caller's job (usually a debounced save). */
  ui.bind = function (root, target, onChange) {
    root.querySelectorAll('[data-field]').forEach((el) => {
      const path = el.getAttribute('data-field');
      const v = C.getPath(target, path);
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
      const evt = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const val = el.type === 'checkbox' ? el.checked : el.value;
        C.setPath(target, path, val);
        onChange(path, val, el);
      });
      if (evt === 'input') el.addEventListener('blur', () => onChange(path, el.value, el, true));
    });

    root.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-pick]');
      if (pick && root.contains(pick)) {
        const path = pick.getAttribute('data-pick');
        const val = pick.getAttribute('data-value');
        const cur = C.getPath(target, path);
        const next = cur === val ? '' : val;
        C.setPath(target, path, next);
        root.querySelectorAll('[data-pick="' + CSS.escape(path) + '"]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === next)));
        onChange(path, next, pick);
        return;
      }
      const tog = e.target.closest('[data-toggle]');
      if (tog && root.contains(tog)) {
        const path = tog.getAttribute('data-toggle');
        const val = tog.getAttribute('data-value');
        const arr = (C.getPath(target, path) || []).slice();
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        C.setPath(target, path, arr);
        tog.setAttribute('aria-pressed', String(i < 0));
        onChange(path, arr, tog);
        return;
      }
      const tagWrap = e.target.closest('[data-tags]');
      if (tagWrap && root.contains(tagWrap)) {
        const path = tagWrap.getAttribute('data-tags');
        const rm = e.target.closest('[data-remove-tag]');
        const add = e.target.closest('[data-add-tag]');
        if (rm || add) {
          const arr = (C.getPath(target, path) || []).slice();
          if (rm) arr.splice(arr.indexOf(rm.getAttribute('data-remove-tag')), 1);
          if (add && !arr.includes(add.getAttribute('data-add-tag'))) arr.push(add.getAttribute('data-add-tag'));
          C.setPath(target, path, arr);
          rerenderTags(tagWrap, path, arr);
          onChange(path, arr, tagWrap);
        }
      }
    });

    root.querySelectorAll('[data-tags]').forEach((wrap) => wireTagEntry(wrap, target, onChange));
  };

  function wireTagEntry(wrap, target, onChange) {
    const path = wrap.getAttribute('data-tags');
    const input = wrap.querySelector('[data-tag-entry]');
    if (!input) return;
    const commit = () => {
      const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean);
      if (!parts.length) return;
      const arr = (C.getPath(target, path) || []).slice();
      parts.forEach((p) => { if (!arr.some((x) => x.toLowerCase() === p.toLowerCase())) arr.push(p); });
      C.setPath(target, path, arr);
      input.value = '';
      rerenderTags(wrap, path, arr);
      onChange(path, arr, wrap);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    });
    input.addEventListener('blur', commit);
  }

  function rerenderTags(wrap, path, arr) {
    const tmp = document.createElement('div');
    tmp.innerHTML = ui.tagInput(path, arr);
    const fresh = tmp.firstChild;
    wrap.querySelector('[data-tag-list]').replaceWith(fresh.querySelector('[data-tag-list]'));
    const oldS = wrap.querySelector('[data-tag-suggest]');
    const newS = fresh.querySelector('[data-tag-suggest]');
    if (oldS && newS) oldS.replaceWith(newS);
    else if (oldS) oldS.remove();
    else if (newS) wrap.appendChild(newS);
  }

  /* ------------------------------------------------------------ technical reference card */

  ui.techCard = function (deck, opts) {
    const rows = M().TECH_REF.map((id) => {
      const q = M().question(id);
      const a = M().answer(deck, id);
      const v = a.choice || 'none';
      let note = '';
      if (id === 'bottom' && (a.choice === 'yes' || a.choice === 'conditional')) {
        const m = M().bottomMeaning(deck);
        if (m.length) note = m.join(', ');
      }
      if (!note && a.notes && a.choice === 'conditional') note = a.notes.split('\n')[0].slice(0, 70);
      return '<div class="cc-row"><span class="k">' + esc(q.short) + '</span><span class="v ' + v + '">' + (a.choice ? esc(M().choiceLabel(a.choice)) : '—') + '</span></div>' +
        (note ? '<div class="cc-note">↳ ' + esc(note) + '</div>' : '');
    }).join('');
    const usage = M().USAGE.map((id) => {
      const a = M().answer(deck, id);
      return '<div class="cc-row"><span class="k">' + esc(M().question(id).short) + '</span><span class="v ' + (a.choice || 'none') + '">' + (a.choice ? esc(M().choiceLabel(a.choice)) : '—') + '</span></div>';
    }).join('');
    const s = M().status(deck);
    return '<div class="catalog-card">' +
      '<div class="cc-head"><span class="label">Before you read</span><span class="label">' + esc(M().callNo(deck)) + '</span></div>' +
      rows + (opts && opts.full ? usage : '') +
      '<div class="cc-foot">' + (s === 'none' ? 'Not yet interviewed — “—” means unanswered.' : s === 'draft' ? 'Interview in progress.' : 'From interview of ' + esc(C.fmtDate(deck.interview.completedAt, 'short')) + '.') + '</div>' +
      '</div>';
  };

  /* ------------------------------------------------------------ misc */

  ui.highlight = function (text, q) {
    const t = esc(text);
    if (!q) return t;
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    return t.replace(re, '<mark>$1</mark>');
  };

  ui.snippet = function (text, q, len) {
    len = len || 140;
    if (!text) return '';
    const flat = String(text).replace(/\s+/g, ' ').trim();
    if (!q) return flat.slice(0, len) + (flat.length > len ? '…' : '');
    const i = flat.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return flat.slice(0, len) + (flat.length > len ? '…' : '');
    const start = Math.max(0, i - 50);
    const s = (start > 0 ? '…' : '') + flat.slice(start, start + len) + (start + len < flat.length ? '…' : '');
    return s;
  };

  /* Pick an image file via a hidden input. Resolves with File[] */
  ui.pickFiles = function (opts) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = (opts && opts.accept) || 'image/*';
      if (opts && opts.multiple) input.multiple = true;
      input.style.display = 'none';
      input.onchange = () => { resolve(Array.from(input.files || [])); input.remove(); };
      document.body.appendChild(input);
      input.click();
    });
  };
})();
