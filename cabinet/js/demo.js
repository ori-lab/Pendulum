/* Clearly-labelled sample records. Fictional decks with invented answers,
   used only to show the interface. Removable in one tap. */
(function () {
  'use strict';
  const C = window.C;

  C.demo = {
    async add() {
      const M = C.model;
      const a = M.newDeck({
        name: 'Specimen Tarot', sample: true, catalogNo: 901, type: 'tarot', tarotSystem: 'RWS',
        creator: 'Sample record', cardCount: '78', guidebook: 'lwb',
        specialties: ['Psychological exploration', 'Shadow work', 'Daily guidance'], tags: ['sample'],
        personality: 'Dry, exacting and kind underneath. Prefers plain questions.',
        strengths: 'Clear in personal readings; good at naming what is avoided.',
        notes: 'This is a sample deck. Its answers are invented to show the layout.',
        favorite: true
      });
      a.interview = Object.assign(M.newInterview(), {
        status: 'complete', startedAt: C.now(), completedAt: C.now(), updatedAt: C.now(),
        answers: {
          nature: { cards: 'Queen of Swords', text: 'Precise and honest; a deck that edits.' },
          teach: { cards: 'Eight of Pentacles', text: 'Patience with repetition.' },
          territory: { cards: 'The Moon', text: 'Inner life, shadow, the things under the surface.' },
          relationship: { cards: 'Page of Cups', text: 'Short daily pulls rather than long sessions.' },
          limitations: { cards: 'Five of Wands', text: 'Muddled with predictive or timing questions.' },
          reversals: { choice: 'yes' }, clarifiers: { choice: 'conditional', notes: 'One clarifier at most.' },
          jumpers: { choice: 'yes' }, bottom: { choice: 'yes', meaning: ['Underlying influences'] },
          otherDecks: { choice: 'undecided' }, personal: { choice: 'yes' }, client: { choice: 'conditional', notes: 'For returning clients only.' },
          collective: { choice: 'no' }, structured: { choice: 'yes' }, freeform: { choice: 'conditional' },
          elements: { values: ['Water', 'Air'] }, shadow: { choice: 'yes' }, care: { text: 'Rest between readings; wrapped in linen.' }
        }
      });
      const b = M.newDeck({
        name: 'The Hollow Orchard Oracle', sample: true, catalogNo: 902, type: 'oracle', cardCount: '44',
        creator: 'Sample record', specialties: ['Ancestral work', 'Creative exploration'], tags: ['sample'],
        notes: 'This is a sample deck with a half-finished interview, to show drafts.'
      });
      b.interview = Object.assign(M.newInterview(), {
        status: 'draft', startedAt: C.now(), updatedAt: C.now(), currentQ: 'relationship',
        answers: {
          nature: { cards: 'The Root Cellar', text: 'Slow, earthy, generous.' },
          teach: { cards: 'Windfall', text: 'To accept what arrives unasked.' },
          territory: { cards: 'Grafting', text: 'Family stories, ancestry, inheritance.' }
        }
      });
      const e = M.newEntry({
        sample: true, deckIds: [a.id], readingType: 'Daily pull', question: 'What needs attention today?',
        spread: 'Single card', cards: 'Two of Swords', interpretation: 'A decision I have been deferring.',
        observations: 'Direct, as usual.', tags: ['sample']
      });
      await C.store.saveDeck(a, { silent: true });
      await C.store.saveDeck(b, { silent: true });
      await C.store.saveEntry(e, { silent: true });
    },
    async remove() {
      for (const e of C.store.journal.filter((x) => x.sample)) await C.store.deleteEntry(e.id);
      for (const d of C.store.decks.filter((x) => x.sample)) await C.store.deleteDeck(d.id);
    }
  };
})();
