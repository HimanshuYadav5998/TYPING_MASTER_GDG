// TYPE//TANK Canvas 2D Ballistic Defense Combat Engine
(function() {
  'use strict';

  class TankBattlefield {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = options; // callbacks: onHudUpdate, onGameOver, onSortieEnd

      this.isRunning = false;
      this.isPaused = false;
      this.animationFrameId = null;

      // Combat State
      this.mode = options.mode || 1;
      this.score = 0;
      this.combo = 1;
      this.maxCombo = 1;
      this.hullIntegrity = 100; // 0 - 100
      this.wordsDestroyed = 0;
      this.correctKeystrokes = 0;
      this.totalKeystrokes = 0;
      this.startTime = 0;
      this.elapsedTimeSeconds = 0;

      // Entities
      this.words = [];
      this.bullets = [];
      this.particles = [];
      this.muzzleFlashes = [];
      this.lockedWord = null;

      // Turret & Tank Specs
      this.tankX = 0;
      this.tankY = 0;
      this.barrelAngle = -Math.PI / 2; // -90 deg (straight up)
      this.targetBarrelAngle = -Math.PI / 2;
      this.barrelLength = 48;
      this.barrelWidth = 10;
      this.recoil = 0;
      this.treadAnim = 0;

      // Spawning & Difficulty
      this.lastSpawnTime = 0;
      this.spawnInterval = 2400; // ms
      this.redBonusActive = false;
      this.activeRedWord = null;

      // Visuals & Layout
      this.perimeterY = 0;
      this.screenShake = 0;
      this.lastFrameTime = performance.now();

      // DPR and sizing
      this.dpr = window.devicePixelRatio || 1;

      // Bind loop once
      this._boundLoop = this._loop.bind(this);

      this.resize();
    }

    // Dynamic recalibration of canvas and world coordinates
    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(320, Math.floor(rect.height));

      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(width * this.dpr);
      this.canvas.height = Math.floor(height * this.dpr);
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';

      this.width = width;
      this.height = height;

      // Turret anchored at bottom-center
      this.tankX = width / 2;
      this.tankY = height - 36;
      this.perimeterY = height - 76;
    }

    // Start a new sortie
    start(mode = 1) {
      this.mode = mode;
      this.isRunning = true;
      this.isPaused = false;
      this.score = 0;
      this.combo = 1;
      this.maxCombo = 1;
      this.hullIntegrity = 100;
      this.wordsDestroyed = 0;
      this.correctKeystrokes = 0;
      this.totalKeystrokes = 0;
      this.startTime = performance.now();
      this.elapsedTimeSeconds = 0;

      this.words = [];
      this.bullets = [];
      this.particles = [];
      this.muzzleFlashes = [];
      this.lockedWord = null;
      this.redBonusActive = false;
      this.activeRedWord = null;

      this.barrelAngle = -Math.PI / 2;
      this.targetBarrelAngle = -Math.PI / 2;
      this.recoil = 0;
      this.screenShake = 0;

      this.lastSpawnTime = performance.now() - 1500; // First word drops soon
      this.spawnInterval = 2300;
      this.lastFrameTime = performance.now();

      if (window.WordEngine) {
        window.WordEngine.resetExclusion();
      }

      this.resize();
      this.updateHud();

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.animationFrameId = requestAnimationFrame(this._boundLoop);
    }

    stop() {
      this.isRunning = false;
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    pause() {
      this.isPaused = true;
    }

    resume() {
      if (this.isPaused) {
        this.isPaused = false;
        this.lastFrameTime = performance.now();
      }
    }

    // Main 60 FPS Game Loop
    _loop(currentTime) {
      if (!this.isRunning) return;

      const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
      this.lastFrameTime = currentTime;

      if (!this.isPaused) {
        this.update(dt, currentTime);
      }

      this.render();

      if (this.isRunning) {
        this.animationFrameId = requestAnimationFrame(this._boundLoop);
      }
    }

    // Update combat physics and logic
    update(dt, currentTime) {
      this.elapsedTimeSeconds = (currentTime - this.startTime) / 1000;
      this.treadAnim += dt * 3;

      // Shake decay
      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 25);
      }

      // Dynamic difficulty scaling
      // As more words are destroyed, spawn interval drops from 2300ms to 1100ms
      const speedScale = 1 + Math.min(1.4, (this.wordsDestroyed * 0.035) + (this.elapsedTimeSeconds * 0.005));
      this.spawnInterval = Math.max(1150, 2300 - (this.wordsDestroyed * 40));

      // Spawning logic
      if (currentTime - this.lastSpawnTime > this.spawnInterval) {
        this.spawnWord(speedScale);
        this.lastSpawnTime = currentTime;
      }

      // Update words
      for (let i = this.words.length - 1; i >= 0; i--) {
        const w = this.words[i];
        w.y += w.speed * dt;

        // Check perimeter breach
        if (w.y >= this.perimeterY) {
          this.handlePerimeterBreach(w, i);
        }
      }

      // Check if locked word was removed or invalid
      if (this.lockedWord && !this.words.includes(this.lockedWord)) {
        this.lockedWord = null;
      }

      // Smooth turret rotation towards locked word or default center
      if (this.lockedWord) {
        const charPos = this.getCharacterPosition(this.lockedWord, this.lockedWord.typedIndex);
        const dx = charPos.x - this.tankX;
        const dy = charPos.y - this.tankY;
        let angle = Math.atan2(dy, dx);
        // Clamp to 180° upper hemisphere arc: [-Math.PI * 0.95, -Math.PI * 0.05]
        angle = Math.max(-Math.PI * 0.96, Math.min(-Math.PI * 0.04, angle));
        this.targetBarrelAngle = angle;
      } else {
        this.targetBarrelAngle = -Math.PI / 2;
      }

      // Smooth angular interpolation
      let angleDiff = this.targetBarrelAngle - this.barrelAngle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      this.barrelAngle += angleDiff * Math.min(1, dt * 18);

      // Recoil recovery
      if (this.recoil > 0) {
        this.recoil = Math.max(0, this.recoil - dt * 50);
      }

      // Update bullets
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.progress += dt * b.speed;

        if (b.progress >= 1) {
          // Bullet reached target character!
          this.bullets.splice(i, 1);
          this.createImpactSparks(b.targetX, b.targetY, b.isRed);
        }
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
        p.life -= dt;
        p.alpha = Math.max(0, p.life / p.maxLife);

        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // Update muzzle flashes
      for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
        const mf = this.muzzleFlashes[i];
        mf.life -= dt;
        if (mf.life <= 0) {
          this.muzzleFlashes.splice(i, 1);
        }
      }

      this.updateHud();
    }

    // Spawn a new hostile target
    spawnWord(speedScale) {
      if (this.words.length >= 8) return; // Cap visible threats to prevent clutter

      // Check if red bonus should spawn: 18% chance if no red currently active
      let isRed = false;
      if (!this.redBonusActive && Math.random() < 0.22 && this.words.length > 0) {
        isRed = true;
      }

      const text = window.WordEngine.spawnWord(this.mode, isRed, this.words);
      if (!text) return;

      if (isRed) {
        this.redBonusActive = true;
        this.activeRedWord = text;
        window.WordEngine.notifyRedSpawn(text);
        if (window.SoundFX) {
          window.SoundFX.playRedSpawn();
        }
      }

      // Measure text width in canvas font
      this.ctx.font = 'bold 18px "Share Tech Mono", "VT323", monospace';
      const textMetrics = this.ctx.measureText(text);
      const boxWidth = textMetrics.width + 24;

      // Horizontal position avoiding edge clipping
      const minX = boxWidth / 2 + 30;
      const maxX = this.width - boxWidth / 2 - 30;
      const x = minX + Math.random() * Math.max(10, maxX - minX);

      // Vertical speed: red bonus falls ~1.8x faster
      const baseSpeed = isRed ? 72 : 38;
      const speed = (baseSpeed + Math.random() * 12) * speedScale;

      this.words.push({
        text,
        x,
        y: -15, // Spawn just above top
        speed,
        isRed,
        typedIndex: 0,
        boxWidth,
        textWidth: textMetrics.width,
        charWidth: textMetrics.width / text.length
      });
    }

    // Calculate canvas coordinates of a specific character in a falling word
    getCharacterPosition(word, charIndex) {
      const startX = word.x - word.textWidth / 2;
      const charX = startX + (Math.min(charIndex, word.text.length - 1) + 0.5) * word.charWidth;
      return { x: charX, y: word.y };
    }

    // Keypress routing & Lowest-First targeting
    handleInput(char) {
      if (!this.isRunning || this.isPaused) return;

      this.totalKeystrokes++;

      // CASE A: A word is already locked
      if (this.lockedWord) {
        const expectedChar = this.lockedWord.text[this.lockedWord.typedIndex];
        if (char === expectedChar) {
          this.processCorrectKeystroke(this.lockedWord);
        } else {
          // Incorrent keystroke
          if (window.SoundFX) window.SoundFX.playError();
          this.triggerWordMispress(this.lockedWord);
        }
        return;
      }

      // CASE B: No word currently locked -> inspect all falling words matching first character
      const candidates = this.words.filter(w => w.text[0] === char && w.typedIndex === 0);

      if (candidates.length > 0) {
        // AUTOMATICALLY LOCK ONTO THE LOWEST / BOTTOM-MOST WORD (Highest Y coordinate)
        candidates.sort((a, b) => b.y - a.y);
        const target = candidates[0];

        this.lockedWord = target;
        this.processCorrectKeystroke(target);
      } else {
        // No match
        if (window.SoundFX) window.SoundFX.playError();
      }
    }

    // Process a verified correct keystroke
    processCorrectKeystroke(word) {
      this.correctKeystrokes++;

      const targetPos = this.getCharacterPosition(word, word.typedIndex);

      // Fire ballistic projectile from cannon tip to that specific letter
      this.fireBullet(targetPos.x, targetPos.y, word.isRed);

      // Immediately advance typed character index
      word.typedIndex++;

      if (window.SoundFX) {
        window.SoundFX.playLaserShot();
      }

      // Check if entire word has been destroyed
      if (word.typedIndex >= word.text.length) {
        this.destroyWord(word);
      }
    }

    // Fire ballistic bullet
    fireBullet(targetX, targetY, isRed) {
      // Calculate cannon tip position
      const barrelTipDist = this.barrelLength - this.recoil;
      const tipX = this.tankX + Math.cos(this.barrelAngle) * barrelTipDist;
      const tipY = this.tankY + Math.sin(this.barrelAngle) * barrelTipDist;

      // Add muzzle flash & spark particles at barrel tip
      this.muzzleFlashes.push({
        x: tipX,
        y: tipY,
        angle: this.barrelAngle,
        life: 0.08
      });

      for (let i = 0; i < 6; i++) {
        const spread = (Math.random() - 0.5) * 0.8;
        const sparkSpeed = 90 + Math.random() * 120;
        this.particles.push({
          x: tipX,
          y: tipY,
          vx: Math.cos(this.barrelAngle + spread) * sparkSpeed,
          vy: Math.sin(this.barrelAngle + spread) * sparkSpeed,
          gravity: 50,
          color: isRed ? '#ff4466' : '#33ff88',
          size: 2 + Math.random() * 2,
          life: 0.15 + Math.random() * 0.15,
          maxLife: 0.3
        });
      }

      // Turret recoil kickback
      this.recoil = 12;

      // Ballistic Projectile
      this.bullets.push({
        startX: tipX,
        startY: tipY,
        targetX,
        targetY,
        progress: 0,
        speed: 12, // Reaches target in ~0.08s
        isRed
      });
    }

    // Eliminate a word upon full typing completion
    destroyWord(word) {
      const idx = this.words.indexOf(word);
      if (idx !== -1) {
        this.words.splice(idx, 1);
      }

      this.wordsDestroyed++;
      const basePoints = word.isRed ? 350 : 100;
      this.score += Math.round(basePoints * this.combo);
      this.combo++;
      if (this.combo > this.maxCombo) {
        this.maxCombo = this.combo;
      }

      if (window.SoundFX) {
        window.SoundFX.playExplosion(word.isRed);
      }

      // If red bonus target, notify exclusion resolution
      if (word.isRed) {
        this.redBonusActive = false;
        this.activeRedWord = null;
        window.WordEngine.notifyRedResolved();
      }

      // Unlock turret
      if (this.lockedWord === word) {
        this.lockedWord = null;
      }

      // Shatter explosion particles
      this.createWordShatterExplosion(word);
    }

    // Handle perimeter breach when threat reaches defense line
    handlePerimeterBreach(word, index) {
      this.words.splice(index, 1);

      const damage = word.isRed ? 30 : 20;
      this.hullIntegrity = Math.max(0, this.hullIntegrity - damage);
      this.combo = 1; // Reset combo multiplier
      this.screenShake = 16;

      if (window.SoundFX) {
        window.SoundFX.playHullDamage();
      }

      // If red bonus word, notify exclusion resolution
      if (word.isRed) {
        this.redBonusActive = false;
        this.activeRedWord = null;
        window.WordEngine.notifyRedResolved();
      }

      if (this.lockedWord === word) {
        this.lockedWord = null;
      }

      // Detonation particles along the perimeter barrier
      for (let i = 0; i < 30; i++) {
        const pSpeed = 60 + Math.random() * 200;
        const pAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        this.particles.push({
          x: word.x,
          y: this.perimeterY,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          gravity: 120,
          color: word.isRed ? '#ff2244' : '#ff9900',
          size: 2.5 + Math.random() * 3,
          life: 0.35 + Math.random() * 0.35,
          maxLife: 0.7
        });
      }

      // Check Tank Hull Integrity Defeat
      if (this.hullIntegrity <= 0) {
        this.handleTankDestroyed();
      }
    }

    // Tank integrity zero: catastrophic explosion and sortie termination
    handleTankDestroyed() {
      this.isRunning = false;
      this.screenShake = 28;

      if (window.SoundFX) {
        window.SoundFX.playExplosion(true);
      }

      // Mega death particle blast
      for (let i = 0; i < 90; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 40 + Math.random() * 280;
        this.particles.push({
          x: this.tankX,
          y: this.tankY,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          gravity: 80,
          color: i % 2 === 0 ? '#ff3344' : '#ffaa00',
          size: 3 + Math.random() * 4,
          life: 0.6 + Math.random() * 0.7,
          maxLife: 1.3
        });
      }

      // Transition to Result debrief screen after short death sequence
      setTimeout(() => {
        if (this.options.onGameOver) {
          const stats = this.getSortieMetrics();
          this.options.onGameOver(stats);
        }
      }, 1200);
    }

    // Particle explosions on bullet hit
    createImpactSparks(x, y, isRed) {
      for (let i = 0; i < 10; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 110;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 60,
          color: isRed ? '#ff3366' : '#55ff99',
          size: 2 + Math.random() * 2,
          life: 0.2 + Math.random() * 0.2,
          maxLife: 0.4
        });
      }
    }

    // Shatter entire word into exploding characters
    createWordShatterExplosion(word) {
      for (let i = 0; i < word.text.length; i++) {
        const charPos = this.getCharacterPosition(word, i);
        const char = word.text[i];
        for (let k = 0; k < 6; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 140;
          this.particles.push({
            x: charPos.x,
            y: charPos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 40,
            gravity: 120,
            color: word.isRed ? '#ff2255' : '#00ff88',
            size: 3 + Math.random() * 3,
            life: 0.35 + Math.random() * 0.35,
            maxLife: 0.7,
            char: k === 0 ? char : null
          });
        }
      }
    }

    triggerWordMispress(word) {
      word.mispressTimer = 0.15;
    }

    // Metrics computation
    getSortieMetrics() {
      const minutes = Math.max(0.01, this.elapsedTimeSeconds / 60);
      const wpm = Math.round((this.correctKeystrokes / 5) / minutes);
      const accuracy = this.totalKeystrokes > 0 
        ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100) 
        : 100;

      return {
        score: this.score,
        wpm,
        accuracy,
        wordsDestroyed: this.wordsDestroyed,
        maxCombo: this.maxCombo,
        mode: this.mode,
        durationSeconds: Math.round(this.elapsedTimeSeconds)
      };
    }

    // Send real-time statistics to the top HUD
    updateHud() {
      if (this.options.onHudUpdate) {
        const minutes = Math.max(0.005, this.elapsedTimeSeconds / 60);
        const liveWpm = Math.round((this.correctKeystrokes / 5) / minutes);
        const accuracy = this.totalKeystrokes > 0 
          ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100) 
          : 100;

        this.options.onHudUpdate({
          score: this.score,
          combo: this.combo,
          hullIntegrity: this.hullIntegrity,
          liveWpm,
          accuracy,
          wordsDestroyed: this.wordsDestroyed
        });
      }
    }

    // ==========================================
    // RENDER PASS (Canvas 2D)
    // ==========================================
    render() {
      const ctx = this.ctx;
      const dpr = this.dpr;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Apply screen shake offset
      if (this.screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * this.screenShake;
        const shakeY = (Math.random() - 0.5) * this.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // Clear Canvas with subtle deep dark grid background
      ctx.fillStyle = '#020503';
      ctx.fillRect(0, 0, this.width, this.height);

      this.drawRadarGrid(ctx);
      this.drawPerimeterDefense(ctx);
      this.drawBullets(ctx);
      this.drawFallingWords(ctx);
      this.drawParticles(ctx);
      this.drawTankTurret(ctx);

      ctx.restore();
    }

    // Tactical background radar grid
    drawRadarGrid(ctx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 80, 25, 0.16)';
      ctx.lineWidth = 1;

      const gridSize = 40;
      for (let x = 0; x < this.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
      for (let y = 0; y < this.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();
      }

      // Radar range arcs centered at tank
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.04)';
      ctx.lineWidth = 1.5;
      [120, 220, 320, 420].forEach(radius => {
        ctx.beginPath();
        ctx.arc(this.tankX, this.tankY, radius, Math.PI, 0);
        ctx.stroke();
      });

      ctx.restore();
    }

    // High-tech laser perimeter defense wire
    drawPerimeterDefense(ctx) {
      ctx.save();
      const pY = this.perimeterY;

      // Glow beam
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);
      const isCritical = this.hullIntegrity <= 25;
      const beamColor = isCritical 
        ? `rgba(255, 40, 40, ${pulse})` 
        : `rgba(0, 255, 120, ${pulse * 0.75})`;

      ctx.shadowBlur = 10;
      ctx.shadowColor = isCritical ? '#ff2244' : '#00ff88';
      ctx.strokeStyle = beamColor;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(0, pY);
      ctx.lineTo(this.width, pY);
      ctx.stroke();

      // Warning hash marks
      ctx.strokeStyle = isCritical ? 'rgba(255, 60, 60, 0.3)' : 'rgba(0, 255, 100, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 10; x < this.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, pY - 4);
        ctx.lineTo(x + 10, pY + 4);
        ctx.stroke();
      }

      // Warning text badge
      ctx.font = '10px "VT323", monospace';
      ctx.fillStyle = isCritical ? '#ff3344' : 'rgba(0, 255, 100, 0.5)';
      ctx.textAlign = 'right';
      ctx.fillText('[ DEFENSE PERIMETER // ACTIVE ]', this.width - 15, pY - 8);

      ctx.restore();
    }

    // Render falling words with DOS brackets, glowing cursor and 35-40% opacity on typed characters
    drawFallingWords(ctx) {
      ctx.save();
      ctx.font = 'bold 18px "Share Tech Mono", "VT323", monospace';
      ctx.textBaseline = 'middle';

      this.words.forEach(w => {
        const isLocked = this.lockedWord === w;
        const boxH = 30;
        const boxW = w.boxWidth;
        const boxX = w.x - boxW / 2;
        const boxY = w.y - boxH / 2;

        ctx.save();

        // Threat Box Background
        const baseColor = w.isRed ? '#ff2244' : '#00ff88';
        ctx.fillStyle = w.isRed ? 'rgba(50, 6, 12, 0.82)' : 'rgba(4, 24, 10, 0.82)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        // Bracketed Border
        ctx.strokeStyle = isLocked ? '#ffffff' : baseColor;
        ctx.lineWidth = isLocked ? 2 : 1;
        if (isLocked) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = w.isRed ? '#ff2244' : '#00ff88';
        }

        // Draw tactical bracketed corners: [  ]
        const cornerLen = 6;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(boxX, boxY + cornerLen);
        ctx.lineTo(boxX, boxY);
        ctx.lineTo(boxX + cornerLen, boxY);
        // Top-right
        ctx.moveTo(boxX + boxW - cornerLen, boxY);
        ctx.lineTo(boxX + boxW, boxY);
        ctx.lineTo(boxX + boxW, boxY + cornerLen);
        // Bottom-right
        ctx.moveTo(boxX + boxW, boxY + boxH - cornerLen);
        ctx.lineTo(boxX + boxW, boxY + boxH);
        ctx.lineTo(boxX + boxW - cornerLen, boxY + boxH);
        // Bottom-left
        ctx.moveTo(boxX + cornerLen, boxY + boxH);
        ctx.lineTo(boxX, boxY + boxH);
        ctx.lineTo(boxX, boxY + boxH - cornerLen);
        ctx.stroke();

        // Bonus indicator badge on top of red words
        if (w.isRed) {
          ctx.font = '10px "VT323", monospace';
          ctx.fillStyle = '#ff2244';
          ctx.textAlign = 'center';
          ctx.fillText('★ 3.5x BONUS ★', w.x, boxY - 8);
          ctx.font = 'bold 18px "Share Tech Mono", "VT323", monospace';
        }

        // Draw Locked Reticle indicator
        if (isLocked) {
          ctx.font = '12px "VT323", monospace';
          ctx.fillStyle = '#00f0ff';
          ctx.textAlign = 'left';
          ctx.fillText('►LOCK', boxX - 42, w.y);
          ctx.textAlign = 'right';
          ctx.fillText('◄', boxX + boxW + 15, w.y);
          ctx.font = 'bold 18px "Share Tech Mono", "VT323", monospace';
        }

        // Render characters one by one
        // EXACT REQUIREMENT: Typed characters immediately fade to ~35-40% opacity while remaining letters stay crisp
        const startX = w.x - w.textWidth / 2;
        ctx.textAlign = 'center';

        for (let i = 0; i < w.text.length; i++) {
          const char = w.text[i];
          const charCenterX = startX + (i + 0.5) * w.charWidth;

          if (i < w.typedIndex) {
            // ALREADY TYPED: Faded to ~35-40% opacity!
            ctx.fillStyle = w.isRed 
              ? 'rgba(255, 60, 80, 0.38)' 
              : 'rgba(0, 255, 120, 0.36)';
            ctx.fillText(char, charCenterX, w.y);
          } else if (i === w.typedIndex && isLocked) {
            // CURRENT ACTIVE CHARACTER: Bright with glowing cursor indicator
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = w.isRed ? '#ff2244' : '#00ff88';
            ctx.fillText(char, charCenterX, w.y);

            // Pulsing cursor underline beneath active char
            const cursorAlpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.015);
            ctx.fillStyle = `rgba(0, 240, 255, ${cursorAlpha})`;
            ctx.fillRect(charCenterX - w.charWidth * 0.45, w.y + 10, w.charWidth * 0.9, 2.5);
            ctx.shadowBlur = 0;
          } else {
            // UNTYPED CHARACTERS: Full crisp brightness
            ctx.fillStyle = w.isRed ? '#ff3355' : '#00ff88';
            ctx.fillText(char, charCenterX, w.y);
          }
        }

        ctx.restore();
      });

      ctx.restore();
    }

    // Draw active ballistic bullets
    drawBullets(ctx) {
      ctx.save();
      this.bullets.forEach(b => {
        const curX = b.startX + (b.targetX - b.startX) * b.progress;
        const curY = b.startY + (b.targetY - b.startY) * b.progress;

        const trailLen = 0.22;
        const trailStartX = b.startX + (b.targetX - b.startX) * Math.max(0, b.progress - trailLen);
        const trailStartY = b.startY + (b.targetY - b.startY) * Math.max(0, b.progress - trailLen);

        // Tracer beam line
        const grad = ctx.createLinearGradient(trailStartX, trailStartY, curX, curY);
        grad.addColorStop(0, 'rgba(0, 255, 150, 0)');
        grad.addColorStop(1, b.isRed ? '#ff4466' : '#55ffaa');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(trailStartX, trailStartY);
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Glowing bullet tip
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = b.isRed ? '#ff2255' : '#00ff88';
        ctx.beginPath();
        ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Render Semicircular Dome Tank & 180° Rotating Turret
    drawTankTurret(ctx) {
      ctx.save();
      const tx = this.tankX;
      const ty = this.tankY;

      // 1. Tank Chassis Base (Treads & Hull Plate)
      const chassisW = 86;
      const chassisH = 22;

      // Tread base
      ctx.fillStyle = '#0a1a0e';
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.fillRect(tx - chassisW / 2, ty + 6, chassisW, chassisH);
      ctx.strokeRect(tx - chassisW / 2, ty + 6, chassisW, chassisH);

      // Tread track wheel teeth
      const treadStep = 10;
      const treadOffset = (this.treadAnim * 8) % treadStep;
      ctx.fillStyle = '#00aa55';
      for (let x = tx - chassisW / 2 + 4; x < tx + chassisW / 2 - 4; x += treadStep) {
        ctx.fillRect(x + treadOffset * 0.2, ty + 10, 5, chassisH - 8);
      }

      // 2. Turret Rotating Cannon Barrel
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(this.barrelAngle);

      // Recoil displacement along barrel axis
      const barrelRecoil = -this.recoil;

      // Barrel shadow/glow
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#00ff88';

      // Twin-plate active barrel
      ctx.fillStyle = '#0d2814';
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.fillRect(barrelRecoil, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);
      ctx.strokeRect(barrelRecoil, -this.barrelWidth / 2, this.barrelLength, this.barrelWidth);

      // Barrel Muzzle Brake
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(barrelRecoil + this.barrelLength - 6, -this.barrelWidth / 2 - 2, 8, this.barrelWidth + 4);

      // Barrel center groove line
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barrelRecoil + 6, 0);
      ctx.lineTo(barrelRecoil + this.barrelLength - 8, 0);
      ctx.stroke();

      ctx.restore(); // back to world coords

      // 3. Semicircular Dome Turret (Centered at tx, ty)
      const domeRadius = 32;

      // Semicircle arc (top hemisphere: PI to 0)
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ff88';
      ctx.fillStyle = '#081e0e';
      ctx.beginPath();
      ctx.arc(tx, ty + 6, domeRadius, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Armor plate lines on the dome
      ctx.strokeStyle = 'rgba(0, 255, 120, 0.4)';
      ctx.lineWidth = 1.5;
      [-16, 0, 16].forEach(dx => {
        ctx.beginPath();
        ctx.moveTo(tx + dx, ty + 6);
        ctx.lineTo(tx + dx * 0.7, ty - domeRadius * 0.65);
        ctx.stroke();
      });

      // Central glowing commander dome / core reactor
      const corePulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.008);
      ctx.fillStyle = `rgba(0, 255, 120, ${corePulse})`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00ff88';
      ctx.beginPath();
      ctx.arc(tx, ty + 2, 8, 0, Math.PI * 2);
      ctx.fill();

      // Hull integrity status ring around dome
      ctx.strokeStyle = this.hullIntegrity > 50 
        ? '#00ff88' 
        : (this.hullIntegrity > 25 ? '#ffaa00' : '#ff2244');
      ctx.lineWidth = 2;
      ctx.beginPath();
      const healthArc = (this.hullIntegrity / 100) * Math.PI;
      ctx.arc(tx, ty + 6, domeRadius + 4, Math.PI, Math.PI + healthArc);
      ctx.stroke();

      // 4. Muzzle flashes
      this.muzzleFlashes.forEach(mf => {
        ctx.save();
        ctx.translate(mf.x, mf.y);
        ctx.rotate(mf.angle);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#00ff88';

        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(24, 0);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      ctx.restore();
    }

    // Render particles
    drawParticles(ctx) {
      ctx.save();
      this.particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.char) {
          ctx.font = 'bold 14px "VT323", monospace';
          ctx.fillText(p.char, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();
    }
  }

  window.TankBattlefield = TankBattlefield;
})();
