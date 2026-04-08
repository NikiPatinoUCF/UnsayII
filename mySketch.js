let particles = [];
let surfaceY;
let warmWhite, deepBlue;

let castState       = 'idle';
let castTimer       = 0;
let castStart, castCtrl, castEnd;
let castLastTrigger = -Infinity;

function setup() {
  createCanvas(windowWidth, windowHeight);
  surfaceY = height * 0.08;
  textFont('IM Fell English');
  textSize(15);
  textAlign(CENTER, CENTER);
  warmWhite = color(255, 248, 230, 220);
  deepBlue  = color(2, 10, 30, 0);
  castStart = createVector(width / 2, surfaceY);
  castCtrl  = createVector(width / 2, surfaceY);
  castEnd   = createVector(width / 2, surfaceY);
  triggerCast();
}

function draw() {
  background(2, 10, 30);

  drawSurface();
  drawCast();

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
    this.noticed = 0;
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
    let d = dist(mouseX, mouseY, this.x, this.y);
    if (d < 90) {
      this.noticed = min(1, this.noticed + 0.04);
    } else {
      this.noticed = max(0, this.noticed - 0.012);
    }
    this.vy *= (1 - this.noticed * 0.006);
  }

  show() {
    let t = constrain(map(this.y, surfaceY, height, 0, 1), 0, 1);
    let c = lerpColor(warmWhite, deepBlue, t);
    let brightWhite = color(255, 255, 245, 230);
    c = lerpColor(c, brightWhite, this.noticed * 0.55);
    push();
      translate(this.x, this.y);
      rotate(this.rotation);
      noStroke();
      fill(c);
      text(this.text, 0, 0);
    pop();
  }
}

function drawSurface() {
  let pulse = (sin(frameCount * 0.013) * 0.5 + 0.5) * 0.35 +
              (sin(frameCount * 0.031) * 0.5 + 0.5) * 0.20 +
              0.45;
  push();
    stroke(255, 248, 230, pulse * 210);
    strokeWeight(0.6);
    line(0, surfaceY, width, surfaceY);
  pop();
}

function triggerCast() {
  castLastTrigger = frameCount;
  castState = 'drawing';
  castTimer = 0;
  let dir    = random() < 0.5 ? -1 : 1;
  let spread = random(width * 0.25, width * 0.42);
  let rise   = random(height * 0.18, height * 0.32);
  let cx = width / 2;
  castStart = createVector(cx, surfaceY);
  castEnd   = createVector(cx + dir * spread, surfaceY);
  castCtrl  = createVector(cx + dir * spread * 0.5, surfaceY - rise);
}

function drawCast() {
  if (castState === 'idle' && frameCount - castLastTrigger >= 720) {
    triggerCast();
  }
  if (castState === 'idle') return;

  castTimer++;
  let progress, alpha;

  if (castState === 'drawing') {
    progress = castTimer / 40;
    alpha = 180;
    if (castTimer >= 40) { castState = 'holding'; castTimer = 0; }
  } else if (castState === 'holding') {
    progress = 1;
    alpha = 180;
    if (castTimer >= 30) { castState = 'fading'; castTimer = 0; }
  } else if (castState === 'fading') {
    progress = 1;
    alpha = map(castTimer, 0, 50, 180, 0);
    if (castTimer >= 50) { castState = 'idle'; castTimer = 0; return; }
  }

  // Quadratic bezier as polyline: B(t) = (1-t)^2*P0 + 2(1-t)*t*P1 + t^2*P2
  // Sampled up to `progress` fraction for progressive drawing
  let STEPS = 48;
  push();
    stroke(255, 248, 230, alpha);
    strokeWeight(0.7);
    noFill();
    beginShape();
    for (let i = 0; i <= STEPS; i++) {
      let t = (i / STEPS) * progress;
      let mt = 1 - t;
      let bx = mt*mt*castStart.x + 2*mt*t*castCtrl.x + t*t*castEnd.x;
      let by = mt*mt*castStart.y + 2*mt*t*castCtrl.y + t*t*castEnd.y;
      vertex(bx, by);
    }
    endShape();
  pop();
}
