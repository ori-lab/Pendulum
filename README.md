# Pendulum
Online pendulum for divination

## Markov Field

`poetry/` holds an audio-reactive p5.js poetry sketch: a Markov chain writes four-line stanzas whose words drift with microphone input. Serve the repo over HTTP (e.g. `python3 -m http.server`) and open `/poetry/`; click once to enable the microphone.

### Four variations

`poetry/variations.html` switches between four more sketches, each with its own vocabulary and motion:

- **Night Garden** (`garden.js`): words circle a lamp in four counter-rotating rings and drift toward the cursor.
- **Rain Ledger** (`rain.js`): words fall like rain, bounce into lines, blow in the wind and get thrown up by loud sounds.
- **Archive** (`archive.js`): stanzas type themselves out on paper, then scroll away; words near the cursor scramble in red ink.
- **Star Chart** (`stars.js`): each line becomes a constellation; hovering lights it up and the bass makes the stars pulse.

Each `.js` file is complete on its own, so it can be pasted into https://editor.p5js.org as is.
