// --- Night Garden: words circle a lamp like moths, in four turning rings ---

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

let markov;
let words = [];
let ringAngles = [0, 0, 0, 0];
let ts = 20;
let changeTimer = 0;
const BASE_DURATION = 480;
const FADE_FRAMES = 70;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  setupAudio();
  generateStanza();
}

function draw() {
  background(12, 14, 18, 40);
  let { bass, treble, level } = readAudio();

  // Lamp glow at the center swells with the bass
  noStroke();
  fill(255, 214, 150, 8 + bass * 40);
  circle(width / 2, height / 2, 30 + bass * 90);

  // Each ring turns at its own pace; neighbours turn opposite ways.
  // Treble spins them faster.
  for (let r = 0; r < ringAngles.length; r++) {
    let dir = r % 2 === 0 ? 1 : -1;
    ringAngles[r] += dir * (0.0015 + r * 0.0004) * (1 + treble * 6);
  }

  let fading = changeTimer > BASE_DURATION - FADE_FRAMES;
  for (let w of words) {
    w.update(bass, level, fading);
    w.display();
  }

  changeTimer += 1 + level * 8;
  if (changeTimer > BASE_DURATION) {
    generateStanza();
    changeTimer = 0;
  }

  drawHint(230, 215, 190);
}

function generateStanza() {
  words = [];
  ts = constrain(min(width, height) / 36, 13, 22);
  textSize(ts);
  let maxR = min(width, height) * 0.44;

  // One line of the poem per ring, laid end to end around it
  for (let l = 0; l < 4; l++) {
    let radius = maxR * (0.32 + l * 0.22);
    let angle = random(TWO_PI);
    for (let word of markov.generateLine(4, 9).split(" ")) {
      let span = (textWidth(word) + textWidth("  ")) / radius;
      words.push(new OrbitWord(word, l, radius, angle + span / 2));
      angle += span;
    }
  }
}

class OrbitWord {
  constructor(word, ring, radius, angle) {
    this.word = word;
    this.ring = ring;
    this.radius = radius;
    this.angle = angle;
    this.pos = createVector(width / 2, height / 2); // bloom out from the lamp
    this.vel = createVector(0, 0);
    this.alpha = 0;
    this.baseAlpha = map(ring, 0, 3, 235, 150);
  }

  update(bass, level, fading) {
    // Home position on the ring; heavy bass widens every ring
    let a = this.angle + ringAngles[this.ring];
    let r = this.radius * (1 + bass * 0.25);
    let home = createVector(width / 2 + cos(a) * r, height / 2 + sin(a) * r);
    let acc = p5.Vector.sub(home, this.pos).mult(0.04);

    // The cursor is a second lamp: nearby words drift toward it
    let mouse = createVector(mouseX, mouseY);
    let d = p5.Vector.dist(this.pos, mouse);
    if (d < 160 && d > 1) {
      acc.add(p5.Vector.sub(mouse, this.pos).setMag(map(d, 0, 160, 2.5, 0)));
    }

    // Loud sounds scatter the moths outward
    if (level > 0.15) {
      let center = createVector(width / 2, height / 2);
      acc.add(p5.Vector.sub(this.pos, center).setMag(level * 6));
    }

    this.vel.add(acc);
    this.vel.mult(0.86);
    this.pos.add(this.vel);

    if (fading) this.alpha = max(0, this.alpha - 4);
    else if (this.alpha < this.baseAlpha) this.alpha += 4;
  }

  display() {
    push();
    noStroke();
    fill(240, 228, 205, this.alpha);
    textSize(ts);
    textAlign(CENTER, CENTER);
    text(this.word, this.pos.x, this.pos.y);
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
