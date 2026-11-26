/* Library — the collection, as a gallery or a compact catalogue list. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;

  C.state = C.state || {};
  const freshFilters = () => ({ q: '', type: '', status: '', fav: false, usage: [], elements: [], specialties: [], tags: [] });
  C.state.lib = C.state.lib || freshFilters();

  function advancedCount(f) { return f.usage.length + f.elements.length + f.specialties.length + f.tags.length; }
  function anyFilter(f) { return !!(f.q || f.type || f.status || f.fav || advancedCount(f)); }

  function filtered() {
    const f = C.state.lib;
    const q = f.q.trim().toLowerCase();
    let list = C.store.decks.filter((d) => {
      if (f.type === 'other' ? !['other', 'lenormand'].includes(d.type) : f.type && d.type !== f.type) return false;
      const st = M().status(d);
      if (f.status === 'interviewed' && st !== 'complete') return false;
      if (f.status === 'awaiting' && st === 'complete') return false;
      if (f.fav && !d.favorite) return false;
      if (f.usage.length) { const u = M().usageOf(d); if (!f.usage.every((x) => u.includes(x))) return false; }
      if (f.elements.length) { const el = M().elementsOf(d); if (!f.elements.some((x) => el.includes(x))) return false; }
      if (f.specialties.length && !f.specialties.some((x) => d.specialties.includes(x))) return false;
      if (f.tags.length && !f.tags.some((x) => d.tags.includes(x))) return false;
      if (q && !M().deckText(d).toLowerCase().includes(q)) return false;
      return true;
    });
    const sort = C.store.settings.sort || 'added';
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
    list.sort({
      added: (a, b) => (a.createdAt < b.createdAt ? 1 : -1),
      name: byName,
      catalog: (a, b) => (a.catalogNo || 0) - (b.catalogNo || 0),
      read: (a, b) => (M().lastReadDate(b) || '').localeCompare(M().lastReadDate(a) || '') || byName(a, b),
      fav: (a, b) => (b.favorite - a.favorite) || byName(a, b)
    }[sort] || ((a, b) => 0));
    return list;
  }

  function results() {
    const list = filtered();
    const f = C.state.lib;
    if (!C.store.decks.length) return '';
    if (!list.length) {
      return '<div class="empty"><h3>Nothing in this drawer</h3><p>No decks match ' + (f.q ? '“' + esc(f.q) + '”' : 'these filters') + '.</p>' +
        '<button class="btn quiet" data-clear-filters>Show all decks</button></div>';
    }
    const view = C.store.settings.view === 'list' ? 'list' : 'gallery';
    return view === 'list'
      ? '<div class="deck-list">' + list.map(C.ui.deckRow).join('') + '</div>'
      : '<div class="gallery">' + list.map(C.ui.deckCard).join('') + '</div>';
  }

  function countLine() {
    const n = filtered().length;
    const t = C.store.decks.length;
    return n === t ? t + (t === 1 ? ' deck' : ' decks') : n + ' of ' + t + ' decks';
  }

  function primaryChips() {
    const f = C.state.lib;
    const chip = (label, attrs, on) => '<button type="button" class="chip" ' + attrs + ' aria-pressed="' + !!on + '">' + label + '</button>';
    const adv = advancedCount(f);
    return '<div class="chips scroll" role="toolbar" aria-label="Filters">' +
      chip('All decks', 'data-f="all"', !anyFilter(f)) +
      chip('Tarot', 'data-f="type" data-v="tarot"', f.type === 'tarot') +
      chip('Oracle', 'data-f="type" data-v="oracle"', f.type === 'oracle') +
      chip('Other systems', 'data-f="type" data-v="other"', f.type === 'other') +
      chip('Interviewed', 'data-f="status" data-v="interviewed"', f.status === 'interviewed') +
      chip('Awaiting interview', 'data-f="status" data-v="awaiting"', f.status === 'awaiting') +
      chip(C.icon('bookmark', 'filled') + ' Favourites', 'data-f="fav"', f.fav) +
      chip(C.icon('filter') + ' More' + (adv ? ' <span class="count">(' + adv + ')</span>' : ''), 'data-f="more"', adv > 0) +
      '</div>';
  }

  function storageLine() {
    const s = C.store.settings;
    if (!C.db.persistent) return '';
    let backup = 'No backup yet';
    if (s.lastBackupAt) {
      const d = C.relDays(s.lastBackupAt);
      backup = 'Last backup ' + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
    }
    return '<p class="footnote">Kept on this device · ' + backup + ' · <a href="#/archive">Archive &amp; backup</a></p>';
  }

  function openMore() {
    const f = C.state.lib;
    const tags = C.store.allTags();
    const usageOpts = [{ id: 'personal', label: 'Personal practice' }, { id: 'client', label: 'Client readings' }, { id: 'collective', label: 'Collective readings' }];
    const html = '<h3>Refine the drawer</h3><p class="muted small mt0">Usage and elements come from your interview answers.</p>' +
      '<div class="sheet-group"><span class="label">Suited to</span>' + C.ui.chips('usage', usageOpts, f.usage, { small: true }) + '</div>' +
      '<div class="sheet-group"><span class="label">Elemental affinity</span>' + C.ui.chips('elements', M().ELEMENTS, f.elements, { small: true }) + '</div>' +
      '<div class="sheet-group"><span class="label">Reading specialties</span>' + C.ui.chips('specialties', M().CATEGORIES, f.specialties, { small: true }) + '</div>' +
      (tags.length ? '<div class="sheet-group"><span class="label">Tags</span>' + C.ui.chips('tags', tags, f.tags, { small: true }) + '</div>' : '') +
      '<div class="actions-row"><button class="btn quiet" data-reset>Clear these</button><button class="btn primary" data-done>Show decks</button></div>';
    C.openSheet(html, (sheet) => {
      C.ui.bind(sheet, f, () => refresh());
      sheet.querySelector('[data-done]').onclick = () => C.closeSheet();
      sheet.querySelector('[data-reset]').onclick = () => {
        f.usage = []; f.elements = []; f.specialties = []; f.tags = [];
        sheet.querySelectorAll('[aria-pressed="true"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        refresh();
      };
    });
  }

  let root = null;
  function refresh() {
    if (!root) return;
    const r = root.querySelector('[data-results]');
    if (r) { r.innerHTML = results(); C.hydratePhotos(r); }
    const c = root.querySelector('[data-chips]');
    if (c) c.innerHTML = primaryChips();
    const n = root.querySelector('[data-count]');
    if (n) n.textContent = countLine();
  }

  C.views.library = {
    title: 'Library',
    restoreScroll: true,
    render() {
      const s = C.store.settings;
      const decks = C.store.decks;
      const hasSamples = decks.some((d) => d.sample) || C.store.journal.some((e) => e.sample);
      let out = C.ui.masthead({
        title: 'The <em>Cabinet</em>',
        sub: 'A personal divination archive',
        actions:
          '<a class="icon-btn" href="#/search" aria-label="Search everything">' + C.icon('search') + '</a>' +
          '<a class="icon-btn" href="#/archive" aria-label="Archive and backup">' + C.icon('archive') + '</a>'
      });

      if (!C.db.persistent) {
        out += '<div class="notice warn"><div class="grow"><p><b>This browser is not letting The Cabinet save to your device</b> (private browsing often does this). Anything you add will disappear when this tab closes. Use <a href="#/archive">Export backup</a> before leaving.</p></div></div>';
      }

      if (!decks.length) {
        out += '<div class="empty">' + C.ui.emptyDrawer +
          '<h3>An empty cabinet</h3><p>Start with just a name. Everything else can wait until you’re ready.</p>' +
          '<a class="btn primary" href="#/add">' + C.icon('plus') + ' Add your first deck</a>' +
          '<p class="mt16 mb0 small faint">Or <button class="link-btn" data-samples>look around with two sample decks</button></p></div>';
        out += storageLine();
        return out;
      }

      if (hasSamples) {
        out += '<div class="notice"><div class="grow"><p>Sample records are in your cabinet so you can see how things look. They’re marked <span class="stamp brass">Sample</span>.</p></div>' +
          '<button class="btn small quiet" data-remove-samples>Remove</button></div>';
      }

      out += '<div class="search-box">' + C.icon('search') +
        '<input class="input" type="search" placeholder="Find a deck, card, note…" value="' + C.attr(C.state.lib.q) + '" data-q aria-label="Search your decks">' + '</div>';
      out += '<div data-chips>' + primaryChips() + '</div>';
      out += '<div class="toolbar"><span class="count" data-count>' + countLine() + '</span><div class="tools">' +
        '<label class="sr-only" for="sort">Sort</label><select id="sort" class="sort-select" data-sort>' +
        [['added', 'Recently added'], ['name', 'Name A–Z'], ['catalog', 'Catalogue no.'], ['read', 'Recently read'], ['fav', 'Favourites first']]
          .map(([v, l]) => '<option value="' + v + '"' + (s.sort === v ? ' selected' : '') + '>' + l + '</option>').join('') +
        '</select>' +
        '<div class="seg" role="group" aria-label="View">' +
        '<button data-view="gallery" aria-pressed="' + (s.view !== 'list') + '" aria-label="Gallery view">' + C.icon('grid') + '</button>' +
        '<button data-view="list" aria-pressed="' + (s.view === 'list') + '" aria-label="List view">' + C.icon('list') + '</button>' +
        '</div></div></div>';
      out += '<div data-results>' + results() + '</div>';
      out += storageLine();
      return out;
    },
    mount(el) {
      root = el;
      const q = el.querySelector('[data-q]');
      if (q) q.addEventListener('input', () => { C.state.lib.q = q.value; refresh(); });

      el.addEventListener('click', async (e) => {
        const f = C.state.lib;
        const chip = e.target.closest('[data-f]');
        if (chip) {
          const kind = chip.getAttribute('data-f');
          const v = chip.getAttribute('data-v');
          if (kind === 'all') { const q0 = f.q; Object.assign(f, freshFilters(), { q: q0 }); }
          else if (kind === 'type') f.type = f.type === v ? '' : v;
          else if (kind === 'status') f.status = f.status === v ? '' : v;
          else if (kind === 'fav') f.fav = !f.fav;
          else if (kind === 'more') return openMore();
          refresh();
          return;
        }
        if (e.target.closest('[data-clear-filters]')) {
          Object.assign(C.state.lib, freshFilters());
          if (q) q.value = '';
          refresh();
          return;
        }
        const vb = e.target.closest('[data-view]');
        if (vb) {
          C.store.settings.view = vb.getAttribute('data-view');
          el.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === vb)));
          C.store.saveSettings();
          refresh();
          return;
        }
        if (e.target.closest('[data-samples]')) {
          await C.demo.add();
          C.toast('Samples added');
          C.rerender();
          return;
        }
        if (e.target.closest('[data-remove-samples]')) {
          const ok = await C.confirm({ title: 'Remove the samples?', body: 'Only records marked “Sample” are removed. Your own decks and entries stay exactly as they are.', ok: 'Remove samples' });
          if (ok) { await C.demo.remove(); C.toast('Samples removed'); C.rerender(); }
        }
      });
      const sort = el.querySelector('[data-sort]');
      if (sort) sort.addEventListener('change', () => { C.store.settings.sort = sort.value; C.store.saveSettings(); refresh(); });
      return () => { root = null; };
    }
  };
})();
