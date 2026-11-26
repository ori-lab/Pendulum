/* Backup, restore and CSV export. Backups are a single JSON file that
   includes photographs (as data URLs) so nothing is lost moving devices. */
(function () {
  'use strict';
  const C = window.C;
  const M = () => C.model;

  function stamp() { return C.today(); }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function buildBackup(includePhotos) {
    const ids = new Set();
    C.store.decks.forEach((d) => d.photoId && ids.add(d.photoId));
    C.store.journal.forEach((e) => (e.photoIds || []).forEach((id) => ids.add(id)));
    const photos = [];
    if (includePhotos) {
      for (const id of ids) {
        const rec = await C.db.get('photos', id);
        if (!rec) continue;
        photos.push({
          id,
          createdAt: rec.createdAt,
          full: rec.full ? await C.blobToDataURL(rec.full) : null,
          thumb: rec.thumb ? await C.blobToDataURL(rec.thumb) : null
        });
      }
    }
    const settings = C.clone(C.store.settings);
    delete settings.lastBackupAt;
    return {
      app: 'the-cabinet',
      version: 1,
      exportedAt: C.now(),
      includesPhotos: !!includePhotos,
      counts: { decks: C.store.decks.length, journal: C.store.journal.length, photos: photos.length },
      decks: C.clone(C.store.decks),
      journal: C.clone(C.store.journal),
      settings,
      photos
    };
  }

  C.backup = {
    async exportJSON(includePhotos, share) {
      const data = await buildBackup(includePhotos);
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = 'the-cabinet-backup-' + stamp() + (includePhotos ? '' : '-no-photos') + '.json';
      if (share && navigator.canShare) {
        const file = new File([blob], name, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'The Cabinet backup' });
          } catch (e) {
            if (e && e.name === 'AbortError') return false;
            download(blob, name);
          }
        } else download(blob, name);
      } else {
        download(blob, name);
      }
      C.store.settings.lastBackupAt = C.now();
      await C.store.saveSettings();
      return { size: blob.size, counts: data.counts };
    },

    canShareFiles() {
      try {
        return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
      } catch (e) { return false; }
    },

    async readFile(file) {
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('This file isn’t a readable backup.'); }
      if (!data || data.app !== 'the-cabinet' || !Array.isArray(data.decks)) throw new Error('This file isn’t a Cabinet backup.');
      return data;
    },

    /* mode: 'merge' keeps the newer of any record present in both; 'replace' erases first. */
    async restore(data, mode) {
      if (mode === 'replace') {
        for (const s of ['decks', 'journal', 'photos']) await C.db.clear(s);
      }
      for (const p of data.photos || []) {
        if (mode === 'merge' && (await C.db.get('photos', p.id))) continue;
        await C.db.put('photos', {
          id: p.id,
          createdAt: p.createdAt,
          type: 'image/jpeg',
          full: p.full ? await C.dataURLToBlob(p.full) : null,
          thumb: p.thumb ? await C.dataURLToBlob(p.thumb) : null
        });
      }
      const newer = async (store, rec) => {
        if (mode === 'merge') {
          const ex = await C.db.get(store, rec.id);
          if (ex && (ex.updatedAt || '') > (rec.updatedAt || '')) return;
        }
        await C.db.put(store, rec);
      };
      for (const d of data.decks) await newer('decks', M().normalizeDeck(d));
      for (const e of data.journal || []) await newer('journal', M().normalizeEntry(e));

      const s = C.store.settings;
      const incoming = data.settings || {};
      if (mode === 'replace') {
        Object.assign(s, incoming, { key: 'settings', lastBackupAt: s.lastBackupAt });
      } else {
        const known = new Set((s.customQuestions || []).map((q) => q.id));
        s.customQuestions = (s.customQuestions || []).concat((incoming.customQuestions || []).filter((q) => !known.has(q.id)));
        s.tags = C.uniq([...(s.tags || []), ...(incoming.tags || [])]);
        s.nextCatalogNo = Math.max(s.nextCatalogNo || 1, incoming.nextCatalogNo || 1);
      }
      await C.store.saveSettings();
      await C.store.load();
    },

    exportCSV() {
      const tech = M().BASE_QUESTIONS.filter((x) => x.kind === 'choice');
      const cols = [
        ['Catalogue no.', (d) => M().callNo(d)],
        ['Name', (d) => d.name],
        ['Type', (d) => M().typeLabel(d)],
        ['Tarot system', (d) => (d.type === 'tarot' ? (d.tarotSystem === 'Other' ? d.tarotSystemOther : d.tarotSystem) : '')],
        ['Creator', (d) => d.creator],
        ['Illustrator', (d) => d.illustrator],
        ['Publisher', (d) => d.publisher],
        ['Cards', (d) => d.cardCount],
        ['Acquired', (d) => d.acquired],
        ['Guidebook', (d) => { const g = M().GUIDEBOOK.find((x) => x.id === d.guidebook); return g ? g.label : ''; }],
        ['Favourite', (d) => (d.favorite ? 'Yes' : '')],
        ['Reading specialties', (d) => d.specialties.join('; ')],
        ['Tags', (d) => d.tags.join('; ')],
        ['Interview status', (d) => ({ complete: 'Interviewed', draft: 'In progress', none: 'Awaiting' })[M().status(d)]],
        ['Interview completed', (d) => (d.interview.completedAt || '').slice(0, 10)]
      ]
        .concat(tech.map((t) => [t.short || t.text, (d) => M().choiceLabel(M().answer(d, t.id).choice)]))
        .concat([
          ['Bottom card represents', (d) => M().bottomMeaning(d).join('; ')],
          ['Elemental affinity', (d) => M().elementsOf(d).join('; ')],
          ['Planetary affinity', (d) => M().planetsOf(d).join('; ')],
          ['Cleansing & care', (d) => M().answer(d, 'care').text || ''],
          ['Nature', (d) => M().answer(d, 'nature').text || ''],
          ['Territory', (d) => M().answer(d, 'territory').text || ''],
          ['Personality', (d) => d.personality],
          ['Strengths', (d) => d.strengths],
          ['Journal entries', (d) => C.store.entriesFor(d.id).length],
          ['Notes', (d) => d.notes]
        ]);
      const cell = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const rows = [cols.map((c) => cell(c[0])).join(',')].concat(
        C.store.decks.slice().sort((a, b) => (a.catalogNo || 0) - (b.catalogNo || 0)).map((d) => cols.map((c) => cell(c[1](d))).join(','))
      );
      download(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'the-cabinet-decks-' + stamp() + '.csv');
    }
  };
})();
