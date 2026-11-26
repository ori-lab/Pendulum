/* Deck profile — the permanent record for a single deck. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;

  const openDrawers = {}; // deckId -> Set of open section ids
  const editing = {}; // deckId -> Set of sections in edit mode

  const choiceStamp = (v) => {
    if (!v) return '<span class="unanswered">Not answered</span>';
    const cls = { yes: 'olive', no: 'oxblood', conditional: 'brass', undecided: 'faint' }[v];
    return '<span class="stamp ' + cls + '">' + esc(M().choiceLabel(v)) + '</span>';
  };

  /* A read-only rendering of one interview answer. */
  function answerHTML(q, a) {
    a = a || {};
    if (!M().hasAnswer(a)) return '<p class="a unanswered">Not yet answered.</p>';
    let out = '';
    if (q.kind === 'choice') {
      out += '<p class="a">' + choiceStamp(a.choice) + '</p>';
      if (q.bottom && ['yes', 'conditional'].includes(a.choice)) {
        const m = C.uniq([...(a.meaning || []), (a.meaningOther || '').trim()]);
        if (m.length) out += '<p class="a small mt8"><span class="label">Represents</span> ' + esc(m.join(', ')) + '</p>';
      }
      if (a.notes) out += '<p class="a muted mt8">' + esc(a.notes) + '</p>';
      return out;
    }
    if (q.kind === 'multi') {
      const vals = C.uniq([...(a.values || []), ...C.splitCards(a.custom || '')]);
      if (vals.length) out += '<p class="a">' + vals.map((v) => '<span class="stamp brass">' + esc(v) + '</span>').join(' ') + '</p>';
      if (a.cards) out += '<p class="cards-drawn mt8">' + esc(a.cards) + '</p>';
      if (a.notes) out += '<p class="a muted mt8">' + esc(a.notes) + '</p>';
      return out;
    }
    if (a.cards) out += '<p class="cards-drawn">' + esc(a.cards) + '</p>';
    if (a.text) out += '<p class="a">' + esc(a.text) + '</p>';
    if (a.notes) out += '<p class="a muted">' + esc(a.notes) + '</p>';
    return out;
  }
  C.answerHTML = answerHTML;

  function qa(deck, id) {
    const q = M().question(id);
    return '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + answerHTML(q, M().answer(deck, id)) + '</div>';
  }

  /* Inline editors for interview answers (paths relative to the deck). */
  function answerEditor(q) {
    const base = 'interview.answers.' + q.id;
    const u = ui();
    if (q.kind === 'reflect') {
      return '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + u.field('Cards drawn', u.input(base + '.cards')) + u.field('Interpretation', u.textarea(base + '.text', { lined: true, rows: 4 })) + '</div>';
    }
    if (q.kind === 'choice') {
      return '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + u.choiceGrid(base + '.choice', C.getPath(currentDeck, base + '.choice'), true) +
        (q.bottom ? '<div class="mt8">' + u.chips(base + '.meaning', M().BOTTOM_MEANINGS, C.getPath(currentDeck, base + '.meaning') || [], { small: true }) + '</div><div class="mt8">' + u.input(base + '.meaningOther', { placeholder: 'Another interpretation of the bottom card' }) + '</div>' : '') +
        '<div class="mt8">' + u.textarea(base + '.notes', { rows: 2, placeholder: 'Notes' }) + '</div></div>';
    }
    if (q.kind === 'multi') {
      return '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + u.chips(base + '.values', q.options, C.getPath(currentDeck, base + '.values') || [], { small: true }) +
        '<div class="mt8">' + u.input(base + '.custom', { placeholder: 'Your own, separated by commas' }) + '</div>' +
        '<div class="mt8">' + u.textarea(base + '.notes', { rows: 2, placeholder: 'Notes' }) + '</div></div>';
    }
    return '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + u.textarea(base + '.text', { lined: true, rows: 4 }) + '</div>';
  }

  let currentDeck = null;

  /* ------------------------------------------------------------ sections */

  function customQs(kind) {
    return (C.store.settings.customQuestions || [])
      .filter((q) => (kind ? (kind === 'choice' ? q.kind === 'choice' : q.kind !== 'choice') : true))
      .map((q) => M().question(q.id))
      .filter((q) => q && (!C.store.settings.customQuestions.find((x) => x.id === q.id).archived || M().hasAnswer(M().answer(currentDeck, q.id))));
  }

  const SECTIONS = [
    {
      id: 'personality', title: 'Deck personality',
      meta: (d) => (d.personality || M().hasAnswer(M().answer(d, 'nature')) ? '' : 'Empty'),
      read: (d) => {
        let out = d.personality ? '<p class="pull-quote">' + esc(d.personality) + '</p>' : '<p class="unanswered">Describe the deck’s character in your own words — tap Edit.</p>';
        if (M().hasAnswer(M().answer(d, 'nature'))) out += '<span class="label">From the interview</span>' + qa(d, 'nature');
        return out;
      },
      edit: () => ui().field('In your own words', ui().textarea('personality', { lined: true, rows: 5, placeholder: 'Temperament, voice, manner…' })) + answerEditor(M().question('nature'))
    },
    {
      id: 'spiritual', title: 'Spiritual interview',
      meta: (d) => { const qs = ['nature', 'teach', 'territory', 'relationship', 'limitations']; return qs.filter((q) => M().hasAnswer(M().answer(d, q))).length + '/5'; },
      read: (d) => ['nature', 'teach', 'territory', 'relationship', 'limitations'].map((id) => qa(d, id)).join('') +
        (customQs('reflect').length ? '<span class="label">Your own questions</span>' + customQs('reflect').map((q) => qa(d, q.id)).join('') : ''),
      edit: () => ['nature', 'teach', 'territory', 'relationship', 'limitations'].map((id) => answerEditor(M().question(id))).join('') + customQs('reflect').map(answerEditor).join('')
    },
    {
      id: 'technical', title: 'Technical reading preferences',
      meta: (d) => { const qs = M().BASE_QUESTIONS.filter((q) => q.section === 'technical'); return qs.filter((q) => M().answer(d, q.id).choice).length + '/' + qs.length; },
      read: (d) => '<dl class="kv">' + M().BASE_QUESTIONS.filter((q) => q.section === 'technical').concat(customQs('choice')).map((q) => {
        const a = M().answer(d, q.id);
        let extra = '';
        if (q.bottom && ['yes', 'conditional'].includes(a.choice)) { const m = M().bottomMeaning(d); if (m.length) extra += '<div class="small muted mt8">Represents: ' + esc(m.join(', ')) + '</div>'; }
        if (a.notes) extra += '<div class="small muted mt8" style="white-space:pre-wrap">' + esc(a.notes) + '</div>';
        return '<dt>' + esc(q.short || q.text) + '</dt><dd>' + choiceStamp(a.choice) + extra + '</dd>';
      }).join('') + '</dl>',
      edit: () => M().BASE_QUESTIONS.filter((q) => q.section === 'technical').concat(customQs('choice')).map(answerEditor).join('')
    },
    {
      id: 'affinities', title: 'Elemental & planetary affinities',
      meta: (d) => C.uniq([...M().elementsOf(d), ...M().planetsOf(d)]).slice(0, 3).join(' · '),
      read: (d) => {
        const el = M().elementsOf(d), pl = M().planetsOf(d);
        let out = '<dl class="kv"><dt>Elements</dt><dd>' + (el.length ? esc(el.join(', ')) : '<span class="unanswered">Not recorded</span>') + '</dd>' +
          '<dt>Planets</dt><dd>' + (pl.length ? esc(pl.join(', ')) : '<span class="unanswered">Not recorded</span>') + '</dd></dl>';
        ['elements', 'planets'].forEach((id) => { const a = M().answer(d, id); if (a.cards || a.notes) out += '<div class="mt16">' + (a.cards ? '<p class="cards-drawn">' + esc(a.cards) + '</p>' : '') + (a.notes ? '<p class="a muted">' + esc(a.notes) + '</p>' : '') + '</div>'; });
        out += '<div class="mt24">' + qa(d, 'care') + '</div>';
        return out;
      },
      edit: () => answerEditor(M().question('elements')) + answerEditor(M().question('planets')) + answerEditor(M().question('care'))
    },
    {
      id: 'strengths', title: 'Strengths & limitations',
      meta: () => '',
      read: (d) => '<span class="label">Strengths</span>' + (d.strengths ? '<p class="prose mt8">' + esc(d.strengths) + '</p>' : '<p class="unanswered mt8">Not yet noted.</p>') +
        '<div class="mt24"><span class="label">Limitations</span></div>' + (M().hasAnswer(M().answer(d, 'limitations')) ? '<div class="mt8">' + answerHTML(M().question('limitations'), M().answer(d, 'limitations')) + '</div>' : '') +
        (d.limitationsNotes ? '<p class="prose mt8">' + esc(d.limitationsNotes) + '</p>' : (!M().hasAnswer(M().answer(d, 'limitations')) ? '<p class="unanswered mt8">Not yet noted.</p>' : '')),
      edit: () => ui().field('Strengths', ui().textarea('strengths', { lined: true, rows: 4, placeholder: 'What it does beautifully.' })) +
        answerEditor(M().question('limitations')) + ui().field('Further notes on limitations', ui().textarea('limitationsNotes', { rows: 3 }))
    },
    {
      id: 'applications', title: 'Best reading applications',
      meta: (d) => (d.specialties.length ? d.specialties.length + ' specialt' + (d.specialties.length === 1 ? 'y' : 'ies') : ''),
      read: (d) => {
        let out = '<span class="label">Reading specialties</span><div class="mt8">' + (d.specialties.length ? '<div class="chips">' + d.specialties.map((s) => '<span class="chip small tag-chip">' + esc(s) + '</span>').join('') + '</div>' : '<p class="unanswered mb0">None chosen yet — these guide the Deck Finder.</p>') + '</div>';
        out += '<div class="mt24"><span class="label">Suited to — from the interview</span></div><dl class="kv mt8">' +
          ['personal', 'client', 'collective', 'structured', 'freeform'].map((id) => '<dt>' + esc(M().question(id).short) + '</dt><dd>' + choiceStamp(M().answer(d, id).choice) + '</dd>').join('') + '</dl>';
        out += '<div class="mt24"><span class="label">Spiritual work</span></div><dl class="kv mt8">' +
          M().ESOTERIC_SUIT.map((id) => { const a = M().answer(d, id); return '<dt>' + esc(M().question(id).short) + '</dt><dd>' + choiceStamp(a.choice) + (a.notes ? '<div class="small muted mt8">' + esc(a.notes) + '</div>' : '') + '</dd>'; }).join('') + '</dl>';
        return out;
      },
      edit: (d) => '<div class="field"><span class="label">Reading specialties</span>' + ui().chips('specialties', M().CATEGORIES, d.specialties, { small: true }) + '</div>' +
        '<p class="small faint">Personal, client, collective and spread preferences live under Technical reading preferences.</p>' +
        M().ESOTERIC_SUIT.map((id) => answerEditor(M().question(id))).join('')
    },
    {
      id: 'spreads', title: 'Preferred spreads',
      meta: (d) => (d.spreads.length ? String(d.spreads.length) : ''),
      noEdit: true,
      read: (d) => (d.spreads.length ? d.spreads.map((s) => '<div class="list-item"><div class="li-head"><h4>' + esc(s.name) + '</h4><div class="li-actions">' +
        '<button class="icon-btn" data-spread-edit="' + s.id + '" aria-label="Edit spread">' + C.icon('edit') + '</button>' +
        '<button class="icon-btn" data-spread-del="' + s.id + '" aria-label="Delete spread">' + C.icon('trash') + '</button></div></div>' +
        (C.splitCards(s.positions).length ? '<ol class="cards-list mt8" style="color:var(--ink)">' + s.positions.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') +
        (s.notes ? '<p class="prose muted small mt8">' + esc(s.notes) + '</p>' : '') + '</div>').join('') : '<p class="unanswered">No spreads saved for this deck.</p>') +
        '<button class="btn quiet small mt16" data-spread-add>' + C.icon('plus') + ' Save a spread</button>'
    },
    {
      id: 'pairings', title: 'Compatible decks',
      meta: (d) => (d.pairings.length ? String(d.pairings.length) : ''),
      noEdit: true,
      read: (d) => {
        const a = M().answer(d, 'otherDecks');
        let out = '<p class="small"><span class="label">Works alongside other decks?</span> ' + choiceStamp(a.choice) + '</p>';
        out += d.pairings.length ? d.pairings.map((p) => {
          const other = C.store.deck(p.deckId);
          if (!other) return '';
          return '<div class="list-item"><div class="li-head"><a href="#/deck/' + other.id + '" style="text-decoration:none"><h4>' + esc(other.name) + '</h4></a><div class="li-actions">' +
            '<button class="icon-btn" data-pair-edit="' + other.id + '" aria-label="Edit pairing notes">' + C.icon('edit') + '</button>' +
            '<button class="icon-btn" data-pair-del="' + other.id + '" aria-label="Remove pairing">' + C.icon('trash') + '</button></div></div>' +
            (p.notes ? '<p class="prose muted small mt8">' + esc(p.notes) + '</p>' : '') + '</div>';
        }).join('') : '<p class="unanswered">No pairings noted.</p>';
        out += C.store.decks.length > 1 ? '<button class="btn quiet small mt16" data-pair-add>' + C.icon('plus') + ' Add a pairing</button>' : '<p class="small faint">Add another deck to note pairings.</p>';
        return out;
      }
    },
    {
      id: 'guidebook', title: 'Guidebook notes',
      meta: (d) => { const g = M().GUIDEBOOK.find((x) => x.id === d.guidebook); return g ? g.label : ''; },
      read: (d) => { const g = M().GUIDEBOOK.find((x) => x.id === d.guidebook); return '<p class="small"><span class="label">Guidebook</span> ' + (g ? esc(g.label) : '<span class="unanswered">Not noted</span>') + '</p>' + (d.guidebookNotes ? '<p class="prose">' + esc(d.guidebookNotes) + '</p>' : '<p class="unanswered">No notes on the guidebook yet.</p>'); },
      edit: () => '<div class="field"><span class="label">Guidebook</span>' + ui().select('guidebook', M().GUIDEBOOK, 'Not noted') + '</div>' + ui().field('Notes', ui().textarea('guidebookNotes', { lined: true, rows: 6, placeholder: 'Useful passages, disagreements, page references…' }))
    },
    {
      id: 'recurring', title: 'Recurring cards',
      meta: (d) => { const r = M().recurringCards(d); return r.length ? String(r.length) : ''; },
      read: (d) => {
        const r = M().recurringCards(d);
        return (r.length ? '<p class="small muted">Cards appearing in more than one journal entry with this deck.</p><div class="tally">' + r.map((x) => '<span class="t">' + esc(x.card) + '<b>×' + x.count + '</b></span>').join('') + '</div>'
          : '<p class="unanswered">Cards that turn up in more than one journal entry will gather here.</p>') +
          (d.recurringNotes ? '<p class="prose mt16">' + esc(d.recurringNotes) + '</p>' : '');
      },
      edit: () => ui().field('Notes on recurring cards', ui().textarea('recurringNotes', { lined: true, rows: 4, placeholder: 'Cards that keep appearing and what you make of them.' }))
    },
    {
      id: 'journal', title: 'Practice journal',
      meta: (d) => { const n = C.store.entriesFor(d.id).length; return n ? String(n) : ''; },
      noEdit: true,
      read: (d) => {
        const list = C.store.entriesFor(d.id);
        return (list.length ? list.slice(0, 20).map((e) => C.ui.entryRow(e)).join('') + (list.length > 20 ? '<p class="small faint mt8">Showing the 20 most recent. <a href="#/journal?deck=' + d.id + '">See all</a></p>' : '') : '<p class="unanswered">No readings recorded with this deck yet.</p>') +
          '<a class="btn quiet small mt16" href="#/journal/new?deck=' + d.id + '">' + C.icon('plus') + ' Record a reading</a>';
      }
    },
    {
      id: 'discoveries', title: 'Ongoing discoveries',
      meta: (d) => { const f = d.discoveries.filter((x) => x.changesPrefs).length; return f ? f + ' flagged' : d.discoveries.length ? String(d.discoveries.length) : ''; },
      noEdit: true,
      read: (d) => {
        const list = d.discoveries.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return (list.length ? list.map((x) => '<div class="discovery' + (x.changesPrefs ? ' flagged' : '') + '"><div class="flex between items-center"><span class="when">' + esc(C.fmtDate(x.date, 'short')) +
          (x.entryId ? ' · <a href="#/entry/' + x.entryId + '">from a reading</a>' : '') + '</span>' +
          '<span class="flex">' + (x.entryId ? '' : '<button class="icon-btn" data-disc-edit="' + x.id + '" aria-label="Edit discovery">' + C.icon('edit') + '</button>') +
          '<button class="icon-btn" data-disc-del="' + x.id + '" aria-label="Delete discovery">' + C.icon('trash') + '</button></span></div>' +
          '<p class="prose mb0">' + esc(x.text) + '</p>' +
          (x.changesPrefs ? '<p class="small mt8 mb0"><span class="stamp oxblood">May change preferences</span> <a href="#/interview/' + d.id + '?section=technical">Review technical answers</a></p>' : '') + '</div>').join('')
          : '<p class="unanswered">Things you learn about this deck over time. Discoveries noted in journal entries appear here too.</p>') +
          '<button class="btn quiet small mt8" data-disc-add>' + C.icon('plus') + ' Note a discovery</button>';
      }
    },
    {
      id: 'details', title: 'Collection details',
      meta: () => '',
      read: (d) => {
        const g = M().GUIDEBOOK.find((x) => x.id === d.guidebook);
        const rows = [['Name', d.name], ['Type', M().typeLabel(d)], ['System', M().systemLabel(d)], ['Creator', d.creator], ['Illustrator', d.illustrator], ['Publisher', d.publisher],
          ['Cards', d.cardCount], ['Acquired', C.fmtDate(d.acquired)], ['Guidebook', g && g.label], ['Catalogue no.', M().callNo(d)], ['Added', C.fmtDate(d.createdAt)]];
        return '<dl class="kv">' + rows.filter((r) => r[1]).map((r) => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') +
          (d.tags.length ? '<dt>Tags</dt><dd><div class="chips">' + d.tags.map((t) => '<span class="chip small tag-chip">' + esc(t) + '</span>').join('') + '</div></dd>' : '') + '</dl>' +
          (d.notes ? '<div class="mt16"><span class="label">Personal notes</span><p class="prose mt8">' + esc(d.notes) + '</p></div>' : '');
      },
      edit: (d) => ui().field('Deck name', ui().input('name', { cls: 'title-input' })) +
        '<div data-photo-slot>' + C.photoDrop(d.photoId) + '</div>' +
        (d.photoId ? '<button class="btn text small" data-photo-remove style="margin:-10px 0 14px">Remove photograph</button>' : '') +
        C.deckDetailsFields(d)
    },
    {
      id: 'history', title: 'Interview history',
      meta: (d) => (d.interviewHistory.length ? d.interviewHistory.length + 1 + ' interviews' : ''),
      noEdit: true,
      read: (d) => {
        const iv = d.interview;
        const st = M().status(d);
        let out = '<dl class="kv">' +
          '<dt>Current</dt><dd>' + (st === 'complete' ? 'Completed ' + esc(C.fmtDate(iv.completedAt)) : st === 'draft' ? 'In progress since ' + esc(C.fmtDate(iv.startedAt || iv.updatedAt)) : 'Not begun') + '</dd>' +
          (iv.completedAt && iv.updatedAt && iv.updatedAt.slice(0, 10) !== iv.completedAt.slice(0, 10) ? '<dt>Last revisited</dt><dd>' + esc(C.fmtDate(iv.updatedAt)) + '</dd>' : '') + '</dl>';
        if (d.interviewHistory.length) {
          out += '<div class="mt16"><span class="label">Earlier interviews</span>' + d.interviewHistory.slice().reverse().map((h) =>
            '<div class="history-item"><span>' + esc(C.fmtDate(h.completedAt || h.startedAt || h.archivedAt)) + (h.completedAt ? '' : ' <span class="stamp faint">Unfinished</span>') + '</span>' +
            '<button class="btn small quiet" data-hist="' + h.id + '">Read</button></div>').join('') + '</div>';
        }
        out += '<div class="actions-row">' +
          (st === 'none' ? '<a class="btn small primary" href="#/interview/' + d.id + '">Begin interview</a>'
            : '<a class="btn small quiet" href="#/interview/' + d.id + (st === 'complete' ? '?q=nature' : '') + '">' + (st === 'complete' ? 'Revisit answers' : 'Resume interview') + '</a>' +
              '<button class="btn small quiet" data-fresh>Begin a fresh interview</button>') + '</div>';
        if (st === 'complete' && d.interview.skipEsoteric) out += '<p class="small mt16">The optional esoteric questions were skipped. <a href="#/interview/' + d.id + '?section=esoteric" data-include-eso>Answer them now</a></p>';
        return out;
      }
    }
  ];

  function drawerHTML(d, sec, i) {
    const open = (openDrawers[d.id] || new Set()).has(sec.id);
    const isEditing = (editing[d.id] || new Set()).has(sec.id);
    const meta = sec.meta ? sec.meta(d) : '';
    const bar = sec.noEdit ? '' : '<div class="edit-bar">' + (isEditing
      ? '<span class="save-state" data-save-state></span><button class="btn small olive" data-done="' + sec.id + '">' + C.icon('check') + ' Done</button>'
      : '<button class="btn small quiet" data-edit="' + sec.id + '">' + C.icon('edit') + ' Edit</button>') + '</div>';
    return '<details class="drawer" data-sec="' + sec.id + '"' + (open || isEditing ? ' open' : '') + '>' +
      '<summary><span class="num">§' + C.pad(i + 1, 2) + '</span><span class="ttl">' + esc(sec.title) + '</span><span class="meta">' + esc(meta) + '</span>' + C.icon('chevron', 'chev') + '</summary>' +
      '<div class="drawer-body">' + bar + '<div data-body="' + sec.id + '">' + (isEditing ? sec.edit(d) : sec.read(d)) + '</div></div></details>';
  }

  function primaryAction(d) {
    const st = M().status(d);
    if (st === 'none') return '<a class="btn primary" href="#/interview/' + d.id + '">Begin interview</a><a class="btn quiet" href="#/journal/new?deck=' + d.id + '">Record a reading</a>';
    if (st === 'draft') { const p = M().progress(d); return '<a class="btn primary" href="#/interview/' + d.id + '">Resume interview · ' + p.answered + '/' + p.total + '</a><a class="btn quiet" href="#/journal/new?deck=' + d.id + '">Record a reading</a>'; }
    return '<a class="btn primary" href="#/journal/new?deck=' + d.id + '">Record a reading</a>';
  }

  /* ------------------------------------------------------------ sheets for list items */

  function spreadSheet(d, spread) {
    const tmp = spread ? C.clone(spread) : { id: C.uid('spread'), name: '', positions: '', notes: '' };
    C.openSheet('<h3>' + (spread ? 'Edit spread' : 'Save a spread') + '</h3><div data-f>' +
      ui().field('Name', ui().input('name', { placeholder: 'e.g. Three-card bridge', autofocus: true })) +
      ui().field('Positions', ui().textarea('positions', { lined: true, rows: 5, placeholder: 'One position per line' })) +
      ui().field('Notes', ui().textarea('notes', { rows: 3 })) + '</div>' +
      '<div class="actions-row stack"><button class="btn primary" data-save>Save spread</button><button class="btn quiet" data-cancel>Cancel</button></div>', (sheet) => {
      ui().bind(sheet.querySelector('[data-f]'), tmp, () => {});
      sheet.querySelector('[data-cancel]').onclick = C.closeSheet;
      sheet.querySelector('[data-save]').onclick = async () => {
        if (!tmp.name.trim()) { sheet.querySelector('[data-field=name]').focus(); return; }
        const i = d.spreads.findIndex((s) => s.id === tmp.id);
        if (i >= 0) d.spreads[i] = tmp; else d.spreads.push(tmp);
        await C.store.saveDeck(d);
        C.closeSheet();
        C.rerender();
      };
    });
  }

  function pairingSheet(d, otherId) {
    const existing = otherId ? d.pairings.find((p) => p.deckId === otherId) : null;
    const tmp = { deckId: otherId || '', notes: existing ? existing.notes : '' };
    const options = C.store.decks.filter((x) => x.id !== d.id && (otherId === x.id || !d.pairings.some((p) => p.deckId === x.id)));
    C.openSheet('<h3>' + (existing ? 'Pairing notes' : 'Pair with another deck') + '</h3><div data-f>' +
      (existing ? '<p class="serif" style="font-size:20px">' + esc(C.store.deck(otherId).name) + '</p>'
        : '<div class="field"><span class="label">Deck</span>' + ui().select('deckId', options.map((x) => ({ id: x.id, label: x.name })), 'Choose a deck') + '</div>') +
      ui().field('How they work together', ui().textarea('notes', { lined: true, rows: 4 })) + '</div>' +
      '<p class="small faint">The pairing is noted on both decks.</p>' +
      '<div class="actions-row stack"><button class="btn primary" data-save>Save pairing</button><button class="btn quiet" data-cancel>Cancel</button></div>', (sheet) => {
      ui().bind(sheet.querySelector('[data-f]'), tmp, () => {});
      sheet.querySelector('[data-cancel]').onclick = C.closeSheet;
      sheet.querySelector('[data-save]').onclick = async () => {
        const other = C.store.deck(tmp.deckId);
        if (!other) return;
        const upsert = (a, b) => {
          const p = a.pairings.find((x) => x.deckId === b.id);
          if (p) p.notes = tmp.notes; else a.pairings.push({ deckId: b.id, notes: tmp.notes });
        };
        upsert(d, other);
        upsert(other, d);
        await C.store.saveDeck(other, { silent: true });
        await C.store.saveDeck(d);
        C.closeSheet();
        C.rerender();
      };
    });
  }

  function historySheet(d, h) {
    const qs = M().BASE_QUESTIONS.concat((C.store.settings.customQuestions || []).map((q) => M().question(q.id)).filter(Boolean));
    const answered = qs.filter((q) => M().hasAnswer((h.answers || {})[q.id]));
    C.openSheet('<h3>Interview of ' + esc(C.fmtDate(h.completedAt || h.startedAt || h.archivedAt)) + '</h3>' +
      '<p class="small faint">Archived ' + esc(C.fmtDate(h.archivedAt)) + '. Read-only.</p>' +
      (answered.length ? answered.map((q) => '<div class="qa"><p class="q">' + esc(q.text) + '</p>' + answerHTML(q, h.answers[q.id]) + '</div>').join('') : '<p class="unanswered">No answers were recorded.</p>') +
      '<div class="actions-row stack"><button class="btn quiet" data-close>Close</button><button class="btn text" data-del-hist>Delete this record</button></div>', (sheet) => {
      sheet.querySelector('[data-close]').onclick = C.closeSheet;
      sheet.querySelector('[data-del-hist]').onclick = async () => {
        C.closeSheet();
        const ok = await C.confirm({ title: 'Delete this earlier interview?', body: 'This archived record will be permanently removed.', ok: 'Delete' });
        if (!ok) return;
        d.interviewHistory = d.interviewHistory.filter((x) => x.id !== h.id);
        await C.store.saveDeck(d);
        C.rerender();
      };
    });
  }

  /* ------------------------------------------------------------ view */

  C.views.profile = {
    title: (p) => { const d = C.store.deck(p.id); return d ? d.name : 'Deck'; },
    nav: 'library',
    render(p) {
      const d = C.store.deck(p.id);
      if (!d) return '<div class="empty"><h3>This drawer is empty</h3><p>That deck isn’t in the cabinet — it may have been removed.</p><a class="btn" href="#/library">Return to the library</a></div>';
      currentDeck = d;
      if (!openDrawers[d.id]) openDrawers[d.id] = new Set();
      if (!editing[d.id]) editing[d.id] = new Set();
      const by = [d.creator ? 'by ' + d.creator : '', d.illustrator && d.illustrator !== d.creator ? 'illustrated by ' + d.illustrator : '', d.publisher].filter(Boolean).join(' · ');
      const usage = M().usageOf(d);

      return ui().pageHead({
        back: '#/library',
        title: M().callNo(d),
        right: '<button class="icon-btn" data-fav aria-pressed="' + d.favorite + '" aria-label="' + (d.favorite ? 'Remove from favourites' : 'Add to favourites') + '">' + C.icon('bookmark', d.favorite ? 'filled' : '') + '</button>'
      }) +
        (d.sample ? '<div class="notice"><p>This is a <b>sample</b> deck with invented answers, here to show the layout. Remove samples from the library.</p></div>' : '') +
        '<section class="profile-hero"><div><div class="portrait"><div class="photo">' + (d.photoId ? '<img alt="' + C.attr(d.name) + '" data-photo="' + d.photoId + '" data-size="full" data-zoom>' : ui().cover(d)) + '</div></div>' +
        (d.photoId ? '' : '<button class="btn text small" data-add-photo style="margin-top:8px">' + C.icon('camera') + ' Add photo</button>') + '</div>' +
        '<div><span class="label">' + esc(M().typeLabel(d)) + (M().systemLabel(d) ? ' · ' + esc(M().systemLabel(d)) : '') + (d.cardCount ? ' · ' + esc(d.cardCount) + ' cards' : '') + '</span>' +
        '<h1>' + esc(d.name) + '</h1>' + (by ? '<div class="byline">' + esc(by) + '</div>' : '') +
        '<div class="stamps">' + ui().statusStamp(d, { tilt: true }) + (d.favorite ? '<span class="stamp oxblood">Favourite</span>' : '') + '</div></div></section>' +
        '<div class="actions-row" style="margin-top:0;margin-bottom:24px">' + primaryAction(d) + '</div>' +
        '<div class="ref-wrap">' + ui().techCard(d) +
        (usage.length ? '<div class="usage-line">' + usage.map((u) => '<span class="stamp olive">' + esc(M().question(u).short) + '</span>').join('') + '</div>' : '') +
        '</div>' +
        '<div class="drawers">' + SECTIONS.map((s, i) => drawerHTML(d, s, i)).join('') + '</div>' +
        '<div class="actions-row" style="margin-top:34px"><button class="btn danger small" data-delete>' + C.icon('trash') + ' Remove this deck</button></div>' +
        '<p class="footnote">Interview answers are your own; nothing here is generated or inferred.</p>';
    },
    mount(el, p) {
      const d = C.store.deck(p.id);
      if (!d) return;
      const save = C.saver(() => C.store.saveDeck(d, { silent: true }), 500);

      // Track open drawers so re-renders keep your place.
      el.querySelectorAll('details.drawer').forEach((det) => {
        det.addEventListener('toggle', () => {
          const id = det.getAttribute('data-sec');
          if (det.open) openDrawers[d.id].add(id); else openDrawers[d.id].delete(id);
        });
      });

      // Bind every section currently in edit mode.
      el.querySelectorAll('[data-body]').forEach((body) => {
        const id = body.getAttribute('data-body');
        if (!editing[d.id].has(id)) return;
        ui().bind(body, d, (path) => {
          if (path === 'type' || path === 'tarotSystem') C.syncDeckDetails(body, d);
          if (path === 'type' && !d.type) d.type = 'tarot';
          save();
        });
        const slot = body.querySelector('[data-photo-slot]');
        if (slot) slot.addEventListener('click', () => replacePhoto(d));
      });

      async function replacePhoto(deck) {
        const [file] = await ui().pickFiles();
        if (!file) return;
        try {
          const old = deck.photoId;
          deck.photoId = await C.ingestPhoto(file);
          if (old) { await C.db.del('photos', old); C.forgetPhoto(old); }
          await C.store.saveDeck(deck);
          C.rerender();
        } catch (e) { C.toast('That image could not be read', 'warn'); }
      }

      el.addEventListener('click', async (e) => {
        const t = (sel) => e.target.closest(sel);
        let b;
        if (t('[data-fav]')) {
          d.favorite = !d.favorite;
          await C.store.saveDeck(d, { silent: true });
          C.toast(d.favorite ? 'Marked as favourite' : 'Removed from favourites');
          C.rerender();
          return;
        }
        if (t('[data-zoom]')) { const url = await C.loadPhotoURL(d.photoId, 'full'); if (url) C.lightbox(url); return; }
        if (t('[data-add-photo]')) return replacePhoto(d);
        if (t('[data-photo-remove]')) {
          const ok = await C.confirm({ title: 'Remove the photograph?', ok: 'Remove' });
          if (!ok) return;
          await C.db.del('photos', d.photoId); C.forgetPhoto(d.photoId); d.photoId = null;
          await C.store.saveDeck(d); C.rerender(); return;
        }
        if ((b = t('[data-edit]'))) { e.preventDefault(); editing[d.id].add(b.getAttribute('data-edit')); openDrawers[d.id].add(b.getAttribute('data-edit')); C.rerender(); return; }
        if ((b = t('[data-done]'))) {
          e.preventDefault();
          await save.flush();
          if (!d.name.trim()) { d.name = 'Untitled deck'; await C.store.saveDeck(d, { silent: true }); }
          editing[d.id].delete(b.getAttribute('data-done'));
          C.toast('Saved');
          C.rerender();
          return;
        }
        if (t('[data-spread-add]')) return spreadSheet(d);
        if ((b = t('[data-spread-edit]'))) return spreadSheet(d, d.spreads.find((s) => s.id === b.getAttribute('data-spread-edit')));
        if ((b = t('[data-spread-del]'))) {
          if (!(await C.confirm({ title: 'Delete this spread?', ok: 'Delete' }))) return;
          d.spreads = d.spreads.filter((s) => s.id !== b.getAttribute('data-spread-del'));
          await C.store.saveDeck(d); C.rerender(); return;
        }
        if (t('[data-pair-add]')) return pairingSheet(d);
        if ((b = t('[data-pair-edit]'))) return pairingSheet(d, b.getAttribute('data-pair-edit'));
        if ((b = t('[data-pair-del]'))) {
          if (!(await C.confirm({ title: 'Remove this pairing?', body: 'It is removed from both decks.', ok: 'Remove' }))) return;
          const oid = b.getAttribute('data-pair-del');
          d.pairings = d.pairings.filter((x) => x.deckId !== oid);
          const other = C.store.deck(oid);
          if (other) { other.pairings = other.pairings.filter((x) => x.deckId !== d.id); await C.store.saveDeck(other, { silent: true }); }
          await C.store.saveDeck(d); C.rerender(); return;
        }
        if (t('[data-disc-add]') || t('[data-disc-edit]')) {
          const id = t('[data-disc-edit]') && t('[data-disc-edit]').getAttribute('data-disc-edit');
          const ex = id ? d.discoveries.find((x) => x.id === id) : null;
          const tmp = { text: ex ? ex.text : '', changesPrefs: ex ? !!ex.changesPrefs : false };
          C.openSheet('<h3>' + (ex ? 'Edit discovery' : 'A new discovery') + '</h3><div data-f>' +
            ui().field('What did you notice?', ui().textarea('text', { lined: true, rows: 5 })) +
            '<label class="flex gap8 items-center" style="min-height:44px"><input type="checkbox" data-field="changesPrefs" style="width:22px;height:22px;accent-color:var(--oxblood)"> This may change how the deck wants to be read</label></div>' +
            '<div class="actions-row stack"><button class="btn primary" data-save>Save</button><button class="btn quiet" data-cancel>Cancel</button></div>', (sheet) => {
            ui().bind(sheet.querySelector('[data-f]'), tmp, () => {});
            setTimeout(() => sheet.querySelector('textarea').focus(), 60);
            sheet.querySelector('[data-cancel]').onclick = C.closeSheet;
            sheet.querySelector('[data-save]').onclick = async () => {
              if (!tmp.text.trim()) return;
              if (ex) Object.assign(ex, { text: tmp.text.trim(), changesPrefs: tmp.changesPrefs });
              else d.discoveries.push({ id: C.uid('disc'), date: C.today(), text: tmp.text.trim(), changesPrefs: tmp.changesPrefs });
              openDrawers[d.id].add('discoveries');
              await C.store.saveDeck(d); C.closeSheet(); C.rerender();
            };
          });
          return;
        }
        if ((b = t('[data-disc-del]'))) {
          const disc = d.discoveries.find((x) => x.id === b.getAttribute('data-disc-del'));
          if (!(await C.confirm({ title: 'Delete this discovery?', body: disc && disc.entryId ? 'It will also be cleared from the journal entry it came from.' : '', ok: 'Delete' }))) return;
          d.discoveries = d.discoveries.filter((x) => x !== disc);
          if (disc && disc.entryId) {
            const en = C.store.entry(disc.entryId);
            if (en) { en.discovery = ''; en.discoveryChangesPrefs = false; await C.store.saveEntry(en, { silent: true }); }
          }
          await C.store.saveDeck(d); C.rerender(); return;
        }
        if ((b = t('[data-hist]'))) return historySheet(d, d.interviewHistory.find((h) => h.id === b.getAttribute('data-hist')));
        if (t('[data-include-eso]')) { d.interview.skipEsoteric = false; await C.store.saveDeck(d, { silent: true }); return; }
        if (t('[data-fresh]')) {
          const ok = await C.confirm({
            title: 'Begin a fresh interview?',
            body: 'Your current answers are kept in Interview history, dated, and you start again with blank questions. Useful when your relationship with a deck has shifted.',
            ok: 'Archive & begin again'
          });
          if (!ok) return;
          const iv = d.interview;
          d.interviewHistory.push({ id: C.uid('hist'), archivedAt: C.now(), startedAt: iv.startedAt, completedAt: iv.completedAt, answers: C.clone(iv.answers), skipEsoteric: iv.skipEsoteric });
          d.interview = M().newInterview();
          await C.store.saveDeck(d, { silent: true });
          C.go('#/interview/' + d.id);
          return;
        }
        if (t('[data-delete]')) {
          const n = C.store.entriesFor(d.id).length;
          const ok = await C.confirm({
            title: 'Remove ' + d.name + '?',
            body: 'The deck, its photograph and its interview are permanently deleted.' + (n ? ' Its ' + n + ' journal ' + (n === 1 ? 'entry stays' : 'entries stay') + ' in your journal, noting the deck by name.' : '') + ' Consider exporting a backup first.',
            ok: 'Delete permanently'
          });
          if (!ok) return;
          await C.store.deleteDeck(d.id);
          C.toast('Deck removed');
          C.go('#/library', true);
        }
      });

      return () => save.flush();
    }
  };
})();
