// --- Night Garden: each line of the poem grows as a flowering plant ---
// Words are leaves up the stem, the last word is the blossom.
// Touch or move through the garden to brush the plants aside.

let corpus = `
moths gather where the jasmine opens after midnight.
the dark garden breathes through every folded petal.
a lantern hums beneath the slow vine of sleep.
dew remembers the shape of every hidden root.
the moon pours milk across the quiet orchard.
night blossoms turn their pale faces toward the wall.
every seed keeps a small lantern underground.
the orchard listens to the moths in slow circles.
`;

const POEM_SECONDS = 35;
const PETALS = [[246, 205, 222], [214, 200, 245], [250, 238, 190], [240, 244, 250]];
const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic

let markov;
let plants = [];
let fireflies = [];
let grass = [];
let sky;
let ts = 16;
let groundY;
let poemStart = 0;
let fadeOut = 0; // counts down while the garden fades before a new one

function setup() {
  makeCanvas();
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  makeButtons("#e8e4d4", "rgba(14, 24, 22, 0.75)");
  layoutScene();
  newPoem();
}

function layoutScene() {
  groundY = height - 64;

  // Night sky painted once into a buffer
  sky = createGraphics(width, height);
  for (let y = 0; y < height; y++) {
    let t = y / height;
    sky.stroke(lerpColor(color(10, 18, 34), color(16, 34, 34), t));
    sky.line(0, y, width, y);
  }
  sky.noStroke();
  let mx = width * 0.82, my = TOP_MARGIN + min(width, height) * 0.1;
  for (let r = 90; r > 0; r -= 6) {
    sky.fill(235, 235, 210, 3);
    sky.circle(mx, my, r * 2);
  }
  sky.fill(238, 236, 214);
  sky.circle(mx, my, 34);
  for (let i = 0; i < 70; i++) {
    sky.fill(220, 225, 255, random(60, 160));
    sky.circle(random(width), random(TOP_MARGIN, groundY * 0.6), random(0.8, 1.8));
  }

  grass = [];
  for (let x = -10; x < width + 10; x += 7) {
    grass.push({ x: x + random(-3, 3), h: random(10, 26), seed: random(100) });
  }

  fireflies = [];
  for (let i = 0; i < 22; i++) {
    fireflies.push({ pos: createVector(random(width), random(TOP_MARGIN, groundY)),
                     seed: random(1000), phase: random(TWO_PI) });
  }
}

function newPoem() {
  plants = [];
  let n = width < 560 ? 2 : width < 900 ? 3 : 4;
  let col = width / n;

  // Text size: as large as possible while leaf words fit their column
  let lines = [];
  for (let line of markov.stanza(n, 4, n === 2 ? 9 : 7)) lines.push(line.split(" "));
  ts = constrain(min(width, height) / 30, 14, 19);
  textSize(ts);
  let widest = max(lines.flat().map(w => textWidth(w)));
  ts *= min(1, (col / 2 - 26) / widest);
  ts = max(ts, 11);

  let order = shuffle([0, 1, 2, 3]);
  let usable = groundY - TOP_MARGIN - 40;
  for (let i = 0; i < n; i++) {
    let baseX = col * (i + 0.5) + random(-0.12, 0.12) * col;
    // Tall enough to space the leaves out, but never taller than the sky
    let needed = (lines[i].length - 1) * ts * 1.55 / 0.7 + ts * 4;
    let h = min(usable, max(needed, usable * random(0.7, 0.95)));
    plants.push(new Plant(lines[i], baseX, h, PETALS[order[i]], i * 0.35));
  }
  poemStart = millis();
  fadeOut = 0;
}

function draw() {
  image(sky, 0, 0);
  let { bass, treble, level } = readAudio();
  let t = millis() / 1000;

  // Once the poem has had its time, fade the garden and grow a new one
  if (fadeOut === 0 && millis() - poemStart > POEM_SECONDS * 1000) fadeOut = 90;
  if (fadeOut > 0 && --fadeOut === 0) newPoem();
  let fade = fadeOut > 0 ? fadeOut / 90 : 1;

  // Breeze: slow gusts, stirred further by the cricket song (treble)
  let breeze = (noise(t * 0.15) - 0.5) * 2 + treble * 1.5;

  for (let p of plants) p.update(t, breeze, level);
  separate(plants.flatMap(p => p.words.filter(w => w.shown)));
  for (let p of plants) p.display(fade, level);

  drawGround(t, breeze);
  drawFireflies(t, level);

  // Night insects
  if (audioCtx && random() < 0.03) chirp();
}

function drawGround(t, breeze) {
  noStroke();
  fill(14, 22, 18);
  rect(0, groundY, width, height - groundY);
  stroke(46, 78, 58);
  strokeWeight(1.2);
  for (let g of grass) {
    let sway = (noise(g.seed, t * 0.4) - 0.5) * 8 + breeze * 4;
    let push = pointerNear(g.x, groundY, 60) ? (g.x - pointer.x) * 0.3 : 0;
    line(g.x, groundY + 2, g.x + sway + push, groundY - g.h);
  }
}

function drawFireflies(t, level) {
  noStroke();
  for (let f of fireflies) {
    let wander = createVector(noise(f.seed, t * 0.2) - 0.5, noise(f.seed + 9, t * 0.2) - 0.5).mult(2.4);
    // Fireflies are drawn toward a finger or the mouse
    if (pointer.active) {
      let toward = createVector(pointer.x - f.pos.x, pointer.y - f.pos.y);
      if (toward.mag() < 220) wander.add(toward.setMag(1.1));
    }
    f.pos.add(wander);
    f.pos.x = (f.pos.x + width) % width;
    f.pos.y = constrain(f.pos.y, TOP_MARGIN, groundY - 4);
    let glow = (sin(t * 2.2 + f.phase) * 0.5 + 0.5) * (0.6 + level * 2);
    fill(214, 240, 140, 40 * glow);
    circle(f.pos.x, f.pos.y, 14);
    fill(236, 255, 170, 200 * glow);
    circle(f.pos.x, f.pos.y, 3);
  }
}

class Plant {
  constructor(words, baseX, h, petal, delay) {
    this.baseX = baseX;
    this.h = h;
    this.petal = petal;
    this.lean = random(-0.12, 0.12);
    this.lean = constrain(this.lean, (40 - baseX) / h, (width - 40 - baseX) / h);
    this.seed = random(1000);
    this.growth = -delay; // seconds; grows from 0 to 1
    this.bend = 0;
    this.bloom = 0;
    this.words = [];

    textSize(ts);
    let side = random() < 0.5 ? -1 : 1;
    let leaves = words.length - 1;
    for (let k = 0; k < words.length; k++) {
      let isBlossom = k === words.length - 1;
      let s = isBlossom ? 1 : 0.12 + 0.68 * (leaves === 1 ? 0.5 : k / (leaves - 1));
      this.words.push({
        word: words[k], s, side: isBlossom ? 0 : side, isBlossom,
        pos: createVector(baseX, groundY), w: textWidth(words[k]), h: ts * 1.15, ox: 0,
        shown: false, alpha: 0, note: SCALE[min(SCALE.length - 1, floor(s * 9) + (isBlossom ? 3 : 0))]
      });
      if (!isBlossom) side *= -1;
    }
  }

  petalR() {
    return ts * (0.55 + 0.5 * this.bloom);
  }

  // Point on the stem, s from 0 (root) to 1 (tip)
  stem(s) {
    return createVector(
      this.baseX + (this.lean * this.h + this.bend) * s * s,
      groundY - s * this.h
    );
  }

  update(t, breeze, level) {
    this.growth = min(1, this.growth + 1 / (60 * 3));

    // Sway in the breeze; a finger or the mouse pushes the stem away
    let target = (noise(this.seed, t * 0.25) - 0.5) * this.h * 0.12 + breeze * this.h * 0.05;
    let tip = this.stem(1);
    if (pointer.active && abs(pointer.x - this.baseX) < 140 && pointer.y > tip.y - 40) {
      target += (this.baseX - pointer.x >= 0 ? 1 : -1) * (140 - abs(pointer.x - this.baseX)) * 0.9;
    }
    this.bend += (target - this.bend) * 0.06;

    for (let w of this.words) {
      if (!w.shown && this.growth >= w.s) {
        w.shown = true;
        w.pos = this.stem(w.s);
        w.pos.x += w.side * 8;
        let pan = map(this.baseX, 0, width, -0.7, 0.7);
        tone(hz(w.note), { decay: w.isBlossom ? 3.5 : 2.2, gain: w.isBlossom ? 0.07 : 0.05, pan });
        tone(hz(w.note + 12), { type: "triangle", decay: 1.2, gain: 0.015, pan });
        if (w.isBlossom) tone(hz(w.note - 5), { decay: 4, gain: 0.04, pan, when: 0.12 });
      }
      if (!w.shown) continue;

      // Each leaf word sits out to one side of its point on the stem
      let a = this.stem(w.s);
      let home = w.isBlossom
        ? createVector(a.x, a.y - this.petalR() * 1.6 - ts * 0.8)
        : createVector(a.x + w.side * (18 + w.w / 2), a.y);
      w.pos.lerp(home, 0.12);
      w.pos.x = constrain(w.pos.x, w.w / 2 + 6, width - w.w / 2 - 6); // stay on screen

      // Brushing a word moves it and sounds its note
      let near = pointerNear(w.pos.x, w.pos.y, 34);
      if (near && !w.touched) {
        tone(hz(w.note), { decay: 1.6, gain: 0.04, pan: map(w.pos.x, 0, width, -0.7, 0.7) });
        w.pos.add(createVector(w.pos.x - pointer.x, w.pos.y - pointer.y).setMag(10));
      }
      w.touched = near;
      w.alpha = min(255, w.alpha + 6);
    }

    let blossom = this.words[this.words.length - 1];
    this.bloom = blossom.shown ? min(1, this.bloom + 0.02) : 0;
  }

  display(fade, level) {
    if (this.growth <= 0) return;

    // Stem
    noFill();
    stroke(70, 120, 84, 255 * fade);
    strokeWeight(2.2);
    beginShape();
    for (let s = 0; s <= this.growth + 0.001; s += 0.04) {
      let p = this.stem(min(s, this.growth));
      vertex(p.x, p.y);
    }
    endShape();

    for (let w of this.words) {
      if (!w.shown) continue;
      let a = this.stem(w.s);
      let alpha = w.alpha * fade;

      if (!w.isBlossom) {
        // Leaf reaching from the stem toward its word
        let edge = createVector(w.pos.x - w.side * (w.w / 2 + 4), w.pos.y);
        let mid = p5.Vector.lerp(a, edge, 0.5);
        push();
        translate(mid.x, mid.y);
        rotate(atan2(edge.y - a.y, edge.x - a.x));
        noStroke();
        fill(84, 140, 96, alpha * 0.85);
        ellipse(0, 0, max(8, dist(a.x, a.y, edge.x, edge.y)), 7);
        pop();
      } else {
        // The blossom; it swells with the music
        let r = this.petalR() * (1 + level * 0.4);
        push();
        translate(a.x, a.y);
        noStroke();
        let [pr, pg, pb] = this.petal;
        fill(pr, pg, pb, alpha * 0.18);
        circle(0, 0, r * 4.2);
        fill(pr, pg, pb, alpha * 0.92);
        for (let i = 0; i < 6; i++) {
          rotate(TWO_PI / 6);
          ellipse(r * 0.75, 0, r * 1.5, r * 0.8);
        }
        fill(250, 214, 120, alpha);
        circle(0, 0, r * 0.7);
        pop();
      }

      noStroke();
      fill(w.isBlossom ? 255 : 232, w.isBlossom ? 244 : 236, w.isBlossom ? 236 : 222, alpha);
      textSize(ts);
      textAlign(CENTER, CENTER);
      drawingContext.shadowColor = "rgba(4, 10, 14, 0.95)"; // readable over the moon
      drawingContext.shadowBlur = 8;
      text(w.word, w.pos.x, w.pos.y);
      drawingContext.shadowBlur = 0;
    }
  }
}

// --- Sound: crickets, a low night drone and a soft breeze ---
function startSound() {
  noiseLoop({ filter: "lowpass", freq: 420, gain: 0.025 }); // breeze
  for (let m of [45, 52, 57]) {                             // drone
    let o = audioCtx.createOscillator();
    o.frequency.value = hz(m);
    let g = audioCtx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(0.012, audioCtx.currentTime, 2);
    o.connect(g);
    g.connect(bus);
    o.start();
  }
}

function chirp() {
  let f = random(4200, 4900), pan = random(-0.9, 0.9), n = floor(random(2, 5));
  for (let i = 0; i < n; i++) {
    tone(f, { attack: 0.003, decay: 0.03, gain: 0.018, when: i * 0.055, pan });
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutScene();
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
