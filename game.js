/**
 * ============================================================================
 * ASTRO-MINER: COMBAT HARVEST — 2D SPACE SHOOTER & HARVESTER
 * Multimedia Systems Lab — Lab Test 2
 * ============================================================================
 * Features:
 *  - Full State Machine: START, PLAYING, PAUSED, GAMEOVER
 *  - Mining Laser Cannon: Twin beams & Triple Spread Shot Power-Up
 *  - Destructible Hazards: Asteroids (2 HP) & Tracking Mines (1 HP)
 *  - Loot Drops on Shatter: Destroying hazards yields collectable Crystals & Cores
 *  - Screen Shake & Camera Punch System
 *  - 60 FPS Delta-time Physics & Inertia Movement (Keyboard + Mouse/Touch)
 *  - Dual Collision Detection: Circle-Distance and AABB (with F1 Hitbox Debugger)
 *  - Dynamic Combo Scoring (x1 to x5) & Continuous Difficulty Scaling
 *  - Procedural Web Audio API Sound Synthesizer & Particle Systems
 * ============================================================================
 */

// --- 1. CONSTANTS & CONFIGURATION ---
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

const STATES = {
  START: 'START',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

const POWERUP_TYPES = {
  MAGNET: { name: 'MAGNET TRACTOR', duration: 7.0, color: '#00f0ff', icon: '🧲' },
  SHIELD: { name: 'PLASMA SHIELD', duration: 8.0, color: '#39ff14', icon: '🛡️' },
  SPREAD: { name: 'TRIPLE SPREAD SHOT', duration: 8.5, color: '#ffbe0b', icon: '⚡' }
};

// --- 2. GAME ENGINE CLASS ---
class AstroMinerGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    // High DPI Support
    this.setupCanvasDPI();

    // State Variables
    this.state = STATES.START;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('astrominer_high') || '0', 10);
    this.lives = 3;
    this.maxLives = 3;
    this.combo = 1;
    this.maxCombo = 1;
    this.gameTime = 0;
    this.lastFrameTime = performance.now();

    // Screen Shake Effect
    this.screenShake = 0.0; // timer in seconds
    this.shakeIntensity = 5.0;

    // Debugging
    this.showHitboxes = false;

    // Power-up Tracking
    this.activePowerup = null; // { type, timeLeft, maxDuration }

    // Input Handling
    this.keys = {};
    this.mouse = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 80, active: false, isDown: false };

    // Game Entities
    this.player = null;
    this.lasers = [];
    this.stars = [];
    this.collectibles = [];
    this.hazards = [];
    this.particles = [];
    this.floatingTexts = [];

    // Spawning Timers
    this.spawnTimerCollectible = 0;
    this.spawnTimerHazard = 0;
    this.spawnTimerPowerup = 0;

    // Cache DOM Elements
    this.dom = {
      score: document.getElementById('hud-score'),
      high: document.getElementById('hud-high'),
      lives: document.getElementById('hud-lives'),
      combo: document.getElementById('hud-multiplier'),
      time: document.getElementById('hud-time'),
      powerupBar: document.getElementById('hud-powerup-bar'),
      powerupLabel: document.getElementById('powerup-label'),
      powerupFill: document.getElementById('powerup-fill'),
      screenStart: document.getElementById('screen-start'),
      screenPause: document.getElementById('screen-pause'),
      screenGameOver: document.getElementById('screen-gameover'),
      finalScore: document.getElementById('final-score'),
      bestScore: document.getElementById('best-score'),
      finalTime: document.getElementById('final-time'),
      finalCombo: document.getElementById('final-combo'),
      audioStatus: document.getElementById('audio-status'),
      debugStatus: document.getElementById('debug-status'),
      btnAudioToggle: document.getElementById('btn-audio-toggle'),
      btnDebugToggle: document.getElementById('btn-debug-toggle'),
      btnStart: document.getElementById('btn-start'),
      btnResume: document.getElementById('btn-resume'),
      btnRestart: document.getElementById('btn-restart'),
      btnPauseRestart: document.getElementById('btn-pause-restart')
    };

    // Initialize systems
    this.initStarfield();
    this.bindEvents();
    this.updateHUD();

    // Start Animation Loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupCanvasDPI() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = CANVAS_WIDTH * dpr;
    this.canvas.height = CANVAS_HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
  }

  // --- 3. EVENT LISTENERS & INPUT ---
  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      this.keys[e.code] = true;

      // Global hotkeys
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        this.togglePause();
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleAudio();
      } else if (e.key === 'F1') {
        e.preventDefault();
        this.toggleDebug();
      } else if ((e.key === 'r' || e.key === 'R') && (this.state === STATES.GAMEOVER || this.state === STATES.PLAYING)) {
        this.resetGame();
        this.startGame();
      } else if ((e.code === 'Space' || e.key === 'Enter') && this.state === STATES.START) {
        this.startGame();
      } else if ((e.code === 'Space' || e.key === 'Enter') && this.state === STATES.GAMEOVER) {
        this.resetGame();
        this.startGame();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      this.keys[e.code] = false;
    });

    // Mouse / Touch Canvas Controls
    const updatePointer = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      this.mouse.x = (clientX - rect.left) * scaleX;
      this.mouse.y = (clientY - rect.top) * scaleY;
      this.mouse.active = true;
    };

    this.canvas.addEventListener('mousemove', (e) => updatePointer(e.clientX, e.clientY));
    this.canvas.addEventListener('mousedown', (e) => {
      updatePointer(e.clientX, e.clientY);
      this.mouse.isDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
        this.mouse.isDown = true;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        updatePointer(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      this.mouse.isDown = false;
    });

    // UI Buttons
    this.dom.btnStart.addEventListener('click', () => this.startGame());
    this.dom.btnResume.addEventListener('click', () => this.togglePause());
    this.dom.btnRestart.addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });
    this.dom.btnPauseRestart.addEventListener('click', () => {
      this.resetGame();
      this.startGame();
    });
    this.dom.btnAudioToggle.addEventListener('click', () => this.toggleAudio());
    this.dom.btnDebugToggle.addEventListener('click', () => this.toggleDebug());
  }

  toggleAudio() {
    const isNowOn = window.soundEngine.toggleMute();
    this.dom.audioStatus.textContent = isNowOn ? 'ON' : 'MUTED';
    document.getElementById('audio-icon').textContent = isNowOn ? '🔊' : '🔇';
  }

  toggleDebug() {
    this.showHitboxes = !this.showHitboxes;
    this.dom.debugStatus.textContent = this.showHitboxes ? 'ON' : 'OFF';
  }

  togglePause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
      this.dom.screenPause.classList.add('active');
    } else if (this.state === STATES.PAUSED) {
      this.state = STATES.PLAYING;
      this.dom.screenPause.classList.remove('active');
      this.lastFrameTime = performance.now();
    }
  }

  // --- 4. GAME INITIALIZATION & RESET ---
  startGame() {
    window.soundEngine.init();
    window.soundEngine.startBGM();
    this.resetGame();
    this.state = STATES.PLAYING;
    this.dom.screenStart.classList.remove('active');
    this.dom.screenPause.classList.remove('active');
    this.dom.screenGameOver.classList.remove('active');
    this.lastFrameTime = performance.now();
  }

  resetGame() {
    this.score = 0;
    this.lives = this.maxLives;
    this.combo = 1;
    this.maxCombo = 1;
    this.gameTime = 0;
    this.screenShake = 0.0;
    this.activePowerup = null;

    this.lasers = [];
    this.collectibles = [];
    this.hazards = [];
    this.particles = [];
    this.floatingTexts = [];

    this.spawnTimerCollectible = 0;
    this.spawnTimerHazard = 0;
    this.spawnTimerPowerup = 0;

    // Create Player Ship
    this.player = new PlayerShip(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 90);

    this.updateHUD();
  }

  initStarfield() {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        radius: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 40 + 20,
        alpha: Math.random() * 0.8 + 0.2
      });
    }
  }

  // --- 5. MAIN LOOP (DELTA TIME) ---
  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = currentTime;

    // Always update stars for dynamic background effect
    this.updateStars(dt);

    if (this.state === STATES.PLAYING) {
      this.gameTime += dt;
      this.updateGame(dt);
    }

    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateStars(dt) {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    }
  }

  // --- 6. GAMEPLAY UPDATES & SPAWNING ---
  updateGame(dt) {
    // 1. Update Player & Weapon Firing
    const isShooting = this.keys['space'] || this.keys['Space'] || this.mouse.isDown;
    this.player.update(dt, this.keys, this.mouse, isShooting, this);

    // 2. Screen Shake Decay
    if (this.screenShake > 0) {
      this.screenShake -= dt;
    }

    // 3. Update Active Power-up Duration
    if (this.activePowerup) {
      this.activePowerup.timeLeft -= dt;
      if (this.activePowerup.timeLeft <= 0) {
        this.addFloatingText('POWER-UP EXPIRED', this.player.x, this.player.y - 30, '#8b9bb4');
        this.activePowerup = null;
      }
      this.updatePowerupHUD();
    }

    // 4. Update Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i];
      laser.update(dt);
      if (laser.isOffscreen()) {
        this.lasers.splice(i, 1);
      }
    }

    // 5. Spawning Logic (Dynamic Difficulty Scaling)
    this.handleSpawning(dt);

    // 6. Laser-to-Hazard Collision Detection Matrix
    this.handleLaserCollisions();

    // 7. Update Collectibles
    const hasMagnet = this.activePowerup && this.activePowerup.type === 'MAGNET';
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.update(dt, hasMagnet ? this.player : null);

      // Collision Check with Player
      if (this.checkCollision(this.player, c)) {
        this.onCollectItem(c);
        this.collectibles.splice(i, 1);
        continue;
      }

      // Despawn off bottom screen
      if (c.y - c.radius > CANVAS_HEIGHT + 30) {
        this.collectibles.splice(i, 1);
      }
    }

    // 8. Update Hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.update(dt, this.player);

      // Collision Check with Player Hull
      if (this.checkCollision(this.player, h)) {
        this.onCollideHazard(h);
        this.hazards.splice(i, 1);
        continue;
      }

      // Despawn off bottom or sides
      if (h.y - h.radius > CANVAS_HEIGHT + 50 || h.x < -60 || h.x > CANVAS_WIDTH + 60) {
        this.hazards.splice(i, 1);
      }
    }

    // 9. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    // 10. Update Floating Text Popups
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.update(dt);
      if (ft.isDead()) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update HUD display
    this.updateHUD();
  }

  // --- 7. WEAPON FIRING & LASER COLLISIONS ---
  fireLaser(x, y, vx, vy, color) {
    this.lasers.push(new Laser(x, y, vx, vy, color));
    window.soundEngine.playLaser();
  }

  handleLaserCollisions() {
    for (let l = this.lasers.length - 1; l >= 0; l--) {
      const laser = this.lasers[l];

      for (let h = this.hazards.length - 1; h >= 0; h--) {
        const hazard = this.hazards[h];

        // Circle-to-point / tip collision
        const dx = laser.x - hazard.x;
        const dy = laser.y - hazard.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= (hazard.radius + laser.radius) * (hazard.radius + laser.radius)) {
          // Remove laser
          this.lasers.splice(l, 1);

          // Damage hazard
          hazard.hp -= laser.damage;
          hazard.hitFlashTimer = 0.12;

          window.soundEngine.playLaserHit();
          this.spawnSparkles(laser.x, laser.y, '#00f0ff', 6);

          // Hazard destroyed!
          if (hazard.hp <= 0) {
            this.onHazardDestroyed(hazard);
            this.hazards.splice(h, 1);
          }
          break; // laser can hit only 1 target
        }
      }
    }
  }

  onHazardDestroyed(hazard) {
    window.soundEngine.playEnemyShatter();

    // Trigger Camera Shake
    this.screenShake = 0.22;
    this.shakeIntensity = hazard.type === 'MINE' ? 6.5 : 4.5;

    // Award destruction points
    const killPoints = (hazard.type === 'MINE' ? 30 : 20) * this.combo;
    this.score += killPoints;
    this.addFloatingText(`+${killPoints}`, hazard.x, hazard.y, '#39ff14');

    // Heavy Shatter Debris Explosion
    this.spawnDebris(hazard.x, hazard.y, hazard.type === 'MINE' ? '#ff3344' : '#94a3b8', 25);

    // --- LOOT DROP MECHANIC ---
    // Destroyed hazards shatter and release high-value minerals!
    const dropCount = hazard.type === 'MINE' ? 2 : 1;
    for (let i = 0; i < dropCount; i++) {
      const isRare = Math.random() < 0.35; // 35% chance for Nova Core
      const dropType = isRare ? 'NOVA_CORE' : 'CRYSTAL';

      const drop = new Collectible(hazard.x, hazard.y, dropType, 1.0);
      // Impart outward scattering velocity
      const scatterAngle = (Math.random() * Math.PI) - (Math.PI / 2); // downward arc
      const scatterSpeed = Math.random() * 80 + 40;
      drop.vx = Math.sin(scatterAngle) * scatterSpeed;
      drop.vy = Math.cos(scatterAngle) * scatterSpeed;
      this.collectibles.push(drop);
    }
  }

  handleSpawning(dt) {
    const difficultyFactor = 1.0 + Math.min(this.gameTime * 0.018, 2.5);

    // Spawn Natural Collectibles
    this.spawnTimerCollectible += dt;
    const collectibleInterval = Math.max(1.2 / (difficultyFactor * 0.8), 0.6);
    if (this.spawnTimerCollectible >= collectibleInterval) {
      this.spawnTimerCollectible = 0;
      const isRare = Math.random() < 0.22;
      this.collectibles.push(new Collectible(
        Math.random() * (CANVAS_WIDTH - 80) + 40,
        -25,
        isRare ? 'NOVA_CORE' : 'CRYSTAL',
        difficultyFactor
      ));
    }

    // Spawn Hazards (Asteroids and Homing Mines)
    this.spawnTimerHazard += dt;
    const hazardInterval = Math.max(1.6 / difficultyFactor, 0.6);
    if (this.spawnTimerHazard >= hazardInterval) {
      this.spawnTimerHazard = 0;
      const isHomingMine = Math.random() < 0.3 && this.gameTime > 8;
      this.hazards.push(new Hazard(
        Math.random() * (CANVAS_WIDTH - 80) + 40,
        -30,
        isHomingMine ? 'MINE' : 'ASTEROID',
        difficultyFactor
      ));
    }

    // Spawn Special Power-ups (Magnet, Shield, or Spread Shot)
    this.spawnTimerPowerup += dt;
    if (this.spawnTimerPowerup >= 12.0 && !this.activePowerup) {
      this.spawnTimerPowerup = 0;
      const roll = Math.random();
      const powerType = roll < 0.35 ? 'SPREAD' : (roll < 0.7 ? 'MAGNET' : 'SHIELD');
      this.collectibles.push(new Collectible(
        Math.random() * (CANVAS_WIDTH - 80) + 40,
        -30,
        powerType,
        difficultyFactor
      ));
    }
  }

  // --- 8. COLLISION DETECTION LOGIC ---
  checkCollision(entityA, entityB) {
    if (!entityA || !entityB) return false;
    const dx = entityA.x - entityB.x;
    const dy = entityA.y - entityB.y;
    const combinedRadius = entityA.radius + entityB.radius;
    return (dx * dx + dy * dy) <= (combinedRadius * combinedRadius);
  }

  // --- 9. GAMEPLAY EVENTS ---
  onCollectItem(item) {
    if (item.type === 'CRYSTAL') {
      const points = 10 * this.combo;
      this.score += points;
      this.combo = Math.min(this.combo + 1, 5);
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      window.soundEngine.playCollect(this.combo);
      this.addFloatingText(`+${points}`, item.x, item.y, '#00f0ff');
      this.spawnSparkles(item.x, item.y, '#00f0ff', 12);

    } else if (item.type === 'NOVA_CORE') {
      const points = 50 * this.combo;
      this.score += points;
      this.combo = Math.min(this.combo + 2, 5);
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      window.soundEngine.playCorePickup();
      this.addFloatingText(`🌟 NOVA CORE +${points}!`, item.x, item.y, '#ffbe0b');
      this.spawnSparkles(item.x, item.y, '#ffbe0b', 24);

    } else if (POWERUP_TYPES[item.type]) {
      const conf = POWERUP_TYPES[item.type];
      this.activePowerup = {
        type: item.type,
        timeLeft: conf.duration,
        maxDuration: conf.duration
      };

      window.soundEngine.playPowerup();
      this.addFloatingText(`${conf.icon} ${conf.name}!`, item.x, item.y, conf.color);
      this.spawnSparkles(item.x, item.y, conf.color, 30);
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('astrominer_high', this.highScore.toString());
    }
  }

  onCollideHazard(hazard) {
    if (this.player.isInvulnerable) return;

    // Check if Plasma Shield is active
    if (this.activePowerup && this.activePowerup.type === 'SHIELD') {
      this.activePowerup = null;
      this.player.triggerInvulnerability(1.2);
      window.soundEngine.playShieldAbsorb();
      this.addFloatingText('🛡️ SHIELD DEFLECTED IMPACT!', this.player.x, this.player.y - 25, '#39ff14');
      this.spawnDebris(hazard.x, hazard.y, '#39ff14', 20);
      return;
    }

    // Hull damage incurred
    this.lives -= 1;
    this.combo = 1; // Penalty
    this.player.triggerInvulnerability(1.8);
    this.screenShake = 0.35;
    this.shakeIntensity = 8.0;

    window.soundEngine.playHit();
    this.addFloatingText('⚠️ HULL DAMAGE! -1 LIFE', this.player.x, this.player.y - 25, '#ff3344');
    this.spawnDebris(hazard.x, hazard.y, '#ff3344', 35);

    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  triggerGameOver() {
    this.state = STATES.GAMEOVER;
    window.soundEngine.stopBGM();
    window.soundEngine.playGameOver();

    this.dom.finalScore.textContent = this.score.toString().padStart(4, '0');
    this.dom.bestScore.textContent = this.highScore.toString().padStart(4, '0');
    this.dom.finalTime.textContent = this.formatTime(this.gameTime);
    this.dom.finalCombo.textContent = `x${this.maxCombo}`;

    this.dom.screenGameOver.classList.add('active');
  }

  // --- 10. VISUAL EFFECTS & PARTICLES ---
  spawnSparkles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 40;
      this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 0.45));
    }
  }

  spawnDebris(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 200 + 60;
      this.particles.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, 0.7, 3.5));
    }
  }

  addFloatingText(text, x, y, color) {
    this.floatingTexts.push(new FloatingText(text, x, y, color));
  }

  // --- 11. HUD DISPLAY UPDATES ---
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateHUD() {
    this.dom.score.textContent = this.score.toString().padStart(4, '0');
    this.dom.high.textContent = this.highScore.toString().padStart(4, '0');
    this.dom.combo.textContent = `x${this.combo}`;
    this.dom.time.textContent = this.formatTime(this.gameTime);

    let livesHtml = '';
    for (let i = 0; i < this.maxLives; i++) {
      livesHtml += `<span class="life-icon" style="opacity: ${i < this.lives ? '1' : '0.2'}">🚀</span>`;
    }
    this.dom.lives.innerHTML = livesHtml;
  }

  updatePowerupHUD() {
    if (this.activePowerup) {
      const conf = POWERUP_TYPES[this.activePowerup.type];
      const pct = Math.max(0, (this.activePowerup.timeLeft / this.activePowerup.maxDuration) * 100);
      this.dom.powerupBar.classList.add('active');
      this.dom.powerupLabel.textContent = `${conf.icon} ${conf.name}`;
      this.dom.powerupFill.style.width = `${pct}%`;
      this.dom.powerupFill.style.background = conf.color;
    } else {
      this.dom.powerupBar.classList.remove('active');
    }
  }

  // --- 12. RENDERING ---
  render() {
    const ctx = this.ctx;
    ctx.save();

    // Camera Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Starfield
    ctx.fillStyle = '#fff';
    for (const star of this.stars) {
      ctx.globalAlpha = star.alpha;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 2. Lasers
    for (const laser of this.lasers) {
      laser.render(ctx, this.showHitboxes);
    }

    // 3. Collectibles
    for (const c of this.collectibles) {
      c.render(ctx, this.showHitboxes);
    }

    // 4. Hazards
    for (const h of this.hazards) {
      h.render(ctx, this.showHitboxes);
    }

    // 5. Player Ship
    if (this.player) {
      this.player.render(ctx, this.showHitboxes, this.activePowerup);
    }

    // 6. Particles
    for (const p of this.particles) {
      p.render(ctx);
    }

    // 7. Floating Texts
    for (const ft of this.floatingTexts) {
      ft.render(ctx);
    }

    ctx.restore();
  }
}

// ============================================================================
// ENTITY CLASSES
// ============================================================================

/**
 * Laser Projectile Class
 */
class Laser {
  constructor(x, y, vx = 0, vy = -700, color = '#00f0ff') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 3;
    this.width = 4;
    this.height = 14;
    this.color = color;
    this.damage = 1;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  isOffscreen() {
    return this.y < -30 || this.x < -30 || this.x > CANVAS_WIDTH + 30;
  }

  render(ctx, showHitbox) {
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;

    // Glowing laser beam
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    ctx.restore();

    if (showHitbox) {
      ctx.save();
      ctx.strokeStyle = '#ff007f';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Player Ship Class
 */
class PlayerShip {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 22;
    this.vx = 0;
    this.vy = 0;
    this.speed = 360;
    this.tilt = 0;

    // Weapon Systems
    this.fireRate = 0.16; // cooldown in seconds
    this.fireTimer = 0.0;

    // Invulnerability
    this.isInvulnerable = false;
    this.invulnerableTimer = 0;
    this.blinkTimer = 0;
  }

  triggerInvulnerability(duration) {
    this.isInvulnerable = true;
    this.invulnerableTimer = duration;
  }

  update(dt, keys, mouse, isShooting, gameEngine) {
    let moveX = 0;
    let moveY = 0;

    if (keys['arrowleft'] || keys['keya']) moveX -= 1;
    if (keys['arrowright'] || keys['keyd']) moveX += 1;
    if (keys['arrowup'] || keys['keyw']) moveY -= 1;
    if (keys['arrowdown'] || keys['keys']) moveY += 1;

    if (mouse.active) {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 8) {
        moveX += (dx / dist) * 1.0;
        moveY += (dy / dist) * 1.0;
      }
    }

    if (moveX !== 0 && moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= len;
      moveY /= len;
    }

    this.vx = moveX * this.speed;
    this.vy = moveY * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(this.radius + 6, Math.min(CANVAS_WIDTH - this.radius - 6, this.x));
    this.y = Math.max(this.radius + 6, Math.min(CANVAS_HEIGHT - this.radius - 6, this.y));

    this.tilt = (this.vx / this.speed) * 0.25;

    // --- WEAPON COOLDOWN & FIRING ---
    this.fireTimer -= dt;
    if (isShooting && this.fireTimer <= 0) {
      this.fireTimer = this.fireRate;

      const hasSpread = gameEngine.activePowerup && gameEngine.activePowerup.type === 'SPREAD';

      if (hasSpread) {
        // Triple Spread Shot: -15 deg, 0 deg, +15 deg
        const spreadSpeed = 720;
        const sin15 = Math.sin(15 * Math.PI / 180);
        const cos15 = Math.cos(15 * Math.PI / 180);

        gameEngine.fireLaser(this.x, this.y - 18, 0, -spreadSpeed, '#ffbe0b');
        gameEngine.fireLaser(this.x - 12, this.y - 10, -spreadSpeed * sin15, -spreadSpeed * cos15, '#ffbe0b');
        gameEngine.fireLaser(this.x + 12, this.y - 10, spreadSpeed * sin15, -spreadSpeed * cos15, '#ffbe0b');
      } else {
        // Standard Twin Plasma Lasers from wingtips
        gameEngine.fireLaser(this.x - 12, this.y - 14, 0, -720, '#00f0ff');
        gameEngine.fireLaser(this.x + 12, this.y - 14, 0, -720, '#00f0ff');
      }
    }

    // Invulnerability timer
    if (this.isInvulnerable) {
      this.invulnerableTimer -= dt;
      this.blinkTimer += dt * 18;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }
  }

  render(ctx, showHitbox, activePowerup) {
    if (this.isInvulnerable && Math.floor(this.blinkTimer) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);

    // 1. Thruster Plasma Flame
    const flameFlicker = Math.random() * 8 + 14;
    ctx.beginPath();
    ctx.moveTo(-7, 18);
    ctx.lineTo(0, 18 + flameFlicker);
    ctx.lineTo(7, 18);
    ctx.closePath();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();

    // 2. Fuselage
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, -26); // Nose
    ctx.lineTo(18, 14);  // Right wing
    ctx.lineTo(8, 18);   // Right engine
    ctx.lineTo(-8, 18);  // Left engine
    ctx.lineTo(-18, 14); // Left wing
    ctx.closePath();

    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f0ff';
    ctx.stroke();

    // Wingtip Cannons
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(-14, -6, 3, 10);
    ctx.fillRect(11, -6, 3, 10);

    // Cockpit
    ctx.beginPath();
    ctx.ellipse(0, -4, 5, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 10;
    ctx.fill();

    // 3. Shield Bubble
    if (activePowerup && activePowerup.type === 'SHIELD') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 15;
      ctx.stroke();

      ctx.fillStyle = 'rgba(57, 255, 20, 0.12)';
      ctx.fill();
    }

    // 4. Tractor Magnet Waves
    if (activePowerup && activePowerup.type === 'MAGNET') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12 + Math.sin(Date.now() * 0.01) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    if (showHitbox) {
      this.renderHitbox(ctx);
    }
  }

  renderHitbox(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
  }
}

/**
 * Collectible Class
 */
class Collectible {
  constructor(x, y, type, difficultyFactor) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.type = type;
    this.speed = (Math.random() * 40 + 90) * difficultyFactor;
    this.rotation = 0;
    this.rotSpeed = Math.random() * 2 - 1;

    switch (type) {
      case 'NOVA_CORE':
        this.radius = 16;
        this.color = '#ffbe0b';
        break;
      case 'MAGNET':
        this.radius = 18;
        this.color = '#00f0ff';
        break;
      case 'SHIELD':
        this.radius = 18;
        this.color = '#39ff14';
        break;
      case 'SPREAD':
        this.radius = 18;
        this.color = '#ffbe0b';
        break;
      default: // CRYSTAL
        this.radius = 13;
        this.color = '#00f0ff';
        break;
    }
  }

  update(dt, playerTarget) {
    // If scattered outward from shattered enemy
    if (this.vx !== 0 || this.vy !== 0) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.94; // drag
      this.vy += 80 * dt; // gravity drift
    } else {
      this.y += this.speed * dt;
    }

    if (playerTarget && (this.type === 'CRYSTAL' || this.type === 'NOVA_CORE')) {
      const dx = playerTarget.x - this.x;
      const dy = playerTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 320) {
        const pullSpeed = 480;
        this.x += (dx / dist) * pullSpeed * dt;
        this.y += (dy / dist) * pullSpeed * dt;
        this.rotation += this.rotSpeed * dt * 3;
        return;
      }
    }

    this.rotation += this.rotSpeed * dt;
  }

  render(ctx, showHitbox) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    if (this.type === 'CRYSTAL') {
      ctx.beginPath();
      ctx.moveTo(0, -this.radius);
      ctx.lineTo(this.radius * 0.75, 0);
      ctx.lineTo(0, this.radius);
      ctx.lineTo(-this.radius * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (this.type === 'NOVA_CORE') {
      ctx.beginPath();
      const spikes = 8;
      const outer = this.radius;
      const inner = this.radius * 0.5;
      for (let i = 0; i < spikes * 2; i++) {
        const r = (i % 2 === 0) ? outer : inner;
        const angle = (i * Math.PI) / spikes;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (this.type === 'MAGNET' || this.type === 'SHIELD' || this.type === 'SPREAD') {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(13, 18, 36, 0.9)';
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = '14px Orbitron';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const icon = this.type === 'MAGNET' ? '🧲' : (this.type === 'SHIELD' ? '🛡️' : '⚡');
      ctx.fillText(icon, 0, 1);
    }

    ctx.restore();

    if (showHitbox) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Destructible Hazard Class (Asteroid & Mine)
 */
class Hazard {
  constructor(x, y, type, difficultyFactor) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.rotation = 0;
    this.pulse = 0;
    this.hitFlashTimer = 0;

    if (type === 'MINE') {
      this.radius = 16;
      this.hp = 1; // 1 hit to destroy
      this.maxHp = 1;
      this.speed = (Math.random() * 30 + 100) * difficultyFactor;
      this.rotSpeed = 1.5;
    } else { // ASTEROID
      this.radius = Math.random() * 12 + 18;
      this.hp = 2; // 2 hits to destroy
      this.maxHp = 2;
      this.speed = (Math.random() * 50 + 80) * difficultyFactor;
      this.rotSpeed = Math.random() * 2 - 1;

      this.vertices = [];
      const numPoints = 8;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i * Math.PI * 2) / numPoints;
        const dist = this.radius * (Math.random() * 0.4 + 0.8);
        this.vertices.push({
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist
        });
      }
    }
  }

  update(dt, playerTarget) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    if (this.type === 'MINE' && playerTarget) {
      const dx = playerTarget.x - this.x;
      this.x += Math.sign(dx) * Math.min(Math.abs(dx), 65) * dt;
      this.y += this.speed * dt;
      this.pulse += dt * 8;
    } else {
      this.y += this.speed * dt;
    }
    this.rotation += this.rotSpeed * dt;
  }

  render(ctx, showHitbox) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    const isFlashing = this.hitFlashTimer > 0;

    if (this.type === 'MINE') {
      ctx.fillStyle = isFlashing ? '#ffffff' : '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.stroke();
        ctx.rotate(Math.PI / 4);
      }

      ctx.beginPath();
      ctx.arc(0, 0, 4 + Math.sin(this.pulse) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3344';
      ctx.shadowColor = '#ff3344';
      ctx.shadowBlur = 12;
      ctx.fill();

    } else {
      ctx.beginPath();
      for (let i = 0; i < this.vertices.length; i++) {
        const v = this.vertices[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fillStyle = isFlashing ? '#ffffff' : (this.hp === 1 ? '#475569' : '#334155');
      ctx.fill();
      ctx.strokeStyle = this.hp === 1 ? '#ef4444' : '#64748b'; // turns cracked red on 1 HP
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crater
      ctx.beginPath();
      ctx.arc(this.radius * 0.25, -this.radius * 0.2, this.radius * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
    }

    ctx.restore();

    if (showHitbox) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff3344';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Particle Class
 */
class Particle {
  constructor(x, y, vx, vy, color, life = 0.5, size = 2.5) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  isDead() {
    return this.life <= 0;
  }

  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Floating Text Popup Class
 */
class FloatingText {
  constructor(text, x, y, color) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.color = color;
    this.life = 0.9;
    this.maxLife = 0.9;
    this.vy = -45;
  }

  update(dt) {
    this.y += this.vy * dt;
    this.life -= dt;
  }

  isDead() {
    return this.life <= 0;
  }

  render(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 13px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// Instantiate game engine on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new AstroMinerGame();
});
