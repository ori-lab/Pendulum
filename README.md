# Pendulum
Online pendulum for divination

## Markov Field

`poetry/` holds an audio-reactive p5.js poetry sketch: a Markov chain writes four-line stanzas whose words drift with microphone input. Serve the repo over HTTP (e.g. `python3 -m http.server`) and open `/poetry/`; click once to enable the microphone.

### Four variations

`poetry/variations.html` switches between four more sketches. Each has its own words, motion and soundscape (tap **sound** to start it), and each responds to touch or the mouse:

- **Night Garden** (`garden.js`): each line grows as a flowering plant, words as leaves and the last word as the blossom, with bell tones as they appear, crickets and fireflies. Touch brushes the plants aside.
- **Rain Ledger** (`rain.js`): words fall like rain and settle into lines, each landing with a drip. Your finger is an umbrella; thunder throws the words back up.
- **Archive** (`archive.js`): stanzas type themselves out with typewriter clicks and a bell at each line end, then roll away. Touching a word smudges it.
- **Star Chart** (`stars.js`): each line is a constellation over a slow pad. Touch gathers the stars and plays their notes; tapping empty sky sends a shooting star.

Each `.js` file is complete on its own and needs only p5.js, so it can be pasted into https://editor.p5js.org as is.
