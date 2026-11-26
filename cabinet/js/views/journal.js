/* Practice journal — chronological readings, linked to one or more decks. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;

  function deckNames(e) {
    const names = (e.deckIds || []).map((id) => C.store.deck(id)).filter(Boolean).map((d) => d.name);
    return names.concat(e.deletedDeckNames || []);
  }
  function entryTitle(e) {
    return e.question || (e.readingType ? e.readingType + ' reading' : 'A reading');
  }
  function isEmpty(e) {
    return !(e.question || e.cards || e.interpretation || e.observations || e.spread || e.discovery || (e.photoIds || []).length || (e.deckIds || []).length || (e.tags || []).length || e.readingType);
  }

  C.ui.entryRow = function (e, q) {
    const d = C.parseDate(e.date) || new Date();
    const names = deckNames(e);
    const body = e.interpretation || e.cards || e.observations || '';
    return '<a class="entry" href="#/entry/' + e.id + '">' +
      '<div class="date"><span class="d">' + d.getDate() + '</span><span class="m">' + C.MONTHS[d.getMonth()].slice(0, 3) + '</span></div>' +
      '<div style="min-width:0">' + (names.length ? '<div class="decks-used">' + esc(names.join(' · ')) + '</div>' : '') +
      '<h4>' + ui().highlight(entryTitle(e), q) + (e.sample ? ' <span class="stamp brass">Sample</span>' : '') + '</h4>' +
      (body ? '<p class="excerpt">' + ui().highlight(ui().snippet(body, q, 160), q) + '</p>' : '') +
      ((e.photoIds || []).length ? '<div class="entry-photos">' + e.photoIds.slice(0, 4).map((id) => '<img alt="" data-photo="' + id + '">').join('') + '</div>' : '') +
      '</div></a>';
  };

  /* ------------------------------------------------------------ list */

  C.state = C.state || {};
  C.state.journal = C.state.journal || { q: '', deck: '', type: '' };

  function listHTML() {
    const f = C.state.journal;
    const q = f.q.trim().toLowerCase();
    const list = C.store.journal.filter((e) => {
      if (f.deck && !(e.deckIds || []).includes(f.deck)) return false;
      if (f.type && e.readingType !== f.type) return false;
      if (q) {
        const hay = [e.question, e.spread, e.cards, e.interpretation, e.observations, e.discovery, e.readingType, (e.tags || []).join(' '), deckNames(e).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort(M().byEntryDateDesc);
    if (!C.store.journal.length) return '';
    if (!list.length) return '<div class="empty"><h3>No entries found</h3><p>Nothing matches these filters.</p><button class="btn quiet" data-clear>Show all entries</button></div>';
    let out = '';
    let month = '';
    list.forEach((e) => {
      const d = C.parseDate(e.date) || new Date();
      const m = C.MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      if (m !== month) { month = m; out += '<div class="month-head"><h3>' + esc(m) + '</h3><span class="line"></span></div>'; }
      out += C.ui.entryRow(e, f.q.trim());
    });
    return out;
  }

  C.views.journal = {
    title: 'Journal',
    restoreScroll: true,
    render(p) {
      const f = C.state.journal;
      if (p.query.deck) f.deck = p.query.deck;
      let out = C.ui.masthead({
        kicker: 'Section IV', title: 'Journal', sub: 'Readings, observations, discoveries',
        actions: '<a class="icon-btn" href="#/search" aria-label="Search everything">' + C.icon('search') + '</a>'
      });
      out += '<div class="actions-row"><a class="btn primary block" href="#/journal/new">' + C.icon('plus') + ' Record a reading</a></div>';
      if (!C.store.journal.length) {
        return out + '<div class="empty">' + C.ui.emptyDrawer + '<h3>No readings recorded</h3><p>A date and the cards are enough. Add more whenever you like.</p></div>';
      }
      const decks = C.store.decks.slice().sort((a, b) => a.name.localeCompare(b.name));
      out += '<div class="search-box">' + C.icon('search') + '<input class="input" type="search" placeholder="Search questions, cards, notes…" value="' + C.attr(f.q) + '" data-jq aria-label="Search the journal"></div>';
      out += '<div class="field-row" style="margin-bottom:6px"><select class="select" data-jdeck aria-label="Filter by deck"><option value="">All decks</option>' +
        decks.map((d) => '<option value="' + d.id + '"' + (f.deck === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('') + '</select>' +
        '<select class="select" data-jtype aria-label="Filter by reading type"><option value="">All reading types</option>' +
        M().READING_TYPES.map((t) => '<option' + (f.type === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></div>';
      out += '<div data-jlist>' + listHTML() + '</div>';
      return out;
    },
    mount(el) {
      const f = C.state.journal;
      const refresh = () => { const l = el.querySelector('[data-jlist]'); l.innerHTML = listHTML(); C.hydratePhotos(l); };
      const q = el.querySelector('[data-jq]');
      if (q) q.addEventListener('input', () => { f.q = q.value; refresh(); });
      const dk = el.querySelector('[data-jdeck]');
      if (dk) dk.addEventListener('change', () => { f.deck = dk.value; refresh(); });
      const tp = el.querySelector('[data-jtype]');
      if (tp) tp.addEventListener('change', () => { f.type = tp.value; refresh(); });
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-clear]')) { Object.assign(f, { q: '', deck: '', type: '' }); C.rerender(); }
      });
    }
  };

  /* ------------------------------------------------------------ discovery sync */

  async function syncDiscoveries(entry) {
    const text = (entry.discovery || '').trim();
    const targets = text ? (entry.discoveryDeckId && entry.deckIds.includes(entry.discoveryDeckId) ? [entry.discoveryDeckId] : entry.deckIds.slice()) : [];
    for (const d of C.store.decks) {
      const before = JSON.stringify(d.discoveries);
      const existing = d.discoveries.find((x) => x.entryId === entry.id);
      if (targets.includes(d.id)) {
        if (existing) Object.assign(existing, { text, date: entry.date, changesPrefs: !!entry.discoveryChangesPrefs });
        else d.discoveries.push({ id: C.uid('disc'), entryId: entry.id, date: entry.date, text, changesPrefs: !!entry.discoveryChangesPrefs });
      } else if (existing) {
        d.discoveries = d.discoveries.filter((x) => x !== existing);
      }
      if (JSON.stringify(d.discoveries) !== before) await C.store.saveDeck(d, { silent: true });
    }
  }

  /* ------------------------------------------------------------ editor */

  function photosHTML(e) {
    return '<div class="photo-strip">' + (e.photoIds || []).map((id) =>
      '<div class="ph"><img alt="" data-photo="' + id + '"><button type="button" data-ph-del="' + id + '" aria-label="Remove photo">' + C.icon('close') + '</button></div>').join('') +
      '<button type="button" class="add-ph" data-ph-add>' + C.icon('camera') + '<span>Add photos</span></button></div>';
  }

  function spreadOptions(e) {
    const names = [];
    (e.deckIds || []).forEach((id) => { const d = C.store.deck(id); if (d) d.spreads.forEach((s) => names.push(s.name)); });
    return C.uniq(names);
  }

  function editorHTML(e, isNew) {
    const u = ui();
    const decks = C.store.decks.slice().sort((a, b) => a.name.localeCompare(b.name));
    const spreads = spreadOptions(e);
    return u.pageHead({ back: isNew ? '#/journal' : '#/entry/' + e.id, title: isNew ? 'New reading' : 'Editing reading', saveState: true, right: '<button class="btn small olive" data-finish>' + C.icon('check') + ' Done</button>' }) +
      '<form data-entry-form autocomplete="off" onsubmit="return false">' +
      '<div class="field-row">' + u.field('Date', u.input('date', { type: 'date' })) + '<div></div></div>' +
      '<div class="field"><span class="label">Deck or decks used</span>' +
      (decks.length ? u.chips('deckIds', decks.map((d) => ({ id: d.id, label: d.name })), e.deckIds, { small: true }) : '<p class="small faint mt0">No decks in the cabinet yet — you can still record the reading.</p>') +
      ((e.deletedDeckNames || []).length ? '<p class="hint">Also used: ' + esc(e.deletedDeckNames.join(', ')) + ' (since removed)</p>' : '') + '</div>' +
      '<div class="field"><span class="label">Reading type</span>' + u.chips('readingType', M().READING_TYPES, e.readingType, { single: true, small: true }) + '</div>' +
      u.field('Question', u.input('question', { placeholder: 'What was asked, if anything' })) +
      u.field('Spread', u.input('spread', { placeholder: 'e.g. Three cards, Celtic Cross, single pull', list: 'spread-list' }) +
        '<datalist id="spread-list">' + spreads.map((s) => '<option value="' + C.attr(s) + '">').join('') + '</datalist>', spreads.length ? 'Saved spreads for these decks appear as suggestions.' : '') +
      u.field('Cards pulled', u.textarea('cards', { rows: 3, placeholder: 'One per line, or separated by commas' })) +
      u.field('Interpretation', u.textarea('interpretation', { lined: true, rows: 7 })) +
      u.field('Observations about the deck', u.textarea('observations', { rows: 3, placeholder: 'How it behaved, its tone, anything surprising' })) +
      '<div class="field"><span class="label">Photographs</span><div data-photos>' + photosHTML(e) + '</div></div>' +
      '<div class="field"><span class="label">Tags</span>' + u.tagInput('tags', e.tags) + '</div>' +
      '<details class="more"' + (e.discovery ? ' open' : '') + '><summary><span><span class="label">A discovery about the deck</span> <span class="small faint">· optional</span></span>' + C.icon('chevron', 'chev') + '</summary><div class="body">' +
      '<p class="small muted mt0">Something this reading taught you about how the deck works. It will also appear under the deck’s Ongoing discoveries.</p>' +
      u.field('Discovery', u.textarea('discovery', { rows: 3 })) +
      '<div data-disc-deck>' + discDeckSelect(e) + '</div>' +
      '<label class="flex gap8 items-center" style="min-height:44px"><input type="checkbox" data-field="discoveryChangesPrefs" style="width:22px;height:22px;accent-color:var(--oxblood)"> This may change its established reading preferences</label>' +
      '</div></details>' +
      '</form>' +
      (isNew ? '' : '<div class="actions-row mt24"><button class="btn danger small" data-del-entry>' + C.icon('trash') + ' Delete entry</button></div>');
  }

  function discDeckSelect(e) {
    if ((e.deckIds || []).length < 2) return '';
    return '<div class="field"><span class="label">Which deck?</span><select class="select" data-field="discoveryDeckId"><option value="">All decks in this reading</option>' +
      e.deckIds.map((id) => C.store.deck(id)).filter(Boolean).map((d) => '<option value="' + d.id + '">' + esc(d.name) + '</option>').join('') + '</select></div>';
  }

  function mountEditor(el, entry, isNew) {
    let created = !isNew;
    const form = el.querySelector('[data-entry-form]');
    const persist = async () => {
      if (!created) {
        if (isEmpty(entry)) return;
        created = true;
        await C.store.saveEntry(entry, { silent: true });
        C.replaceHash('#/entry/' + entry.id + '/edit');
      } else {
        await C.store.saveEntry(entry, { silent: true });
      }
      await syncDiscoveries(entry);
    };
    const save = C.saver(persist, 500);

    const bindForm = () => ui().bind(form, entry, (path) => {
      if (path === 'deckIds') {
        const holder = form.querySelector('[data-disc-deck]');
        holder.innerHTML = discDeckSelect(entry);
        const sel = holder.querySelector('select');
        if (sel) { sel.value = entry.discoveryDeckId || ''; sel.addEventListener('change', () => { entry.discoveryDeckId = sel.value; save(); }); }
        const dl = form.querySelector('#spread-list');
        if (dl) dl.innerHTML = spreadOptions(entry).map((s) => '<option value="' + C.attr(s) + '">').join('');
      }
      save();
    });
    bindForm();

    el.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-ph-add]')) {
        const files = await ui().pickFiles({ multiple: true });
        if (!files.length) return;
        C.toast('Adding photos…', 'info');
        for (const f of files) {
          try { entry.photoIds.push(await C.ingestPhoto(f)); } catch (e) { C.toast('One image could not be read', 'warn'); }
        }
        const holder = el.querySelector('[data-photos]');
        holder.innerHTML = photosHTML(entry);
        C.hydratePhotos(holder);
        save(); save.flush();
        return;
      }
      const del = ev.target.closest('[data-ph-del]');
      if (del) {
        const id = del.getAttribute('data-ph-del');
        entry.photoIds = entry.photoIds.filter((x) => x !== id);
        await C.db.del('photos', id);
        C.forgetPhoto(id);
        const holder = el.querySelector('[data-photos]');
        holder.innerHTML = photosHTML(entry);
        C.hydratePhotos(holder);
        save();
        return;
      }
      if (ev.target.closest('[data-finish]')) {
        await save.flush();
        if (!created) {
          if (isEmpty(entry)) { C.go('#/journal', true); return; }
          await persist();
        }
        C.toast('Reading filed');
        C.go('#/entry/' + entry.id, true);
        return;
      }
      if (ev.target.closest('[data-del-entry]')) {
        const ok = await C.confirm({ title: 'Delete this entry?', body: 'The entry and its photographs are permanently removed.', ok: 'Delete' });
        if (!ok) return;
        await C.store.deleteEntry(entry.id);
        C.toast('Entry deleted');
        C.go('#/journal', true);
      }
    });

    return async () => {
      await save.flush();
      // An entry left empty is quietly discarded, along with any orphaned photos.
      if (!created) { for (const id of entry.photoIds) await C.db.del('photos', id); }
      else if (isEmpty(entry)) await C.store.deleteEntry(entry.id);
    };
  }

  let pendingNew = null;
  C.views.entryNew = {
    title: 'New reading',
    nav: 'journal',
    render(p) {
      pendingNew = M().newEntry();
      if (p.query.deck && C.store.deck(p.query.deck)) pendingNew.deckIds = [p.query.deck];
      return editorHTML(pendingNew, true);
    },
    mount(el) { return mountEditor(el, pendingNew, true); }
  };

  C.views.entryEdit = {
    title: 'Edit reading',
    nav: 'journal',
    render(p) {
      const e = C.store.entry(p.id);
      if (!e) { C.go('#/journal', true); return null; }
      return editorHTML(e, false);
    },
    mount(el, p) { return mountEditor(el, C.store.entry(p.id), false); }
  };

  /* ------------------------------------------------------------ reading view */

  C.views.entry = {
    title: (p) => { const e = C.store.entry(p.id); return e ? entryTitle(e) : 'Reading'; },
    nav: 'journal',
    render(p) {
      const e = C.store.entry(p.id);
      if (!e) return '<div class="empty"><h3>Entry not found</h3><p>It may have been deleted.</p><a class="btn" href="#/journal">Return to the journal</a></div>';
      const decks = (e.deckIds || []).map((id) => C.store.deck(id)).filter(Boolean);
      const cards = C.splitCards(e.cards);
      const block = (label, html) => (html ? '<div class="block"><span class="label">' + label + '</span>' + html + '</div>' : '');
      const dd = e.discoveryDeckId && C.store.deck(e.discoveryDeckId);
      return ui().pageHead({ back: '#/journal', title: C.fmtDate(e.date), right: '<a class="btn small quiet" href="#/entry/' + e.id + '/edit">' + C.icon('edit') + ' Edit</a>' }) +
        '<article class="reading-view">' +
        '<div class="r-meta">' + (e.readingType ? '<span class="stamp olive">' + esc(e.readingType) + '</span>' : '') + (e.sample ? '<span class="stamp brass">Sample</span>' : '') + '</div>' +
        '<h1>' + esc(entryTitle(e)) + '</h1>' +
        (decks.length || (e.deletedDeckNames || []).length ? '<p class="label" style="color:var(--oxblood)">' + decks.map((d) => '<a href="#/deck/' + d.id + '">' + esc(d.name) + '</a>').concat((e.deletedDeckNames || []).map(esc)).join(' · ') + '</p>' : '') +
        block('Spread', e.spread ? '<p class="mt8 mb0">' + esc(e.spread) + '</p>' : '') +
        block('Cards pulled', cards.length ? '<ol class="cards-list mt8">' + cards.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ol>' : '') +
        block('Interpretation', e.interpretation ? '<p class="prose mt8">' + esc(e.interpretation) + '</p>' : '') +
        block('Observations about the deck', e.observations ? '<p class="prose mt8">' + esc(e.observations) + '</p>' : '') +
        block('Photographs', (e.photoIds || []).length ? '<div class="photo-strip">' + e.photoIds.map((id) => '<div class="ph" data-zoom="' + id + '" role="button" tabindex="0"><img alt="" data-photo="' + id + '"></div>').join('') + '</div>' : '') +
        block('Discovery', e.discovery ? '<div class="discovery mt8' + (e.discoveryChangesPrefs ? ' flagged' : '') + '"><p class="prose mb0">' + esc(e.discovery) + '</p>' +
          (e.discoveryChangesPrefs ? '<p class="small mt8 mb0"><span class="stamp oxblood">May change preferences</span>' + (dd || decks.length === 1 ? ' <a href="#/interview/' + (dd || decks[0]).id + '?section=technical">Review technical answers</a>' : '') + '</p>' : '') + '</div>' : '') +
        block('Tags', (e.tags || []).length ? '<div class="chips mt8">' + e.tags.map((t) => '<span class="chip small tag-chip">' + esc(t) + '</span>').join('') + '</div>' : '') +
        '</article>';
    },
    mount(el) {
      el.addEventListener('click', async (ev) => {
        const z = ev.target.closest('[data-zoom]');
        if (z) { const url = await C.loadPhotoURL(z.getAttribute('data-zoom'), 'full'); if (url) C.lightbox(url); }
      });
    }
  };
})();
