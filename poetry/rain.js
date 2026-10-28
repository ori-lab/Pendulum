// --- Rain Ledger: words fall like rain and settle into lines ---
// Your finger or mouse is an umbrella. Thunder throws the words back up.

let corpus = `
rain writes its ledger across the tin roofs of the city.
the gutter counts every coin of falling light.
a bus window holds the blurred names of strangers.
wet neon spills slowly down the empty avenue.
the umbrella keeps a small weather of its own.
puddles hold the sky folded at our feet.
the city rinses its windows before morning.
every streetlamp drowns a little gold in the street.
`;

const POEM_SECONDS = 35;
const DRIPS = [84, 86, 88, 91, 93, 96, 98, 100]; // high pentatonic plinks

let markov;
let words = [];
let streaks = [];
let ts = 20;
let poemStart = 0;
let draining = false;
let flash = 0;
let nextThunder = 0;
let rainGain = null;

function setup() {
  makeCanvas();
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  makeButtons("#d7e1ee", "rgba(16, 20, 26, 0.75)");
  makeStreaks();
  newPoem();
  nextThunder = millis() + random(14, 22) * 1000;
}

function makeStreaks() {
  streaks = [];
  let n = floor(width * height / 9000);
  for (let i = 0; i < n; i++) {
    streaks.push({ x: random(width), y: random(height), len: random(8, 22), speed: random(5, 10) });
  }
}

function newPoem() {
  words = [];
  ts = constrain(min(width, height) / 26, 15, 23);
  textSize(ts);
  let lineHeight = ts * 1.9;
  let maxW = width - 40;

  // Break the stanza into rows that fit the screen
  let rows = [];
  for (let line of markov.stanza(4, 4, 9)) {
    let row = [];
    for (let word of line.split(" ")) {
      let trial = row.concat(word).join(" ");
      if (row.length && textWidth(trial) > maxW) {
        rows.push(row);
        row = [];
      }
      row.push(word);
    }
    rows.push(row);
    rows.push(null); // small gap between poem lines
  }
  rows.pop();

  let total = rows.reduce((h, r) => h + (r ? lineHeight : lineHeight * 0.4), 0);
  let y = TOP_MARGIN + max(ts, (height - TOP_MARGIN - BOTTOM_MARGIN - total) / 2) + ts;
  let i = 0;
  for (let row of rows) {
    if (!row) { y += lineHeight * 0.4; continue; }
    let x = (width - textWidth(row.join(" "))) / 2;
    for (let word of row) {
      words.push(new RainWord(word, x, y, i * 7 + floor(random(12))));
      x += textWidth(word + " ");
      i++;
    }
    y += lineHeight;
  }
  poemStart = millis();
  draining = false;
}

function draw() {
  background(16, 20, 27);
  let { treble } = readAudio();
  let t = millis() / 1000;

  // Wind gusts, stronger when the rain gets loud
  let wind = (noise(t * 0.25) - 0.5) * 2.2 + treble * 2;

  // Rain gets heavier and lighter on its own
  let heaviness = noise(t * 0.05 + 50);
  if (rainGain) rainGain.setTargetAtTime(0.03 + heaviness * 0.07, audioCtx.currentTime, 0.5);

  drawStreaks(wind, heaviness);

  if (!draining && millis() - poemStart > POEM_SECONDS * 1000) {
    draining = true;
    poemStart = millis();
  }
  if (draining && millis() - poemStart > 2500) newPoem();

  if (millis() > nextThunder) {
    thunder();
    nextThunder = millis() + random(22, 38) * 1000;
  }

  for (let w of words) {
    w.update(wind);
    w.display();
  }

  drawUmbrella();

  if (flash > 0) {
    noStroke();
    fill(210, 222, 240, flash);
    rect(0, 0, width, height);
    flash *= 0.88;
    if (flash < 1) flash = 0;
  }
}

function drawStreaks(wind, heaviness) {
  stroke(150, 172, 198, 60);
  strokeWeight(1);
  let shown = floor(streaks.length * (0.45 + heaviness * 0.55));
  for (let k = 0; k < shown; k++) {
    let s = streaks[k];
    s.y += s.speed;
    s.x += wind;
    if (s.y > height) { s.y = -20; s.x = random(width); }
    if (s.x > width) s.x -= width;
    if (s.x < 0) s.x += width;
    if (underUmbrella(s.x, s.y)) continue; // dry under the umbrella
    line(s.x, s.y, s.x + wind * 2, s.y + s.len);
  }
}

const UMBRELLA_R = 64;

function underUmbrella(x, y) {
  return pointer.active && abs(x - pointer.x) < UMBRELLA_R && y > pointer.y - 40;
}

function drawUmbrella() {
  if (!pointer.active) return;
  push();
  translate(pointer.x, pointer.y - 40);
  noStroke();
  fill(120, 150, 190, 150);
  arc(0, 0, UMBRELLA_R * 2, UMBRELLA_R * 1.3, PI, TWO_PI, PIE);
  stroke(200, 215, 235, 170);
  strokeWeight(2);
  noFill();
  line(0, 0, 0, 40);
  arc(-6, 40, 12, 12, 0, PI);
  pop();
}

function thunder() {
  flash = 150;
  hiss({ filter: "lowpass", freq: 160, q: 0.8, attack: 0.05, decay: 3.5, gain: 0.7 });
  hiss({ filter: "lowpass", freq: 90, q: 0.8, attack: 0.3, decay: 4, gain: 0.5, when: 0.25 });
  for (let w of words) w.throwUp();
}

class RainWord {
  constructor(word, tx, ty, delay) {
    this.word = word;
    this.target = createVector(tx, ty);
    this.pos = createVector(tx + random(-40, 40), -random(30, 220));
    this.vel = createVector(0, 0);
    this.delay = delay;
    this.landed = false;
    this.splashed = false;
  }

  throwUp() {
    if (!this.landed) return;
    this.vel.y = -random(6, 13);
    this.vel.x = random(-3, 3);
    this.landed = false;
    this.splashed = false;
  }

  update(wind) {
    if (this.delay > 0) { this.delay--; return; }

    // When the poem ends the floor drops away and the words wash off-screen
    let floor = draining ? height + 80 : this.target.y;
    this.vel.y += 0.35; // gravity

    // Wind pushes falling words; a spring brings each back over its place
    let springK = this.landed ? 0.08 : 0.025;
    this.vel.x += (this.landed ? 0 : wind * 0.06) + (this.target.x - this.pos.x) * springK;

    // The umbrella: words above it slide off the sides
    let dx = this.pos.x - pointer.x;
    if (pointer.active && abs(dx) < UMBRELLA_R + 10 && this.pos.y < pointer.y - 20 && this.pos.y > pointer.y - 160) {
      this.vel.x += (dx >= 0 ? 1 : -1) * 1.6;
      if (this.landed) this.vel.y -= 1.2; // lift settled words out of the way
      this.landed = false;
    }

    this.vel.x *= 0.85;
    this.pos.add(this.vel);

    if (this.pos.y >= floor) {
      this.pos.y = floor;
      if (this.vel.y > 1.5) {
        if (!this.splashed) {
          this.splashed = true;
          let pan = map(this.pos.x, 0, width, -0.8, 0.8);
          tone(hz(random(DRIPS)), { decay: 0.35, gain: 0.05, pan });
          hiss({ freq: 3500, q: 2, decay: 0.04, gain: 0.04, pan });
        }
        this.vel.y *= -0.3; // small splash bounce
      } else {
        this.vel.y = 0;
        this.landed = true;
      }
    }
  }

  display() {
    if (this.delay > 0) return;
    noStroke();
    fill(222, 230, 242);
    textSize(ts);
    textAlign(LEFT, BASELINE);
    text(this.word, this.pos.x, this.pos.y);
  }
}

// --- Sound: steady rain on the roofs ---
function startSound() {
  rainGain = noiseLoop({ filter: "bandpass", freq: 2600, q: 0.5, gain: 0.06 });
  noiseLoop({ filter: "lowpass", freq: 500, gain: 0.05 });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeStreaks();
  newPoem();
}

// =============================================================
// Shared code: page margins, touch + mouse, buttons, sound.
// Everything below is the same in all four sketches.
// =============================================================
const TOP_MARGIN = 60;     // keep words clear of the tab bar
const BOTTOM_MARGIN = 84;  // keep words clear of the buttons

function makeCanvas() {
  pixelDensity(min(2, displayDensity()));
  let c = createCanvas(windowWidth, windowHeight);
  c.style("touch-action", "none"); // finger drags move words, not the page
  trackPointer();
  return c;
}

// -------------------------------------------------------------
// Pointer: the mouse while it's over the page, or a finger while
// it's touching the screen
// -------------------------------------------------------------
const pointer = { x: -9999, y: -9999, active: false, down: false };

function trackPointer() {
  const onButton = e => e.target.closest && e.target.closest("button, a");
  const place = e => { pointer.x = e.clientX; pointer.y = e.clientY; };
  window.addEventListener("pointerdown", e => {
    place(e);
    pointer.down = true;
    pointer.active = !onButton(e);
    if (!onButton(e)) ensureAudio();
  });
  window.addEventListener("pointermove", e => {
    place(e);
    pointer.active = !onButton(e) && (e.pointerType === "mouse" || pointer.down);
  });
  const lift = e => {
    pointer.down = false;
    if (e.pointerType !== "mouse") pointer.active = false;
    if (!onButton(e) && audioCtx) audioCtx.resume(); // iPhones unlock audio on finger-up
  };
  window.addEventListener("pointerup", lift);
  window.addEventListener("pointercancel", lift);
  document.addEventListener("mouseleave", () => { pointer.active = false; });
}

function pointerNear(x, y, r) {
  return pointer.active && dist(pointer.x, pointer.y, x, y) < r;
}

// -------------------------------------------------------------
// Buttons: "new poem" and the sound switch
// -------------------------------------------------------------
let soundBtn;

function makeButtons(ink, paper) {
  let bar = createDiv();
  bar.style("position", "fixed");
  bar.style("left", "0");
  bar.style("right", "0");
  bar.style("bottom", "calc(20px + env(safe-area-inset-bottom, 0px))");
  bar.style("display", "flex");
  bar.style("justify-content", "center");
  bar.style("gap", "10px");
  bar.style("z-index", "5");
  bar.style("pointer-events", "none");

  let next = createButton("new poem");
  soundBtn = createButton("");
  for (let b of [next, soundBtn]) {
    b.parent(bar);
    b.style("pointer-events", "auto");
    b.style("touch-action", "manipulation");
    b.style("font", "14px/1 Georgia, 'Times New Roman', serif");
    b.style("letter-spacing", "0.04em");
    b.style("color", ink);
    b.style("background", paper);
    b.style("border", "1px solid " + ink);
    b.style("border-radius", "999px");
    b.style("padding", "10px 16px");
    b.style("cursor", "pointer");
  }
  next.elt.addEventListener("click", () => {
    ensureAudio();
    newPoem();
  });
  soundBtn.elt.addEventListener("click", () => {
    if (!audioCtx) {
      ensureAudio();
    } else {
      soundOn = !soundOn;
      master.gain.setTargetAtTime(soundOn ? 0.9 : 0, audioCtx.currentTime, 0.05);
      audioCtx.resume();
    }
    updateSoundButton();
  });
  updateSoundButton();
}

function updateSoundButton() {
  if (!soundBtn) return;
  soundBtn.html(!audioCtx ? "♪ tap for sound" : soundOn ? "♪ sound on" : "sound off");
}

// -------------------------------------------------------------
// Sound engine (plain Web Audio, no library needed)
// -------------------------------------------------------------
let audioCtx = null;
let bus, master, analyser, freqData, timeData, noiseBuf;
let soundOn = true;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();

    master = audioCtx.createGain();
    master.gain.value = soundOn ? 0.9 : 0;
    master.connect(audioCtx.destination);

    // Every sound goes into the bus; the analyser listens there so the
    // visuals keep reacting even with the sound switched off
    bus = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    bus.connect(analyser);
    bus.connect(master);

    // A little reverb for space
    let verb = audioCtx.createConvolver();
    verb.buffer = makeImpulse(2.8);
    let wet = audioCtx.createGain();
    wet.gain.value = 0.35;
    bus.connect(verb);
    verb.connect(wet);
    wet.connect(master);

    unlockSilentSwitch();
    startSound(); // this sketch's own soundscape
  }
  audioCtx.resume();
  updateSoundButton();
}

// iPhones mute web audio when the ringer switch is on silent, unless a
// media element is playing. A looping silent clip keeps sound audible.
function unlockSilentSwitch() {
  try {
    let n = 4000, bytes = new Uint8Array(44 + n);
    let v = new DataView(bytes.buffer);
    let str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
    str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, "data"); v.setUint32(40, n, true); bytes.fill(128, 44);
    let bin = "";
    for (let b of bytes) bin += String.fromCharCode(b);
    let el = document.createElement("audio");
    el.src = "data:audio/wav;base64," + btoa(bin);
    el.loop = true;
    el.setAttribute("playsinline", "");
    let p = el.play();
    if (p) p.catch(() => {});
  } catch (e) {}
}

function makeImpulse(seconds) {
  let len = floor(audioCtx.sampleRate * seconds);
  let buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
  for (let c = 0; c < 2; c++) {
    let d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * pow(1 - i / len, 3);
  }
  return buf;
}

function noiseBuffer() {
  if (!noiseBuf) {
    let len = audioCtx.sampleRate * 2;
    noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    let d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function output(node, pan) {
  if (audioCtx.createStereoPanner) {
    let p = audioCtx.createStereoPanner();
    p.pan.value = constrain(pan, -1, 1);
    node.connect(p);
    p.connect(bus);
  } else {
    node.connect(bus);
  }
}

// A single note with a quick attack and a fading tail
function tone(freq, { type = "sine", attack = 0.005, decay = 1, gain = 0.1, when = 0, pan = 0 } = {}) {
  if (!audioCtx) return;
  let t = audioCtx.currentTime + when;
  let osc = audioCtx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  let g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(g);
  output(g, pan);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

// A short burst of filtered noise (clicks, drips, thunder, rustles)
function hiss({ filter = "bandpass", freq = 1000, q = 1, attack = 0.002, decay = 0.1,
                gain = 0.1, when = 0, pan = 0, sweepTo = 0 } = {}) {
  if (!audioCtx) return;
  let t = audioCtx.currentTime + when;
  let src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer();
  let f = audioCtx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
  f.Q.value = q;
  let g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(f);
  f.connect(g);
  output(g, pan);
  src.start(t, Math.random() * 1.5);
  src.stop(t + attack + decay + 0.05);
}

// Endless filtered noise (rain, wind, room tone); returns its volume control
function noiseLoop({ filter = "lowpass", freq = 800, q = 0.7, gain = 0.05 } = {}) {
  let src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  let f = audioCtx.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  let g = audioCtx.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(gain, audioCtx.currentTime, 1.5); // fade in
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start();
  return g.gain;
}

// Note number to frequency (69 = A above middle C)
function hz(midi) {
  return 440 * pow(2, (midi - 69) / 12);
}

// How loud the low end, the high end, and the whole mix are right now
function readAudio() {
  if (!analyser) return { bass: 0, treble: 0, level: 0 };
  analyser.getByteFrequencyData(freqData);
  analyser.getFloatTimeDomainData(timeData);
  let binHz = audioCtx.sampleRate / analyser.fftSize;
  let band = (lo, hi) => {
    let a = floor(lo / binHz), b = min(freqData.length, max(a + 1, floor(hi / binHz)));
    let s = 0;
    for (let i = a; i < b; i++) s += freqData[i];
    return s / ((b - a) * 255);
  };
  let rms = 0;
  for (let v of timeData) rms += v * v;
  rms = sqrt(rms / timeData.length);
  return { bass: band(30, 250), treble: band(3000, 9000), level: min(1, rms * 4) };
}

// -------------------------------------------------------------
// Keep words from overlapping: nudge apart any two labels whose
// boxes touch. Each item has pos, w, h and ox (label centre offset).
// -------------------------------------------------------------
function separate(items, pad = 6) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      let a = items[i], b = items[j];
      let dx = (b.pos.x + b.ox) - (a.pos.x + a.ox);
      let dy = b.pos.y - a.pos.y;
      let ox = (a.w + b.w) / 2 + pad - abs(dx);
      let oy = (a.h + b.h) / 2 + pad / 2 - abs(dy);
      if (ox > 0 && oy > 0) {
        if (ox < oy) {
          let s = (dx >= 0 ? 1 : -1) * ox * 0.45;
          a.pos.x -= s;
          b.pos.x += s;
        } else {
          let s = (dy >= 0 ? 1 : -1) * oy * 0.45;
          a.pos.y -= s;
          b.pos.y += s;
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Markov Chain Engine
// -------------------------------------------------------------
class MarkovGenerator {
  constructor(order = 1) {
    this.order = order;
    this.chain = {};
    this.starts = [];
  }

  train(text) {
    let sentences = text.trim().toLowerCase().split("\n");

    for (let s of sentences) {
      let tokens = s.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length <= this.order) continue;

      this.starts.push(tokens.slice(0, this.order).join(" "));

      for (let i = 0; i <= tokens.length - this.order; i++) {
        let gram = tokens.slice(i, i + this.order).join(" ");
        let next = tokens[i + this.order] || null;
        if (!this.chain[gram]) this.chain[gram] = [];
        if (next) this.chain[gram].push(next);
      }
    }
  }

  // n different lines for one stanza
  stanza(n, minWords, maxWords) {
    let lines = [];
    for (let tries = 0; lines.length < n && tries < 40; tries++) {
      let line = this.generateLine(minWords, maxWords);
      if (!lines.includes(line) || tries > 30) lines.push(line);
    }
    return lines;
  }

  generateLine(minWords = 4, maxWords = 8) {
    if (this.starts.length === 0) return "silence unfolds";

    let result = random(this.starts).split(" ");

    while (result.length < maxWords) {
      let gram = result.slice(result.length - this.order).join(" ");
      let nextOptions = this.chain[gram];
      if (!nextOptions || nextOptions.length === 0) break;

      let nextWord = random(nextOptions);
      result.push(nextWord);
      if (nextWord.endsWith(".") && result.length >= minWords) break;
    }

    return result.join(" ").replace(/\./g, "");
  }
}
