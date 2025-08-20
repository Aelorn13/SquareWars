// components/enemy/enemyTypes.js
export const enemyTypes = [
  {
    name: "normal",
    score: 1,
    chance: 80,
    color: [245, 74, 74],
    size: 32,
    maxHp: 4,
    speed: 100,
    damage: 1,
  },
  {
    name: "fast",
    score: 1,
    chance: 15,
    color: [248, 175, 39],
    size: 28,
    maxHp: 2,
    speed: 180,
    damage: 1,
  },
  {
    name: "tank",
    score: 2,
    chance: 10,
    color: [100, 100, 255],
    size: 40,
    maxHp: 10,
    speed: 60,
    damage: 3,
  },
  {
    name: "rageTank",
    score: 3,
    chance: 3,
    color: [153, 36, 27],
    size: 36,
    maxHp: 8,
    speed: 45,
    damage: 2,
  },
  {
    name: "boss",
    score: 20,
    chance: 0,
    color: [40, 40, 40], // your latest value
    size: 80,
    maxHp: 100,
    speed: 80,
    damage: 9,
  },
];

export function chooseEnemyType(list) {
  const totalChance = list.reduce((sum, t) => sum + t.chance, 0);
  const roll = Math.random() * totalChance;
  let sum = 0;
  for (const t of list) {
    sum += t.chance;
    if (roll < sum) return t;
  }
  return list[0];
}
