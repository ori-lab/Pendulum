# Pendulum
Online pendulum for divination

- `Index.html` — the pendulum simulation.
- `cabinet/` — **The Cabinet**, a personal tarot & oracle deck archive (see below).

## The Cabinet

A mobile-first personal divination library, guided deck interview tool and practice journal.
No build step, no accounts, no external services: open `cabinet/index.html` from any static host.

### Running it

Serve the `cabinet/` folder over HTTP, for example:

```sh
cd cabinet && python3 -m http.server 8000
# then open http://localhost:8000
```

To use it on a phone, host it on any static host (GitHub Pages works: Settings → Pages → deploy from
this branch, then visit `/cabinet/`). On iPhone, open it in Safari and use **Share → Add to Home Screen**.
It then runs full-screen and offline.

### Where your data lives

- Records are saved automatically to **IndexedDB in the browser on that device**. Nothing leaves the device.
- The app asks the browser to keep the data rather than evict it (`navigator.storage.persist`).
- Safari may clear website data for sites you haven't opened in about a week. Sites added to the Home Screen are exempt.
- If the browser refuses storage (some private-browsing modes), the app says so on screen and keeps data in memory only.
- **Archive → Export full backup** writes one JSON file that includes every photograph. **Restore** merges it
  or replaces the current data. **CSV** exports the deck database as a spreadsheet.

### Structure

```
cabinet/
  index.html            app shell
  manifest.webmanifest  PWA manifest
  sw.js                 offline cache for the app shell + fonts
  css/cabinet.css       design system (paper, charcoal, oxblood, olive, brass)
  js/core.js            utilities, IndexedDB layer, store, photos, sheets/toasts
  js/model.js           data model, vocabularies, interview questions
  js/ui.js              shared components + two-way form binding
  js/backup.js          JSON backup/restore, CSV export
  js/demo.js            clearly-labelled sample records (removable)
  js/views/*.js         library, add deck, interview, profile, journal, finder, archive/search
  js/app.js             hash router
```

### Data model (summary)

- **Deck**: identity fields, `photoId`, `favorite`, `specialties`, `tags`, `personality`, `strengths`,
  `spreads[]`, `pairings[]`, `discoveries[]`, `interview { answers, currentQ, startedAt, completedAt, skipEsoteric }`,
  `interviewHistory[]`.
- **Interview answer**: `{ cards, text }` for reflective questions, `{ choice, notes }` for Yes/No/Conditional/Undecided
  questions (bottom of deck adds `meaning[]`, `meaningOther`), `{ values[], custom, notes }` for affinities.
- **Journal entry**: `date`, `deckIds[]`, `readingType`, `question`, `spread`, `cards`, `interpretation`,
  `observations`, `photoIds[]`, `tags[]`, `discovery` (+ which deck, + "may change preferences" flag).
- **Photos**: stored once as Blobs (full-size and thumbnail), referenced by id.

The Deck Finder only recommends from recorded data: specialties, tags, interview answers, and phrases
from your own notes. Every recommendation lists its reasons, and incomplete profiles are kept separate from confirmed matches.
