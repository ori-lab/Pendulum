/* Deck Finder — recommends decks from your own recorded answers and tags.
   Nothing is inferred beyond what you have written down: each reason shown
   points to a specific answer, specialty, tag or phrase in your notes. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;

  const WHO = [
    { id: 'personal', label: 'Myself' },
    { id: 'client', label: 'A client' },
    { id: 'collective', label: 'The collective' },
    { id: 'other', label: 'Someone close to me' }
  ];
  const APPROACH = [
    { id: 'structured', label: 'A structured spread' },
    { id: 'freeform', label: 'Intuitive, freeform' },
    { id: 'clarifiers', label: 'Room for clarifiers' },
    { id: 'otherDecks', label: 'Alongside another deck' }
  ];
  const PRACTICES = [
    { id: 'deity', label: 'Deity work' },
    { id: 'ancestral', label: 'Ancestral work' },
    { id: 'spirit', label: 'Spirit communication' },
    { id: 'ritual', label: 'Ritual & magic' },
    { id: 'shadow', label: 'Shadow work' }
  ];

  /* Subjects that correspond directly to an interview question. */
  const CATEGORY_TO_Q = {
    'Shadow work': 'shadow',
    'Ancestral work': 'ancestral',
    'Deity work': 'deity',
    'Ritual': 'ritual',
    'Elemental magic': 'ritual',
    'Collective readings': 'collective'
  };
  /* Words looked for in your own written answers (territory, teaching, personality, strengths). */
  const KEYWORDS = {
    'Psychological exploration': ['psycholog', 'inner', 'psyche', 'self-reflect', 'subconscious'],
    'Shadow work': ['shadow'],
    'Ancestral work': ['ancest', 'lineage', 'heritage'],
    'Deity work': ['deity', 'deities', 'god', 'goddess'],
    'Relationships': ['relationship', 'love', 'partner', 'romance', 'family', 'friend'],
    'Emotional processing': ['emotion', 'feeling', 'grief', 'heal'],
    'Decision-making': ['decision', 'choice', 'choose', 'practical'],
    'Predictive readings': ['predict', 'future', 'forecast', 'timing', 'outcome'],
    'Daily guidance': ['daily', 'everyday', 'day-to-day'],
    'Collective readings': ['collective', 'world', 'society'],
    'Creative exploration': ['creativ', 'art', 'writing', 'inspiration'],
    'Archetypal study': ['archetyp', 'symbol'],
    'Astrological readings': ['astrolog', 'planet', 'zodiac'],
    'Elemental magic': ['element', 'magic'],
    'Ritual': ['ritual', 'ceremon', 'spell'],
    'Mythological exploration': ['myth', 'legend', 'folklore'],
    'Spiritual development': ['spiritual', 'growth', 'soul', 'devotion']
  };
  const TEXT_SOURCES = [
    ['territory', 'its territory'], ['teach', 'what it teaches'], ['nature', 'its nature']
  ];

  function score(deck, q) {
    const reasons = [];
    const cautions = [];
    const conflicts = [];
    let pts = 0;
    const ans = (id) => M().answer(deck, id).choice;
    const qShort = (id) => M().question(id).short.toLowerCase();

    const weigh = (id, label, strong) => {
      const v = ans(id);
      if (v === 'yes') { pts += strong ? 3 : 2; reasons.push('Answered <b>yes</b> to ' + esc(label)); }
      else if (v === 'conditional') {
        pts += 1;
        const n = M().answer(deck, id).notes;
        cautions.push('<b>Conditional</b> for ' + esc(label) + (n ? ' — “' + esc(ui().snippet(n, '', 90)) + '”' : ''));
      } else if (v === 'no') conflicts.push('Answered <b>no</b> to ' + esc(label));
    };

    // Who
    if (q.who && q.who !== 'other') weigh(q.who, qShort(q.who), true);
    if (q.who === 'other') weigh('personal', 'personal readings (closest match for someone close)', false);

    // Subjects
    (q.subjects || []).forEach((cat) => {
      let hit = false;
      if (deck.specialties.includes(cat)) { pts += 3; hit = true; reasons.push('You listed <b>' + esc(cat) + '</b> as a specialty'); }
      if (deck.tags.some((t) => t.toLowerCase() === cat.toLowerCase())) { pts += 1; hit = true; reasons.push('Tagged “' + esc(cat) + '”'); }
      const qid = CATEGORY_TO_Q[cat];
      if (qid && !(q.who === qid)) {
        const before = conflicts.length;
        weigh(qid, qShort(qid), false);
        if (conflicts.length > before || ans(qid)) hit = true;
      }
      if (cat === 'Astrological readings' && M().planetsOf(deck).length) { pts += 1; hit = true; reasons.push('Planetary affinities recorded: ' + esc(M().planetsOf(deck).join(', '))); }
      if (cat === 'Elemental magic' && M().elementsOf(deck).length) { pts += 1; hit = true; reasons.push('Elemental affinities recorded: ' + esc(M().elementsOf(deck).join(', '))); }
      if (!hit) {
        // Look in your own words, quoting where the phrase appears.
        const words = KEYWORDS[cat] || [];
        const sources = TEXT_SOURCES.map(([id, where]) => [M().answer(deck, id).text || '', where])
          .concat([[deck.personality, 'your personality notes'], [deck.strengths, 'your strengths notes']]);
        for (const [text, where] of sources) {
          const low = (text || '').toLowerCase();
          const w = words.find((k) => low.includes(k));
          if (w) {
            pts += 1;
            reasons.push('Your notes on ' + where + ' mention “' + esc(snippetAround(text, w)) + '”');
            break;
          }
        }
      }
      // Limitations that mention the subject are surfaced, never hidden.
      const lim = (M().answer(deck, 'limitations').text || '') + ' ' + (deck.limitationsNotes || '');
      const lw = (KEYWORDS[cat] || []).find((k) => lim.toLowerCase().includes(k));
      if (lw) cautions.push('Its recorded limitations mention “' + esc(snippetAround(lim, lw)) + '”');
    });

    // Approach
    (q.approach || []).forEach((id) => weigh(id, qShort(id), false));

    // Elements
    const el = M().elementsOf(deck);
    (q.elements || []).forEach((x) => { if (el.includes(x)) { pts += 2; reasons.push('Elemental affinity: <b>' + esc(x) + '</b>'); } });

    // Practices
    (q.practices || []).forEach((id) => { if (!(q.subjects || []).some((c) => CATEGORY_TO_Q[c] === id)) weigh(id, qShort(id), false); });

    return { deck, pts, reasons: C.uniq(reasons), cautions: C.uniq(cautions), conflicts: C.uniq(conflicts), complete: M().status(deck) === 'complete' };
  }

  function snippetAround(text, word) {
    const flat = String(text).replace(/\s+/g, ' ');
    const i = flat.toLowerCase().indexOf(word);
    const start = Math.max(0, i - 30);
    return (start ? '…' : '') + flat.slice(start, i + word.length + 40).trim() + (i + word.length + 40 < flat.length ? '…' : '');
  }

  /* ------------------------------------------------------------ view */

  const STEPS = [
    { id: 'who', title: 'Who is this reading for?' },
    { id: 'subjects', title: 'What is the reading about?', hint: 'Choose any that fit.' },
    { id: 'approach', title: 'What kind of approach would help?', hint: 'Optional.' },
    { id: 'spirit', title: 'Any spiritual or elemental considerations?', hint: 'Optional.' }
  ];

  function freshQuery() { return { who: '', subjects: [], approach: [], elements: [], practices: [] }; }
  C.state = C.state || {};

  function stepBody(i, q) {
    const s = STEPS[i];
    const u = ui();
    let fields = '';
    if (s.id === 'who') fields = '<div class="choice-grid">' + WHO.map((w) => '<button type="button" class="choice" data-pick="who" data-value="' + w.id + '" aria-pressed="' + (q.who === w.id) + '"><span class="mark"></span>' + w.label + '</button>').join('') + '</div>';
    if (s.id === 'subjects') fields = u.chips('subjects', M().CATEGORIES, q.subjects);
    if (s.id === 'approach') fields = u.chips('approach', APPROACH, q.approach);
    if (s.id === 'spirit') fields = '<span class="label">Element</span><div class="mt8">' + u.chips('elements', M().ELEMENTS, q.elements) + '</div><div class="mt24"><span class="label">Practice</span></div><div class="mt8">' + u.chips('practices', PRACTICES, q.practices) + '</div>';
    return '<div class="iv-progress"><div class="bars">' + STEPS.map((_, j) => '<div class="bar"><i style="transform:scaleX(' + (j <= i ? 1 : 0) + ')"></i></div>').join('') + '</div>' +
      '<div class="meta"><span class="label">Step ' + (i + 1) + ' of ' + STEPS.length + '</span><span class="label">Deck Finder</span></div></div>' +
      '<div class="iv-body" data-step><h2>' + esc(s.title) + '</h2>' + (s.hint ? '<p class="q-hint">' + esc(s.hint) + '</p>' : '<p class="q-hint"></p>') + fields + '</div>' +
      '<div class="iv-foot"><button class="btn quiet" data-fprev' + (i === 0 ? ' disabled' : '') + ' aria-label="Back">' + C.icon('back') + '</button>' +
      '<button class="btn text" data-fskip>' + (i === STEPS.length - 1 ? '' : 'Skip') + '</button>' +
      '<button class="btn primary" data-fnext>' + (i === STEPS.length - 1 ? 'Find decks' : 'Next') + '</button></div>';
  }

  function summary(q) {
    const parts = [];
    if (q.who) parts.push('for ' + WHO.find((w) => w.id === q.who).label.toLowerCase());
    if (q.subjects.length) parts.push('about ' + q.subjects.join(', ').toLowerCase());
    if (q.approach.length) parts.push('with ' + q.approach.map((a) => APPROACH.find((x) => x.id === a).label.toLowerCase()).join(', '));
    if (q.elements.length) parts.push('drawing on ' + q.elements.join(', ').toLowerCase());
    if (q.practices.length) parts.push('for ' + q.practices.map((a) => PRACTICES.find((x) => x.id === a).label.toLowerCase()).join(', '));
    return parts.length ? 'A reading ' + parts.join('; ') + '.' : 'No criteria chosen — showing what your records can say.';
  }

  function matchCard(r, kind) {
    const d = r.deck;
    const items = r.reasons.map((x) => '<li>' + x + '</li>').concat(r.cautions.map((x) => '<li class="caution">' + x + '</li>'), r.conflicts.map((x) => '<li class="conflict">' + x + '</li>'));
    return '<div class="match"><a class="m-head" href="#/deck/' + d.id + '">' + C.ui.thumb(d) +
      '<div><span class="label">' + esc(M().typeLabel(d)) + '</span><h3>' + esc(d.name) + '</h3>' +
      (kind === 'confirmed' ? '<span class="stamp olive">Confirmed by your records</span>' : kind === 'possible' ? '<span class="stamp brass">Profile incomplete</span>' : kind === 'avoid' ? '<span class="stamp oxblood">Advised against</span>' : '') + '</div></a>' +
      (items.length ? '<ul>' + items.join('') + '</ul>' : '') +
      (kind !== 'avoid' ? '<div class="m-actions"><a class="btn small primary" href="#/journal/new?deck=' + d.id + '">Read with this deck</a>' +
        (kind === 'possible' || kind === 'unknown' ? '<a class="btn small quiet" href="#/interview/' + d.id + '">' + (M().status(d) === 'draft' ? 'Resume interview' : 'Interview it') + '</a>' : '') + '</div>' : '') +
      '</div>';
  }

  function resultsHTML(q) {
    const scored = C.store.decks.map((d) => score(d, q)).sort((a, b) => b.pts - a.pts || a.deck.name.localeCompare(b.deck.name));
    const confirmed = scored.filter((r) => !r.conflicts.length && r.pts > 0 && r.complete);
    const possible = scored.filter((r) => !r.conflicts.length && r.pts > 0 && !r.complete);
    const avoid = scored.filter((r) => r.conflicts.length);
    const unknown = scored.filter((r) => !r.conflicts.length && r.pts === 0 && !r.complete);
    const nomatch = scored.filter((r) => !r.conflicts.length && r.pts === 0 && r.complete);

    let out = ui().pageHead({ title: 'Deck Finder', right: '<button class="btn small quiet" data-restart>Start over</button>' }) +
      '<h2 class="section-title mt0">From your cabinet</h2><p class="summary-line">' + esc(summary(q)) + '</p>';

    if (!confirmed.length && !possible.length) {
      out += '<div class="notice"><p>No deck’s records match these criteria yet. ' +
        (unknown.length ? 'Some decks haven’t been interviewed, so there isn’t enough to go on — the more you record, the better this gets.' : 'Try fewer criteria, or add reading specialties to your decks’ profiles.') + '</p></div>';
    }
    if (confirmed.length) {
      out += '<div class="group-head"><h3>Confirmed matches</h3><span class="label">' + confirmed.length + '</span></div>' +
        '<p class="small muted">Interviewed decks whose recorded answers, specialties or notes fit.</p>' + confirmed.map((r) => matchCard(r, 'confirmed')).join('');
    }
    if (possible.length) {
      out += '<div class="group-head"><h3>Possible — incomplete profile</h3><span class="label">' + possible.length + '</span></div>' +
        '<p class="small muted">Partial records point this way, but the interview isn’t finished.</p>' + possible.map((r) => matchCard(r, 'possible')).join('');
    }
    if (avoid.length) {
      out += '<details class="more mt24"><summary><span><span class="label">Advised against by your answers</span> <span class="small faint">· ' + avoid.length + '</span></span>' + C.icon('chevron', 'chev') + '</summary><div class="body">' + avoid.map((r) => matchCard(r, 'avoid')).join('') + '</div></details>';
    }
    if (unknown.length) {
      out += '<details class="more"><summary><span><span class="label">Not enough recorded to say</span> <span class="small faint">· ' + unknown.length + '</span></span>' + C.icon('chevron', 'chev') + '</summary><div class="body">' + unknown.map((r) => matchCard(r, 'unknown')).join('') + '</div></details>';
    }
    if (nomatch.length) out += '<p class="footnote">' + nomatch.length + ' interviewed ' + (nomatch.length === 1 ? 'deck has' : 'decks have') + ' nothing recorded that relates to this reading.</p>';
    return out;
  }

  C.views.finder = {
    title: 'Deck Finder',
    render() {
      if (!C.store.decks.length) {
        return C.ui.masthead({ kicker: 'Section III', title: 'Deck Finder', sub: 'Which deck wants this reading?' }) +
          '<div class="empty">' + C.ui.emptyDrawer + '<h3>Nothing to choose from yet</h3><p>The finder recommends from your own decks, using your interviews and tags.</p><a class="btn primary" href="#/add">Add a deck</a></div>';
      }
      return '<div data-finder></div>';
    },
    mount(el) {
      const host = el.querySelector('[data-finder]');
      if (!host) return;
      const st = (C.state.finder = C.state.finder || { step: -1, q: freshQuery() });

      function intro() {
        const n = C.store.decks.length;
        const done = C.store.decks.filter((d) => M().status(d) === 'complete').length;
        host.innerHTML = C.ui.masthead({ kicker: 'Section III', title: 'Deck Finder', sub: 'Which deck wants this reading?' }) +
          '<p class="section-lede mt24">Four short questions. Recommendations come only from what you’ve recorded — interviews, specialties, tags and your own notes — and each one shows its reasons.</p>' +
          '<div class="catalog-card mt24"><div class="cc-head"><span class="label">Your records</span><span class="label">' + done + '/' + n + '</span></div>' +
          '<div class="cc-typed">' + done + ' of ' + n + ' ' + (n === 1 ? 'deck' : 'decks') + ' fully interviewed.</div></div>' +
          '<div class="actions-row stack mt24"><button class="btn primary" data-start>Begin</button>' +
          (C.store.settings.finderLast ? '<button class="btn quiet" data-repeat>Repeat last search</button>' : '') + '</div>';
      }
      function draw() {
        if (st.step < 0) return intro();
        if (st.step >= STEPS.length) {
          host.innerHTML = resultsHTML(st.q);
          C.hydratePhotos(host);
          return;
        }
        host.innerHTML = '<div class="iv">' + stepBody(st.step, st.q) + '</div>';
        ui().bind(host.querySelector('[data-step]'), st.q, () => {});
      }

      host.addEventListener('click', (e) => {
        if (e.target.closest('[data-start]')) { st.q = freshQuery(); st.step = 0; draw(); window.scrollTo(0, 0); return; }
        if (e.target.closest('[data-repeat]')) { st.q = Object.assign(freshQuery(), C.clone(C.store.settings.finderLast)); st.step = STEPS.length; draw(); return; }
        if (e.target.closest('[data-restart]')) { st.step = -1; draw(); window.scrollTo(0, 0); return; }
        if (e.target.closest('[data-fprev]')) { st.step = Math.max(0, st.step - 1); draw(); return; }
        if (e.target.closest('[data-fnext]') || e.target.closest('[data-fskip]')) {
          st.step++;
          if (st.step >= STEPS.length) { C.store.settings.finderLast = C.clone(st.q); C.store.saveSettings(); }
          draw();
          window.scrollTo(0, 0);
        }
      });
      draw();
    }
  };

  C.finderScore = score; // exposed for testing
})();
