// requiredDps.js
export function calcRequiredDPS(ENEMY_CONFIGS, opts = {}) {
  const {
    progress = 0,                  // 0..1 (use your spawnProgress)
    initialSpawnInterval = 1.0,    // e.g. 1.0s at start
    minimalSpawnInterval = 0.2,    // from your code
    ease = (p) => p * p,          // matches easedProgress have to be changed if it changes
    safetyFactor = 1.15,          // extra margin (tune)
    desiredTTK = null,            // seconds per enemy if you want TTK target
    targetingEfficiency = 1.0,    // fraction of DPS effectively reducing global incoming HP
    smallOnSpawnerDeath = 3       // number of small spawned on spawner death
  } = opts;

  const p = Math.max(0, Math.min(1, progress));
  const eased = ease(p);

  const types = Object.values(ENEMY_CONFIGS);

  // calculate weights like your chooseEnemyType
  const weights = types.map(e => {
    const start = e.spawnWeightStart ?? 0;
    if (start === 0) return 0;
    const end = e.spawnWeightEnd ?? start;
    return Math.max(0, start + (end - start) * p);
  });

  const total = weights.reduce((s, w) => s + w, 0);

  let probs;
  if (total <= 0) {
    // fallback to first positive-start enemy like your chooseEnemyType
    const fallback = types.find(e => (e.spawnWeightStart ?? 0) > 0) || types[0];
    probs = types.map(e => (e === fallback ? 1 : 0));
  } else {
    probs = weights.map(w => w / total);
  }

  const smallHp = ENEMY_CONFIGS.small?.maxHp ?? 0;

  // expected HP contributed by one spawn event (include smalls spawned by spawner death)
  const expectedHPPerSpawn = types.reduce((sum, e, i) => {
    let hp = (e.maxHp ?? 0);
    if (e.name === 'spawner') hp += smallOnSpawnerDeath * smallHp;
    return sum + (probs[i] ?? 0) * hp;
  }, 0);

  // compute current spawn interval using your formula
  const spawnIntervalRange = initialSpawnInterval - minimalSpawnInterval;
  const spawnInterval = Math.max(
    minimalSpawnInterval,
    initialSpawnInterval - spawnIntervalRange * eased
  );

  const spawnRate = 1 / spawnInterval; // enemies per second

  // stability DPS: enough DPS to remove incoming HP at same rate it's added
  const stabilityDPS = expectedHPPerSpawn * spawnRate;

  // optional TTK target (if you want each enemy to die within desiredTTK seconds on average)
  const ttkDPS = desiredTTK ? (expectedHPPerSpawn / desiredTTK) : 0;

  // choose the stricter requirement and apply safety and targeting efficiency
  const requiredDPS = Math.max(stabilityDPS, ttkDPS) * safetyFactor / Math.max(1e-6, targetingEfficiency);

  return {
    expectedHPPerSpawn,
    spawnInterval,
    spawnRate,
    stabilityDPS,
    ttkDPS,
    requiredDPS,
    probs, // probability per enemy type at this progress
    safetyFactor,
    targetingEfficiency
  };
}
