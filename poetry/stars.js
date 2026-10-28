// --- Star Chart: each line of the poem becomes a constellation ---
// Touch or hover to gather the stars and hear them. Tap empty sky
// for a shooting star.

let corpus = `
the old star leans its silver weight on the dark.
a comet threads the needle of the northern sky.
every orbit returns to the quiet of its first door.
the telescope gathers light older than the sea.
cold dust drifts between the patient planets.
the dark keeps a ledger of every burning name.
a satellite hums above the sleeping fields.
the northern sky remembers a lantern made of ice.
`;

const POEM_SECONDS = 40;
const SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86]; // D minor pentatonic
const CHORDS = [[38, 50, 57, 62, 65], [41, 53, 60, 65, 69], [36, 48, 55, 60, 64], [43, 55, 62, 67, 70]];

let markov;
let constellations = []; // arrays of StarWord, in reading order
let sky = [];
let comets = [];
let ts = 16;
let poemStart = 0;
let fadeOut = 0;
let pad = null;   // the drone voices, retuned with each poem
let chordIndex = 0;

function setup() {
  makeCanvas();
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  makeButtons("#cdd6f4", "rgba(8, 10, 22, 0.75)");
  makeSky();
  newPoem();

  // A tap on empty sky sends a shooting star
  window.addEventListener("pointerdown", e => {
    if (e.target.closest && e.target.closest("button, a")) return;
    let hit = constellations.flat().some(w => dist(e.clientX, e.clientY, w.pos.x, w.pos.y) < 60);
    if (!hit) launchComet(e.clientX, e.clientY);
  });
}

function makeSky() {
  sky = [];
  let n = floor(width * height / 3500);
  for (let i = 0; i < n; i++) {
    sky.push({ x: random(width), y: random(height), s: random(0.6, 2), phase: random(TWO_PI) });
  }
}

function newPoem() {
  constellations = [];
  ts = constrain(min(width, height) / 30, 13, 18);
  textSize(ts);

  // Regions of sky for the four constellations: a 2x2 grid when the
  // screen is wide, a single column when it's tall and narrow
  let top = TOP_MARGIN + 10, bottom = height - BOTTOM_MARGIN - 10;
  let regions = [];
  if (width > height * 1.1) {
    let rowH = (bottom - top) / 2;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      regions.push({ x0: 20 + c * (width - 40) / 2, x1: 20 + (c + 1) * (width - 40) / 2 - 20,
                     y0: top + r * rowH + ts, y1: top + (r + 1) * rowH - ts });
    }
  } else {
    let rowH = (bottom - top) / 4;
    for (let r = 0; r < 4; r++) {
      regions.push({ x0: 20, x1: width - 20, y0: top + r * rowH + ts, y1: top + (r + 1) * rowH - ts });
    }
  }
  regions = shuffle(regions);

  let placed = [];
  let lines = markov.stanza(4, 3, 7);
  for (let l = 0; l < 4; l++) {
    let r = regions[l];
    let c = [];
    let p = createVector(random(r.x0, lerp(r.x0, r.x1, 0.4)), random(r.y0, r.y1));
    for (let word of lines[l].split(" ")) {
      let w = new StarWord(word, l);
      // Try spots a short hop from the last star; keep the first one
      // whose label doesn't touch any other label
      let best = null;
      for (let tries = 0; tries < 40; tries++) {
        let q = c.length === 0 ? p.copy()
          : p5.Vector.add(p, p5.Vector.fromAngle(random(-PI * 0.6, PI * 0.6)).mult(random(30, 70) + textWidth(c[c.length - 1].word) * 0.5));
        q.x = constrain(q.x, r.x0, r.x1 - w.w - 10);
        q.y = constrain(q.y, r.y0, r.y1);
        if (!placed.some(o => overlaps(q, w, o))) { best = q; break; }
        if (!best) best = q;
      }
      w.home = best.copy();
      w.pos = best.copy();
      p = best;
      c.push(w);
      placed.push(w);
    }
    constellations.push(c);
  }
  poemStart = millis();
  fadeOut = 0;
  if (pad) retunePad();
}

function overlaps(q, w, o) {
  return abs((q.x + w.ox) - (o.home.x + o.ox)) < (w.w + o.w) / 2 + 12 &&
         abs(q.y - o.home.y) < (w.h + o.h) / 2 + 6;
}

function draw() {
  background(6, 8, 20);
  let { bass, treble, level } = readAudio();
  let t = millis() / 1000;

  // Background stars twinkle with the high notes
  noStroke();
  for (let st of sky) {
    let tw = 100 + 90 * sin(t * 1.6 * (1 + treble * 3) + st.phase);
    fill(200, 210, 255, tw);
    circle(st.x, st.y, st.s);
  }

  if (fadeOut === 0 && millis() - poemStart > POEM_SECONDS * 1000) fadeOut = 120;
  if (fadeOut > 0 && --fadeOut === 0) newPoem();
  let fade = fadeOut > 0 ? fadeOut / 120 : 1;

  let all = constellations.flat();
  for (let c of constellations) {
    let lit = c.some(w => pointerNear(w.pos.x, w.pos.y, 110));
    for (let w of c) w.update(t, lit);
  }
  separate(all, 10);

  for (let c of constellations) {
    let lit = c.some(w => w.lit);
    stroke(150, 175, 240, (lit ? 170 : 60) * fade);
    strokeWeight(lit ? 1.4 : 1);
    for (let i = 1; i < c.length; i++) line(c[i - 1].pos.x, c[i - 1].pos.y, c[i].pos.x, c[i].pos.y);
    for (let w of c) w.display(fade, bass, level);
  }

  drawComets();

  // An occasional faint twinkle note
  if (audioCtx && random() < 0.006) {
    tone(hz(random(SCALE) + 12), { decay: 2.5, gain: 0.02, pan: random(-0.8, 0.8) });
  }
}

class StarWord {
  constructor(word, line) {
    textSize(ts);
    this.word = word;
    this.line = line;
    this.w = textWidth(word);
    this.h = ts * 1.2;
    this.ox = 9 + this.w / 2; // label sits to the right of the star
    this.home = createVector(0, 0);
    this.pos = createVector(0, 0);
    this.vel = createVector(0, 0);
    this.alpha = 0;
    this.seed = random(1000);
    this.flare = 0;
    this.lit = false;
    this.touched = false;
  }

  update(t, lit) {
    this.lit = lit;

    // Slow drift around home
    let drift = createVector(noise(this.seed, t * 0.08) - 0.5, noise(this.seed + 50, t * 0.08) - 0.5).mult(24);
    let goal = p5.Vector.add(this.home, drift);

    // A finger or the mouse gathers stars toward it: close ones strongly,
    // the rest of a lit constellation leans in
    let toward = createVector(pointer.x - this.home.x, pointer.y - this.home.y);
    if (lit) goal.add(toward.copy().mult(0.15));
    if (pointerNear(this.pos.x, this.pos.y, 170)) {
      goal.add(toward.mult(0.3));
      if (!this.touched) {
        this.touched = true;
        this.flare = 255;
        let note = SCALE[floor(map(this.home.y, TOP_MARGIN, height - BOTTOM_MARGIN, SCALE.length - 1, 0, true))];
        tone(hz(note), { decay: 2.4, gain: 0.06, pan: map(this.pos.x, 0, width, -0.8, 0.8) });
        tone(hz(note + 12), { type: "triangle", decay: 1.2, gain: 0.015 });
      }
    } else {
      this.touched = false;
    }

    this.vel.add(p5.Vector.sub(goal, this.pos).mult(0.03));
    this.vel.mult(0.82);
    this.pos.add(this.vel);
    this.flare *= 0.95;
    this.alpha = min(255, this.alpha + 4);
  }

  display(fade, bass, level) {
    let a = this.alpha * fade;
    noStroke();
    // Halo and star; they swell with the low drone and any chimes
    fill(255, 240, 210, a * 0.15 + this.flare * 0.25);
    circle(this.pos.x, this.pos.y, 10 + bass * 14 + this.flare / 12);
    fill(255, 246, 225, a);
    circle(this.pos.x, this.pos.y, 3.5 + level * 5 + this.flare / 60);
    fill(this.lit ? 245 : 205, this.lit ? 238 : 214, 255, a);
    textSize(ts);
    textAlign(LEFT, CENTER);
    text(this.word, this.pos.x + 9, this.pos.y);
  }
}

function launchComet(x, y) {
  let dir = random() < 0.5 ? -1 : 1;
  comets.push({ pos: createVector(x, y), vel: createVector(dir * random(7, 11), random(2, 4)), life: 1 });
  hiss({ filter: "bandpass", freq: 5000, q: 3, attack: 0.05, decay: 0.8, gain: 0.05,
         sweepTo: 1200, pan: dir * 0.6 });
  tone(hz(random(SCALE) + 12), { decay: 2, gain: 0.04, when: 0.1 });
}

function drawComets() {
  for (let c of comets) {
    c.pos.add(c.vel);
    c.life -= 0.012;
    let tail = p5.Vector.sub(c.pos, p5.Vector.mult(c.vel, 9));
    strokeWeight(2);
    stroke(230, 236, 255, 200 * c.life);
    line(tail.x, tail.y, c.pos.x, c.pos.y);
    noStroke();
    fill(255, 255, 255, 255 * c.life);
    circle(c.pos.x, c.pos.y, 4);
  }
  comets = comets.filter(c => c.life > 0);
}

// --- Sound: a slow, glowing pad that changes chord with each poem ---
function startSound() {
  let filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700;
  let lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.07;
  let depth = audioCtx.createGain();
  depth.gain.value = 300;
  lfo.connect(depth);
  depth.connect(filter.frequency);
  lfo.start();
  filter.connect(bus);

  pad = [];
  for (let i = 0; i < 5; i++) {
    let o = audioCtx.createOscillator();
    o.type = "triangle";
    o.detune.value = random(-7, 7);
    let g = audioCtx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(i === 0 ? 0.05 : 0.025, audioCtx.currentTime, 2.5);
    o.connect(g);
    g.connect(filter);
    o.start();
    pad.push(o);
  }
  retunePad();
}

function retunePad() {
  let chord = CHORDS[chordIndex++ % CHORDS.length];
  pad.forEach((o, i) => o.frequency.setTargetAtTime(hz(chord[i]), audioCtx.currentTime, 1.5));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeSky();
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
