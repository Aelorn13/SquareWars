//difficultyManager.js
export const difficultySettings = {
  easy: {
    name: 'Easy',
    spawnInterval: { start: 3, end: 0.8 },
    enemyStatMultiplier: { start: 0.75, end: 1.25 },
    bossSpawnTime: 120,
    endlessScaling: {
      statMultiplierRate: 4,
      spawnIntervalDecay: 6,
    }
  },
  normal: {
    name: 'Normal',
    spawnInterval: { start: 2, end: 0.2 },
    enemyStatMultiplier: { start: 1.0, end: 2.0 },
    bossSpawnTime: 100,
    endlessScaling: {
      statMultiplierRate: 3.5,
      spawnIntervalDecay: 10,
    }
  },
  hard: {
    name: 'Nightmare',
    spawnInterval: { start: 1.6, end: 0.1 },
    enemyStatMultiplier: { start: 1.0, end: 2.7 },
    scoreStatMultiplier: { start: 1.5, end: 3.0 }, 
    bossSpawnTime: 90,
    endlessScaling: {
      statMultiplierRate: 3,
      spawnIntervalDecay: 9,
    }
  }
};

let currentDifficulty = 'normal';

export function getSelectedDifficultyConfig() {
    // In a real implementation, this would read  or a menu selection
    return difficultySettings[currentDifficulty];
}

export function setCurrentDifficulty(difficulty) {
    if (difficultySettings[difficulty]) {
        currentDifficulty = difficulty;
    } else {
        console.error(`Attempted to set an invalid difficulty: ${difficulty}`);
    }
}