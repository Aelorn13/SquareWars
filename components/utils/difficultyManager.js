export const difficultySettings = {
  easy: {
    name: 'Easy',
    spawnInterval: { start: 3, end: 0.8 },
    enemyStatMultiplier: { start: 0.75, end: 1.25 },
    bossSpawnTime: 120,
  },
  normal: {
    name: 'Normal',
    spawnInterval: { start: 2, end: 0.2 },
    enemyStatMultiplier: { start: 1.0, end: 2.0 },
    bossSpawnTime: 100,
  },
  hard: {
    name: 'Hard',
    spawnInterval: { start: 1.5, end: 0.1 },
    enemyStatMultiplier: { start: 1.2, end: 2.7 },
    scoreStatMultiplier: { start: 1.5, end: 3.0 }, 
    bossSpawnTime: 90,
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