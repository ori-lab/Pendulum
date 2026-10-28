// --- Star Chart: each line of the poem becomes a constellation ---

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

let markov;
let constellations = []; // arrays of StarWord, in reading order
let sky = [];
let ts = 16;
let changeTimer = 0;
const BASE_DURATION = 560;
const FADE_FRAMES = 80;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  setupAudio();
  makeSky();
  generateStanza();
}

function makeSky() {
  sky = [];
  for (let i = 0; i < 220; i++) {
    sky.push({ x: random(width), y: random(height), s: random(0.5, 2), phase: random(TWO_PI) });
  }
}

function draw() {
  background(6, 8, 18);
  let { bass, treble, level } = readAudio();

  // Background stars twinkle faster with treble
  noStroke();
  for (let st of sky) {
    let tw = 110 + 90 * sin(frameCount * 0.03 * (1 + treble * 4) + st.phase);
    fill(200, 210, 255, tw);
    circle(st.x, st.y, st.s);
  }

  let fading = changeTimer > BASE_DURATION - FADE_FRAMES;

  for (let c of constellations) {
    // Hovering any star lights up its whole constellation
    let lit = c.some(w => dist(mouseX, mouseY, w.pos.x, w.pos.y) < 90);
    for (let w of c) w.update(bass, level, fading, lit);

    stroke(150, 175, 240, (lit ? 150 : 55) * c[0].alpha / 255);
    strokeWeight(1);
    for (let i = 1; i < c.length; i++) {
      line(c[i - 1].pos.x, c[i - 1].pos.y, c[i].pos.x, c[i].pos.y);
    }
    for (let w of c) w.display(bass, lit);
  }

  changeTimer += 1 + level * 8;
  if (changeTimer > BASE_DURATION) {
    generateStanza();
    changeTimer = 0;
  }

  drawHint(170, 185, 230);
}

function generateStanza() {
  constellations = [];
  ts = constrain(min(width, height) / 45, 12, 17);
  textSize(ts);

  // Four regions of sky: a 2x2 grid when wide, a column when narrow
  let regions = [];
  if (width >= 700) {
    for (let cy of [0.3, 0.7]) for (let cx of [0.27, 0.73]) {
      regions.push({ x: width * cx, y: height * cy, rx: width * 0.18, ry: height * 0.15 });
    }
  } else {
    for (let cy of [0.18, 0.4, 0.62, 0.84]) {
      regions.push({ x: width / 2, y: height * cy, rx: width * 0.32, ry: height * 0.07 });
    }
  }
  regions = shuffle(regions);

  for (let l = 0; l < 4; l++) {
    let r = regions[l];
    let p = createVector(r.x + random(-r.rx, r.rx) * 0.5, r.y + random(-r.ry, r.ry) * 0.5);
    let c = [];
    for (let word of markov.generateLine(4, 8).split(" ")) {
      c.push(new StarWord(word, p.copy()));
      // Wander to the next star, staying inside this region
      let step = textWidth(word) * 0.6 + random(25, 55);
      p.add(p5.Vector.fromAngle(random(TWO_PI)).mult(step));
      p.x = constrain(p.x, r.x - r.rx, r.x + r.rx);
      p.y = constrain(p.y, r.y - r.ry, r.y + r.ry);
    }
    constellations.push(c);
  }
}

class StarWord {
  constructor(word, home) {
    this.word = word;
    this.home = home;
    this.pos = home.copy().add(random(-20, 20), random(-20, 20));
    this.vel = createVector(0, 0);
    this.alpha = 0;
    this.seed = random(1000);
    this.flare = 0;
  }

  update(bass, level, fading, lit) {
    // Slow celestial drift around home
    let drift = createVector(
      (noise(this.seed, frameCount * 0.003) - 0.5) * 30,
      (noise(this.seed + 50, frameCount * 0.003) - 0.5) * 30
    );
    let acc = p5.Vector.add(this.home, drift).sub(this.pos).mult(0.02);

    // Loud sounds set off a supernova: a few stars flare and fly
    if (level > 0.18 && random() < 0.03) {
      this.vel.add(p5.Vector.random2D().mult(level * 20));
      this.flare = 255;
    }

    this.vel.add(acc);
    this.vel.mult(0.9);
    this.pos.add(this.vel);
    this.flare *= 0.94;

    let target = lit ? 255 : 190;
    if (fading) this.alpha = max(0, this.alpha - 4);
    else this.alpha += (target - this.alpha) * 0.05;
  }

  display(bass, lit) {
    push();
    noStroke();
    // The star itself pulses with the bass
    fill(255, 245, 220, this.alpha);
    circle(this.pos.x, this.pos.y, 3 + bass * 6 + this.flare / 40);
    fill(lit ? 235 : 200, lit ? 225 : 210, 255, this.alpha);
    textSize(ts * (1 + bass * 0.3));
    text(this.word, this.pos.x + 7, this.pos.y + ts * 0.35);
    pop();
  }
}

function mousePressed() {
  if (!startAudio()) {
    generateStanza();
    changeTimer = 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeSky();
  generateStanza();
}

// -------------------------------------------------------------
// Audio: reacts to the mic where p5.sound is loaded (the p5 web
// editor includes it); elsewhere the sketch runs on the mouse alone
// -------------------------------------------------------------
let mic, fft;
let audioStarted = false;
const HAS_SOUND = typeof p5.AudioIn === "function";

function setupAudio() {
  if (!HAS_SOUND) return;
  mic = new p5.AudioIn();
  fft = new p5.FFT(0.8, 64);
  fft.setInput(mic);
}

function readAudio() {
  if (!audioStarted) return { bass: 0, treble: 0, level: 0 };
  fft.analyze();
  return {
    bass: fft.getEnergy("bass") / 255,      // 0.0 - 1.0
    treble: fft.getEnergy("treble") / 255,  // 0.0 - 1.0
    level: mic.getLevel()                   // Amplitude volume
  };
}

// Browsers require a click before the microphone can start.
// Returns true if this click was used to start it.
function startAudio() {
  if (!HAS_SOUND || audioStarted) return false;
  userStartAudio();
  mic.start();
  audioStarted = true;
  return true;
}

function drawHint(r, g, b) {
  let msg = HAS_SOUND && !audioStarted
    ? "[ click to let the microphone in ]"
    : "[ click for a new stanza ]";
  push();
  noStroke();
  fill(r, g, b, 130);
  textSize(12);
  textAlign(CENTER);
  text(msg, width / 2, height - 30);
  pop();
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
