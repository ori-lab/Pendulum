/* Guided deck interview — one question at a time — and the Interviews hub. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  const HINTS = {
    nature: 'Who or what is this deck, at heart?',
    teach: 'The lessons it seems to carry for you.',
    territory: 'Subjects, questions or moods where it speaks most clearly.',
    relationship: 'Practices, habits or attention it asks of you.',
    limitations: 'Where it struggles, goes quiet, or should not be asked.',
    bottom: 'If yes, you can note what the bottom card represents.',
    care: 'Cleansing, storage, offerings, rest — whatever it asks for.'
  };

  /* ------------------------------------------------------------ fields per kind */

  function fieldsFor(q, a) {
    const base = 'answers.' + q.id;
    const u = ui();
    const cardsField = (label) => u.field(label || 'Card or cards drawn', u.input(base + '.cards', { placeholder: 'e.g. The Moon, Six of Cups' }));
    if (q.kind === 'reflect') {
      return cardsField() + u.field('Interpretation', u.textarea(base + '.text', { lined: true, rows: 6, placeholder: 'What you sense, in your own words.' }));
    }
    if (q.kind === 'choice') {
      let out = u.choiceGrid(base + '.choice', a.choice);
      if (q.bottom) {
        out += '<div class="sub-q" data-bottom-extra' + (['yes', 'conditional'].includes(a.choice) ? '' : ' hidden') + '>' +
          '<span class="label">The bottom card represents</span><div class="mt8">' + u.chips(base + '.meaning', M().BOTTOM_MEANINGS, a.meaning || []) + '</div>' +
          '<div class="mt16">' + u.field('Another interpretation', u.input(base + '.meaningOther', { placeholder: 'Your own meaning' })) + '</div></div>';
      }
      out += '<div class="mt24">' + u.field('Notes', u.textarea(base + '.notes', { rows: 3, placeholder: 'Optional — conditions, nuances, cards drawn.' })) + '</div>';
      return out;
    }
    if (q.kind === 'multi') {
      return u.chips(base + '.values', q.options, a.values || []) +
        '<div class="mt24">' + u.field('Your own', u.input(base + '.custom', { placeholder: 'Anything not listed — separate with commas' })) + '</div>' +
        cardsField('Card or cards drawn (optional)') +
        u.field('Notes', u.textarea(base + '.notes', { rows: 3 }));
    }
    // free text
    return cardsField('Card or cards drawn (optional)') + u.field('Answer', u.textarea(base + '.text', { lined: true, rows: 6 }));
  }

  /* ------------------------------------------------------------ progress */

  function progressBars(deck, step) {
    const steps = M().steps(deck).filter((s) => !s.gate);
    const sections = C.uniq(steps.map((s) => s.section));
    const bars = sections.map((sec) => {
      const qs = steps.filter((s) => s.section === sec);
      const done = qs.filter((q) => M().hasAnswer(deck.interview.answers[q.id])).length;
      return '<div class="bar' + (sec === 'esoteric' ? ' opt' : '') + '" title="' + esc(M().SECTIONS[sec].short) + '"><i style="transform:scaleX(' + (qs.length ? done / qs.length : 0) + ')"></i></div>';
    }).join('');
    const idx = step && !step.gate ? steps.findIndex((s) => s.id === step.id) + 1 : null;
    return '<div class="iv-progress" aria-label="Interview progress"><div class="bars">' + bars + '</div>' +
      '<div class="meta"><span class="label">' + (idx ? 'Question ' + idx + ' of ' + steps.length : 'Interlude') + '</span>' +
      '<span class="label">' + esc(M().SECTIONS[step ? step.section : 'spiritual'].label) + '</span></div></div>';
  }

  function stepNumber(deck, step) {
    const inSection = M().steps(deck).filter((s) => !s.gate && s.section === step.section);
    const i = inSection.findIndex((s) => s.id === step.id);
    return M().SECTIONS[step.section].short + ' · ' + (ROMAN[i] || i + 1);
  }

  /* ------------------------------------------------------------ view */

  C.views.interview = {
    title: (p) => { const d = C.store.deck(p.id); return d ? 'Interview · ' + d.name : 'Interview'; },
    nav: null,
    render(p) {
      const deck = C.store.deck(p.id);
      if (!deck) { C.go('#/interviews', true); return null; }
      return '<div class="iv" data-iv></div>';
    },
    mount(el, p) {
      const deck = C.store.deck(p.id);
      const iv = deck.interview;
      const shell = el.querySelector('[data-iv]');
      const save = C.saver(() => C.store.saveDeck(deck, { silent: true }), 500);

      let steps = M().steps(deck);
      let index = 0;
      const jump = p.query.q;
      if (jump && steps.some((s) => s.id === jump)) index = steps.findIndex((s) => s.id === jump);
      else if (p.query.section) index = Math.max(0, steps.findIndex((s) => s.section === p.query.section));
      else if (iv.currentQ && steps.some((s) => s.id === iv.currentQ)) index = steps.findIndex((s) => s.id === iv.currentQ);
      else if (M().status(deck) !== 'complete') {
        const firstOpen = steps.findIndex((s) => !s.gate && !M().hasAnswer(iv.answers[s.id]));
        index = firstOpen >= 0 ? firstOpen : 0;
      }
      let finished = false;

      function top() {
        return '<div class="iv-top">' +
          '<button class="icon-btn" data-leave aria-label="Save and leave">' + C.icon('close') + '</button>' +
          '<span class="deck-name">' + esc(deck.name) + '</span>' +
          '<span class="save-state" data-save-state style="min-width:46px;justify-content:flex-end"></span></div>';
      }

      function draw() {
        steps = M().steps(deck);
        if (index >= steps.length) index = steps.length - 1;
        const step = steps[index];
        iv.currentQ = step.id;
        iv.updatedAt = C.now();
        save();
        let body;
        if (step.gate) {
          const esoCount = M().BASE_QUESTIONS.filter((q) => q.section === 'esoteric').length;
          body = '<div class="iv-body iv-gate"><span class="plate">Optional</span>' +
            '<h2>The esoteric interview</h2>' +
            '<p>' + esoCount + ' further questions on elemental and planetary affinity, and the kinds of spiritual work this deck is suited to. You can skip it and return any time.</p>' +
            '<div class="actions-row stack" style="max-width:360px;margin:0 auto">' +
            '<button class="btn primary" data-eso="go">Continue to esoteric questions</button>' +
            '<button class="btn quiet" data-eso="skip">Skip for now</button>' +
            '</div></div>';
        } else {
          const a = iv.answers[step.id] || (iv.answers[step.id] = {});
          body = '<div class="iv-body" data-step>' +
            '<span class="q-num">' + esc(stepNumber(deck, step)) + '</span>' +
            '<h2>' + esc(step.text) + '</h2>' +
            '<p class="q-hint">' + esc(step.hint || HINTS[step.id] || (index === 0 ? M().SECTIONS[step.section].intro : '')) + '</p>' +
            fieldsFor(step, a) + '</div>';
        }
        const isLast = index === steps.length - 1;
        const foot = step.gate ? '<div class="iv-foot"><button class="btn quiet" data-prev' + (index === 0 ? ' disabled' : '') + '>Back</button></div>'
          : '<div class="iv-foot">' +
            '<button class="btn quiet" data-prev' + (index === 0 ? ' disabled' : '') + ' aria-label="Previous question">' + C.icon('back') + '</button>' +
            '<button class="btn text" data-skip>Skip</button>' +
            '<button class="btn primary" data-next>' + (isLast ? 'Finish' : 'Next') + '</button></div>';
        shell.innerHTML = top() + progressBars(deck, step) + body + foot;
        const stepEl = shell.querySelector('[data-step]');
        if (stepEl) {
          C.ui.bind(stepEl, iv, (path) => {
            iv.startedAt = iv.startedAt || C.now();
            if (/\.choice$/.test(path)) {
              const extra = stepEl.querySelector('[data-bottom-extra]');
              if (extra) extra.hidden = !['yes', 'conditional'].includes(C.getPath(iv, path));
            }
            save();
            const bars = shell.querySelector('.iv-progress');
            if (bars) bars.outerHTML = progressBars(deck, step);
          });
        }
        window.scrollTo(0, 0);
        const h = shell.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      }

      function finish() {
        finished = true;
        const firstTime = !iv.completedAt;
        if (firstTime) iv.completedAt = C.now();
        iv.status = 'complete';
        iv.currentQ = null;
        iv.updatedAt = C.now();
        save.flush ? (save(), save.flush()) : save();
        const prog = M().progress(deck);
        const skipped = M().steps(deck).filter((s) => !s.gate && !M().hasAnswer(iv.answers[s.id]));
        shell.innerHTML = top() +
          '<div class="filed"><div class="catalog-card"><div class="cc-head"><span class="label">' + esc(M().callNo(deck)) + '</span><span class="label">' + esc(C.fmtDate(iv.completedAt, 'short')) + '</span></div>' +
          '<div class="cc-typed" style="font-family:var(--serif);font-size:24px;padding-top:8px">' + esc(deck.name) + '</div>' +
          '<div class="cc-typed" style="padding-bottom:0">' + prog.answered + ' of ' + prog.total + ' answered</div>' +
          '<div class="cc-typed"><span class="stamp olive tilt">Interviewed</span></div></div>' +
          '<h2>' + (firstTime ? 'Interview filed.' : 'Changes filed.') + '</h2>' +
          '<p class="muted serif" style="font-style:italic;font-size:18px">Your answers are now arranged in the deck’s profile.</p>' +
          (skipped.length ? '<p class="small faint">Left open: ' + skipped.slice(0, 6).map((s) => '<a href="#/interview/' + deck.id + '?q=' + s.id + '">' + esc(s.short || s.text) + '</a>').join(', ') + (skipped.length > 6 ? ' and ' + (skipped.length - 6) + ' more' : '') + '. Nothing is required.</p>' : '') +
          '<div class="actions-row stack" style="max-width:360px;margin:22px auto 0">' +
          '<a class="btn primary" href="#/deck/' + deck.id + '">View deck profile</a>' +
          '<a class="btn quiet" href="#/library">Return to library</a></div></div>';
        C.toast(firstTime ? 'Interview filed' : 'Saved');
      }

      shell.addEventListener('click', (e) => {
        if (e.target.closest('[data-leave]')) {
          save.flush();
          C.toast('Saved — resume any time');
          C.go('#/deck/' + deck.id);
          return;
        }
        if (e.target.closest('[data-prev]')) { if (index > 0) { index--; draw(); } return; }
        if (e.target.closest('[data-next]') || e.target.closest('[data-skip]')) {
          iv.startedAt = iv.startedAt || C.now();
          if (index >= steps.length - 1) { finish(); return; }
          index++;
          draw();
          return;
        }
        const eso = e.target.closest('[data-eso]');
        if (eso) {
          iv.skipEsoteric = eso.getAttribute('data-eso') === 'skip';
          steps = M().steps(deck);
          const gateAt = steps.findIndex((s) => s.gate);
          if (gateAt >= steps.length - 1) { finish(); return; }
          index = gateAt + 1;
          draw();
        }
      });

      draw();
      return () => { if (!finished) save.flush(); };
    }
  };

  /* ------------------------------------------------------------ hub */

  function row(deck, right, sub) {
    return '<a class="row-card" href="' + right.href + '">' + C.ui.thumb(deck) +
      '<div><h3>' + esc(deck.name) + '</h3><div class="sub">' + sub + '</div></div>' +
      '<span class="stamp ' + right.cls + '">' + esc(right.label) + '</span></a>';
  }

  C.views.interviews = {
    title: 'Interviews',
    render() {
      const decks = C.store.decks.slice();
      const drafts = decks.filter((d) => M().status(d) === 'draft').sort((a, b) => (b.interview.updatedAt || '').localeCompare(a.interview.updatedAt || ''));
      const awaiting = decks.filter((d) => M().status(d) === 'none').sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const done = decks.filter((d) => M().status(d) === 'complete').sort((a, b) => (b.interview.completedAt || '').localeCompare(a.interview.completedAt || ''));
      const custom = (C.store.settings.customQuestions || []).filter((q) => !q.archived);

      let out = C.ui.masthead({ kicker: 'Section II', title: 'Interviews', sub: 'Getting to know each deck, one question at a time' });

      if (!decks.length) {
        return out + '<div class="empty">' + C.ui.emptyDrawer + '<h3>No decks to interview yet</h3><p>Add a deck and you can begin its interview straight away.</p><a class="btn primary" href="#/add">Add a deck</a></div>';
      }

      if (drafts.length) {
        out += '<h2 class="section-title">Continue where you left off</h2>';
        out += drafts.map((d) => {
          const p = M().progress(d);
          const q = d.interview.currentQ && M().question(d.interview.currentQ);
          return '<a class="row-card" href="#/interview/' + d.id + '">' + C.ui.thumb(d) +
            '<div><h3>' + esc(d.name) + '</h3><div class="sub">' + p.answered + ' of ' + p.total + ' answered' + (q ? ' · paused at “' + esc(q.short || q.text) + '”' : '') + '</div>' +
            '<div class="mini-progress"><i style="width:' + Math.round(p.pct * 100) + '%"></i></div></div>' +
            '<span class="btn small primary">Resume</span></a>';
        }).join('');
      }

      if (awaiting.length) {
        out += '<h2 class="section-title">Awaiting interview</h2><p class="section-lede">' + awaiting.length + (awaiting.length === 1 ? ' deck hasn’t' : ' decks haven’t') + ' been asked anything yet.</p>';
        out += awaiting.map((d) => row(d, { href: '#/interview/' + d.id, cls: 'oxblood', label: 'Begin' }, esc(M().typeLabel(d)))).join('');
      }

      if (done.length) {
        out += '<h2 class="section-title">Interviewed</h2>';
        out += done.map((d) => {
          const hist = (d.interviewHistory || []).length;
          return row(d, { href: '#/deck/' + d.id, cls: 'olive', label: 'Profile' },
            'Interviewed ' + esc(C.fmtDate(d.interview.completedAt, 'short')) + (hist ? ' · ' + hist + ' earlier ' + (hist === 1 ? 'interview' : 'interviews') : ''));
        }).join('');
      }

      out += '<hr class="double-rule">';
      out += '<h2 class="section-title mt0">Your own questions</h2><p class="section-lede">Added to the end of every interview, after the built-in questions.</p>';
      out += custom.length
        ? '<div class="ledger">' + custom.map((q) => '<div class="l-row"><div class="l-text"><b>' + esc(q.text) + '</b><span>' + (q.kind === 'choice' ? 'Yes / No / Conditional / Undecided' : 'Cards drawn + interpretation') + '</span></div>' +
          '<button class="icon-btn" data-edit-q="' + q.id + '" aria-label="Edit question">' + C.icon('edit') + '</button>' +
          '<button class="icon-btn" data-del-q="' + q.id + '" aria-label="Remove question">' + C.icon('trash') + '</button></div>').join('') + '</div>'
        : '<p class="muted small">None yet.</p>';
      out += '<button class="btn quiet" data-add-q>' + C.icon('plus') + ' Add a question</button>';
      return out;
    },
    mount(el) {
      el.addEventListener('click', async (e) => {
        const s = C.store.settings;
        if (e.target.closest('[data-add-q]') || e.target.closest('[data-edit-q]')) {
          const editId = e.target.closest('[data-edit-q]') && e.target.closest('[data-edit-q]').getAttribute('data-edit-q');
          const existing = editId ? s.customQuestions.find((q) => q.id === editId) : null;
          const tmp = { text: existing ? existing.text : '', kind: existing ? existing.kind : 'reflect' };
          C.openSheet('<h3>' + (existing ? 'Edit question' : 'A question of your own') + '</h3>' +
            '<div data-qform>' + C.ui.field('Question', C.ui.input('text', { placeholder: 'e.g. What do you need from me before a reading?', autofocus: true })) +
            '<div class="field"><span class="label">Answer with</span>' + C.ui.chips('kind', [{ id: 'reflect', label: 'Cards + interpretation' }, { id: 'choice', label: 'Yes / No / Conditional' }], tmp.kind, { single: true }) + '</div></div>' +
            '<div class="actions-row stack"><button class="btn primary" data-save>Save question</button><button class="btn quiet" data-cancel>Cancel</button></div>', (sheet) => {
            C.ui.bind(sheet.querySelector('[data-qform]'), tmp, () => {});
            sheet.querySelector('[data-cancel]').onclick = C.closeSheet;
            sheet.querySelector('[data-save]').onclick = async () => {
              if (!tmp.text.trim()) return;
              if (existing) Object.assign(existing, { text: tmp.text.trim(), kind: tmp.kind || 'reflect' });
              else s.customQuestions.push({ id: C.uid('cq'), text: tmp.text.trim(), kind: tmp.kind || 'reflect' });
              await C.store.saveSettings({ toast: true });
              C.closeSheet();
              C.rerender();
            };
          });
          return;
        }
        const del = e.target.closest('[data-del-q]');
        if (del) {
          const ok = await C.confirm({ title: 'Remove this question?', body: 'It won’t be asked in future interviews. Answers already given stay in each deck’s profile.', ok: 'Remove' });
          if (!ok) return;
          const q = s.customQuestions.find((x) => x.id === del.getAttribute('data-del-q'));
          if (q) q.archived = true;
          await C.store.saveSettings({ toast: true });
          C.rerender();
        }
      });
    }
  };
})();
