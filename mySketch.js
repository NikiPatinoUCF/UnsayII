let particles = [];
let surfaceY;
let warmWhite, deepBlue;

function setup() {
  createCanvas(windowWidth, windowHeight);
  surfaceY = height * 0.08;
  textFont('IM Fell English');
  textSize(15);
  textAlign(CENTER, CENTER);
  warmWhite = color(255, 248, 230, 220);
  deepBlue  = color(2, 10, 30, 0);
}

function draw() {
  background(2, 10, 30);

  // Breathing spawn rhythm: two overlapping sine waves for organic swell
  let breath = ((sin(frameCount * 0.005) + 1) * 0.65 +
                (sin(frameCount * 0.017) + 1) * 0.35) / 2;
  if (random() < breath * 0.10) {
    particles.push(new Particle());
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].finished()) particles.splice(i, 1);
  }
}

class Particle {
  constructor() {
    this.x = width / 2 + random(-width * 0.35, width * 0.35);
    this.y = surfaceY;
    this.vx = random(-1.8, 1.8);
    this.vy = random(0.15, 0.55);
    this.rotation = random(-0.08, 0.08);
    this.rotationSpeed = random(-0.004, 0.004);
    this.driftPhase = random(TWO_PI);
    this.driftAmp = random(0.15, 0.45);
    let line = random(corpus);
    let words = line.split(' ');
    let maxStart = max(0, words.length - 2);
    let start = floor(random(0, maxStart + 1));
    let size = min(floor(random(2, 5)), words.length - start);
    this.text = words.slice(start, start + size).join(' ');
    console.log(this.text);
  }

  finished() {
    return this.y > height + 60;
  }

  update() {
    this.vy += 0.003;
    this.vx *= 0.97;
    this.x += this.vx;
    this.x += sin(frameCount * 0.018 + this.driftPhase) * this.driftAmp;
    this.x += sin(frameCount * 0.055 + this.driftPhase * 1.7) * 0.15;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
  }

  show() {
    let t = constrain(map(this.y, surfaceY, height, 0, 1), 0, 1);
    let c = lerpColor(warmWhite, deepBlue, t);
    push();
      translate(this.x, this.y);
      rotate(this.rotation);
      noStroke();
      fill(c);
      text(this.text, 0, 0);
    pop();
  }
}
