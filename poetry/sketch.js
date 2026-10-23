// --- Algorithmic Poetry Sketch: Markov Field & Audio Reactivity ---

let corpus = `
the tide fractures the quiet perimeter under dense pressure.
silence cradles every lost latitude without witness.
a pale horizon measures unwritten water before daybreak.
cold stone dissolves into the sleeping faultline like suspended dust.
an echo unfolds across hollow architecture in deliberate waves.
the spine of night remembers the edge of glass.
amber light haunts the perimeter slowly.
forgotten salt measures every lost latitude.
`;

let markov;
let mic, fft;
let audioStarted = false;

let particles = [];
let changeTimer = 0;
const BASE_DURATION = 420;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Georgia");

  // Initialize Markov Model (Order 1 for lyrical flexibility, 2 for stricter syntax)
  markov = new MarkovGenerator(1);
  markov.train(corpus);

  // Initialize Audio In & Analyzer
  mic = new p5.AudioIn();
  fft = new p5.FFT(0.8, 64);
  fft.setInput(mic); // Without this the FFT analyzes the (silent) master output

  generateStanza();
}

function draw() {
  background(14, 16, 20, 50);

  // Audio Analysis
  let bass = 0;
  let treble = 0;
  let level = 0;

  if (audioStarted) {
    fft.analyze();
    bass = fft.getEnergy("bass") / 255;      // 0.0 - 1.0
    treble = fft.getEnergy("treble") / 255;  // 0.0 - 1.0
    level = mic.getLevel();                  // Amplitude volume
  }

  // Draw & update floating word tokens
  for (let i = 0; i < particles.length; i++) {
    let p = particles[i];
    p.update(bass, treble, level);
    p.display();
  }

  // Audio-reactive timer: loud spikes accelerate the decay cycle
  changeTimer += 1 + level * 8;
  if (changeTimer > BASE_DURATION) {
    generateStanza();
    changeTimer = 0;
  }

  // Audio prompt overlay if microphone not yet activated
  if (!audioStarted) {
    push();
    fill(180, 190, 205, 120);
    textSize(12);
    textAlign(CENTER);
    text("[ click anywhere to enable audio reactivity ]", width / 2, height - 30);
    pop();
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
    // Clean and tokenize into sentences and words
    let sentences = text.trim().toLowerCase().split("\n");

    for (let s of sentences) {
      let tokens = s.trim().split(/\s+/).filter(t => t.length > 0);
      if (tokens.length <= this.order) continue;

      // Track viable sentence openings
      let startKey = tokens.slice(0, this.order).join(" ");
      this.starts.push(startKey);

      for (let i = 0; i <= tokens.length - this.order; i++) {
        let gram = tokens.slice(i, i + this.order).join(" ");
        let next = tokens[i + this.order] || null;

        if (!this.chain[gram]) {
          this.chain[gram] = [];
        }
        if (next) {
          this.chain[gram].push(next);
        }
      }
    }
  }

  generateLine(minWords = 4, maxWords = 8) {
    if (this.starts.length === 0) return "silence unfolds";

    let current = random(this.starts);
    let result = current.split(" ");

    while (result.length < maxWords) {
      let gram = result.slice(result.length - this.order).join(" ");
      let nextOptions = this.chain[gram];

      if (!nextOptions || nextOptions.length === 0) {
        break; // End of chain branch
      }

      let nextWord = random(nextOptions);
      result.push(nextWord);

      // Natural termination if period detected and minimum length met
      if (nextWord.endsWith(".") && result.length >= minWords) {
        break;
      }
    }

    let line = result.join(" ").replace(/\./g, ""); // Strip periods for clean layout
    return line;
  }
}

// -------------------------------------------------------------
// Typography & Visuals
// -------------------------------------------------------------
function generateStanza() {
  particles = [];
  let linesCount = 4;
  let lineHeight = 48;
  let startY = height * 0.35;

  textSize(22);

  for (let l = 0; l < linesCount; l++) {
    let lineStr = markov.generateLine(4, 9);
    let words = lineStr.split(" ");
    let totalWidth = textWidth(lineStr);
    let curX = (width - totalWidth) / 2;

    for (let w = 0; w < words.length; w++) {
      let word = words[w];
      let targetX = curX;
      let targetY = startY + l * lineHeight;
      particles.push(new WordParticle(word, targetX, targetY, l));
      curX += textWidth(word + " ");
    }
  }
}

class WordParticle {
  constructor(word, targetX, targetY, lineIndex) {
    this.word = word;
    this.target = createVector(targetX, targetY);
    this.pos = createVector(
      targetX + random(-30, 30),
      targetY + random(-50, 50)
    );
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.alpha = 0;
    this.baseAlpha = map(lineIndex, 0, 3, 230, 160);
    this.noiseOffset = random(2000);
  }

  update(bass, treble, level) {
    // 1. Noise-based current (speed modulated by treble frequencies)
    let speed = 0.004 + treble * 0.015;
    let nX = noise(this.noiseOffset, frameCount * speed) - 0.5;
    let nY = noise(this.noiseOffset + 100, frameCount * speed) - 0.5;
    let flow = createVector(nX, nY).mult(0.8 + level * 4.0);

    // 2. Elastic anchor pull (bass relaxes or strains tension)
    let spring = p5.Vector.sub(this.target, this.pos);
    let d = spring.mag();
    let elasticity = map(bass, 0, 1, 0.025, 0.008); // Heavy bass loosens word bonds
    spring.normalize();
    spring.mult(constrain(d * elasticity, 0, 3.5));

    // 3. Audio shockwave: Loud vocal / percussive spikes push words outward
    if (level > 0.15) {
      let center = createVector(width / 2, height / 2);
      let blast = p5.Vector.sub(this.pos, center);
      blast.normalize();
      blast.mult(level * 5.0);
      this.acc.add(blast);
    }

    // 4. Mouse interaction
    let mouse = createVector(mouseX, mouseY);
    let distMouse = p5.Vector.dist(this.pos, mouse);
    if (distMouse < 120) {
      let repulse = p5.Vector.sub(this.pos, mouse);
      repulse.normalize();
      repulse.mult(map(distMouse, 0, 120, 4, 0));
      this.acc.add(repulse);
    }

    this.acc.add(spring);
    this.acc.add(flow);
    this.vel.add(this.acc);
    this.vel.mult(0.90); // Friction damping
    this.pos.add(this.vel);
    this.acc.mult(0);

    // Fade in
    if (this.alpha < this.baseAlpha) {
      this.alpha += 4;
    }
  }

  display() {
    push();
    noStroke();
    fill(220, 225, 235, this.alpha);
    textSize(22);
    text(this.word, this.pos.x, this.pos.y);
    pop();
  }
}

// -------------------------------------------------------------
// User Interaction & Audio Unlock
// -------------------------------------------------------------
function mousePressed() {
  // Browsers require a user interaction to start the AudioContext
  if (!audioStarted) {
    userStartAudio();
    mic.start();
    audioStarted = true;
  } else {
    generateStanza();
    changeTimer = 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generateStanza();
}
