let particles = [];
let surfaceY;
let warmWhite, deepBlue;

let castState       = 'idle';
let castTimer       = 0;
let castStart, castCtrl, castEnd;
let castLastTrigger = -Infinity;
let rodTip;

let spawnActive   = false;
let spawnFrames   = 0;
const spawnDuration = 600; // frames of active spawning after cast lands (~10s)

function setup() {
  createCanvas(windowWidth, windowHeight);
  surfaceY = height / 2;
  textFont('IM Fell English');
  textSize(15);
  textAlign(CENTER, CENTER);
  warmWhite = color(255, 248, 230, 220);
  deepBlue  = color(2, 10, 30, 0);

  // Compute rodTip from figure geometry so triggerCast() can use it
  let figX     = width * 0.12;
  let bodyH    = height * 0.12;
  let torsoTop = surfaceY - bodyH;
  let armTipX  = figX + width * 0.06;
  let armTipY  = torsoTop - height * 0.04;
  rodTip = createVector(armTipX + width * 0.05, armTipY - height * 0.07);

  castStart = createVector(rodTip.x, rodTip.y);
  castCtrl  = createVector(rodTip.x, rodTip.y);
  castEnd   = createVector(rodTip.x, rodTip.y);
  triggerCast();
}

function draw() {
  background(2, 10, 30);

  drawSpine();
  drawSurface();
  drawFigure();
  drawCast();

  // Cast-gated spawn: fragments only appear after cast lands on water
  if (spawnActive) {
    spawnFrames++;
    if (spawnFrames > spawnDuration) {
      spawnActive = false;
    } else {
      let breath = ((sin(spawnFrames * 0.008) + 1) * 0.65 +
                    (sin(spawnFrames * 0.021) + 1) * 0.35) / 2;
      if (random() < breath * 0.045) {
        particles.push(new Particle());
      }
    }
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
  }

  finished() { return this.y > height + 60; }

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

// Sunlight spine — warm gold shimmer column below surfaceY, brightest at top
function drawSpine() {
  let segCount  = 40;
  let segHeight = height * 0.02;
  let totalH    = height * 0.55;
  push();
    strokeWeight(2.5);
    noFill();
    for (let i = 0; i < segCount; i++) {
      let frac  = i / (segCount - 1);
      let alpha = map(frac, 0, 1, 28, 0);
      let sy    = surfaceY + frac * totalH;
      let sx    = width / 2 + sin(frameCount * 0.02 + i * 0.3) * 4;
      stroke(255, 240, 180, alpha);
      line(sx, sy, sx, sy + segHeight);
    }
  pop();
}

// Surface line — pulsing warm white at height/2
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

// Silhouette figure — left side, feet at surfaceY
function drawFigure() {
  let silhouette = color(40, 35, 30, 200);
  let figX       = width * 0.12;
  let bodyH      = height * 0.12;
  let bodyW      = width * 0.018;
  let torsoTop   = surfaceY - bodyH;
  let headR      = bodyW * 1.4;
  let armTipX    = figX + width * 0.06;
  let armTipY    = torsoTop - height * 0.04;
  let rodTipX    = armTipX + width * 0.05;
  let rodTipY    = armTipY - height * 0.07;

  push();
    fill(silhouette);
    noStroke();
    ellipse(figX, torsoTop - headR, headR * 2, headR * 2);
    rect(figX - bodyW * 0.5, torsoTop, bodyW, bodyH);

    stroke(silhouette);
    strokeWeight(max(1.5, bodyW * 0.6));
    noFill();
    line(figX + bodyW * 0.5, torsoTop + bodyH * 0.1, armTipX, armTipY);

    strokeWeight(max(1, bodyW * 0.3));
    line(armTipX, armTipY, rodTipX, rodTipY);
  pop();
}

// Cast — originates from rodTip, always arcs rightward over water
function triggerCast() {
  castLastTrigger = frameCount;
  castState = 'drawing';
  castTimer = 0;

  let spread = random(width * 0.25, width * 0.42);
  let rise   = random(height * 0.12, height * 0.22);

  castStart = createVector(rodTip.x, rodTip.y);
  castEnd   = createVector(rodTip.x + spread, surfaceY);
  castCtrl  = createVector(rodTip.x + spread * 0.5, rodTip.y - rise);
}

function drawCast() {
  if (castState === 'idle' && frameCount - castLastTrigger >= 900) {
    triggerCast();
  }
  if (castState === 'idle') return;

  castTimer++;
  let progress, alpha;

  if (castState === 'drawing') {
    progress = castTimer / 40;
    alpha = 180;
    if (castTimer >= 40) {
      castState = 'holding';
      castTimer = 0;
      spawnActive = true;  // cast landed — open fragment spawn window
      spawnFrames = 0;
    }
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
  let STEPS = 48;
  push();
    stroke(255, 248, 230, alpha);
    strokeWeight(0.7);
    noFill();
    beginShape();
    for (let i = 0; i <= STEPS; i++) {
      let t  = (i / STEPS) * progress;
      let mt = 1 - t;
      let bx = mt*mt*castStart.x + 2*mt*t*castCtrl.x + t*t*castEnd.x;
      let by = mt*mt*castStart.y + 2*mt*t*castCtrl.y + t*t*castEnd.y;
      vertex(bx, by);
    }
    endShape();
  pop();
}
