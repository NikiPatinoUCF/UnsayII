// UNSAY — interactive game
// corpus.js loaded first, provides: const corpusSaid, const corpusUnsaid
// ── Globals ────────────────────────────────────────────────────────────────
let fragments     = [];
let fragmentQueue = [];
let bucket        = [];
let fish          = [];

// Meter state
let heldCount     = 0;
let carriedSmooth = 1.0;
let heldSmooth    = 0.0;

// Ending
let gameComplete  = false;
let sunsetT       = 0;

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
  textSize(46);
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
  // Completion check
  if (!gameComplete && bucket.length >= corpusSaid.length && heldCount >= corpusUnsaid.length) {
    gameComplete = true;
  }
  if (gameComplete) sunsetT = min(1, sunsetT + 1 / 600);  // ~10 seconds

  // ── Sky ────────────────────────────────────────────────────────────────────
  if (sunsetT < 0.002) {
    background(18, 12, 8);
  } else {
    let s = sunsetT;
    let grad = drawingContext.createLinearGradient(0, 0, 0, surfaceY);
    grad.addColorStop(0,    `rgb(${_l(18,22,s)},${_l(12,6,s)},${_l(8,42,s)})`);
    grad.addColorStop(0.35, `rgb(${_l(18,110,s)},${_l(12,28,s)},${_l(8,20,s)})`);
    grad.addColorStop(0.65, `rgb(${_l(18,200,s)},${_l(12,72,s)},${_l(8,18,s)})`);
    grad.addColorStop(0.85, `rgb(${_l(18,232,s)},${_l(12,118,s)},${_l(8,28,s)})`);
    grad.addColorStop(1,    `rgb(${_l(18,248,s)},${_l(12,162,s)},${_l(8,52,s)})`);
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, 0, width, surfaceY);

    // Sun orb glow in sky
    let scx = width * 0.55;
    let scy = surfaceY - height * 0.07;
    let sg  = drawingContext.createRadialGradient(scx, scy, 0, scx, scy, height * 0.18 * s);
    sg.addColorStop(0,   `rgba(255,215,110,${s * 0.55})`);
    sg.addColorStop(0.4, `rgba(245,140,42,${s * 0.28})`);
    sg.addColorStop(1,   `rgba(200,65,18,0)`);
    drawingContext.fillStyle = sg;
    drawingContext.fillRect(0, 0, width, surfaceY);
  }

  // ── Water ──────────────────────────────────────────────────────────────────
  noStroke();
  fill(_l(2,16,sunsetT), _l(8,8,sunsetT), _l(22,22,sunsetT));
  rect(0, surfaceY, width, height - surfaceY);
  drawSunReflection();

  drawSurface();
  updateFish();
  drawBucket();
  drawFigure();
  drawMeters();
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
      if (fragments[i].type === 'unsaid' && fragments[i].vortexT >= 1) heldCount++;
      fragments.splice(i, 1);
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
    this.dir    = random() < 0.5 ? 1 : -1;
    this.x      = this.dir === 1 ? -70 : width + 70;
    this.y      = random(surfaceY + height * 0.06, height - 35);
    this.speed  = random(0.6, 1.2);
    this.bw     = random(32, 58);
    this.bh     = this.bw * 0.36;
    this.wob    = random(TWO_PI);
    this.vx     = this.speed * this.dir;
    this.vy     = 0;
    this.target = null;
  }

  update() {
    // During ending, fish drift peacefully — no hunting
    if (gameComplete) {
      this.target = null;
      this.vx = lerp(this.vx, this.speed * this.dir * 0.4, 0.02);
      this.vy = lerp(this.vy, 0, 0.04);
      if (abs(this.vx) > 0.1) this.dir = this.vx > 0 ? 1 : -1;
      this.x += this.vx; this.y += this.vy; this.wob += 0.025;
      return;
    }

    // Drop target if it's no longer eligible
    if (this.target) {
      let f = this.target;
      if (f.state !== 'resting' || f.clickCount !== 0 || f.beingEaten) {
        this.target = null;
      }
    }

    // Seek the nearest eligible resting word
    if (!this.target) {
      let best = null, bestD = Infinity;
      for (let f of fragments) {
        if (f.state !== 'resting' || f.clickCount !== 0 || f.beingEaten) continue;
        let d = dist(this.x, this.y, f.x, f.y);
        if (d < bestD) { bestD = d; best = f; }
      }
      this.target = best;
    }

    if (this.target) {
      let dx = this.target.x - this.x;
      let dy = this.target.y - this.y;
      let d  = sqrt(dx * dx + dy * dy);
      if (d > 1) {
        this.vx = lerp(this.vx, (dx / d) * this.speed * 1.4, 0.05);
        this.vy = lerp(this.vy, (dy / d) * this.speed * 1.4, 0.05);
      }
      // Close enough — eat it
      if (d < this.bw * 0.6) {
        this.target.beingEaten = true;
        this.target = null;
      }
    } else {
      // No words to hunt — drift horizontally
      this.vx = lerp(this.vx, this.speed * this.dir, 0.03);
      this.vy = lerp(this.vy, 0, 0.05);
    }

    // Face the direction of travel
    if (abs(this.vx) > 0.1) this.dir = this.vx > 0 ? 1 : -1;

    this.x   += this.vx;
    this.y   += this.vy;
    this.wob += 0.035;
  }

  isOffScreen() {
    return this.x > width + 120 || this.x < -120;
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

// ── Helpers ────────────────────────────────────────────────────────────────
function _l(a, b, t) { return floor(lerp(a, b, t)); }  // integer lerp for CSS rgb()

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
function drawSunReflection() {
  if (sunsetT < 0.04) return;
  let s  = min(sunsetT * 1.4, 1);
  let cx = width * 0.55;

  push();
    for (let y = surfaceY + 1; y < height; y += 2) {
      let depth  = (y - surfaceY) / (height - surfaceY);
      let bright = s * pow(1 - depth, 0.55);
      if (bright < 0.018) continue;

      // Two overlapping waves create organic shimmer
      let wA   = sin(y * 0.068 + frameCount * 0.007) * 0.5 + 0.5;
      let wB   = sin(y * 0.21  + frameCount * 0.011) * 0.35 + 0.65;
      let maxW = width * 0.26 * s * (1 - depth * 0.55);
      let lw   = maxW * wA * wB;

      let cw = lw * 0.14;  // bright core
      let gw = lw * 0.52;  // gold band
      // Core — warm cream/white
      stroke(255, 246, 218, 230 * bright);
      strokeWeight(1.8);
      line(cx - cw, y, cx + cw, y);
      // Gold band
      stroke(242, 162, 42, 150 * bright * wA);
      strokeWeight(1.2);
      line(cx - gw, y, cx - cw, y);
      line(cx + cw, y, cx + gw, y);
      // Amber/rose outer
      stroke(215, 80, 28, 75 * bright * wB);
      strokeWeight(1);
      line(cx - lw, y, cx - gw, y);
      line(cx + gw, y, cx + lw, y);
    }
  pop();
}

function drawSurface() {
  // Horizon glow — full-width band that blooms with sunset
  if (sunsetT > 0.01) {
    let spread = 70 + sunsetT * 60;
    let hg = drawingContext.createLinearGradient(0, surfaceY - spread, 0, surfaceY + spread);
    let a  = sunsetT * 0.85;
    hg.addColorStop(0,   `rgba(255,168,42,0)`);
    hg.addColorStop(0.5, `rgba(255,158,38,${a})`);
    hg.addColorStop(1,   `rgba(218,82,15,0)`);
    drawingContext.fillStyle = hg;
    drawingContext.fillRect(0, surfaceY - spread, width, spread * 2);
  }

  let pulse = sin(frameCount * 0.013) * 0.5 + sin(frameCount * 0.031) * 0.3;
  let baseA = map(pulse, -0.8, 0.8, 140, 210);
  push();
    stroke(255, _l(248, 195, sunsetT), _l(230, 95, sunsetT),
           lerp(baseA, 255, sunsetT));
    strokeWeight(0.7 + abs(sin(frameCount * 0.02)) * 0.4 + sunsetT * 1.5);
    line(0, surfaceY, width, surfaceY);
  pop();
}

function drawFigure() {
  // Posture shifts as burden lifts (carried depletes) and interior fills (held grows)
  let lift      = 1 - carriedSmooth;
  let aTorsoTop = torsoTop  - lift * figBodyH * 0.12;
  let aBodyH    = figBodyH  + lift * figBodyH * 0.12;
  let aArmTipY  = armTipY   - lift * height  * 0.02;
  let aRodTipY  = rodTip.y  - lift * height  * 0.02;


  // Pole folds away in the first 40% of the sunset
  let poleT      = min(sunsetT * 2.5, 1);
  let dArmTipX   = lerp(armTipX,   figX + figBodyW * 0.5, poleT);
  let dArmTipY   = lerp(aArmTipY,  aTorsoTop + aBodyH * 0.45, poleT);
  let dRodTipX   = lerp(rodTip.x,  figX + figBodyW * 0.5, poleT);
  let dRodTipY   = lerp(aRodTipY,  aTorsoTop + aBodyH * 0.45, poleT);

  let sil = color(40, 35, 30, 210);
  push();
    fill(sil); noStroke();
    ellipse(figX, aTorsoTop - headR, headR * 2, headR * 2);
    rect(figX - figBodyW * 0.5, aTorsoTop, figBodyW, aBodyH);
    stroke(sil);
    strokeWeight(max(1.5, figBodyW * 0.6)); noFill();
    line(figX + figBodyW * 0.5, aTorsoTop + aBodyH * 0.1, dArmTipX, dArmTipY);
    strokeWeight(max(1, figBodyW * 0.3));
    line(dArmTipX, dArmTipY, dRodTipX, dRodTipY);
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
  if (gameComplete) return;
  push();
    textSize(28);
    textStyle(ITALIC);
    textAlign(LEFT, TOP);
    noStroke();
    fill(255, 245, 220, 68);
    text('To Say or to Unsay', width * 0.05, height * 0.05);
  pop();
}

function drawMeters() {
  let carriedTarget = 1 - constrain(bucket.length / corpusSaid.length, 0, 1);
  let heldTarget    = constrain(heldCount / corpusUnsaid.length, 0, 1);
  carriedSmooth = lerp(carriedSmooth, carriedTarget, 0.04);
  heldSmooth    = lerp(heldSmooth,    heldTarget,    0.04);

  let bw  = 6;
  let bh  = figBodyH;
  let by  = torsoTop;
  let gap = 12;
  let lx  = figX - figBodyW * 0.5 - gap - bw;
  let rx  = figX + figBodyW * 0.5 + gap;

  // ── Left: Carried (amber, depletes top-down) ──────────────────────────────
  push();
    noStroke();
    // Track
    fill(60, 45, 20, 45);
    rect(lx, by, bw, bh);
    // Fill
    if (carriedSmooth > 0.001) {
      fill(200, 145, 55, 175);
      rect(lx, by, bw, bh * carriedSmooth);
    }
    // Label
    textSize(16);
    textStyle(ITALIC);
    textAlign(CENTER, TOP);
    fill(200, 165, 85, 80);
    text('carried', lx + bw * 0.5, surfaceY + 7);
  pop();

  // ── Right: Held (blue-gray, fills bottom-up) ──────────────────────────────
  push();
    noStroke();
    // Track
    fill(25, 35, 55, 45);
    rect(rx, by, bw, bh);
    // Fill
    if (heldSmooth > 0.001) {
      let fh = bh * heldSmooth;
      fill(130, 155, 190, 175);
      rect(rx, by + bh - fh, bw, fh);
    }
    // Label
    textSize(16);
    textStyle(ITALIC);
    textAlign(CENTER, TOP);
    fill(130, 155, 190, 80);
    text('held', rx + bw * 0.5, surfaceY + 7);
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
  if (gameComplete) { castState = 'idle'; return; }
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
