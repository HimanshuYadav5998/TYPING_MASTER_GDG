// TYPE//TANK Word Dictionaries & Exclusion Engine
(function() {
  'use strict';

  // Mode 1 [Alpha]: Strictly lowercase military, cyber, and combat terms
  const MODE_1_WORDS = [
    'tank', 'radar', 'artillery', 'recon', 'drone', 'armor', 'missile', 'bunker',
    'stealth', 'patrol', 'turret', 'ballistic', 'sector', 'salvo', 'tactical',
    'perimeter', 'breach', 'flank', 'strike', 'convoy', 'mortar', 'cipher',
    'sentry', 'intercept', 'barrage', 'defend', 'target', 'cannon', 'blast',
    'vector', 'shield', 'escort', 'vanguard', 'outpost', 'commando', 'fortress',
    'garrison', 'platoon', 'brigade', 'infantry', 'caliber', 'payload', 'shrapnel',
    'ambush', 'trench', 'airdrop', 'sonar', 'jammer', 'recoil', 'bullet',
    'assault', 'hazard', 'beacon', 'flare', 'dynamo', 'battery', 'chassis',
    'reactor', 'sensor', 'trigger', 'rocket', 'torpedo', 'howitzer', 'grenade'
  ];

  // Mode 2 [Bravo]: Mixed-case military callsigns, operations, and combat units
  const MODE_2_WORDS = [
    'Tank', 'RadarX', 'DeltaForce', 'GhostNine', 'SkyHawk', 'BlackOps', 'AlphaOne',
    'ViperSix', 'RedAlert', 'IronDome', 'NightStalker', 'StormBreaker', 'TitanMech',
    'ShadowOps', 'ApexPredator', 'CyberShield', 'ZeroHour', 'WarHammer', 'OmegaCore',
    'StrikeForce', 'EchoBase', 'BravoLead', 'FrontLine', 'FireStorm', 'DeathWatch',
    'ThunderBolt', 'BattleGroup', 'NightRaven', 'AegisCore', 'SteelRain', 'HavocSquad',
    'OverWatch', 'PhantomUnit', 'SolarFlare', 'RogueTroop', 'VortexOne', 'CommandPost',
    'RapidStrike', 'DarkMatter', 'SilverBlade', 'LaserFocus', 'CrimsonTide', 'IronFist'
  ];

  // Mode 3 [Charlie]: Mixed-case with tactical numerals, coordinates, calibers, and unit designations
  const MODE_3_WORDS = [
    'Squad5', 'Tank99', 'Sector7G', 'Mech01', 'B52', 'M1A2', 'T90', 'AK47',
    'F22Raptor', 'Sub9', 'Zone101', 'Grid42', 'Unit88', 'Base404', 'Salvo3',
    'Armor77', 'Kilo9', 'Delta50', 'Ops247', 'Code999', 'Patrol12', 'Radar360',
    'Cannon105', 'Rocket8', 'Falcon9', 'Target7', 'Sentry3', 'Vector45', 'Bunker13',
    'Mortar60', 'Platoon4', 'Drone202', 'Armor55', 'Volt24', 'Core500', 'Strike77',
    'Chassis8', 'Fort99', 'Pilot01', 'Echo7', 'Fox3', 'Viper21', 'Zero7'
  ];

  // Mode 4 [Delta]: Full tactical syntax with brackets, arithmetic, symbols, hyphens, and operators
  const MODE_4_WORDS = [
    '[tank-01]', '(8+9)', '{cmd-9}', '!alert!', '<def-7>', '#target1', '[recon:4]',
    '[bunker#2]', '(12*3)', '[salvo-9]', '{fire_now}', '!lock-on!', '<grid:88>',
    '[vanguard+1]', '*strike*', '(ammo=99)', '[base/alpha]', '{shield:9}', '!code#42!',
    '[t-72b]', '[f-35c]', '<radar:360>', '{ping-ack}', '[ops.09]', '(15/3)',
    '!breach!', '[armor:max]', '{recoil-0}', '<hostile#1>', '[turret_x]', '!salvo!',
    '(hp+50)', '[sector_9]', '{kilo-4}', '!danger!', '<flank:left>', '[unit_07]',
    '#missile-2', '[overlord!]', '{emp.wave}'
  ];

  // Active Red bonus word exclusion state
  let activeRedInitial = null;
  let exclusionCooldownUntil = 0; // timestamp until when initial char is blocked

  const WordEngine = {
    // Return sample words for a given mode index (1-4)
    getPreviewWords(modeIndex) {
      switch (modeIndex) {
        case 1:
          return MODE_1_WORDS.slice(0, 10);
        case 2:
          return MODE_2_WORDS.slice(0, 10);
        case 3:
          return MODE_3_WORDS.slice(0, 10);
        case 4:
          return MODE_4_WORDS.slice(0, 10);
        default:
          return MODE_1_WORDS.slice(0, 10);
      }
    },

    // Notify when a red bonus word has spawned
    notifyRedSpawn(word) {
      if (word && word.length > 0) {
        activeRedInitial = word[0];
      }
    },

    // Notify when red bonus target has resolved (eliminated or breached perimeter)
    notifyRedResolved() {
      if (activeRedInitial) {
        // Enforce 3000ms cooldown window after resolution
        exclusionCooldownUntil = Date.now() + 3000;
        // Keep activeRedInitial tracked until cooldown expires
        setTimeout(() => {
          if (Date.now() >= exclusionCooldownUntil) {
            activeRedInitial = null;
          }
        }, 3000);
      }
    },

    // Reset exclusion state when restarting or leaving game
    resetExclusion() {
      activeRedInitial = null;
      exclusionCooldownUntil = 0;
    },

    // Check if a starting character is currently under red exclusion
    isCharacterExcluded(char) {
      if (!activeRedInitial) return false;
      const isBlocked = (char === activeRedInitial) || 
                        (char.toLowerCase() === activeRedInitial.toLowerCase());
      if (!isBlocked) return false;

      // Check if cooldown has passed
      if (Date.now() > exclusionCooldownUntil && exclusionCooldownUntil > 0) {
        activeRedInitial = null;
        return false;
      }
      return true;
    },

    // Get candidate word list for a mode
    getWordList(modeIndex) {
      switch (modeIndex) {
        case 1: return MODE_1_WORDS;
        case 2: return MODE_2_WORDS;
        case 3: return MODE_3_WORDS;
        case 4: return MODE_4_WORDS;
        default: return MODE_1_WORDS;
      }
    },

    // Generate a valid word that doesn't conflict with currently active words or red exclusions
    spawnWord(modeIndex, isRedBonus, existingActiveWords = []) {
      const list = this.getWordList(modeIndex);
      const activeTexts = new Set(existingActiveWords.map(w => w.text));
      const activeFirstChars = new Set(existingActiveWords.map(w => w.text[0]));

      // Shuffle list clone
      const pool = [...list].sort(() => 0.5 - Math.random());

      for (const candidate of pool) {
        // Avoid duplicate words on screen
        if (activeTexts.has(candidate)) continue;

        const firstChar = candidate[0];

        // If not red, check if first char is currently under red target exclusion
        if (!isRedBonus && this.isCharacterExcluded(firstChar)) {
          continue;
        }

        // For red bonus targets: cannot pick a first character that is already falling
        if (isRedBonus && activeFirstChars.has(firstChar)) {
          continue;
        }

        return candidate;
      }

      // Fallback if all candidates are constrained
      for (const candidate of pool) {
        if (!activeTexts.has(candidate)) return candidate;
      }

      return pool[0];
    }
  };

  window.WordEngine = WordEngine;
})();
