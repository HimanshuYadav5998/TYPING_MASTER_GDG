// TYPE//TANK Pure LocalStorage Engine for Callsign, Arsenal & Flight Logs
(function() {
  'use strict';

  const STORAGE_KEYS = {
    CALLSIGN: 'typetank_callsign',
    SETTINGS: 'typetank_settings',
    LOGS: 'typetank_flight_logs'
  };

  const DEFAULT_SETTINGS = {
    mode: 1, // 1: Alpha, 2: Bravo, 3: Charlie, 4: Delta
    aspectRatio: 'auto', // 'auto', '16-9', '4-3'
    crtEnabled: true,
    matrix: {
      uppercase: false,
      numbers: false,
      specials: false
    }
  };

  const Storage = {
    // 1. Callsign
    getCallsign() {
      try {
        return localStorage.getItem(STORAGE_KEYS.CALLSIGN) || '';
      } catch (e) {
        return '';
      }
    },

    setCallsign(name) {
      const clean = (name || '').trim().toUpperCase().slice(0, 12) || 'PILOT-01';
      try {
        localStorage.setItem(STORAGE_KEYS.CALLSIGN, clean);
      } catch (e) {}
      return clean;
    },

    // 2. Settings
    getSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...DEFAULT_SETTINGS, ...parsed };
        }
      } catch (e) {}
      return { ...DEFAULT_SETTINGS };
    },

    saveSettings(settings) {
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      } catch (e) {}
    },

    // 3. Flight Logs & Records
    getRecords() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (e) {}
      return [];
    },

    // Get personal best for a specific mode or overall
    getPersonalBest(mode = null) {
      const logs = this.getRecords();
      const filtered = mode ? logs.filter(l => l.mode === mode) : logs;
      if (filtered.length === 0) return null;
      return filtered.reduce((best, cur) => (cur.score > best.score ? cur : best), filtered[0]);
    },

    // Add a new sortie debrief record. Returns evaluation of whether it's a new personal best.
    addRecord(entry) {
      const logs = this.getRecords();
      const previousPB = this.getPersonalBest(entry.mode);
      const isNewPB = !previousPB || entry.score > previousPB.score;

      const newRecord = {
        id: 'LOG-' + Date.now().toString(36).toUpperCase(),
        callsign: entry.callsign || this.getCallsign() || 'OPERATOR',
        timestamp: Date.now(),
        dateStr: new Date().toISOString().slice(0, 16).replace('T', ' '),
        mode: entry.mode,
        score: entry.score,
        wpm: entry.wpm,
        accuracy: entry.accuracy,
        wordsDestroyed: entry.wordsDestroyed,
        maxCombo: entry.maxCombo,
        durationSeconds: entry.durationSeconds || 0,
        isPB: isNewPB
      };

      // Unshift newest first
      logs.unshift(newRecord);

      // Keep up to 100 most recent records to prevent storage limits
      if (logs.length > 100) {
        logs.length = 100;
      }

      try {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      } catch (e) {}

      return {
        isNewPB,
        previousPB: previousPB ? { ...previousPB } : null,
        record: newRecord
      };
    },

    // Get lifetime stats for the operator
    getLifetimeStats() {
      const logs = this.getRecords();
      if (logs.length === 0) {
        return {
          totalSorties: 0,
          bestScore: 0,
          bestWpm: 0,
          peakAccuracy: 0,
          totalWordsDestroyed: 0,
          modeBests: { 1: null, 2: null, 3: null, 4: null }
        };
      }

      let bestScore = 0;
      let bestWpm = 0;
      let peakAccuracy = 0;
      let totalWords = 0;
      const modeBests = { 1: null, 2: null, 3: null, 4: null };

      logs.forEach(log => {
        if (log.score > bestScore) bestScore = log.score;
        if (log.wpm > bestWpm) bestWpm = log.wpm;
        if (log.accuracy > peakAccuracy) peakAccuracy = log.accuracy;
        totalWords += (log.wordsDestroyed || 0);

        if (!modeBests[log.mode] || log.score > modeBests[log.mode].score) {
          modeBests[log.mode] = log;
        }
      });

      return {
        totalSorties: logs.length,
        bestScore,
        bestWpm,
        peakAccuracy,
        totalWordsDestroyed: totalWords,
        modeBests
      };
    },

    // Purge records
    purgeLogs() {
      try {
        localStorage.removeItem(STORAGE_KEYS.LOGS);
      } catch (e) {}
    }
  };

  window.TypingStorage = Storage;
})();
