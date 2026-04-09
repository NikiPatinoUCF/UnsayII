// UNSAY — interactive game
// corpus.js loaded first, provides: const corpusSaid, const corpusUnsaid
// ── Globals ────────────────────────────────────────────────────────────────
let fragments     = [];
let fragmentQueue = [];
let bucket        = [];
let fish          = [];

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
let nextCastIn      = 0;

// ── Setup ──────────────────────────────────────────────────────────────────
function setup() {
  createCanvas(windowWidth, windowHeight);
  surfaceY = height / 2;

  textFont('IM Fell English');
  textSize(22);
  textAlign(CENTER, CENTER);

  warmWhite = color(255, 248, 230, 220);
  deepBlue  = color(15, 30, 65, 175);

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

  castStart = createVector(rodTip.x, rodTip.y);
  castCtrl  = createVector(rodTip.x, rodTip.y);
  castEnd   = createVector(rodTip.x, rodTip.y);
}

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  background(18, 12, 8);
  noStroke();
  fill(2, 8, 22);
  rect(0, surfaceY, width, height - surfaceY);

  drawSurface();
  updateFish();
  drawBucket();
  drawFigure();
  drawVortex();
  drawCast();
  drawHeading();

  for (let i = fragmentQueue.length - 1; i >= 0; i--) {
    if (frameCount >= fragmentQueue[i].delay) {
      fragments.push(new Fragment(fragmentQueue[i].text, fragmentQueue[i].spawnX, fragmentQueue[i].type));
      fragmentQueue.splice(i, 1);
    }
  }

  for (let i = fragments.length - 1; i >= 0; i--) {
    fragments[i].update();
    fragments[i].show();
    let s = fragments[i].state;
    if (s === 'recovered') {
      bucket.push(fragments[i].text);
      fragments.splice(i, 1);
    } else if (s === 'done') {
      fragments.splice(i, 1);
    }
  }

  // Fish eating: a single pass marks the word; it then fades out on its own
  for (let f of fragments) {
    if (f.beingEaten || f.state !== 'resting' || f.clickCount !== 0) continue;
    for (let fi of fish) {
      let wy = fi.y + sin(fi.wob) * 2;
      if (dist(fi.x, wy, f.x, f.y) < fi.bw * 0.8) {
        f.beingEaten = true;
        break;
      }
    }
  }

  let hovering = false;
  for (let f of fragments) {
    if (f.isClickable() && dist(mouseX, mouseY, f.x, f.y) < 65) {
      hovering = true;
      break;
    }
  }
  let figHover = castState === 'idle' &&
    mouseX > figX - width * 0.04 && mouseX < rodTip.x + 20 &&
    mouseY > rodTip.y - 20 && mouseY < surfaceY;
  cursor(hovering || figHover ? HAND : ARROW);
}

// ── Input ──────────────────────────────────────────────────────────────────
function mouseClicked() {
  if (mouseButton !== LEFT) return;

  if (castState === 'idle' &&
      mouseX > figX - width * 0.04 && mouseX < rodTip.x + 20 &&
      mouseY > rodTip.y - 20 && mouseY < surfaceY) {
    triggerCast();
    return;
  }

  let nearest = null, nearestDist = 65;
  for (let f of fragments) {
    if (!f.isClickable()) continue;
    let d = dist(mouseX, mouseY, f.x, f.y);
    if (d < nearestDist) { nearestDist = d; nearest = f; }
  }
  if (nearest) nearest.click();
}

// ── Fragment ───────────────────────────────────────────────────────────────
class Fragment {
  constructor(text, spawnX, type) {
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
    this.returnStartY  = surfaceY;
    this.clickCount    = 0;
    this.type          = type || 'said';
    this.vortexT       = 0;
    this.vortexStartX  = 0;
    this.vortexStartY  = 0;
    this.eatAlpha      = 1.0;
    this.beingEaten    = false;
  }

  isClickable() {
    return this.state === 'sinking' || this.state === 'resting' || this.state === 'rising';
  }

  click() {
    this.clickCount++;
    if (this.clickCount >= 5) {
      this.returnStartX = this.x;
      this.returnStartY = this.y;
      this.returnT = 0;
      this.state = 'returning';
      return;
    }
    if (this.state === 'sinking') {
      this.vy = max(0.05, this.vy - 0.5);
    } else if (this.state === 'resting') {
      this.lift = min(1.0, this.lift + 0.5);
      this.state = 'rising'; this.vy = 0;
    } else if (this.state === 'rising') {
      this.lift = min(1.0, this.lift + 0.5);
    }
  }

  update() {
    if (this.state === 'done') return;
    if (this.beingEaten) {
      this.eatAlpha = max(0, this.eatAlpha - 0.014);
      if (this.eatAlpha <= 0) { this.state = 'done'; return; }
    }

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

      if (this.lift < 0.02 && this.vy > 0.5) {
        this.state = 'sinking';
        this.restY = height - random(22, height * 0.07);
      }
      if (this.y <= surfaceY) {
        this.returnStartX = this.x;
        this.returnStartY = surfaceY;
        this.y = surfaceY;
        this.returnT = 0;
        this.state = 'returning';
      }
    }

    else if (this.state === 'returning') {
      this.returnT += 1 / 55;
      let t  = constrain(this.returnT, 0, 1);
      let e  = t < 0.5 ? 4*t*t*t : 1 - pow(-2*t + 2, 3) / 2;
      let cx = (this.returnStartX + bucketX) / 2;
      let cy = surfaceY - height * 0.09;
      let mt = 1 - e;
      this.x = mt*mt*this.returnStartX + 2*mt*e*cx + e*e*bucketX;
      this.y = mt*mt*this.returnStartY + 2*mt*e*cy  + e*e*(bucketY - 11);
      if (this.returnT >= 1) {
        if (this.type === 'said') {
          this.state = 'recovered';
        } else {
          this.state        = 'vortex';
          this.vortexT      = 0;
          this.vortexStartX = this.x;
          this.vortexStartY = this.y;
        }
      }
    }

    else if (this.state === 'vortex') {
      this.vortexT += 1 / 75;
      let t  = constrain(this.vortexT, 0, 1);
      let e  = t * t;  // accelerate inward
      let cx = figX;
      let cy = torsoTop + figBodyH * 0.5;
      let dx = this.vortexStartX - cx;
      let dy = this.vortexStartY - cy;
      let r  = sqrt(dx * dx + dy * dy) * (1 - e);
      let a0 = atan2(dy, dx);
      let θ  = a0 - t * TWO_PI * 1.5;  // 1.5 counterclockwise rotations
      this.x = cx + r * cos(θ);
      this.y = cy + r * sin(θ);
      if (this.vortexT >= 1) this.state = 'done';
    }
  }

  show() {
    if (this.state === 'recovered' || this.state === 'done') return;

    if (this.state === 'vortex') {
      let t = constrain(this.vortexT, 0, 1);
      push();
        translate(this.x, this.y);
        noStroke();
        fill(200, 210, 230, (1 - t) * 190);
        text(this.text, 0, 0);
      pop();
      return;
    }

    let tDepth = constrain(map(this.y, surfaceY, height, 0, 1), 0, 1);
    let c = lerpColor(warmWhite, deepBlue, tDepth);

    if (this.state === 'rising' || this.state === 'returning') {
      c = lerpColor(c, color(255, 255, 245, 240), 0.65);
    } else if (this.state === 'resting') {
      let pulse = (sin(frameCount * 0.05 + this.driftPhase) + 1) * 0.5;
      c = lerpColor(c, color(255, 255, 240, 200), pulse * 0.15);
    }
    if (this.clickCount > 0 && this.clickCount < 5) {
      c = lerpColor(c, color(255, 255, 245, 240), this.clickCount * 0.12);
    }

    push();
      translate(this.x, this.y);
      rotate(this.rotation);
      noStroke();
      fill(red(c), green(c), blue(c), alpha(c) * this.eatAlpha);
      text(this.text, 0, 0);
    pop();
  }
}

// ── Fish ───────────────────────────────────────────────────────────────────
class Fish {
  constructor() {
    this.dir   = random() < 0.5 ? 1 : -1;
    this.x     = this.dir === 1 ? -70 : width + 70;
    this.y     = random(surfaceY + height * 0.06, height - 35);
    this.speed = random(0.35, 0.8);
    this.bw    = random(32, 58);
    this.bh    = this.bw * 0.36;
    this.wob   = random(TWO_PI);
  }

  update() {
    this.x   += this.speed * this.dir;
    this.wob += 0.035;
  }

  isOffScreen() {
    return (this.dir === 1  && this.x > width  + 80) ||
           (this.dir === -1 && this.x < -80);
  }

  show() {
    let wy = this.y + sin(this.wob) * 2;
    push();
      translate(this.x, wy);
      if (this.dir === -1) scale(-1, 1);
      fill(130, 90, 28, 175);
      noStroke();
      // Tail
      triangle(
        -this.bw * 0.38,  0,
        -this.bw * 0.72, -this.bh * 0.52,
        -this.bw * 0.72,  this.bh * 0.52
      );
      // Body
      ellipse(this.bw * 0.04, 0, this.bw * 0.76, this.bh);
    pop();
  }
}

function updateFish() {
  // Remove fish that have crossed the screen
  for (let i = fish.length - 1; i >= 0; i--) {
    if (fish[i].isOffScreen()) fish.splice(i, 1);
  }
  // Maintain 2 fish; occasionally allow a 3rd
  if (fish.length < 2 || (fish.length < 3 && random() < 0.002)) {
    fish.push(new Fish());
  }
  for (let f of fish) { f.update(); f.show(); }
}

// ── Corpus helper ──────────────────────────────────────────────────────────
function pickFragment(corpusArr) {
  let line     = random(corpusArr);
  let words    = line.split(' ');
  let maxStart = max(0, words.length - 2);
  let start    = floor(random(0, maxStart + 1));
  let size     = min(floor(random(2, 4)), words.length - start);
  return words.slice(start, start + size).join(' ');
}

// ── Scene drawing ──────────────────────────────────────────────────────────
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

function drawVortex() {
  let cx = figX;
  let cy = torsoTop + figBodyH * 0.5;
  // Only draw when a word is actively spiraling in
  let active = false;
  for (let f of fragments) {
    if (f.state === 'vortex') { active = true; break; }
  }
  if (!active) return;
  push();
    noFill();
    let spin = frameCount * 0.18;
    for (let i = 0; i < 3; i++) {
      let a0 = spin + i * TWO_PI / 3;
      let r  = 10;
      stroke(200, 210, 230, 100);
      strokeWeight(0.9);
      arc(cx, cy, r * 2, r * 2, a0, a0 + PI * 0.65);
    }
  pop();
}

function drawBucket() {
  let bh  = 48, tw = 38, bw = 26;
  let top = bucketY - bh;
  let fillRatio = min(bucket.length / corpusSaid.length, 1);

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

function drawHeading() {
  push();
    textSize(16);
    textStyle(ITALIC);
    textAlign(LEFT, TOP);
    noStroke();
    fill(255, 245, 220, 68);
    text('To Say or to Unsay', width * 0.05, height * 0.05);
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
    let type = random() < 0.5 ? 'said' : 'unsaid';
    let corp = type === 'said' ? corpusSaid : corpusUnsaid;
    fragmentQueue.push({ text: pickFragment(corp), spawnX: sx, type: type, delay: frameCount + i * 25 });
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
