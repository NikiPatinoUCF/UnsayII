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
    this.vy = random(0.4, 1.4);
    this.rotation = random(-0.08, 0.08);
    this.rotationSpeed = random(-0.004, 0.004);
    this.driftPhase = random(TWO_PI);
    this.driftAmp = random(0.15, 0.45);
    this.text = random(corpus);
  }

  finished() {
    return this.y > height + 60;
  }

  update() {
    this.vy += 0.006;
    this.x += sin(frameCount * 0.018 + this.driftPhase) * this.driftAmp;
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
