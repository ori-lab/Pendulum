// --- Archive: each stanza types itself out, then scrolls up and fades ---

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

let markov;
let stanzas = [];   // the current stanza is last; older ones are scrolling away
let ts = 18;
let charBudget = 0;
let holdTimer = 0;
const HOLD_FRAMES = 260;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("Courier New");
  markov = new MarkovGenerator(1);
  markov.train(corpus);
  setupAudio();
  newStanza();
}

function draw() {
  background(236, 228, 212); // paper
  let { bass, treble, level } = readAudio();

  // Type a few characters per frame; loud sounds make the typist hurry
  let current = stanzas[stanzas.length - 1];
  charBudget += 0.4 + level * 3;
  while (charBudget >= 1 && !current.done()) {
    current.typeChar();
    charBudget -= 1;
  }
  if (current.done()) {
    holdTimer++;
    if (holdTimer > HOLD_FRAMES) newStanza();
  }

  for (let s of stanzas) {
    s.update();
    s.display(bass, treble);
  }
  stanzas = stanzas.filter(s => s.alpha > 0);

  drawHint(60, 50, 40);
}

function newStanza() {
  // The previous stanza rolls up out of the way like paper through a platen
  for (let s of stanzas) s.leave();
  stanzas.push(new Stanza());
  holdTimer = 0;
  charBudget = 0;
}

class Stanza {
  constructor() {
    ts = constrain(width / 42, 13, 19);
    textSize(ts);
    this.lineHeight = ts * 1.9;
    this.left = max(20, (width - 640) / 2);
    this.top = height * 0.3;
    this.scroll = 0;
    this.scrollTarget = 0;
    this.alpha = 255;
    this.leaving = false;
    this.tokens = [];
    this.typed = 0; // index of the token being typed

    // Lay words out left-aligned, wrapping at the right margin
    let y = 0;
    for (let l = 0; l < 4; l++) {
      let x = 0;
      for (let word of markov.generateLine(4, 9).split(" ")) {
        let w = textWidth(word);
        if (x > 0 && this.left + x + w > width - 20) {
          x = textWidth("  "); // wrapped lines are indented
          y += this.lineHeight;
        }
        this.tokens.push({ word, x, y, shown: 0, scramble: word });
        x += w + textWidth(" ");
      }
      y += this.lineHeight;
    }
    this.height = y;
  }

  done() {
    return this.typed >= this.tokens.length;
  }

  typeChar() {
    let t = this.tokens[this.typed];
    t.shown++;
    if (t.shown > t.word.length) this.typed++; // the extra step is the space bar
  }

  leave() {
    this.leaving = true;
    this.scrollTarget = -(this.height + this.lineHeight * 2);
  }

  update() {
    this.scroll += (this.scrollTarget - this.scroll) * 0.06;
    if (this.leaving) this.alpha -= 2.5;
  }

  display(bass, treble) {
    push();
    noStroke();
    textSize(ts);
    for (let t of this.tokens) {
      if (t.shown === 0) continue;
      let x = this.left + t.x + random(-1, 1) * treble * 2; // key-strike shimmy
      let y = this.top + t.y + this.scroll + random(-1, 1) * bass * 3;
      let str = t.word.slice(0, t.shown);

      // Words near the cursor smudge: letters jumble in ribbon red
      let near = !this.leaving && t.shown >= t.word.length &&
        dist(mouseX, mouseY, x + textWidth(t.word) / 2, y - ts / 3) < 60;
      if (near) {
        if (frameCount % 8 === 0) t.scramble = shuffle(t.word.split("")).join("");
        fill(168, 50, 43, this.alpha);
        str = t.scramble;
      } else {
        fill(42, 38, 34, this.alpha);
      }
      text(str, x, y);
    }

    // Blinking carriage cursor after the last typed letter
    if (!this.leaving && !this.done() && frameCount % 40 < 22) {
      let t = this.tokens[this.typed];
      let cx = this.left + t.x + textWidth(t.word.slice(0, t.shown));
      fill(42, 38, 34, 200);
      rect(cx + 1, this.top + t.y + this.scroll + 3, ts * 0.55, 2);
    }
    pop();
  }
}

function mousePressed() {
  if (!startAudio()) newStanza();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  stanzas = [];
  newStanza();
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
