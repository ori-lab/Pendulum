/* Add a deck — only the name is required. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;

  /* The optional details form; shared by Add Deck and the profile's "Collection details" editor. */
  C.deckDetailsFields = function (deck, opts) {
    const u = ui();
    return (
      (opts && opts.noType ? '' : '<div class="field"><span class="label">Deck type</span>' + u.chips('type', M().DECK_TYPES.map((t) => ({ id: t.id, label: t.label })), deck.type, { single: true }) + '</div>') +
      '<div data-show-other' + (deck.type === 'other' ? '' : ' class="hidden"') + '>' + u.field('Name of the system', u.input('otherSystem', { placeholder: 'e.g. Kipper, runes, playing cards' })) + '</div>' +
      '<div data-show-tarot' + (deck.type === 'tarot' ? '' : ' class="hidden"') + '>' +
      '<div class="field"><span class="label">Tarot system</span>' + u.chips('tarotSystem', M().TAROT_SYSTEMS, deck.tarotSystem, { single: true, small: true }) + '</div>' +
      '<div data-show-tarot-other' + (deck.tarotSystem === 'Other' ? '' : ' class="hidden"') + '>' + u.field('Describe the system', u.input('tarotSystemOther')) + '</div>' +
      '</div>' +
      '<div class="field-row">' + u.field('Creator', u.input('creator')) + u.field('Illustrator', u.input('illustrator')) + '</div>' +
      '<div class="field-row">' + u.field('Publisher', u.input('publisher')) + u.field('Number of cards', u.input('cardCount', { type: 'text', inputmode: 'numeric', placeholder: 'e.g. 78' })) + '</div>' +
      '<div class="field-row">' + u.field('Acquired', u.input('acquired', { type: 'date' })) + '<div class="field"><span class="label">Guidebook</span>' + u.select('guidebook', M().GUIDEBOOK, 'Not noted') + '</div></div>' +
      '<div class="field"><span class="label">Reading specialties</span><p class="hint mt0" style="margin-bottom:8px">What you reach for this deck to do. These power the Deck Finder.</p>' + u.chips('specialties', M().CATEGORIES, deck.specialties, { small: true }) + '</div>' +
      '<div class="field"><span class="label">Tags</span>' + u.tagInput('tags', deck.tags) + '</div>' +
      u.field('Personal notes', u.textarea('notes', { lined: true, placeholder: 'Where it came from, first impressions, anything at all.' }))
    );
  };

  /* Keeps conditional sub-fields in sync after type/system changes. */
  C.syncDeckDetails = function (root, deck) {
    const t = root.querySelector('[data-show-tarot]');
    if (t) t.classList.toggle('hidden', deck.type !== 'tarot');
    const o = root.querySelector('[data-show-other]');
    if (o) o.classList.toggle('hidden', deck.type !== 'other');
    const to = root.querySelector('[data-show-tarot-other]');
    if (to) to.classList.toggle('hidden', deck.tarotSystem !== 'Other');
  };

  C.photoDrop = function (photoId, label) {
    return '<div class="photo-drop' + (photoId ? ' has-photo' : '') + '" data-photo-drop role="button" tabindex="0" aria-label="' + (photoId ? 'Replace photograph' : 'Add a photograph') + '">' +
      (photoId ? '<img alt="" data-photo="' + C.attr(photoId) + '" data-size="full"><span class="btn small replace">' + C.icon('camera') + ' Replace</span>'
        : '<div class="inner">' + C.icon('camera') + '<span class="serif" style="font-size:19px">' + esc(label || 'Add a photograph') + '</span><span class="small faint">Optional · from camera or library</span></div>') +
      '</div>';
  };

  let draft = null;

  C.views.add = {
    title: 'Add a deck',
    nav: 'add',
    render() {
      draft = M().newDeck();
      return ui().pageHead({ back: '#/library', title: 'New acquisition' }) +
        '<h2 class="section-title mt0">Add a deck</h2>' +
        '<p class="section-lede">A name is all it needs. The rest can wait.</p>' +
        '<form data-add-form autocomplete="off">' +
        ui().field('Deck name', '<input class="input title-input" data-field="name" required placeholder="e.g. Thoth Tarot" autofocus enterkeyhint="done">') +
        '<div data-photo-slot>' + C.photoDrop(null) + '</div>' +
        '<div class="field"><span class="label">Type</span>' + ui().chips('type', M().DECK_TYPES.map((t) => ({ id: t.id, label: t.label })), draft.type, { single: true }) + '</div>' +
        '<details class="more"><summary><span><span class="label">More details</span> <span class="small faint">· optional</span></span>' + C.icon('chevron', 'chev') + '</summary><div class="body" data-more></div></details>' +
        '<button class="btn primary block" type="submit" data-submit>File this deck</button>' +
        '</form>';
    },
    mount(el) {
      const form = el.querySelector('[data-add-form]');
      // Build the optional block without duplicating the type chips shown above.
      const more = el.querySelector('[data-more]');
      more.innerHTML = C.deckDetailsFields(draft, { noType: true });
      C.ui.bind(form, draft, (path) => {
        if (path === 'type' || path === 'tarotSystem') C.syncDeckDetails(form, draft);
        if (path === 'type' && !draft.type) draft.type = 'tarot';
      });
      C.syncDeckDetails(form, draft);

      const slot = el.querySelector('[data-photo-slot]');
      const pick = async () => {
        const [file] = await C.ui.pickFiles();
        if (!file) return;
        slot.querySelector('.photo-drop').style.opacity = '0.5';
        try {
          if (draft.photoId) await C.db.del('photos', draft.photoId);
          draft.photoId = await C.ingestPhoto(file);
          slot.innerHTML = C.photoDrop(draft.photoId);
          C.hydratePhotos(slot);
        } catch (err) {
          slot.querySelector('.photo-drop').style.opacity = '1';
          C.toast('That image could not be read', 'warn');
        }
      };
      slot.addEventListener('click', pick);
      slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        draft.name = draft.name.trim();
        if (!draft.name) {
          const n = form.querySelector('[data-field="name"]');
          n.focus();
          n.setAttribute('aria-invalid', 'true');
          C.toast('A name is all it needs', 'warn');
          return;
        }
        draft.catalogNo = C.store.nextCatalogNo();
        draft.createdAt = C.now();
        await C.store.saveDeck(draft, { silent: true });
        const id = draft.id;
        draft = null;
        C.go('#/added/' + id, true);
      });

      return async () => {
        // Abandoned without filing: discard any uploaded photo.
        if (draft && draft.photoId && !C.store.deck(draft.id)) await C.db.del('photos', draft.photoId);
        draft = null;
      };
    }
  };

  C.views.added = {
    title: 'Filed',
    nav: 'library',
    render(p) {
      const d = C.store.deck(p.id);
      if (!d) { C.go('#/library', true); return null; }
      return '<div class="filed">' +
        '<div class="catalog-card"><div class="cc-head"><span class="label">' + esc(M().callNo(d)) + '</span><span class="label">' + esc(C.fmtDate(C.today(), 'short')) + '</span></div>' +
        '<div class="cc-typed" style="font-family:var(--serif);font-size:24px;line-height:32px;padding-top:8px">' + esc(d.name) + '</div>' +
        '<div class="cc-typed" style="padding-bottom:0">' + esc(M().typeLabel(d)) + (d.creator ? ' · ' + esc(d.creator) : '') + '</div>' +
        '<div class="cc-typed"><span class="stamp olive tilt">Filed</span></div></div>' +
        '<h2>Filed in the cabinet.</h2><p class="muted serif" style="font-style:italic;font-size:18px">Would you like to meet it properly?</p>' +
        '<div class="actions-row stack" style="max-width:360px;margin:22px auto 0">' +
        '<a class="btn primary" href="#/interview/' + d.id + '">Begin interview</a>' +
        '<a class="btn quiet" href="#/library">Return to library</a>' +
        '<a class="btn text" href="#/deck/' + d.id + '">View deck profile</a>' +
        '</div></div>';
    }
  };
})();
