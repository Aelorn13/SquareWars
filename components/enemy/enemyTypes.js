export const enemyTypes = [
  {
    name: "normal",
    score: 1,
    SpawnChanceWeight: 80,
    color: [245, 74, 74],
    size: 32,
    maxHp: 4,
    speed: 100,
    damage: 1,
    rarity: 0, // common
  },
  {
    name: "fast",
    score: 1,
    SpawnChanceWeight: 15,
    color: [248, 175, 39],
    size: 28,
    maxHp: 2,
    speed: 180,
    damage: 1,
    rarity: 1, // uncommon
  },
  {
    name: "tank",
    score: 2,
    SpawnChanceWeight: 10,
    color: [100, 100, 255],
    size: 40,
    maxHp: 10,
    speed: 60,
    damage: 3,
    rarity: 2, // rare
  },
  {
    name: "rageTank",
    score: 3,
    SpawnChanceWeight: 3,
    color: [153, 36, 27],
    size: 36,
    maxHp: 8,
    speed: 45,
    damage: 2,
    rarity: 3, // very rare
  },
  {
    name: "boss",
    score: 20,
    SpawnChanceWeight: 0,
    color: [40, 40, 40],
    size: 80,
    maxHp: 100,
    speed: 80,
    damage: 9,
    rarity: 99, // ignored by picker in normal spawns
  },
];

// Bias per rarity at full progress (progress = 1)
// normal→-50%, fast→+20%, tank→+60%, rageTank→+100%
const rarityBias = [-0.5, 0.2, 0.6, 1.0];
// [-0.3, 0.1, 0.3, 0.6] → subtle
// [-0.7, 0.4, 0.9, 1.6] → strong
export function chooseEnemyType(list, progress = 0) {
  // Clamp progress
  progress = Math.max(0, Math.min(1, progress));

  // Build weighted list using biased chances
  const weights = list.map((t) => {
    if (t.name === "boss") return 0; // never pick boss via random pool
    const bias = rarityBias[t.rarity] ?? 0;
    const mult = Math.max(0, 1 + progress * bias);
    return t.SpawnChanceWeight * mult;
  });

  const total = weights.reduce((s, w) => s + w, 0);
  // fallback: no weights? just return first
  if (total <= 0) return list[0];

  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return list[i];
  }
  return list[0];
}
