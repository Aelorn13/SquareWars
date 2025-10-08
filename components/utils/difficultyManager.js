export const difficultySettings = {
  easy: {
    name: 'Easy',
    // Spawn interval scales from 3s down to 0.8s
    spawnInterval: { start: 3, end: 0.8 },
    // Enemy stats scale up by 50% over the course of the game
    enemyStatMultiplier: { start: 0.75, end: 1.25 },
    bossSpawnTime: 120,
  },
  normal: {
    name: 'Normal',
    // Spawn interval scales from 2s down to 0.2s
    spawnInterval: { start: 2, end: 0.2 },
    // Enemy stats scale up by 100% (double) over the course of the game
    enemyStatMultiplier: { start: 1.0, end: 2.0 },
    bossSpawnTime: 100,
  },
  hard: {
    name: 'Hard',
    // Spawn interval scales from 1.5s down to 0.1s
    spawnInterval: { start: 1.5, end: 0.1 },
    // Enemy stats scale up by 150% over the course of the game
    enemyStatMultiplier: { start: 1.2, end: 2.7 },
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