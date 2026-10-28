// --- Archive: each stanza types itself out, then rolls up and away ---
// Touch or hover a word to smudge it.

let corpus = `
the archive keeps a drawer for every unsent letter.
ink fades slowly on the backs of old receipts.
a typewriter remembers the weight of each confession.
the clerk files the rain under forgotten names.
paper yellows in the long silence of the basement.
every envelope holds the dust of another city.
the ribbon ran out halfway through the apology.
old stamps carry small kings across the sea.
`;

const HOLD_SECONDS = 16; // how long a finished stanza stays before rolling away

let markov;
let stanzas = [];   // the current stanza is last; older ones are rolling away
let ts = 18;
let charBudget = 0;
let doneAt = 0;

function setup() {
  makeCanvas();
  textFont("Courier New");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  makeButtons("#2a2622", "rgba(236, 228, 212, 0.9)");
  newPoem();
}

function draw() {
  background(236, 228, 212); // paper
  if (stanzas.length) drawRules();

  // Type at a human, uneven pace
  let current = stanzas[stanzas.length - 1];
  charBudget += random(0.12, 0.5);
  while (charBudget >= 1 && !current.done()) {
    charBudget -= 1;
    current.typeChar();
  }
  if (current.done()) {
    if (!doneAt) doneAt = millis();
    if (millis() - doneAt > HOLD_SECONDS * 1000) newPoem();
  }

  for (let s of stanzas) {
    s.update();
    s.display();
  }
  stanzas = stanzas.filter(s => s.alpha > 0);
}

function drawRules() {
  stroke(190, 200, 214, 110);
  strokeWeight(1);
  let gap = ts * 1.9;
  let first = stanzas[stanzas.length - 1].top + 6;
  first -= ceil((first - TOP_MARGIN) / gap) * gap;
  for (let y = first; y < height - BOTTOM_MARGIN; y += gap) {
    if (y > TOP_MARGIN) line(0, y, width, y);
  }
}

function newPoem() {
  // The previous stanza rolls up out of the way like paper through a platen
  for (let s of stanzas) s.leave();
  stanzas.push(new Stanza());
  doneAt = 0;
  charBudget = -20;
  if (stanzas.length > 1) carriageReturn();
}

class Stanza {
  constructor() {
    ts = constrain(width / 34, 14, 19);
    textSize(ts);
    this.lineHeight = ts * 1.9;
    this.left = max(22, (width - 640) / 2);
    this.scroll = 0;
    this.scrollTarget = 0;
    this.alpha = 255;
    this.leaving = false;
    this.tokens = [];
    this.typed = 0;

    // Lay words out left-aligned, wrapping at the right margin
    let y = 0;
    for (let lineStr of markov.stanza(4, 4, 9)) {
      let x = 0;
      let line = lineStr.split(" ");
      for (let k = 0; k < line.length; k++) {
        let w = textWidth(line[k]);
        if (x > 0 && this.left + x + w > width - 22) {
          x = textWidth("  "); // wrapped lines are indented
          y += this.lineHeight;
        }
        this.tokens.push({ word: line[k], x, y, shown: 0, strike: 0, scramble: line[k],
                           lineEnd: k === line.length - 1, smudged: false });
        x += w + textWidth(" ");
      }
      y += this.lineHeight;
    }
    this.height = y;
    let usable = height - TOP_MARGIN - BOTTOM_MARGIN;
    this.top = TOP_MARGIN + max(this.lineHeight, (usable - y) / 2) + ts;
  }

  done() {
    return this.typed >= this.tokens.length;
  }

  typeChar() {
    let t = this.tokens[this.typed];
    t.shown++;
    if (t.shown <= t.word.length) {
      keyClick(t);
      t.strike = 1;
    } else {
      // The extra step after a word is the space bar, or a new line
      this.typed++;
      if (t.lineEnd) {
        bell();
        charBudget = -28; // pause while the carriage returns
      } else {
        spaceBar();
      }
    }
  }

  leave() {
    this.leaving = true;
    this.scrollTarget = -(this.top + this.height);
  }

  update() {
    this.scroll += (this.scrollTarget - this.scroll) * 0.05;
    if (this.leaving) this.alpha -= 3;
  }

  display() {
    push();
    noStroke();
    textSize(ts);
    textAlign(LEFT, BASELINE);
    for (let t of this.tokens) {
      if (t.shown === 0) continue;
      t.strike *= 0.8;
      let x = this.left + t.x;
      let y = this.top + t.y + this.scroll - t.strike * 2; // key strike jolt
      let str = t.word.slice(0, t.shown);

      // Words under a finger or the mouse smudge: letters jumble in red ink
      let near = !this.leaving && t.shown >= t.word.length &&
        pointerNear(x + textWidth(t.word) / 2, y - ts / 3, 44);
      if (near) {
        if (!t.smudged) rustle();
        if (frameCount % 8 === 0 || !t.smudged) t.scramble = shuffle(t.word.split("")).join("");
        fill(168, 50, 43, this.alpha);
        str = t.scramble;
        y -= 4;
      } else {
        fill(42, 38, 34, this.alpha);
      }
      t.smudged = near;
      text(str, x, y);
    }

    // Blinking cursor after the last typed letter
    if (!this.leaving && !this.done() && frameCount % 40 < 22) {
      let t = this.tokens[this.typed];
      let cx = this.left + t.x + textWidth(t.word.slice(0, t.shown));
      fill(42, 38, 34, 200);
      rect(cx + 1, this.top + t.y + this.scroll + 3, ts * 0.55, 2);
    }
    pop();
  }
}

// --- Sound: typewriter keys, space bar, bell and carriage return ---
function startSound() {
  noiseLoop({ filter: "lowpass", freq: 260, gain: 0.012 }); // quiet room
}

function keyClick(t) {
  let pan = map(t.x, 0, width, -0.5, 0.5);
  hiss({ freq: random(2200, 3200), q: 1.4, decay: 0.035, gain: 0.32, pan });
  tone(random(110, 140), { decay: 0.05, gain: 0.12, pan });
}

function spaceBar() {
  hiss({ freq: 900, q: 1, decay: 0.05, gain: 0.18 });
}

function bell() {
  tone(2093, { decay: 1.1, gain: 0.08, pan: 0.5 });
  tone(2093 * 2.76, { decay: 0.4, gain: 0.02, pan: 0.5 });
  carriageReturn(0.25);
}

function carriageReturn(when = 0) {
  hiss({ freq: 700, q: 2, attack: 0.02, decay: 0.35, gain: 0.08, sweepTo: 1800, when, pan: 0.3 });
  hiss({ freq: 600, q: 1, decay: 0.06, gain: 0.2, when: when + 0.38, pan: -0.3 });
}

function rustle() {
  hiss({ filter: "highpass", freq: 3500, q: 0.5, attack: 0.01, decay: 0.12, gain: 0.05 });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  stanzas = [];
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
