/**
 * @typedef {object} EnemyType
 * @property {string} name - The unique name of the enemy type.
 * @property {number} score - The score awarded for defeating this enemy.
 * @property {number} spawnChanceWeight - Base weight for this enemy to spawn.
 * @property {number[]} color - RGB color array for the enemy.
 * @property {number} size - Visual size of the enemy.
 * @property {number} maxHp - Maximum health points.
 * @property {number} speed - Movement speed.
 * @property {number} damage - Damage dealt by the enemy.
 * @property {number} rarity - Rarity level, used for spawn bias calculation.
 */

/**
 * Defines various enemy types with their distinct attributes.
 * The 'boss' enemy type has a spawnChanceWeight of 0, meaning it's not
 * intended to be chosen through the standard random spawn mechanism.
 *
 * @type {EnemyType[]}
 */
export const ENEMY_TYPES = [
  {
    name: "normal",
    score: 2,
    spawnChanceWeight: 80,
    color: [245, 74, 74],
    size: 32,
    maxHp: 4,
    speed: 100,
    damage: 1,
    rarity: 0, // Common
  },
  {
    name: "fast",
    score: 3,
    spawnChanceWeight: 15,
    color: [248, 175, 39],
    size: 28,
    maxHp: 2,
    speed: 180,
    damage: 1,
    rarity: 1, // Uncommon
  },
  {
    name: "tank",
    score: 4,
    spawnChanceWeight: 10,
    color: [100, 100, 255],
    size: 40,
    maxHp: 10,
    speed: 60,
    damage: 3,
    rarity: 2, // Rare
  },
  {
    name: "rageTank",
    score: 6,
    spawnChanceWeight: 3,
    color: [153, 36, 27],
    size: 36,
    maxHp: 8,
    speed: 45,
    damage: 2,
    rarity: 3, // Very Rare
  },
  {
    name: "boss",
    score: 20,
    spawnChanceWeight: 0, // Boss is ignored by the standard picker
    color: [60, 20, 20],
    size: 80,
    maxHp: 300,
    speed: 80,
    damage: 9,
    rarity: 99, // Rarity value ensures it's not affected by normal rarity bias
  },
];

/**
 * Defines how much the spawn chance of each rarity type is biased
 * as the game progress increases. The index corresponds to the `rarity` property
 * in `ENEMY_TYPES`.
 * E.g., at full progress (progress = 1):
 *  - Normal (rarity 0) enemies get -50% of their base spawn chance.
 *  - Fast (rarity 1) enemies get +20% of their base spawn chance.
 *  - Tank (rarity 2) enemies get +60% of their base spawn chance.
 *  - RageTank (rarity 3) enemies get +100% of their base spawn chance.
 *
 * This effectively makes rarer enemies more common at higher progress.
 */
const RARITY_BIAS_AT_FULL_PROGRESS = [-0.5, 0.2, 0.6, 1.0];

/**
 * Selects a random enemy type from a list, biasing the selection based on
 * game progress and enemy rarity.
 *
 * @param {EnemyType[]} enemyList - The array of possible enemy types to choose from.
 * @param {number} [gameProgress=0] - A value between 0 and 1 indicating game progression.
 *                                    Higher values increase the chance of rarer enemies.
 * @returns {EnemyType} The chosen enemy type, or the first enemy in the list as a fallback.
 */
export function chooseEnemyType(enemyList, gameProgress = 0) {
  // Ensure gameProgress is within the valid range [0, 1].
  const clampedProgress = Math.max(0, Math.min(1, gameProgress));

  // Calculate effective spawn weights for each enemy type,
  // applying rarity bias based on game progress.
  const effectiveWeights = enemyList.map((enemy) => {
    // Boss type explicitly excluded from random spawning pool.
    if (enemy.name === "boss") {
      return 0;
    }

    // Get the bias factor for this enemy's rarity level.
    // Defaults to 0 if rarity is not found in RARITY_BIAS_AT_FULL_PROGRESS.
    const rarityBias = RARITY_BIAS_AT_FULL_PROGRESS[enemy.rarity] ?? 0;

    // Calculate the multiplier for the base spawn chance weight.
    // The multiplier ensures the weight never goes below zero.
    // At progress 0, mult = 1 (no bias).
    // At progress 1, mult = 1 + rarityBias.
    const biasMultiplier = Math.max(0, 1 + clampedProgress * rarityBias);

    return enemy.spawnChanceWeight * biasMultiplier;
  });

  // Calculate the sum of all effective weights.
  const totalWeightSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0);

  // If no valid weights are left (e.g., all are 0),
  // return the first enemy type as a safe fallback.
  if (totalWeightSum <= 0) {
    return enemyList[0];
  }

  // Perform a weighted random roll to pick an enemy type.
  let randomRoll = Math.random() * totalWeightSum;

  for (let i = 0; i < enemyList.length; i++) {
    randomRoll -= effectiveWeights[i];
    // When the randomRoll falls to or below 0, we've found our enemy.
    if (randomRoll <= 0) {
      return enemyList[i];
    }
  }

  // Fallback in case floating point inaccuracies or an edge case
  // prevents a selection within the loop. This should rarely, if ever, be hit.
  return enemyList[0];
}