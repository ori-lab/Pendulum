/* The Cabinet — data model, vocabularies and interview structure. */
(function () {
  'use strict';
  const C = window.C;

  const DECK_TYPES = [
    { id: 'tarot', label: 'Tarot', code: 'TAR' },
    { id: 'oracle', label: 'Oracle', code: 'ORA' },
    { id: 'lenormand', label: 'Lenormand', code: 'LEN' },
    { id: 'other', label: 'Other system', code: 'DIV' }
  ];
  const TAROT_SYSTEMS = ['RWS', 'Thoth', 'Marseille', 'Independent', 'Other'];
  const GUIDEBOOK = [
    { id: 'full', label: 'Full guidebook' },
    { id: 'lwb', label: 'Little white book' },
    { id: 'digital', label: 'Digital / online' },
    { id: 'none', label: 'None' }
  ];
  const CATEGORIES = [
    'Psychological exploration', 'Shadow work', 'Ancestral work', 'Deity work', 'Relationships',
    'Emotional processing', 'Decision-making', 'Predictive readings', 'Daily guidance', 'Collective readings',
    'Creative exploration', 'Archetypal study', 'Astrological readings', 'Elemental magic', 'Ritual',
    'Mythological exploration', 'Spiritual development'
  ];
  const ELEMENTS = ['Fire', 'Water', 'Air', 'Earth', 'Spirit'];
  const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const CHOICES = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
    { id: 'conditional', label: 'Conditional' },
    { id: 'undecided', label: 'Undecided' }
  ];
  const BOTTOM_MEANINGS = ['Felt energy', 'Underlying influences', 'Additional guidance'];
  const READING_TYPES = ['Personal', 'Client', 'Collective', 'Daily pull', 'Deck study', 'Ritual', 'Other'];

  const SECTIONS = {
    spiritual: {
      label: 'Spiritual interview', short: 'Spiritual',
      intro: 'Shuffle, ask, and draw. Note the card or cards, then what you sense.'
    },
    technical: {
      label: 'Technical interview', short: 'Technical',
      intro: 'Quick answers about how this deck prefers to be read.'
    },
    esoteric: {
      label: 'Esoteric interview', short: 'Esoteric', optional: true,
      intro: 'Optional. Affinities and the kinds of work this deck is suited to.'
    },
    custom: { label: 'Your own questions', short: 'Your questions' }
  };

  const BASE_QUESTIONS = [
    { id: 'nature', section: 'spiritual', kind: 'reflect', text: 'What is your nature?' },
    { id: 'teach', section: 'spiritual', kind: 'reflect', text: 'What are you here to teach me?' },
    { id: 'territory', section: 'spiritual', kind: 'reflect', text: 'What territory do you work best within?' },
    { id: 'relationship', section: 'spiritual', kind: 'reflect', text: 'How can I best develop a relationship with you?' },
    { id: 'limitations', section: 'spiritual', kind: 'reflect', text: 'What are your limitations?' },

    { id: 'reversals', section: 'technical', kind: 'choice', text: 'Do you want me to use reversals?', short: 'Reversals' },
    { id: 'clarifiers', section: 'technical', kind: 'choice', text: 'Do you work well with clarifying cards?', short: 'Clarifiers' },
    { id: 'jumpers', section: 'technical', kind: 'choice', text: 'Should I acknowledge jumper cards?', short: 'Jumpers' },
    { id: 'bottom', section: 'technical', kind: 'choice', text: 'Should I consider the bottom of the deck?', short: 'Bottom of deck', bottom: true },
    { id: 'otherDecks', section: 'technical', kind: 'choice', text: 'Do you work well alongside other decks?', short: 'With other decks' },
    { id: 'personal', section: 'technical', kind: 'choice', text: 'Are you suited to personal readings?', short: 'Personal readings' },
    { id: 'client', section: 'technical', kind: 'choice', text: 'Are you suited to client readings?', short: 'Client readings' },
    { id: 'collective', section: 'technical', kind: 'choice', text: 'Are you suited to collective readings?', short: 'Collective readings' },
    { id: 'structured', section: 'technical', kind: 'choice', text: 'Do you work well with structured spreads?', short: 'Structured spreads' },
    { id: 'freeform', section: 'technical', kind: 'choice', text: 'Do you work well with intuitive or freeform readings?', short: 'Freeform readings' },

    { id: 'elements', section: 'esoteric', kind: 'multi', options: ELEMENTS, text: 'What is your elemental affinity?', short: 'Elements', hint: 'Choose any that apply, or add your own.' },
    { id: 'planets', section: 'esoteric', kind: 'multi', options: PLANETS, text: 'What is your planetary affinity?', short: 'Planets', hint: 'Choose any that apply, or add your own.' },
    { id: 'deity', section: 'esoteric', kind: 'choice', text: 'Are you suited to deity work?', short: 'Deity work' },
    { id: 'ancestral', section: 'esoteric', kind: 'choice', text: 'Are you suited to ancestral work?', short: 'Ancestral work' },
    { id: 'spirit', section: 'esoteric', kind: 'choice', text: 'Are you suited to spirit communication?', short: 'Spirit communication' },
    { id: 'ritual', section: 'esoteric', kind: 'choice', text: 'Are you suited to ritual and magical practice?', short: 'Ritual & magic' },
    { id: 'shadow', section: 'esoteric', kind: 'choice', text: 'Are you suited to shadow work?', short: 'Shadow work' },
    { id: 'care', section: 'esoteric', kind: 'text', text: 'How do you prefer to be cleansed or cared for?', short: 'Cleansing & care' }
  ];

  const TECH_REF = ['reversals', 'jumpers', 'clarifiers', 'bottom'];
  const USAGE = ['personal', 'client', 'collective'];
  const ESOTERIC_SUIT = ['deity', 'ancestral', 'spirit', 'ritual', 'shadow'];

  function newInterview() {
    return { status: 'none', answers: {}, currentQ: null, startedAt: null, completedAt: null, updatedAt: null, skipEsoteric: false };
  }

  function newDeck(fields) {
    return Object.assign(
      {
        id: C.uid('deck'),
        catalogNo: 0,
        createdAt: C.now(),
        updatedAt: C.now(),
        name: '',
        creator: '', illustrator: '', publisher: '',
        type: 'tarot', otherSystem: '',
        tarotSystem: '', tarotSystemOther: '',
        cardCount: '',
        photoId: null,
        acquired: '',
        guidebook: '',
        notes: '',
        favorite: false,
        specialties: [],
        tags: [],
        personality: '',
        strengths: '',
        limitationsNotes: '',
        guidebookNotes: '',
        spreads: [],
        pairings: [],
        recurringNotes: '',
        discoveries: [],
        interview: newInterview(),
        interviewHistory: [],
        sample: false
      },
      fields || {}
    );
  }

  function normalizeDeck(d) {
    const base = newDeck();
    const out = Object.assign(base, d);
    out.interview = Object.assign(newInterview(), d.interview || {});
    out.interview.answers = out.interview.answers || {};
    ['specialties', 'tags', 'spreads', 'pairings', 'discoveries', 'interviewHistory'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    return out;
  }

  function newEntry(fields) {
    return Object.assign(
      {
        id: C.uid('entry'),
        createdAt: C.now(),
        updatedAt: C.now(),
        date: C.today(),
        deckIds: [],
        readingType: '',
        question: '',
        spread: '',
        cards: '',
        interpretation: '',
        observations: '',
        photoIds: [],
        tags: [],
        discovery: '',
        discoveryDeckId: '',
        discoveryChangesPrefs: false,
        sample: false
      },
      fields || {}
    );
  }
  function normalizeEntry(e) {
    const out = Object.assign(newEntry(), e);
    ['deckIds', 'photoIds', 'tags'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    return out;
  }

  /* ---------------------------------------------------------- interview */

  function customQuestions() {
    return (C.store.settings.customQuestions || []).filter((q) => !q.archived).map((q) => ({
      id: q.id, section: 'custom', kind: q.kind === 'choice' ? 'choice' : 'reflect', text: q.text, short: q.text, custom: true
    }));
  }
  function allQuestions() { return BASE_QUESTIONS.concat(customQuestions()); }
  function question(id) {
    return allQuestions().find((q) => q.id === id) ||
      (C.store.settings.customQuestions || []).map((q) => ({ id: q.id, section: 'custom', kind: q.kind === 'choice' ? 'choice' : 'reflect', text: q.text, short: q.text, custom: true })).find((q) => q.id === id);
  }

  /* Ordered steps for a deck's interview. '@esoteric' is a gate screen. */
  function steps(deck) {
    const qs = allQuestions();
    const out = [];
    qs.filter((q) => q.section === 'spiritual').forEach((q) => out.push(q));
    qs.filter((q) => q.section === 'technical').forEach((q) => out.push(q));
    out.push({ id: '@esoteric', gate: true, section: 'esoteric' });
    if (!deck.interview.skipEsoteric) qs.filter((q) => q.section === 'esoteric').forEach((q) => out.push(q));
    qs.filter((q) => q.section === 'custom').forEach((q) => out.push(q));
    return out;
  }

  function hasAnswer(a) {
    if (!a) return false;
    return !!(
      (a.cards && a.cards.trim()) || (a.text && a.text.trim()) || a.choice ||
      (a.notes && a.notes.trim()) || (a.values && a.values.length) || (a.custom && a.custom.trim())
    );
  }

  function progress(deck) {
    const qs = steps(deck).filter((s) => !s.gate);
    const answered = qs.filter((q) => hasAnswer(deck.interview.answers[q.id])).length;
    const at = deck.interview.currentQ ? qs.findIndex((q) => q.id === deck.interview.currentQ) : -1;
    return { total: qs.length, answered, position: at >= 0 ? at + 1 : 0, pct: qs.length ? answered / qs.length : 0 };
  }

  function status(deck) {
    const iv = deck.interview;
    if (iv.completedAt) return 'complete';
    if (iv.startedAt || Object.keys(iv.answers || {}).some((k) => hasAnswer(iv.answers[k]))) return 'draft';
    return 'none';
  }

  function answer(deck, qid) { return (deck.interview.answers || {})[qid] || {}; }
  function choiceLabel(id) { const c = CHOICES.find((x) => x.id === id); return c ? c.label : ''; }

  function elementsOf(deck) {
    const a = answer(deck, 'elements');
    return C.uniq([...(a.values || []), ...C.splitCards(a.custom || '')]);
  }
  function planetsOf(deck) {
    const a = answer(deck, 'planets');
    return C.uniq([...(a.values || []), ...C.splitCards(a.custom || '')]);
  }
  function usageOf(deck) {
    return USAGE.filter((k) => ['yes', 'conditional'].includes(answer(deck, k).choice));
  }
  function bottomMeaning(deck) {
    const a = answer(deck, 'bottom');
    return C.uniq([...(a.meaning || []), a.meaningOther ? a.meaningOther.trim() : '']);
  }

  function typeLabel(deck) {
    if (deck.type === 'other') return deck.otherSystem || 'Other system';
    const t = DECK_TYPES.find((x) => x.id === deck.type);
    return t ? t.label : 'Deck';
  }
  function typeCode(deck) { const t = DECK_TYPES.find((x) => x.id === deck.type); return t ? t.code : 'DIV'; }
  function systemLabel(deck) {
    if (deck.type !== 'tarot' || !deck.tarotSystem) return '';
    if (deck.tarotSystem === 'Other') return deck.tarotSystemOther || 'Other system';
    return deck.tarotSystem === 'Independent' ? 'Independent system' : deck.tarotSystem + ' tradition';
  }
  function callNo(deck) { return typeCode(deck) + ' · ' + C.pad(deck.catalogNo || 0); }

  function lastReadDate(deck) {
    const e = C.store.entriesFor(deck.id)[0];
    return e ? e.date : null;
  }

  function byEntryDateDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  }

  /* Recurring cards: an honest tally of the cards you've recorded for this deck. */
  function recurringCards(deck) {
    const counts = {};
    const display = {};
    C.store.entriesFor(deck.id).forEach((e) => {
      C.uniq(C.splitCards(e.cards).map((c) => c.toLowerCase())).forEach((key) => {
        counts[key] = (counts[key] || 0) + 1;
      });
      C.splitCards(e.cards).forEach((c) => { display[c.toLowerCase()] = display[c.toLowerCase()] || c; });
    });
    return Object.keys(counts)
      .filter((k) => counts[k] > 1)
      .map((k) => ({ card: display[k], count: counts[k] }))
      .sort((a, b) => b.count - a.count || a.card.localeCompare(b.card));
  }

  /* Full-text haystack for a deck (used by search & library filtering). */
  function deckText(deck) {
    const parts = [deck.name, deck.creator, deck.illustrator, deck.publisher, typeLabel(deck), deck.tarotSystem, deck.tarotSystemOther,
      deck.notes, deck.personality, deck.strengths, deck.limitationsNotes, deck.guidebookNotes, deck.recurringNotes,
      (deck.specialties || []).join(' '), (deck.tags || []).join(' ')];
    Object.values(deck.interview.answers || {}).forEach((a) => {
      parts.push(a.cards, a.text, a.notes, a.custom, (a.values || []).join(' '), (a.meaning || []).join(' '), a.meaningOther);
    });
    (deck.spreads || []).forEach((s) => parts.push(s.name, s.positions, s.notes));
    (deck.pairings || []).forEach((p) => parts.push(p.notes));
    (deck.discoveries || []).forEach((d) => parts.push(d.text));
    return parts.filter(Boolean).join(' \n ');
  }

  C.model = {
    DECK_TYPES, TAROT_SYSTEMS, GUIDEBOOK, CATEGORIES, ELEMENTS, PLANETS, CHOICES, BOTTOM_MEANINGS, READING_TYPES,
    SECTIONS, BASE_QUESTIONS, TECH_REF, USAGE, ESOTERIC_SUIT,
    newDeck, normalizeDeck, newEntry, normalizeEntry, newInterview,
    allQuestions, question, steps, hasAnswer, progress, status, answer, choiceLabel,
    elementsOf, planetsOf, usageOf, bottomMeaning, typeLabel, typeCode, systemLabel, callNo, lastReadDate,
    byEntryDateDesc, recurringCards, deckText
  };
})();
