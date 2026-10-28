// --- Rain Ledger: words fall like rain and settle into lines ---

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

let markov;
let words = [];
let streaks = [];
let ts = 20;
let changeTimer = 0;
const BASE_DURATION = 540;
const DRAIN_FRAMES = 90;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Georgia");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  setupAudio();
  makeStreaks();
  generateStanza();
}

function makeStreaks() {
  streaks = [];
  for (let i = 0; i < 90; i++) {
    streaks.push({ x: random(width), y: random(height), len: random(8, 22), speed: random(4, 9) });
  }
}

function draw() {
  background(16, 20, 26, 80);
  let { bass, treble, level } = readAudio();

  // Wind gusts with noise; treble blows harder
  let wind = (noise(frameCount * 0.004) - 0.5) * 2 + treble * 3;

  // Background rain
  stroke(150, 170, 195, 45);
  strokeWeight(1);
  for (let s of streaks) {
    line(s.x, s.y, s.x + wind * 2, s.y + s.len);
    s.y += s.speed * (1 + level * 3);
    s.x += wind;
    if (s.y > height) { s.y = -20; s.x = random(width); }
    if (s.x > width) s.x -= width;
    if (s.x < 0) s.x += width;
  }

  let draining = changeTimer > BASE_DURATION - DRAIN_FRAMES;
  for (let w of words) {
    w.update(bass, level, wind, draining);
    w.display();
  }

  // Thunder flash on loud sounds
  if (level > 0.2) {
    noStroke();
    fill(200, 215, 235, level * 60);
    rect(0, 0, width, height);
  }

  changeTimer += 1 + level * 8;
  if (changeTimer > BASE_DURATION) {
    generateStanza();
    changeTimer = 0;
  }

  drawHint(180, 195, 215);
}

function generateStanza() {
  words = [];
  ts = constrain(width / 40, 14, 22);
  textSize(ts);
  let lineHeight = ts * 2.2;
  let startY = height * 0.32;

  for (let l = 0; l < 4; l++) {
    let lineStr = markov.generateLine(4, 9);
    let curX = max(16, (width - textWidth(lineStr)) / 2);
    let lineWords = lineStr.split(" ");
    for (let i = 0; i < lineWords.length; i++) {
      let delay = l * 25 + i * 6 + floor(random(10)); // a staggered downpour
      words.push(new RainWord(lineWords[i], curX, startY + l * lineHeight, delay));
      curX += textWidth(lineWords[i] + " ");
    }
  }
}

class RainWord {
  constructor(word, tx, ty, delay) {
    this.word = word;
    this.target = createVector(tx, ty);
    this.pos = createVector(tx + random(-40, 40), -random(30, 200));
    this.vel = createVector(0, 0);
    this.delay = delay;
    this.landed = false;
  }

  update(bass, level, wind, draining) {
    if (this.delay > 0) { this.delay--; return; }

    // When the stanza drains, the floor drops away and words fall off-screen
    let floor = draining ? height + 80 : this.target.y;

    this.vel.y += 0.35 + bass * 0.3; // gravity, heavier with bass

    // Wind pushes sideways; a spring brings each word back over its place
    this.vel.x += wind * 0.08 + (this.target.x - this.pos.x) * 0.02;

    // The cursor is an umbrella: words falling onto it slide off the sides
    let dx = this.pos.x - mouseX;
    let dy = this.pos.y - mouseY;
    if (abs(dx) < 70 && dy < 0 && dy > -110) {
      this.vel.x += (dx >= 0 ? 1 : -1) * 1.2;
    }

    // Thunder throws settled words back into the air
    if (level > 0.2 && this.landed) {
      this.vel.y = -random(4, 10) * level * 4;
      this.landed = false;
    }

    this.vel.x *= 0.9;
    this.pos.add(this.vel);

    if (this.pos.y >= floor) {
      this.pos.y = floor;
      if (this.vel.y > 1.5) {
        this.vel.y *= -0.3; // small splash bounce
      } else {
        this.vel.y = 0;
        this.landed = true;
      }
    }
  }

  display() {
    if (this.delay > 0) return;
    push();
    noStroke();
    fill(215, 225, 238, 225);
    textSize(ts);
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
  makeStreaks();
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
