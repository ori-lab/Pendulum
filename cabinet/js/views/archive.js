/* Archive — storage, backups, exports, tags and housekeeping. Plus global search. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;
  const esc = C.esc;
  const ui = () => C.ui;

  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

  function row(title, sub, action) {
    return '<div class="l-row"><div class="l-text"><b>' + title + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>' + action + '</div>';
  }

  async function estimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return (e.usage / 1048576).toFixed(1) + ' MB used';
      }
    } catch (e) { /* ignore */ }
    return '';
  }

  C.views.archive = {
    title: 'Archive',
    nav: 'library',
    render() {
      const s = C.store.settings;
      const persistent = C.db.persistent;
      const last = s.lastBackupAt ? C.fmtDate(s.lastBackupAt) : 'Never';
      const tags = C.store.allTags();
      const hasSamples = C.store.decks.some((d) => d.sample) || C.store.journal.some((e) => e.sample);
      const photoCount = C.store.decks.filter((d) => d.photoId).length + C.store.journal.reduce((n, e) => n + (e.photoIds || []).length, 0);

      let out = ui().pageHead({ back: '#/library', title: 'Archive & backup' });
      out += '<h2 class="section-title mt0">The <em>back room</em></h2><p class="section-lede">Where your records are kept, and how to keep them safe.</p>';

      // Storage
      out += '<span class="plate">Storage</span>';
      if (persistent) {
        out += '<div class="notice"><div class="grow"><p>Everything is saved automatically to <b>this browser on this device</b>. Nothing is sent anywhere — there is no account and no server.</p>' +
          '<p class="small muted mt8">' + (s.persistGranted ? 'The browser has agreed to keep this data rather than clear it when space runs low.' : 'The browser may still clear this data if the device runs short of space, or if you clear website data.') +
          (isIOS() && !isStandalone() ? ' On iPhone and iPad, Safari can clear data for websites you haven’t opened in about a week — adding The Cabinet to your Home Screen avoids this.' : '') +
          ' A backup file is the only copy that survives a lost or reset device.</p>' +
          '<p class="small faint mt8" data-usage></p></div></div>';
      } else {
        out += '<div class="notice warn"><div class="grow"><p><b>Saving to this device is not available in this browser</b> (private browsing often blocks it). Your entries exist only while this tab stays open. Export a backup before closing, and restore it in a normal window.</p></div></div>';
      }

      // Backup
      out += '<h2 class="section-title">Backup</h2><div class="ledger">' +
        row('Export full backup', 'Every deck, interview, journal entry and photograph (' + photoCount + ') in one file. Last backup: ' + esc(last) + '.', '<button class="btn small primary" data-export>' + C.icon('download') + ' Export</button>') +
        (C.backup.canShareFiles() ? row('Share backup', 'Send the file to Files, iCloud Drive, email or another app.', '<button class="btn small quiet" data-share>' + C.icon('share') + ' Share</button>') : '') +
        row('Export without photographs', 'A much smaller file. Photos stay on this device only.', '<button class="btn small quiet" data-export-lite>Export</button>') +
        row('Restore from backup', 'Load a backup file — you’ll choose whether to merge or replace.', '<button class="btn small quiet" data-restore>' + C.icon('upload') + ' Restore</button>') +
        row('Deck database (CSV)', 'Deck details and interview answers as a spreadsheet.', '<button class="btn small quiet" data-csv>CSV</button>') +
        '</div>';

      // Install
      out += '<h2 class="section-title">Keep it on your Home Screen</h2>';
      if (isStandalone()) out += '<p class="muted">The Cabinet is installed. It opens like an app and works offline.</p>';
      else if (isIOS()) out += '<p class="muted">In Safari, tap <b>Share</b> then <b>Add to Home Screen</b>. It will open full-screen, work offline, and its data is protected from Safari’s automatic clean-up.</p>';
      else out += '<p class="muted">Install The Cabinet to open it like an app and use it offline.</p>' + (installPrompt ? '<button class="btn quiet" data-install>Install The Cabinet</button>' : '<p class="small faint">If your browser supports it, look for “Install app” or “Add to Home Screen” in its menu.</p>');

      // Tags
      out += '<h2 class="section-title">Tags</h2>';
      if (tags.length) {
        out += '<div class="ledger">' + tags.map((t) => {
          const n = C.store.decks.filter((d) => d.tags.includes(t)).length + C.store.journal.filter((e) => (e.tags || []).includes(t)).length;
          return row(esc(t), n + (n === 1 ? ' record' : ' records'),
            '<span class="flex"><button class="icon-btn" data-tag-rename="' + C.attr(t) + '" aria-label="Rename tag">' + C.icon('edit') + '</button>' +
            '<button class="icon-btn" data-tag-del="' + C.attr(t) + '" aria-label="Delete tag">' + C.icon('trash') + '</button></span>');
        }).join('') + '</div>';
      } else out += '<p class="muted small">No tags yet. Add them to decks or journal entries as you go.</p>';
      out += '<button class="btn quiet small mt8" data-tag-add>' + C.icon('plus') + ' Create a tag</button>';

      // Housekeeping
      out += '<h2 class="section-title">Housekeeping</h2><div class="ledger">' +
        row('Interview questions', 'Add your own questions to every interview.', '<a class="btn small quiet" href="#/interviews">Open</a>') +
        (hasSamples ? row('Sample records', 'Remove the clearly-marked sample decks and entries.', '<button class="btn small quiet" data-rm-samples>Remove</button>')
          : row('Sample records', 'Add two marked sample decks to see how things look.', '<button class="btn small quiet" data-add-samples>Add</button>')) +
        row('Erase everything', 'Permanently delete all decks, entries and photographs on this device.', '<button class="btn small danger" data-erase>Erase</button>') +
        '</div>';
      out += '<p class="footnote">The Cabinet · v1.0 · works offline · no accounts, no tracking</p>';
      return out;
    },
    async mount(el) {
      const u = el.querySelector('[data-usage]');
      if (u) u.textContent = await estimate();

      el.addEventListener('click', async (e) => {
        const t = (s) => e.target.closest(s);
        let b;
        if (t('[data-export]') || t('[data-export-lite]') || t('[data-share]')) {
          const lite = !!t('[data-export-lite]');
          C.toast('Preparing backup…', 'info');
          try {
            const r = await C.backup.exportJSON(!lite, !!t('[data-share]'));
            if (r) { C.toast('Backup exported'); C.rerender(); }
          } catch (err) { console.error(err); C.toast('Backup failed', 'warn'); }
          return;
        }
        if (t('[data-csv]')) { C.backup.exportCSV(); C.toast('CSV exported'); return; }
        if (t('[data-restore]')) {
          const [file] = await ui().pickFiles({ accept: 'application/json,.json' });
          if (!file) return;
          let data;
          try { data = await C.backup.readFile(file); } catch (err) { C.toast('Not a Cabinet backup', 'warn'); C.openSheet('<h3>That file can’t be restored</h3><p class="muted">' + esc(err.message) + '</p><button class="btn quiet block" onclick="C.closeSheet()">Close</button>'); return; }
          const c = { decks: data.decks.length, journal: (data.journal || []).length, photos: (data.photos || []).length };
          C.openSheet('<h3>Restore this backup?</h3>' +
            '<div class="catalog-card mt16"><div class="cc-head"><span class="label">Backup</span><span class="label">' + esc(C.fmtDate(data.exportedAt, 'short')) + '</span></div>' +
            '<div class="cc-typed">' + c.decks + ' decks · ' + c.journal + ' entries · ' + c.photos + ' photos</div></div>' +
            '<p class="small muted mt16"><b>Merge</b> adds anything new and keeps whichever copy of a record was edited most recently. <b>Replace</b> erases what is here first.</p>' +
            '<div class="actions-row stack"><button class="btn primary" data-mode="merge">Merge with my cabinet</button>' +
            '<button class="btn danger" data-mode="replace">Replace everything</button><button class="btn quiet" data-cancel>Cancel</button></div>', (sheet) => {
            sheet.querySelector('[data-cancel]').onclick = C.closeSheet;
            sheet.querySelectorAll('[data-mode]').forEach((btn) => {
              btn.onclick = async () => {
                const mode = btn.getAttribute('data-mode');
                if (mode === 'replace') {
                  C.closeSheet();
                  const ok = await C.confirm({ title: 'Replace everything?', body: 'All decks, entries and photos currently on this device will be erased and replaced by the backup.', ok: 'Erase & restore' });
                  if (!ok) return;
                } else C.closeSheet();
                C.toast('Restoring…', 'info');
                try { await C.backup.restore(data, mode); C.toast('Backup restored'); C.go('#/library'); }
                catch (err) { console.error(err); C.toast('Restore failed', 'warn'); }
              };
            });
          });
          return;
        }
        if (t('[data-install]') && installPrompt) { installPrompt.prompt(); installPrompt = null; return; }
        if ((b = t('[data-tag-rename]'))) {
          const old = b.getAttribute('data-tag-rename');
          const name = await C.prompt({ title: 'Rename tag', value: old });
          if (!name || name === old) return;
          await renameTag(old, name);
          C.toast('Tag renamed'); C.rerender(); return;
        }
        if ((b = t('[data-tag-del]'))) {
          const tag = b.getAttribute('data-tag-del');
          const ok = await C.confirm({ title: 'Delete the tag “' + tag + '”?', body: 'It’s removed from every deck and entry. The records themselves are untouched.', ok: 'Delete tag' });
          if (!ok) return;
          await renameTag(tag, null);
          C.toast('Tag deleted'); C.rerender(); return;
        }
        if (t('[data-tag-add]')) {
          const name = await C.prompt({ title: 'Create a tag', placeholder: 'e.g. Full moon, Travel deck' });
          if (!name) return;
          C.store.settings.tags = C.uniq([...(C.store.settings.tags || []), name]);
          await C.store.saveSettings({ toast: true }); C.rerender(); return;
        }
        if (t('[data-add-samples]')) { await C.demo.add(); C.toast('Samples added'); C.rerender(); return; }
        if (t('[data-rm-samples]')) { await C.demo.remove(); C.toast('Samples removed'); C.rerender(); return; }
        if (t('[data-erase]')) {
          const ok = await C.confirm({ title: 'Erase the whole cabinet?', body: 'Every deck, interview, journal entry and photograph on this device will be permanently deleted. Export a backup first if there is anything you want to keep.', ok: 'Continue' });
          if (!ok) return;
          const typed = await C.prompt({ title: 'Type ERASE to confirm', placeholder: 'ERASE', ok: 'Erase everything' });
          if (typed !== 'ERASE') { if (typed !== null) C.toast('Nothing was erased', 'info'); return; }
          for (const s of ['decks', 'journal', 'photos', 'meta']) await C.db.clear(s);
          await C.store.load();
          C.toast('Cabinet erased');
          C.go('#/library');
        }
      });
    }
  };

  async function renameTag(from, to) {
    const swap = (arr) => C.uniq(arr.map((x) => (x === from ? to : x)).filter(Boolean));
    for (const d of C.store.decks) if (d.tags.includes(from)) { d.tags = swap(d.tags); await C.store.saveDeck(d, { silent: true }); }
    for (const e of C.store.journal) if ((e.tags || []).includes(from)) { e.tags = swap(e.tags); await C.store.saveEntry(e, { silent: true }); }
    C.store.settings.tags = swap(C.store.settings.tags || []);
    await C.store.saveSettings();
  }

  /* ------------------------------------------------------------ search */

  C.state = C.state || {};
  C.views.search = {
    title: 'Search',
    nav: 'library',
    render(p) {
      const q = p.query.q || C.state.searchQ || '';
      return ui().pageHead({ back: '#/library', title: 'Search the cabinet' }) +
        '<div class="search-box mt0">' + C.icon('search') + '<input class="input" type="search" data-sq autofocus placeholder="Decks, cards, interview answers, notes…" value="' + C.attr(q) + '" aria-label="Search everything"></div>' +
        '<div class="search-results" data-sr></div>';
    },
    mount(el) {
      const input = el.querySelector('[data-sq]');
      const out = el.querySelector('[data-sr]');
      const run = () => {
        const q = input.value.trim();
        C.state.searchQ = q;
        if (q.length < 2) { out.innerHTML = '<p class="muted small">Searches every deck profile, interview answer, spread, discovery and journal entry.</p>'; return; }
        const lq = q.toLowerCase();
        const decks = C.store.decks.filter((d) => M().deckText(d).toLowerCase().includes(lq));
        const entries = C.store.journal.filter((e) => [e.question, e.spread, e.cards, e.interpretation, e.observations, e.discovery, (e.tags || []).join(' ')].join(' ').toLowerCase().includes(lq)).sort(M().byEntryDateDesc);
        let html = '';
        if (decks.length) {
          html += '<h3>Decks <span class="label">' + decks.length + '</span></h3>' + decks.map((d) => {
            const where = whereInDeck(d, lq);
            return '<a class="result" href="#/deck/' + d.id + '"><div class="r-where">' + esc(M().callNo(d)) + (where.label ? ' · ' + esc(where.label) : '') + '</div>' +
              '<div class="r-title">' + ui().highlight(d.name, q) + '</div>' + (where.text ? '<div class="r-snip">' + ui().highlight(ui().snippet(where.text, q), q) + '</div>' : '') + '</a>';
          }).join('');
        }
        if (entries.length) html += '<h3>Journal <span class="label">' + entries.length + '</span></h3>' + entries.map((e) => C.ui.entryRow(e, q)).join('');
        if (!decks.length && !entries.length) html = '<div class="empty"><h3>Nothing found</h3><p>No record mentions “' + esc(q) + '”.</p></div>';
        out.innerHTML = html;
        C.hydratePhotos(out);
      };
      input.addEventListener('input', C.debounce(run, 150));
      run();
    }
  };

  function whereInDeck(d, lq) {
    const checks = [['Name', d.name], ['Creator', d.creator], ['Personality', d.personality], ['Strengths', d.strengths], ['Notes', d.notes], ['Guidebook notes', d.guidebookNotes], ['Tags', d.tags.join(', ')], ['Specialties', d.specialties.join(', ')]];
    M().allQuestions().forEach((q) => {
      const a = M().answer(d, q.id);
      checks.push([q.short || q.text, [a.cards, a.text, a.notes, a.custom, (a.values || []).join(', ')].filter(Boolean).join(' — ')]);
    });
    d.spreads.forEach((s) => checks.push(['Spread', [s.name, s.positions, s.notes].join(' ')]));
    d.discoveries.forEach((x) => checks.push(['Discovery', x.text]));
    d.pairings.forEach((x) => checks.push(['Pairing', x.notes]));
    const hit = checks.find(([, v]) => v && String(v).toLowerCase().includes(lq));
    if (!hit || hit[0] === 'Name') return { label: '', text: '' };
    return { label: hit[0], text: hit[1] };
  }
})();
