// UNSAY — interactive game
// corpus.js loaded first, provides: const corpusSaid, const corpusUnsaid
// ── Globals ────────────────────────────────────────────────────────────────
let fragments     = [];
let fragmentQueue = [];
let bucket        = [];
let fish          = [];

// Meter state
let saidEatenCount = 0;
let carriedSmooth  = 1.0;
let heldSmooth     = 0.0;

// Ending
let gameComplete  = false;
let winPauseTimer = 0;   // counts up after gameComplete; sunset starts after threshold
let sunsetT       = 0;
let nightT        = 0;
let stars         = [];
let shootingStarT  = -1;      // -1 = idle, 0→>1 = in flight
let autoStarFired  = false;
let moonClicksLeft = 0;       // unlocks to 2 after auto star completes
let starSX, starSY, starEX, starEY;  // randomised path per launch

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
let castSwing       = 0;   // -1 = full backcast, 0 = rest, +1 = full forward
let liveRodTip      = {x: 0, y: 0};  // animated rod tip, set each frame by drawFigure()

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

  for (let i = 0; i < 130; i++) {
    stars.push({
      x:       random(width),
      y:       random(surfaceY * 0.92),
      r:       random(0.5, 2.4),
      twinkle: random(TWO_PI)
    });
  }
}

// ── Draw ───────────────────────────────────────────────────────────────────
function draw() {
  // Completion check
  if (!gameComplete && bucket.length >= corpusUnsaid.length && saidEatenCount >= corpusSaid.length) {
    gameComplete = true;
  }
  if (gameComplete) winPauseTimer++;
  if (gameComplete && winPauseTimer > 150) sunsetT = min(1, sunsetT + 1 / 600);  // ~10 seconds
  if (sunsetT >= 1)  nightT  = min(1, nightT  + 1 / 900);  // ~15 seconds after sunset

  // ── Sky ────────────────────────────────────────────────────────────────────
  if (sunsetT < 0.002) {
    background(18, 12, 8);
  } else {
    let s = sunsetT;
    let n = nightT;
    // Sunset colors blend toward deep night indigo as nightT rises
    let grad = drawingContext.createLinearGradient(0, 0, 0, surfaceY);
    grad.addColorStop(0,    `rgb(${_l(_l(18,22,s), 3,  n)},${_l(_l(12,6,s),  4,  n)},${_l(_l(8,42,s),  16, n)})`);
    grad.addColorStop(0.35, `rgb(${_l(_l(18,110,s),5,  n)},${_l(_l(12,28,s), 6,  n)},${_l(_l(8,20,s),  24, n)})`);
    grad.addColorStop(0.65, `rgb(${_l(_l(18,200,s),7,  n)},${_l(_l(12,72,s), 9,  n)},${_l(_l(8,18,s),  34, n)})`);
    grad.addColorStop(0.85, `rgb(${_l(_l(18,232,s),9,  n)},${_l(_l(12,118,s),13, n)},${_l(_l(8,28,s),  40, n)})`);
    grad.addColorStop(1,    `rgb(${_l(_l(18,248,s),11, n)},${_l(_l(12,162,s),19, n)},${_l(_l(8,52,s),  46, n)})`);
    drawingContext.fillStyle = grad;
    drawingContext.fillRect(0, 0, width, surfaceY);

    // Sun orb — fades out as night rises
    let sunFade = s * (1 - n);
    if (sunFade > 0.01) {
      let scx = width * 0.55;
      let scy = surfaceY - height * 0.07;
      let sg  = drawingContext.createRadialGradient(scx, scy, 0, scx, scy, height * 0.18 * s);
      sg.addColorStop(0,   `rgba(255,215,110,${sunFade * 0.55})`);
      sg.addColorStop(0.4, `rgba(245,140,42,${sunFade * 0.28})`);
      sg.addColorStop(1,   `rgba(200,65,18,0)`);
      drawingContext.fillStyle = sg;
      drawingContext.fillRect(0, 0, width, surfaceY);
    }
  }

  drawNightSky();  // stars + moon disc (sky layer, before water)

  // ── Water ──────────────────────────────────────────────────────────────────
  noStroke();
  fill(_l(_l(2,16,sunsetT), 4, nightT), _l(_l(8,8,sunsetT), 8, nightT), _l(_l(22,22,sunsetT), 30, nightT));
  rect(0, surfaceY, width, height - surfaceY);
  drawSunReflection();

  drawSurface();
  drawDock();
  updateFish();
  drawBucket();
  drawFigure();
  drawMeters();
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
      if (fragments[i].type === 'said' && fragments[i].beingEaten) saidEatenCount++;
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
  let moonHover = gameComplete && moonClicksLeft > 0 && shootingStarT < 0 &&
    dist(mouseX, mouseY, width * 0.68, surfaceY - height * (nightT * 0.38)) < height * 0.044 * 2.2;
  cursor(hovering || figHover || moonHover ? HAND : ARROW);
}

// ── Input ──────────────────────────────────────────────────────────────────
function mouseClicked() {
  if (mouseButton !== LEFT) return;

  // Moon click — trigger bonus shooting stars during night
  if (gameComplete && moonClicksLeft > 0 && shootingStarT < 0) {
    let moonMx = width * 0.68;
    let moonMy = surfaceY - height * (nightT * 0.38);
    let moonMr = height * 0.044;
    if (dist(mouseX, mouseY, moonMx, moonMy) < moonMr * 2.2) {
      launchShootingStar();
      moonClicksLeft--;
      return;
    }
  }

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
    this.eatAlpha      = 1.0;
    this.beingEaten    = false;
  }

  isClickable() {
    return this.type === 'unsaid' &&
      (this.state === 'sinking' || this.state === 'resting' || this.state === 'rising');
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
        this.state = 'recovered';
      }
    }

  }

  show() {
    if (this.state === 'recovered' || this.state === 'done') return;

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
      if (this.state === 'returning') {
        // Hold full size for first 40%, then collapse rapidly to ~18%
        let t = constrain((this.returnT - 0.4) / 0.6, 0, 1);
        scale(lerp(1, 0.18, t * t * t));
      }
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
      if (f.type !== 'said' || f.state !== 'resting' || f.beingEaten) {
        this.target = null;
      }
    }

    // Seek the nearest eligible resting said word
    if (!this.target) {
      let best = null, bestD = Infinity;
      for (let f of fragments) {
        if (f.type !== 'said' || f.state !== 'resting' || f.beingEaten) continue;
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
  let sunS = min(sunsetT * 1.4, 1) * (1 - nightT);  // sun reflection fades with night
  let cx   = width * 0.55;

  // Sun reflection (warm)
  if (sunS > 0.018) {
    push();
      for (let y = surfaceY + 1; y < height; y += 2) {
        let depth  = (y - surfaceY) / (height - surfaceY);
        let bright = sunS * pow(1 - depth, 0.55);
        if (bright < 0.018) continue;

        let wA   = sin(y * 0.068 + frameCount * 0.007) * 0.5 + 0.5;
        let wB   = sin(y * 0.21  + frameCount * 0.011) * 0.35 + 0.65;
        let maxW = width * 0.26 * sunS * (1 - depth * 0.55);
        let lw   = maxW * wA * wB;
        let cw   = lw * 0.14;
        let gw   = lw * 0.52;
        stroke(255, 246, 218, 230 * bright);
        strokeWeight(1.8);
        line(cx - cw, y, cx + cw, y);
        stroke(242, 162, 42, 150 * bright * wA);
        strokeWeight(1.2);
        line(cx - gw, y, cx - cw, y);
        line(cx + cw, y, cx + gw, y);
        stroke(215, 80, 28, 75 * bright * wB);
        strokeWeight(1);
        line(cx - lw, y, cx - gw, y);
        line(cx + gw, y, cx + lw, y);
      }
    pop();
  }

  // Moon reflection (cool, fades in)
  let moonS = constrain((nightT - 0.08) / 0.92, 0, 1);
  if (moonS > 0.01) {
    let mx = width * 0.68;
    push();
      for (let y = surfaceY + 1; y < height; y += 2) {
        let depth  = (y - surfaceY) / (height - surfaceY);
        let bright = moonS * pow(1 - depth, 0.65);
        if (bright < 0.015) continue;

        let wA   = sin(y * 0.072 + frameCount * 0.006) * 0.5 + 0.5;
        let wB   = sin(y * 0.19  + frameCount * 0.010) * 0.35 + 0.65;
        let maxW = width * 0.12 * moonS * (1 - depth * 0.6);
        let lw   = maxW * wA * wB;
        let cw   = lw * 0.22;
        stroke(210, 220, 242, 185 * bright);
        strokeWeight(1.6);
        line(mx - cw, y, mx + cw, y);
        stroke(170, 192, 225, 85 * bright * wA);
        strokeWeight(1);
        line(mx - lw, y, mx - cw, y);
        line(mx + cw, y, mx + lw, y);
      }
    pop();
  }
}

function launchShootingStar() {
  starSX = random(width * 0.05, width * 0.35);
  starSY = random(surfaceY * 0.04, surfaceY * 0.22);
  starEX = random(width * 0.55, width * 0.95);
  starEY = random(surfaceY * 0.25, surfaceY * 0.60);
  shootingStarT = 0;
}

function drawNightSky() {
  if (nightT < 0.01) return;
  let n = nightT;

  // Stars — fade in, gently twinkle
  push();
    noStroke();
    for (let st of stars) {
      let tw = sin(frameCount * 0.038 + st.twinkle) * 0.5 + 0.5;
      let a  = n * (0.5 + tw * 0.5) * 200;
      fill(218, 224, 242, a);
      ellipse(st.x, st.y, st.r * 2, st.r * 2);
    }
  pop();

  // Moon — rises from horizon as nightT increases
  let mx = width * 0.68;
  let my = surfaceY - height * (nightT * 0.38);
  let mr = height * 0.044;

  // Outer atmospheric glow
  let mg = drawingContext.createRadialGradient(mx, my, 0, mx, my, mr * 4);
  mg.addColorStop(0,   `rgba(195,210,238,${n * 0.22})`);
  mg.addColorStop(0.45,`rgba(170,192,228,${n * 0.10})`);
  mg.addColorStop(1,   `rgba(140,172,218,0)`);
  drawingContext.fillStyle = mg;
  drawingContext.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);

  // Moon disc
  push();
    noStroke();
    fill(212, 222, 242, n * 215);
    ellipse(mx, my, mr * 2, mr * 2);
    // Subtle highlight
    fill(238, 242, 255, n * 70);
    ellipse(mx - mr * 0.2, my - mr * 0.2, mr * 0.85, mr * 0.85);
  pop();

  // Auto-fire first shooting star once night is established
  if (nightT >= 0.5 && !autoStarFired && shootingStarT < 0) {
    launchShootingStar();
    autoStarFired = true;
  }

  // Animate active shooting star
  if (shootingStarT >= 0) {
    shootingStarT += 1 / 105;

    if (shootingStarT > 1.1) {
      // Star finished — unlock moon clicks on first completion
      shootingStarT = -1;
      if (moonClicksLeft === 0) moonClicksLeft = 2;
    } else {
      let t     = constrain(shootingStarT, 0, 1);
      let hx    = lerp(starSX, starEX, t);
      let hy    = lerp(starSY, starEY, t);
      let tailT = max(0, t - 0.15);
      let tx    = lerp(starSX, starEX, tailT);
      let ty    = lerp(starSY, starEY, tailT);
      let a     = t < 0.8 ? 1 : map(t, 0.8, 1, 1, 0);

      drawingContext.save();
      // Skip gradient line if head and tail haven't separated yet
      if (dist(tx, ty, hx, hy) > 1) {
        let trail = drawingContext.createLinearGradient(tx, ty, hx, hy);
        trail.addColorStop(0, 'rgba(200,215,255,0)');
        trail.addColorStop(1, `rgba(255,255,255,${(a * 0.95).toFixed(3)})`);
        drawingContext.strokeStyle = trail;
        drawingContext.lineWidth   = 2.5;
        drawingContext.beginPath();
        drawingContext.moveTo(tx, ty);
        drawingContext.lineTo(hx, hy);
        drawingContext.stroke();
      }
      // Head glow
      let glow = drawingContext.createRadialGradient(hx, hy, 0, hx, hy, 20);
      glow.addColorStop(0,   `rgba(255,255,255,${(a * 0.95).toFixed(3)})`);
      glow.addColorStop(0.4, `rgba(210,228,255,${(a * 0.48).toFixed(3)})`);
      glow.addColorStop(1,   'rgba(180,200,255,0)');
      drawingContext.fillStyle = glow;
      drawingContext.fillRect(hx - 20, hy - 20, 40, 40);
      drawingContext.restore();
    }
  }
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

  // Cast swing — pulls arm back (castSwing < 0) or pushes slightly forward (> 0)
  let swingBack  = constrain(-castSwing, 0, 1);  // 0 = rest, 1 = full backcast
  let backArmX   = figX + figBodyW * 0.4;           // arm tucked near body
  let backArmY   = aTorsoTop - aBodyH * 0.18;        // raised high
  let backRodX   = figX - width  * 0.04;             // rod tip behind the fisher
  let backRodY   = aTorsoTop - aBodyH * 0.55;        // pointing up and back
  let cArmTipX   = lerp(dArmTipX, backArmX, swingBack);
  let cArmTipY   = lerp(dArmTipY, backArmY, swingBack);
  let cRodTipX   = lerp(dRodTipX, backRodX, swingBack);
  let cRodTipY   = lerp(dRodTipY, backRodY, swingBack);

  // Expose live rod tip for cast line attachment
  liveRodTip.x = cRodTipX;
  liveRodTip.y = cRodTipY;

  let sil = color(40, 35, 30, 210);
  push();
    fill(sil); noStroke();
    ellipse(figX, aTorsoTop - headR, headR * 2, headR * 2);
    rect(figX - figBodyW * 0.5, aTorsoTop, figBodyW, aBodyH);

    // Held inner glow — drawn after body, clipped to body rect, before arms
    if (heldSmooth > 0.001) {
      let fh = aBodyH * heldSmooth;
      drawingContext.save();
      drawingContext.beginPath();
      drawingContext.rect(figX - figBodyW * 0.5, aTorsoTop, figBodyW, aBodyH);
      drawingContext.clip();
      let grd = drawingContext.createLinearGradient(0, aTorsoTop + aBodyH, 0, aTorsoTop);
      grd.addColorStop(0,    'rgba(255,  0,  0,130)');  // red
      grd.addColorStop(0.17, 'rgba(255,127,  0,130)');  // orange
      grd.addColorStop(0.33, 'rgba(240,220,  0,130)');  // yellow
      grd.addColorStop(0.5,  'rgba(  0,185,  0,130)');  // green
      grd.addColorStop(0.67, 'rgba(  0, 80,255,130)');  // blue
      grd.addColorStop(0.83, 'rgba( 75,  0,130,130)');  // indigo
      grd.addColorStop(1,    'rgba(148,  0,211,130)');  // violet
      drawingContext.fillStyle = grd;
      drawingContext.fillRect(figX - figBodyW * 0.5, aTorsoTop + aBodyH - fh, figBodyW, fh);
      drawingContext.restore();
    }

    stroke(sil);
    strokeWeight(max(1.5, figBodyW * 0.6)); noFill();
    line(figX + figBodyW * 0.5, aTorsoTop + aBodyH * 0.1, cArmTipX, cArmTipY);
    strokeWeight(max(1, figBodyW * 0.3));
    line(cArmTipX, cArmTipY, cRodTipX, cRodTipY);
  pop();
}

function drawBucket() {
  let bh  = 48, tw = 38, bw = 26;
  let top = bucketY - bh;
  let fillRatio = min(bucket.length / corpusUnsaid.length, 1);

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

function drawDock() {
  let dl = figX - width * 0.065;
  let dr = figX + width * 0.022;
  let dw = dr - dl;
  let pilDepth = height * 0.13;

  push();
    noStroke();
    // Pilings into the water
    fill(38, 24, 12, 200);
    let pilXs = [dl + 10, dl + dw * 0.48, dr - 10];
    for (let px of pilXs) {
      rect(px - 5, surfaceY - 4, 10, pilDepth, 3);
    }
    // Lower plank
    fill(58, 40, 22, 245);
    stroke(26, 14, 5, 130);
    strokeWeight(1);
    rect(dl, surfaceY - 7, dw, 7, 1);
    // Upper plank (slightly lighter grain)
    fill(66, 46, 26, 230);
    rect(dl, surfaceY - 13, dw, 6, 1);
    // Dark gap between planks
    noStroke();
    fill(18, 10, 4, 180);
    rect(dl + 2, surfaceY - 8, dw - 4, 1);
  pop();
}

function drawMeters() {
  let carriedTarget = 1 - constrain(bucket.length / corpusUnsaid.length, 0, 1);
  let heldTarget    = constrain(saidEatenCount / corpusSaid.length, 0, 1);
  carriedSmooth = lerp(carriedSmooth, carriedTarget, 0.04);
  heldSmooth    = lerp(heldSmooth,    heldTarget,    0.04);
}

// ── Cast ───────────────────────────────────────────────────────────────────
function triggerCast() {
  castState = 'backcast';
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
  if (gameComplete) { castState = 'idle'; castSwing = 0; return; }
  if (castState === 'idle' && frameCount >= castLastTrigger + nextCastIn) {
    triggerCast();
  }
  if (castState === 'idle') {
    castSwing = lerp(castSwing, 0, 0.1);
    return;
  }

  castTimer++;

  // ── Backcast: arm pulls back/up, no line yet ─────────────────────────────
  if (castState === 'backcast') {
    let t    = constrain(castTimer / 18, 0, 1);
    let e    = t * t * (3 - 2 * t);     // smoothstep
    castSwing = -e;                      // 0 → -1
    if (castTimer >= 18) { castState = 'drawing'; castTimer = 0; }
    return;
  }

  let progress, alpha;

  if (castState === 'drawing') {
    progress  = castTimer / 50;
    alpha     = 170;
    // Arm whips forward: castSwing -1 → 0.18
    castSwing = lerp(-1, 0.18, constrain(castTimer / 50, 0, 1));
    if (castTimer >= 50) { castState = 'holding'; castTimer = 0; queueCast(); }
  } else if (castState === 'holding') {
    progress  = 1; alpha = 170;
    castSwing = lerp(castSwing, 0.05, 0.12);
    if (castTimer >= 20) { castState = 'fading'; castTimer = 0; }
  } else if (castState === 'fading') {
    progress  = 1;
    alpha     = map(castTimer, 0, 60, 170, 0);
    castSwing = lerp(castSwing, 0, 0.06);
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
      vertex(mt*mt*liveRodTip.x + 2*mt*t*castCtrl.x + t*t*castEnd.x,
             mt*mt*liveRodTip.y + 2*mt*t*castCtrl.y + t*t*castEnd.y);
    }
    endShape();
  pop();
}
