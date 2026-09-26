// TYPE//TANK Master Application Controller, State Machine & Keyboard Routing
(function() {
  'use strict';

  // Application State
  const state = {
    currentScreen: 'login', // 'login', 'settings', 'instructions', 'game', 'result', 'records'
    callsign: '',
    settings: {
      mode: 1,
      aspectRatio: 'auto',
      crtEnabled: true,
      matrix: {
        uppercase: false,
        numbers: false,
        specials: false
      }
    },
    activeFilterMode: 0, // 0: All, 1: Mode 1, 2: Mode 2, 3: Mode 3, 4: Mode 4
    battlefield: null,
    lastSortieStats: null,
    confettiParticles: [],
    confettiAnimationId: null
  };

  // DOM Elements cache
  let dom = {};

  // Confetti celebration engine for New Personal Best
  function launchRecordCelebration() {
    const canvas = dom.confettiCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    state.confettiParticles = [];
    const colors = ['#00ff88', '#00f0ff', '#ff0055', '#ffcc00', '#ffffff', '#b366ff'];

    for (let i = 0; i < 180; i++) {
      state.confettiParticles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 16,
        vy: -8 - Math.random() * 14,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        life: 1,
        decay: 0.006 + Math.random() * 0.008
      });
    }

    if (state.confettiAnimationId) {
      cancelAnimationFrame(state.confettiAnimationId);
    }

    function renderConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      state.confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;
        p.life -= p.decay;

        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        state.confettiAnimationId = requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        state.confettiAnimationId = null;
      }
    }

    renderConfetti();
  }

  // Sync mode matrix toggles bi-directionally
  function syncMatrixWithMode(mode) {
    switch (mode) {
      case 1:
        state.settings.matrix = { uppercase: false, numbers: false, specials: false };
        break;
      case 2:
        state.settings.matrix = { uppercase: true, numbers: false, specials: false };
        break;
      case 3:
        state.settings.matrix = { uppercase: true, numbers: true, specials: false };
        break;
      case 4:
        state.settings.matrix = { uppercase: true, numbers: true, specials: true };
        break;
    }
  }

  function syncModeWithMatrix() {
    const m = state.settings.matrix;
    if (m.specials) {
      state.settings.mode = 4;
      m.uppercase = true;
      m.numbers = true;
    } else if (m.numbers) {
      state.settings.mode = 3;
      m.uppercase = true;
    } else if (m.uppercase) {
      state.settings.mode = 2;
    } else {
      state.settings.mode = 1;
    }
  }

  // Update Settings UI elements
  function updateSettingsUI() {
    // Mode cards active state
    dom.modeCards.forEach(card => {
      const cardMode = parseInt(card.dataset.mode, 10);
      if (cardMode === state.settings.mode) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Matrix toggles
    if (dom.chkUpper) dom.chkUpper.checked = state.settings.matrix.uppercase;
    if (dom.chkNumbers) dom.chkNumbers.checked = state.settings.matrix.numbers;
    if (dom.chkSpecials) dom.chkSpecials.checked = state.settings.matrix.specials;

    // Aspect ratio buttons in settings
    dom.aspectBtns.forEach(btn => {
      if (btn.dataset.aspect === state.settings.aspectRatio) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update dynamic preview bar
    if (dom.previewWordsContainer && window.WordEngine) {
      const words = window.WordEngine.getPreviewWords(state.settings.mode);
      dom.previewWordsContainer.innerHTML = words.map(w => `<span class="preview-chip">${escapeHtml(w)}</span>`).join(' ');
    }

    // Persist settings
    if (window.TypingStorage) {
      window.TypingStorage.saveSettings(state.settings);
    }
  }

  // Apply Aspect Ratio Mode to Cabinet Container
  function setAspectRatio(ratio) {
    state.settings.aspectRatio = ratio;
    const cabinet = dom.arcadeCabinet;
    if (cabinet) {
      cabinet.classList.remove('aspect-auto', 'aspect-16-9', 'aspect-4-3');
      if (ratio === '16-9') {
        cabinet.classList.add('aspect-16-9');
      } else if (ratio === '4-3') {
        cabinet.classList.add('aspect-4-3');
      } else {
        cabinet.classList.add('aspect-auto');
      }
    }

    // Update Header Aspect Button text
    if (dom.headerAspectBtn) {
      const label = ratio === '16-9' ? '16:9' : (ratio === '4-3' ? '4:3' : 'AUTO');
      dom.headerAspectBtn.textContent = `[ASPECT: ${label}]`;
    }

    updateSettingsUI();

    // Trigger canvas recalibration
    if (state.battlefield) {
      setTimeout(() => state.battlefield.resize(), 50);
    }
  }

  // Toggle CRT Scanlines
  function setCrtEnabled(enabled) {
    state.settings.crtEnabled = !!enabled;
    const overlay = dom.crtOverlay;
    if (overlay) {
      if (state.settings.crtEnabled) {
        overlay.classList.remove('crt-off');
      } else {
        overlay.classList.add('crt-off');
      }
    }
    if (dom.headerCrtBtn) {
      dom.headerCrtBtn.textContent = `[CRT: ${state.settings.crtEnabled ? 'ON' : 'OFF'}]`;
    }
    if (window.TypingStorage) {
      window.TypingStorage.saveSettings(state.settings);
    }
  }

  // Set Callsign
  function setOperatorCallsign(name) {
    const clean = window.TypingStorage.setCallsign(name);
    state.callsign = clean;
    if (dom.headerCallsign) {
      dom.headerCallsign.textContent = clean;
    }
    if (dom.loginInput) {
      dom.loginInput.value = clean;
    }
  }

  // Screen Navigator
  function switchScreen(screenName) {
    if (window.SoundFX) {
      window.SoundFX.playMenuClick();
    }

    state.currentScreen = screenName;

    // Hide all screen sections
    dom.screens.forEach(screen => {
      screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // Screen specific logic
    if (screenName === 'login') {
      if (dom.loginInput) {
        setTimeout(() => dom.loginInput.focus(), 80);
      }
    } else if (screenName === 'settings') {
      updateSettingsUI();
    } else if (screenName === 'game') {
      // Sync HUD callsign and mode badge
      const hudCs = document.getElementById('hud-callsign');
      const hudMode = document.getElementById('hud-mode-badge');
      const modeNames = { 1: 'M1:ALPHA', 2: 'M2:BRAVO', 3: 'M3:CHARLIE', 4: 'M4:DELTA' };
      if (hudCs) hudCs.textContent = state.callsign || 'PILOT-01';
      if (hudMode) hudMode.textContent = modeNames[state.settings.mode] || 'M1:ALPHA';
      if (state.battlefield) {
        state.battlefield.start(state.settings.mode);
      }
    } else if (screenName === 'result') {
      renderDebriefScreen();
    } else if (screenName === 'records') {
      renderRecordsScreen();
    }
  }

  // Update Game Top HUD
  function handleHudUpdate(metrics) {
    if (dom.hudScore) dom.hudScore.textContent = metrics.score.toString().padStart(6, '0');
    if (dom.hudCombo) dom.hudCombo.textContent = `x${metrics.combo}`;
    if (dom.hudWpm) dom.hudWpm.textContent = metrics.liveWpm;
    if (dom.hudAccuracy) dom.hudAccuracy.textContent = `${metrics.accuracy}%`;

    // Health bar reactive colors
    if (dom.hudHealthFill) {
      dom.hudHealthFill.style.width = `${metrics.hullIntegrity}%`;
      dom.hudHealthText.textContent = `${metrics.hullIntegrity}%`;

      dom.hudHealthFill.classList.remove('health-good', 'health-warn', 'health-critical');
      if (metrics.hullIntegrity > 50) {
        dom.hudHealthFill.classList.add('health-good');
      } else if (metrics.hullIntegrity > 25) {
        dom.hudHealthFill.classList.add('health-warn');
      } else {
        dom.hudHealthFill.classList.add('health-critical');
      }
    }
  }

  // Sortie Game Over Callback
  function handleGameOver(stats) {
    state.lastSortieStats = stats;

    // Save record to LocalStorage
    const saveResult = window.TypingStorage.addRecord({
      callsign: state.callsign,
      mode: stats.mode,
      score: stats.score,
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      wordsDestroyed: stats.wordsDestroyed,
      maxCombo: stats.maxCombo,
      durationSeconds: stats.durationSeconds
    });

    state.lastSortieStats.isNewPB = saveResult.isNewPB;
    state.lastSortieStats.previousPB = saveResult.previousPB;

    switchScreen('result');
  }

  // Debrief Screen Rendering & Personal Best Celebration
  function renderDebriefScreen() {
    const stats = state.lastSortieStats;
    if (!stats) return;

    if (dom.resScore) dom.resScore.textContent = stats.score.toString().padStart(6, '0');
    if (dom.resWpm) dom.resWpm.textContent = stats.wpm;
    if (dom.resAccuracy) dom.resAccuracy.textContent = `${stats.accuracy}%`;
    if (dom.resWords) dom.resWords.textContent = stats.wordsDestroyed;
    if (dom.resCombo) dom.resCombo.textContent = `x${stats.maxCombo}`;
    if (dom.resMode) {
      const modeNames = { 1: '1 [ALPHA]', 2: '2 [BRAVO]', 3: '3 [CHARLIE]', 4: '4 [DELTA]' };
      dom.resMode.textContent = modeNames[stats.mode] || stats.mode;
    }

    // Arcade Record Celebration evaluation
    if (stats.isNewPB) {
      if (dom.resBanner) {
        dom.resBanner.className = 'record-banner pb-celebration';
        dom.resBanner.innerHTML = '★ NEW PERSONAL BEST ACHIEVED! ★';
      }
      if (dom.resDelta) {
        dom.resDelta.innerHTML = `<span class="text-neon">ALL-TIME HIGH SCORE FOR MODE ${stats.mode}!</span>`;
      }
      // Victory Fanfare audio
      if (window.SoundFX) {
        window.SoundFX.playVictoryFanfare();
      }
      // Confetti burst
      launchRecordCelebration();
    } else {
      if (dom.resBanner) {
        dom.resBanner.className = 'record-banner debrief-normal';
        dom.resBanner.innerHTML = '+---[ SORTIE TERMINATED ]---+';
      }
      if (dom.resDelta && stats.previousPB) {
        const scoreDiff = stats.previousPB.score - stats.score;
        if (scoreDiff > 0) {
          dom.resDelta.innerHTML = `PERSONAL BEST: <span class="text-white">${stats.previousPB.score.toLocaleString()} PTS</span> (${stats.previousPB.wpm} WPM) &bull; <span class="text-amber">+${scoreDiff} PTS NEEDED TO SURPASS</span>`;
        } else {
          dom.resDelta.innerHTML = `<span class="text-neon">SURPASSED PREVIOUS BEST: ${stats.previousPB.score.toLocaleString()} PTS</span>`;
        }
      } else if (dom.resDelta) {
        dom.resDelta.textContent = 'SORTIE LOGGED IN OPERATOR FLIGHT RECORDS.';
      }
    }
  }

  // Render My Records / Flight Logs Screen
  function renderRecordsScreen() {
    const lifetime = window.TypingStorage.getLifetimeStats();

    if (dom.recBestScore) dom.recBestScore.textContent = lifetime.bestScore.toLocaleString();
    if (dom.recMaxWpm) dom.recMaxWpm.textContent = lifetime.bestWpm;
    if (dom.recPeakAcc) dom.recPeakAcc.textContent = `${lifetime.peakAccuracy}%`;
    if (dom.recTotalWords) dom.recTotalWords.textContent = lifetime.totalWordsDestroyed.toLocaleString();
    if (dom.recTotalSorties) dom.recTotalSorties.textContent = lifetime.totalSorties;

    // Mode Bests Quad
    [1, 2, 3, 4].forEach(m => {
      const el = document.getElementById(`mode-pb-${m}`);
      if (el) {
        const pb = lifetime.modeBests[m];
        if (pb) {
          el.innerHTML = `<span class="pb-score">${pb.score.toLocaleString()} PTS</span><span class="pb-sub">${pb.wpm} WPM &bull; ${pb.accuracy}%</span>`;
        } else {
          el.innerHTML = `<span class="pb-none">NO DATA</span>`;
        }
      }
    });

    renderFlightLogTable();
  }

  // Render Flight Log Table with Active Mode Filter
  function renderFlightLogTable() {
    const logs = window.TypingStorage.getRecords();
    const filter = state.activeFilterMode;
    const filtered = filter === 0 ? logs : logs.filter(l => l.mode === filter);

    if (!dom.recordsTableBody) return;

    if (filtered.length === 0) {
      dom.recordsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-dim">-- NO FLIGHT LOGS RECORDED FOR THIS CRITERIA --</td></tr>`;
      return;
    }

    const modeLabels = { 1: 'ALPHA', 2: 'BRAVO', 3: 'CHARLIE', 4: 'DELTA' };

    dom.recordsTableBody.innerHTML = filtered.map(log => {
      const pbTag = log.isPB ? '<span class="badge-pb">★ PB</span>' : '';
      return `
        <tr>
          <td>${log.dateStr || new Date(log.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge-mode">M${log.mode}:${modeLabels[log.mode]}</span></td>
          <td class="text-score">${log.score.toLocaleString()} ${pbTag}</td>
          <td class="text-wpm">${log.wpm}</td>
          <td>${log.accuracy}%</td>
          <td>x${log.maxCombo || 1}</td>
          <td>${log.wordsDestroyed || 0}</td>
        </tr>
      `;
    }).join('');
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  // Keyboard routing across application states
  function handleKeyDown(e) {
    // If modal is open, let modal handle it
    if (dom.callsignModal && dom.callsignModal.classList.contains('active')) {
      if (e.key === 'Escape') {
        dom.callsignModal.classList.remove('active');
      } else if (e.key === 'Enter') {
        const val = dom.modalCallsignInput.value.trim();
        if (val) {
          setOperatorCallsign(val);
          dom.callsignModal.classList.remove('active');
        }
      }
      return;
    }

    const key = e.key;

    // --- SCREEN: LOGIN ---
    if (state.currentScreen === 'login') {
      if (key === 'Enter') {
        const val = dom.loginInput.value.trim();
        if (val) {
          setOperatorCallsign(val);
        }
        switchScreen('settings');
      }
      return;
    }

    // --- SCREEN: SETTINGS ---
    if (state.currentScreen === 'settings') {
      if (key === '1') {
        state.settings.mode = 1;
        syncMatrixWithMode(1);
        updateSettingsUI();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      } else if (key === '2') {
        state.settings.mode = 2;
        syncMatrixWithMode(2);
        updateSettingsUI();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      } else if (key === '3') {
        state.settings.mode = 3;
        syncMatrixWithMode(3);
        updateSettingsUI();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      } else if (key === '4') {
        state.settings.mode = 4;
        syncMatrixWithMode(4);
        updateSettingsUI();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      } else if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        switchScreen('instructions');
      }
      return;
    }

    // --- SCREEN: INSTRUCTIONS ---
    if (state.currentScreen === 'instructions') {
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        switchScreen('game');
      } else if (key === 'Escape') {
        switchScreen('settings');
      }
      return;
    }

    // --- SCREEN: GAME ARENA ---
    if (state.currentScreen === 'game') {
      if (key === 'Escape') {
        // Abort sortie confirmation / end
        if (confirm('ABORT COMBAT SORTIE? CURRENT COMBAT PROGRESS WILL BE TERMINATED.')) {
          if (state.battlefield) {
            state.battlefield.stop();
            handleGameOver(state.battlefield.getSortieMetrics());
          }
        }
        return;
      }

      // Single printable character keystroke during gameplay
      if (key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (state.battlefield) {
          state.battlefield.handleInput(key);
        }
      }
      return;
    }

    // --- SCREEN: RESULT ---
    if (state.currentScreen === 'result') {
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        switchScreen('game');
      } else if (key === 'r' || key === 'R') {
        switchScreen('records');
      } else if (key === 's' || key === 'S' || key === 'Escape') {
        switchScreen('settings');
      }
      return;
    }

    // --- SCREEN: RECORDS ---
    if (state.currentScreen === 'records') {
      if (key === 'Escape' || key === 'Enter' || key === 'Backspace') {
        switchScreen('settings');
      }
      return;
    }
  }

  // Initialize and attach DOM Event Listeners
  function init() {
    dom = {
      arcadeCabinet: document.getElementById('arcade-cabinet'),
      crtOverlay: document.getElementById('crt-overlay'),
      confettiCanvas: document.getElementById('confetti-canvas'),
      gameCanvas: document.getElementById('game-canvas'),
      screens: document.querySelectorAll('.screen-section'),

      // Header controls
      headerCallsign: document.getElementById('header-callsign-display'),
      headerSwitchBtn: document.getElementById('btn-switch-callsign'),
      headerAspectBtn: document.getElementById('btn-toggle-aspect'),
      headerCrtBtn: document.getElementById('btn-toggle-crt'),
      headerAudioBtn: document.getElementById('btn-toggle-audio'),
      headerLogsBtn: document.getElementById('btn-header-logs'),

      // Login screen
      loginInput: document.getElementById('input-callsign'),
      loginBtn: document.getElementById('btn-login-proceed'),

      // Settings screen
      modeCards: document.querySelectorAll('.mode-card'),
      chkUpper: document.getElementById('chk-matrix-uppercase'),
      chkNumbers: document.getElementById('chk-matrix-numbers'),
      chkSpecials: document.getElementById('chk-matrix-specials'),
      aspectBtns: document.querySelectorAll('.btn-aspect-choice'),
      previewWordsContainer: document.getElementById('preview-words-list'),
      settingsProceedBtn: document.getElementById('btn-settings-proceed'),

      // Instructions screen
      briefingEngageBtn: document.getElementById('btn-briefing-engage'),
      briefingBackBtn: document.getElementById('btn-briefing-back'),

      // Game Top HUD
      hudScore: document.getElementById('hud-score-val'),
      hudCombo: document.getElementById('hud-combo-val'),
      hudWpm: document.getElementById('hud-wpm-val'),
      hudAccuracy: document.getElementById('hud-accuracy-val'),
      hudHealthFill: document.getElementById('hud-health-fill'),
      hudHealthText: document.getElementById('hud-health-text'),

      // Result screen
      resBanner: document.getElementById('result-banner-title'),
      resScore: document.getElementById('res-score-val'),
      resWpm: document.getElementById('res-wpm-val'),
      resAccuracy: document.getElementById('res-accuracy-val'),
      resWords: document.getElementById('res-words-val'),
      resCombo: document.getElementById('res-combo-val'),
      resMode: document.getElementById('res-mode-val'),
      resDelta: document.getElementById('result-delta-msg'),
      btnPlayAgain: document.getElementById('btn-play-again'),
      btnOpenRecords: document.getElementById('btn-open-records'),
      btnResultSettings: document.getElementById('btn-result-settings'),

      // Records screen
      recBestScore: document.getElementById('stat-best-score'),
      recMaxWpm: document.getElementById('stat-max-wpm'),
      recPeakAcc: document.getElementById('stat-peak-acc'),
      recTotalWords: document.getElementById('stat-total-words'),
      recTotalSorties: document.getElementById('stat-total-sorties'),
      recordsTableBody: document.getElementById('table-records-body'),
      filterTabs: document.querySelectorAll('.filter-tab'),
      btnPurgeLogs: document.getElementById('btn-purge-logs'),
      btnRecordsBack: document.getElementById('btn-records-back'),

      // Callsign Switch Modal
      callsignModal: document.getElementById('modal-callsign'),
      modalCallsignInput: document.getElementById('modal-callsign-input'),
      modalSaveBtn: document.getElementById('modal-callsign-save'),
      modalCancelBtn: document.getElementById('modal-callsign-cancel')
    };

    // Load initial settings and callsign from storage
    if (window.TypingStorage) {
      state.settings = window.TypingStorage.getSettings();
      state.callsign = window.TypingStorage.getCallsign();
    }

    if (state.callsign) {
      setOperatorCallsign(state.callsign);
    } else {
      setOperatorCallsign('PILOT-01');
    }

    // Apply stored Aspect Ratio
    setAspectRatio(state.settings.aspectRatio || 'auto');

    // Apply stored CRT
    setCrtEnabled(state.settings.crtEnabled !== false);

    // Audio Mute sync
    if (window.SoundFX && dom.headerAudioBtn) {
      dom.headerAudioBtn.textContent = `[AUDIO: ${window.SoundFX.isMuted() ? 'OFF' : 'ON'}]`;
    }

    // Initialize Canvas Battlefield Engine
    if (dom.gameCanvas && window.TankBattlefield) {
      state.battlefield = new window.TankBattlefield(dom.gameCanvas, {
        mode: state.settings.mode,
        onHudUpdate: handleHudUpdate,
        onGameOver: handleGameOver
      });
    }

    // Resize handler for dynamic canvas recalibration
    window.addEventListener('resize', () => {
      if (dom.confettiCanvas) {
        dom.confettiCanvas.width = window.innerWidth;
        dom.confettiCanvas.height = window.innerHeight;
      }
      if (state.battlefield) {
        state.battlefield.resize();
      }
    });

    // Keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    // First user click to unlock AudioContext
    window.addEventListener('pointerdown', () => {
      if (window.SoundFX) {
        window.SoundFX.init();
      }
    }, { once: true });

    // HEADER BUTTON EVENTS
    if (dom.headerSwitchBtn) {
      dom.headerSwitchBtn.addEventListener('click', () => {
        if (dom.callsignModal) {
          dom.modalCallsignInput.value = state.callsign;
          dom.callsignModal.classList.add('active');
          dom.modalCallsignInput.focus();
        }
      });
    }

    if (dom.headerAspectBtn) {
      dom.headerAspectBtn.addEventListener('click', () => {
        const next = state.settings.aspectRatio === 'auto' 
          ? '16-9' 
          : (state.settings.aspectRatio === '16-9' ? '4-3' : 'auto');
        setAspectRatio(next);
        if (window.SoundFX) window.SoundFX.playMenuClick();
      });
    }

    if (dom.headerCrtBtn) {
      dom.headerCrtBtn.addEventListener('click', () => {
        setCrtEnabled(!state.settings.crtEnabled);
        if (window.SoundFX) window.SoundFX.playMenuClick();
      });
    }

    if (dom.headerAudioBtn) {
      dom.headerAudioBtn.addEventListener('click', () => {
        if (window.SoundFX) {
          const muted = window.SoundFX.toggleMute();
          dom.headerAudioBtn.textContent = `[AUDIO: ${muted ? 'OFF' : 'ON'}]`;
        }
      });
    }

    if (dom.headerLogsBtn) {
      dom.headerLogsBtn.addEventListener('click', () => {
        switchScreen('records');
      });
    }

    // LOGIN BUTTONS
    if (dom.loginBtn) {
      dom.loginBtn.addEventListener('click', () => {
        const val = dom.loginInput.value.trim();
        if (val) setOperatorCallsign(val);
        switchScreen('settings');
      });
    }

    // SETTINGS MODE CARDS
    dom.modeCards.forEach(card => {
      card.addEventListener('click', () => {
        const m = parseInt(card.dataset.mode, 10);
        state.settings.mode = m;
        syncMatrixWithMode(m);
        updateSettingsUI();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      });
    });

    // SETTINGS MATRIX TOGGLES
    const handleMatrixChange = () => {
      state.settings.matrix.uppercase = dom.chkUpper.checked;
      state.settings.matrix.numbers = dom.chkNumbers.checked;
      state.settings.matrix.specials = dom.chkSpecials.checked;
      syncModeWithMatrix();
      updateSettingsUI();
      if (window.SoundFX) window.SoundFX.playMenuClick();
    };

    if (dom.chkUpper) dom.chkUpper.addEventListener('change', handleMatrixChange);
    if (dom.chkNumbers) dom.chkNumbers.addEventListener('change', handleMatrixChange);
    if (dom.chkSpecials) dom.chkSpecials.addEventListener('change', handleMatrixChange);

    // SETTINGS ASPECT BUTTONS
    dom.aspectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        setAspectRatio(btn.dataset.aspect);
        if (window.SoundFX) window.SoundFX.playMenuClick();
      });
    });

    if (dom.settingsProceedBtn) {
      dom.settingsProceedBtn.addEventListener('click', () => {
        switchScreen('instructions');
      });
    }

    // INSTRUCTIONS BUTTONS
    if (dom.briefingEngageBtn) {
      dom.briefingEngageBtn.addEventListener('click', () => {
        switchScreen('game');
      });
    }
    if (dom.briefingBackBtn) {
      dom.briefingBackBtn.addEventListener('click', () => {
        switchScreen('settings');
      });
    }

    // RESULT BUTTONS
    if (dom.btnPlayAgain) {
      dom.btnPlayAgain.addEventListener('click', () => {
        switchScreen('game');
      });
    }
    if (dom.btnOpenRecords) {
      dom.btnOpenRecords.addEventListener('click', () => {
        switchScreen('records');
      });
    }
    if (dom.btnResultSettings) {
      dom.btnResultSettings.addEventListener('click', () => {
        switchScreen('settings');
      });
    }

    // RECORDS SCREEN
    dom.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilterMode = parseInt(tab.dataset.filter, 10);
        renderFlightLogTable();
        if (window.SoundFX) window.SoundFX.playMenuClick();
      });
    });

    if (dom.btnPurgeLogs) {
      dom.btnPurgeLogs.addEventListener('click', () => {
        if (confirm('CONFIRM PURGE: WIPE ALL FLIGHT LOGS AND HISTORICAL RECORDS PERMANENTLY?')) {
          window.TypingStorage.purgeLogs();
          renderRecordsScreen();
          if (window.SoundFX) window.SoundFX.playHullDamage();
        }
      });
    }

    if (dom.btnRecordsBack) {
      dom.btnRecordsBack.addEventListener('click', () => {
        switchScreen('settings');
      });
    }

    // CALLSIGN MODAL
    if (dom.modalSaveBtn) {
      dom.modalSaveBtn.addEventListener('click', () => {
        const val = dom.modalCallsignInput.value.trim();
        if (val) {
          setOperatorCallsign(val);
          dom.callsignModal.classList.remove('active');
        }
      });
    }

    if (dom.modalCancelBtn) {
      dom.modalCancelBtn.addEventListener('click', () => {
        dom.callsignModal.classList.remove('active');
      });
    }

    // INITIAL SCREEN ROUTE
    // If callsign already exists in localStorage, user can go directly to Settings or Login
    if (state.callsign && state.callsign !== 'PILOT-01') {
      switchScreen('settings');
    } else {
      switchScreen('login');
    }
  }

  // Auto initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.App = {
    switchScreen,
    setAspectRatio,
    setCrtEnabled
  };
})();
