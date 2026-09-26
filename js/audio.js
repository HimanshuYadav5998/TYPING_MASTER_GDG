// TYPE//TANK Native Web Audio API Sound Synthesizer
(function() {
  'use strict';

  let audioCtx = null;
  let isMuted = false;
  let masterGain = null;

  // Initialize or resume AudioContext upon first user gesture
  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        masterGain = audioCtx.createGain();
        masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
        masterGain.connect(audioCtx.destination);
      }
    } else if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Load mute state from storage
  try {
    const savedMute = localStorage.getItem('typetank_audio_muted');
    if (savedMute !== null) {
      isMuted = savedMute === 'true';
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  const SoundFX = {
    init() {
      initAudio();
    },

    isMuted() {
      return isMuted;
    },

    toggleMute() {
      isMuted = !isMuted;
      try {
        localStorage.setItem('typetank_audio_muted', isMuted);
      } catch (e) {}

      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
      }
      return isMuted;
    },

    setMuted(muted) {
      isMuted = !!muted;
      try {
        localStorage.setItem('typetank_audio_muted', isMuted);
      } catch (e) {}

      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(isMuted ? 0 : 0.7, audioCtx.currentTime);
      }
    },

    // 1. High-frequency laser shot for normal keystrokes
    playLaserShot() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      // Fast downward pitch sweep: 1200Hz down to 220Hz
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.09);
    },

    // 2. Heavy metallic thump / explosion on word elimination
    playExplosion(isRed = false) {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const duration = isRed ? 0.45 : 0.35;

      // Noise buffer for blast crunch
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isRed ? 1800 : 1200, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(isRed ? 0.6 : 0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);

      // Deep sub-bass drop sine wave
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(isRed ? 180 : 140, now);
      subOsc.frequency.exponentialRampToValueAtTime(35, now + duration);

      subGain.gain.setValueAtTime(0.7, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      subOsc.connect(subGain);
      subGain.connect(masterGain);

      whiteNoise.start(now);
      subOsc.start(now);
      whiteNoise.stop(now + duration);
      subOsc.stop(now + duration);
    },

    // 3. High-pitched dual-tone chime on red bonus word spawn
    playRedSpawn() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const freqs = [880, 1318.5, 1760]; // A5, E6, A6 fanfare chime

      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.19);
      });
    },

    // 4. Low crunch / screen shake buzz on damage impact
    playHullDamage() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const duration = 0.38;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(55, now + duration);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(300, now);
      filter.Q.setValueAtTime(2, now);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration);
    },

    // 5. Multi-tone triumphant fanfare for new records
    playVictoryFanfare() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      // 8-bit victory arpeggio: C5, E5, G5, B5, C6 triumph
      const notes = [
        { f: 523.25, d: 0.10, t: 0 },
        { f: 659.25, d: 0.10, t: 0.10 },
        { f: 783.99, d: 0.10, t: 0.20 },
        { f: 987.77, d: 0.12, t: 0.30 },
        { f: 1046.50, d: 0.45, t: 0.42 }
      ];

      notes.forEach(n => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startTime = now + n.t;

        osc.type = 'square';
        osc.frequency.setValueAtTime(n.f, startTime);

        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.d);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + n.d + 0.02);
      });
    },

    // 6. Soft retro terminal click on UI buttons and menus
    playMenuClick() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.03);
    },

    // 7. Low error beep for incorrect typing
    playError() {
      if (isMuted) return;
      initAudio();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.07);
    }
  };

  window.SoundFX = SoundFX;
})();
