// UNSAY — interactive game
// corpus.js loaded first, provides: const corpus (array of memoir lines)

// ── Globals ────────────────────────────────────────────────────────────────
let fragments     = [];
let fragmentQueue = [];
let bucket        = [];

let surfaceY;
let warmWhite, deepBlue;

// Figure geometry — set in setup(), shared across draw functions
let figX, figBodyH, figBodyW, torsoTop, headR, armTipX, armTipY;
let rodTip;
let bucketX, bucketY;

// Cast state machine
let castState       = 'idle';
let castTimer       = 0;
let castStart, castCtrl, castEnd;
let castLastTrigger = 0;
let nextCastIn      = 0;  // first cast fires on frame 0

// ── Setup ──────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  surfaceY = height / 2;

  textFont('IM Fell English');
  textSize(15);
  textAlign(CENTER, CENTER);

  warmWhite = color(255, 248, 230, 220);
  deepBlue  = color(2, 10, 30, 0);

  // Figure geometry (also used by cast and bucket)
  figX      = width  * 0.12;
  figBodyH  = height * 0.13;
  figBodyW  = width  * 0.018;
  torsoTop  = surfaceY - figBodyH;
  headR     = figBodyW * 1.4;
  armTipX   = figX + width  * 0.06;
  armTipY   = torsoTop - height * 0.04;
  rodTip    = createVector(armTipX + width * 0.05, armTipY - height * 0.07);

  bucketX = figX - width * 0.045;
  bucketY = surfaceY;

  // Safe cast vector defaults (overwritten by triggerCast before drawing)
  castStart = createVector(rodTip.x, rodTip.y);
  castCtrl  = createVector(rodTip.x, rodTip.y);
  castEnd   = createVector(rodTip.x, rodTip.y);
}

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  // Sky
  background(18, 12, 8);
  // Water
  noStroke();
  fill(2, 8, 22);
  rect(0, surfaceY, width, height - surfaceY);

  drawSpine();
  drawSurface();
  drawBucket();
  drawFigure();
  drawCast();

  // Spawn queued fragments when their delay elapses
  for (let i = fragmentQueue.length - 1; i >= 0; i--) {
    if (frameCount >= fragmentQueue[i].delay) {
      fragments.push(new Fragment(fragmentQueue[i].text, fragmentQueue[i].spawnX));
      fragmentQueue.splice(i, 1);
    }
  }

  // Update + draw fragments; remove recovered ones
  for (let i = fragments.length - 1; i >= 0; i--) {
    fragments[i].update();
    fragments[i].show();
    if (fragments[i].state === 'recovered') {
      bucket.push(fragments[i].text);
      fragments.splice(i, 1);
    }
  }

  // Cursor: hand when hovering a clickable fragment
  let hovering = false;
  for (let f of fragments) {
    if (f.isClickable() && dist(mouseX, mouseY, f.x, f.y) < 55) {
      hovering = true;
      break;
    }
  }
  cursor(hovering ? HAND : ARROW);
}

// ── Input ──────────────────────────────────────────────────────────────────
function mouseClicked() {
  let nearest = null, nearestDist = 55;
  for (let f of fragments) {
    if (!f.isClickable()) continue;
    let d = dist(mouseX, mouseY, f.x, f.y);
    if (d < nearestDist) { nearestDist = d; nearest = f; }
  }
  if (nearest) nearest.click();
}

// ── Fragment ───────────────────────────────────────────────────────────────
class Fragment {
  constructor(text, spawnX) {
    this.text          = text;
    this.x             = spawnX + random(-35, 35);
    this.y             = surfaceY;
    this.vx            = random(-0.6, 0.6);
    this.vy            = random(0.3, 0.8);
    this.rotation      = random(-0.05, 0.05);
    this.rotationSpeed = random(-0.002, 0.002);
    this.driftPhase    = random(TWO_PI);
    this.lift          = 0;
    this.restY         = height - random(22, height * 0.07);
    this.state         = 'sinking';
    this.returnT       = 0;
    this.returnStartX  = 0;
  }

  isClickable() { return this.state === 'resting' || this.state === 'rising'; }

  click() {
    this.lift = min(1.0, this.lift + 0.5);
    if (this.state === 'resting') { this.state = 'rising'; this.vy = 0; }
  }

  update() {
    if (this.state === 'sinking') {
      this.vx  *= 0.98;
      this.vy   = min(this.vy + 0.012, 2.5);
      this.x   += this.vx + sin(frameCount * 0.018 + this.driftPhase) * 0.2;
      this.y   += this.vy;
      this.rotation += this.rotationSpeed;
      if (this.y >= this.restY) {
        this.y = this.restY; this.vy = 0; this.vx = 0;
        this.state = 'resting';
      }
    }

    else if (this.state === 'resting') {
      this.x   += sin(frameCount * 0.012 + this.driftPhase) * 0.1;
      this.lift = max(0, this.lift - 0.006);
      if (this.lift > 0.02) { this.state = 'rising'; this.vy = 0; }
    }

    else if (this.state === 'rising') {
      this.lift = max(0, this.lift - 0.006);
      let force = 0.018 - this.lift * 3.0;
      this.vy   = constrain(this.vy + force, -3, 3);
      this.x   += sin(frameCount * 0.018 + this.driftPhase) * 0.2;
      this.y   += this.vy;
      this.rotation += this.rotationSpeed;

      // Lift exhausted and falling back — sink to a new resting spot
      if (this.lift < 0.02 && this.vy > 0.5) {
        this.state = 'sinking';
        this.restY = height - random(22, height * 0.07);
      }
      // Reached surface — begin return journey
      if (this.y <= surfaceY) {
        this.y = surfaceY;
        this.returnStartX = this.x;
        this.returnT = 0;
        this.state = 'returning';
      }
    }

    else if (this.state === 'returning') {
      this.returnT += 1 / 55;
      let t  = constrain(this.returnT, 0, 1);
      // Ease in-out cubic
      let e  = t < 0.5 ? 4*t*t*t : 1 - pow(-2*t + 2, 3) / 2;
      let cx = (this.returnStartX + bucketX) / 2;
      let cy = surfaceY - height * 0.09;
      let mt = 1 - e;
      this.x = mt*mt*this.returnStartX + 2*mt*e*cx + e*e*bucketX;
      this.y = mt*mt*surfaceY          + 2*mt*e*cy  + e*e*(bucketY - 11);
      if (this.returnT >= 1) this.state = 'recovered';
    }
  }

  show() {
    if (this.state === 'recovered') return;

    let tDepth = constrain(map(this.y, surfaceY, height, 0, 1), 0, 1);
    let c = lerpColor(warmWhite, deepBlue, tDepth);

    if (this.state === 'rising' || this.state === 'returning') {
      c = lerpColor(c, color(255, 255, 245, 240), 0.65);
    } else if (this.state === 'resting') {
      let pulse = (sin(frameCount * 0.05 + this.driftPhase) + 1) * 0.5;
      c = lerpColor(c, color(255, 255, 240, 200), pulse * 0.15);
    }

    push();
      translate(this.x, this.y);
      rotate(this.rotation);
      noStroke();
      fill(c);
      text(this.text, 0, 0);
    pop();
  }
}

// ── Corpus helper ──────────────────────────────────────────────────────────
function pickFragment() {
  let line     = random(corpus);
  let words    = line.split(' ');
  let maxStart = max(0, words.length - 2);
  let start    = floor(random(0, maxStart + 1));
  let size     = min(floor(random(2, 4)), words.length - start);
  return words.slice(start, start + size).join(' ');
}

// ── Scene drawing ──────────────────────────────────────────────────────────
function drawSpine() {
  let segH   = height * 0.02;
  let totalH = (height - surfaceY) * 0.9;
  push();
    strokeWeight(2.5);
    noFill();
    for (let i = 0; i < 40; i++) {
      let frac  = i / 39;
      let alpha = map(frac, 0, 1, 26, 0) * (1 + 0.3 * sin(frameCount * 0.03 + i * 0.4));
      let sy    = surfaceY + frac * totalH;
      let sx    = width / 2 + sin(frameCount * 0.02 + i * 0.3) * 4;
      stroke(255, 240, 180, alpha);
      line(sx, sy, sx, sy + segH);
    }
  pop();
}

function drawSurface() {
  let pulse = sin(frameCount * 0.013) * 0.5 + sin(frameCount * 0.031) * 0.3;
  push();
    stroke(255, 248, 230, map(pulse, -0.8, 0.8, 140, 210));
    strokeWeight(0.7 + abs(sin(frameCount * 0.02)) * 0.4);
    line(0, surfaceY, width, surfaceY);
  pop();
}

function drawFigure() {
  let sil = color(40, 35, 30, 210);
  push();
    fill(sil); noStroke();
    ellipse(figX, torsoTop - headR, headR * 2, headR * 2);
    rect(figX - figBodyW * 0.5, torsoTop, figBodyW, figBodyH);
    stroke(sil);
    strokeWeight(max(1.5, figBodyW * 0.6)); noFill();
    line(figX + figBodyW * 0.5, torsoTop + figBodyH * 0.1, armTipX, armTipY);
    strokeWeight(max(1, figBodyW * 0.3));
    line(armTipX, armTipY, rodTip.x, rodTip.y);
  pop();
}

function drawBucket() {
  let bh  = 22, tw = 18, bw = 12;
  let top = bucketY - bh;
  let fillRatio = min(bucket.length / corpus.length, 1);

  push();
    stroke(160, 130, 90, 200);
    strokeWeight(1.2);
    fill(28, 20, 12, 190);
    quad(bucketX - tw/2, top,
         bucketX + tw/2, top,
         bucketX + bw/2, bucketY,
         bucketX - bw/2, bucketY);

    if (fillRatio > 0) {
      let fillH = bh * fillRatio;
      let fillY = bucketY - fillH;
      let fw    = map(fillH, 0, bh, bw, tw) - 4;
      noStroke();
      fill(190, 155, 80, 140);
      quad(bucketX - fw/2,       fillY,
           bucketX + fw/2,       fillY,
           bucketX + (fw-2)/2,   bucketY - 1,
           bucketX - (fw-2)/2,   bucketY - 1);
    }

    noFill();
    stroke(160, 130, 90, 160);
    strokeWeight(1);
    arc(bucketX, top, tw * 0.7, 8, PI, TWO_PI);
  pop();
}

// ── Cast ───────────────────────────────────────────────────────────────────
function triggerCast() {
  castState = 'drawing';
  castTimer = 0;
  let spread = random(width * 0.30, width * 0.50);
  let rise   = random(height * 0.14, height * 0.24);
  castStart  = createVector(rodTip.x, rodTip.y);
  castEnd    = createVector(rodTip.x + spread, surfaceY);
  castCtrl   = createVector(rodTip.x + spread * 0.5, rodTip.y - rise);
}

function queueCast() {
  castLastTrigger = frameCount;
  nextCastIn      = floor(random(900, 1200));
  let sx    = castEnd.x;
  let count = floor(random(3, 6));
  for (let i = 0; i < count; i++) {
    fragmentQueue.push({ text: pickFragment(), spawnX: sx, delay: frameCount + i * 25 });
  }
}

function drawCast() {
  if (castState === 'idle' && frameCount >= castLastTrigger + nextCastIn) {
    triggerCast();
  }
  if (castState === 'idle') return;

  castTimer++;
  let progress, alpha;

  if (castState === 'drawing') {
    progress = castTimer / 50;
    alpha    = 170;
    if (castTimer >= 50) { castState = 'holding'; castTimer = 0; queueCast(); }
  } else if (castState === 'holding') {
    progress = 1; alpha = 170;
    if (castTimer >= 20) { castState = 'fading'; castTimer = 0; }
  } else if (castState === 'fading') {
    progress = 1;
    alpha    = map(castTimer, 0, 60, 170, 0);
    if (castTimer >= 60) { castState = 'idle'; castTimer = 0; return; }
  }

  push();
    stroke(255, 248, 230, alpha);
    strokeWeight(0.8);
    noFill();
    beginShape();
    for (let i = 0; i <= 48; i++) {
      let t  = (i / 48) * progress;
      let mt = 1 - t;
      vertex(mt*mt*castStart.x + 2*mt*t*castCtrl.x + t*t*castEnd.x,
             mt*mt*castStart.y + 2*mt*t*castCtrl.y + t*t*castEnd.y);
    }
    endShape();
  pop();
}
