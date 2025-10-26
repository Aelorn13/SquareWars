
// ===== utils/difficultyManager.js =====
export const difficultySettings = {
  easy: {
    name: 'Easy',
    bossSpawnTime: 120,
    
    // HP Scaling
    hp: {
      start: 0.75,      // 75% HP at start
      end: 1.25,        // 125% HP at boss spawn
      endlessRate: 4,   // Slower growth in endless
    },
    
    // Speed Scaling
    speed: {
      start: 0.8,       // 80% speed at start
      end: 1.2,         // 120% speed at boss spawn
      endlessRate: 3,   // Moderate growth in endless
    },
    
    // Spawn Rate
    spawnInterval: {
      start: 3.0,       // 3 seconds between spawns initially
      end: 0.8,         // 0.8 seconds at boss spawn
      endlessDecay: 6,  // Slower decay in endless
    },
    
    // Score multiplier (optional)
    scoreMultiplier: { start: 1.0, end: 1.5 },
  },

  normal: {
    name: 'Normal',
    bossSpawnTime: 100,
    
    hp: {
      start: 0.9,
      end: 2.0,
      endlessRate: 3.5,
    },
    
    speed: {
      start: 0.9,
      end: 1.5,
      endlessRate: 2.5,
    },
    
    spawnInterval: {
      start: 2.0,
      end: 0.2,
      endlessDecay: 10,
    },
    
    scoreMultiplier: { start: 1.0, end: 2.0 },
  },

  hard: {
    name: 'Nightmare',
    bossSpawnTime: 90,
    
    hp: {
      start: 1.0,
      end: 2.7,
      endlessRate: 3,
    },
    
    speed: {
      start: 1.0,
      end: 1.8,
      endlessRate: 2,
    },
    
    spawnInterval: {
      start: 1.6,
      end: 0.1,
      endlessDecay: 9,
    },
    
    scoreMultiplier: { start: 1.5, end: 3.0 },
  },
};

let currentDifficulty = 'normal';

export function getSelectedDifficultyConfig() {
  return difficultySettings[currentDifficulty];
}

export function setCurrentDifficulty(difficulty) {
  if (difficultySettings[difficulty]) {
    currentDifficulty = difficulty;
  } else {
    console.error(`Invalid difficulty: ${difficulty}`);
  }
}