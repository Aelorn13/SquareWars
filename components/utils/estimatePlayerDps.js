// components/utils/estimatePlayerDPS.js
// Small, deterministic DPS estimator that matches your shooting logic.
const DEFAULTS = {
  BASE_PROJECTILE_SIZE: 6,
  DEFAULT_SPREAD: 10,
  MIN_FIRE_RATE: 0.04,
  MULTI_SCALE: 0.65,
  RICOCHET_EFFICIENCY: 0.5,
};

function getDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1;
  if (numProjectiles === 3) return DEFAULTS.MULTI_SCALE;
  return Math.max(0.1, DEFAULTS.MULTI_SCALE - 0.05 * (numProjectiles - 3));
}

function expectedCritMultiplier(critChance = 0, critMult = 2) {
  return 1 + (critChance || 0) * ((critMult || 2) - 1);
}
function toDeg(rad){ return (rad * 180) / Math.PI; }
function angularHalfDeg(radius, distance){
  if (distance <= 0) return 180;
  return toDeg(Math.atan2(radius, distance));
}

export function estimatePlayerDPS(player = {}, opts = {}) {
  const {
    mode = "single",
    target = { radius: 16, distance: 240 },
    avgTargetsInCone = 1,
    projectileSize = DEFAULTS.BASE_PROJECTILE_SIZE,
    ricochet = null,
    burnEffect = null,
    buffMultiplier = 1,
  } = opts;

  const shotInterval = Math.max(DEFAULTS.MIN_FIRE_RATE, (player.attackSpeed || 0.5));
  const shotsPerSec = 1 / shotInterval;

  const count = Math.max(1, Math.floor(player.projectiles || 1));
  const spreadDeg = count === 1 ? 0 : (player.bulletSpreadDeg ?? DEFAULTS.DEFAULT_SPREAD) * Math.sqrt(count);

  // per-projectile expected damage including crit expectation and damage buffs
  const critExp = expectedCritMultiplier(player.critChance || 0, player.critMultiplier || 2);
  const perProjDamage = (player.damage || 1) * getDamageScale(count) * critExp * (buffMultiplier || 1);

  // single-target geometric hit calc (player aims at center)
  const targetRadius = (target.radius != null) ? target.radius : 16;
  const targetDistance = (target.distance != null) ? target.distance : 240;
  const allowedDeg = angularHalfDeg(targetRadius + projectileSize / 2, targetDistance);

  // how many projectiles (by angle) will hit target center
  const offsetsDeg = (count === 1)
    ? [0]
    : Array.from({ length: count }, (_, i) => -spreadDeg/2 + (spreadDeg/(count-1)) * i);
  const hitsOnTarget = offsetsDeg.filter(d => Math.abs(d) <= allowedDeg).length;
  const expectedHitsPerShot_single = hitsOnTarget;
  const hitsPerSec_single = expectedHitsPerShot_single * shotsPerSec;
  const rawDps_single = perProjDamage * hitsPerSec_single;

  // crowd mode: approximates distinct enemies hit per shot
  const expectedDistinctHitsPerShot_crowd = Math.min(count, Math.max(0, avgTargetsInCone));
  const hitsPerSec_crowd = expectedDistinctHitsPerShot_crowd * shotsPerSec;
  const rawDps_crowd = perProjDamage * hitsPerSec_crowd;

  // DOT (burn) steady-state DPS
  let dotDps_single = 0, dotDps_crowd = 0;
  if (burnEffect && burnEffect.damagePerTick && burnEffect.duration && burnEffect.tickInterval) {
    const ticks = Math.floor(burnEffect.duration / burnEffect.tickInterval);
    const totalDotPerHit = ticks * burnEffect.damagePerTick;
    dotDps_single = hitsPerSec_single * totalDotPerHit;
    dotDps_crowd = hitsPerSec_crowd * totalDotPerHit;
  }

  // ricochet extra damage approximation
  let ricochetDps_single = 0, ricochetDps_crowd = 0;
  if (ricochet && ricochet.bounces) {
    const eff = (ricochet.efficiency == null) ? DEFAULTS.RICOCHET_EFFICIENCY : ricochet.efficiency;
    const extraPerHitFactor = ricochet.bounces * eff;
    ricochetDps_single = perProjDamage * hitsPerSec_single * extraPerHitFactor;
    ricochetDps_crowd = perProjDamage * hitsPerSec_crowd * extraPerHitFactor;
  }

  const total_single = rawDps_single + dotDps_single + ricochetDps_single;
  const total_crowd = rawDps_crowd + dotDps_crowd + ricochetDps_crowd;

  return {
    meta: {
      shotsPerSec,
      projectilesPerShot: count,
      spreadDeg,
      perProjDamage,
      critExpectation: critExp,
      damageScalePerProj: getDamageScale(count),
    },
    singleTarget: {
      targetRadius,
      targetDistance,
      allowedDeg,
      expectedHitsPerShot: expectedHitsPerShot_single,
      hitsPerSec: hitsPerSec_single,
      rawDps: rawDps_single,
      dotDps: dotDps_single,
      ricochetDps: ricochetDps_single,
      totalDps: total_single,
    },
    crowd: {
      avgTargetsInCone,
      expectedDistinctHitsPerShot: expectedDistinctHitsPerShot_crowd,
      hitsPerSec: hitsPerSec_crowd,
      rawDps: rawDps_crowd,
      dotDps: dotDps_crowd,
      ricochetDps: ricochetDps_crowd,
      totalDps: total_crowd,
    }
  };
}
