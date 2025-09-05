/**
 * @file A self-contained module to manage all player cosmetic effects.
 */
import { HP_SIZE_CONFIG, ATTACK_SPEED_COLOR_CONFIG, TRAIL_CONFIG, BARREL_CONFIG, BULLET_SPEED_BARREL_CONFIG } from "./playerCosmeticConfig.js";
import { clamp, lerp, toRadians } from "./playerCosmeticUtils.js";

export function setupPlayerCosmetics(k, player) {
  player._cosmetics = {};
  initializeScale(player);
  initializeColor(player);
  initializeTrail(player);
  initializeBarrels(k, player);

  player.onUpdate(() => {
    if (!player.exists()) return;
    syncBarrelCount(k, player);
    updateScale(k, player);
    updateColor(k, player);
    updateTrail(k, player);
    updateBarrelTransforms(k, player);
  });
}

// --- HP-Based Scaling ---
function initializeScale(player) {
  player._cosmetics.scale = { target: 1 };
  const getMaxHealth = () => (typeof player.maxHP === 'function' ? player.maxHP() : player.maxHp());
  const updateTarget = () => {
    const hpRatio = clamp(player.hp() / getMaxHealth(), 0, 1);
    player._cosmetics.scale.target = lerp(HP_SIZE_CONFIG.minScale, HP_SIZE_CONFIG.maxScale, hpRatio);
  };
  player.onHurt(updateTarget);
  player.onHeal(updateTarget);
  updateTarget();
}
function updateScale(k, player) {
  const currentScale = player.scale.x;
  const targetScale = player._cosmetics.scale.target;
  const alpha = 1 - Math.exp(-HP_SIZE_CONFIG.smoothingSpeed * k.dt());
  player.scale = k.vec2(lerp(currentScale, targetScale, alpha));
}

// --- Attack Speed-Based Color ---
function initializeColor(player) {
  player._cosmetics.color = {
    baselineAttackSpeed: player.attackSpeed,
    lastKnownAttackSpeed: player.attackSpeed,
    currentTarget: [...ATTACK_SPEED_COLOR_CONFIG.baseColor],
    interpolated: [...ATTACK_SPEED_COLOR_CONFIG.baseColor],
  };
}
function updateColor(k, player) {
  const state = player._cosmetics.color;
  if (state.lastKnownAttackSpeed !== player.attackSpeed) {
    const deviation = clamp((state.baselineAttackSpeed - player.attackSpeed) / state.baselineAttackSpeed, 0, 1);
    const intensity = Math.sqrt(deviation);
    for (let i = 0; i < 3; i++) {
      state.currentTarget[i] = lerp(ATTACK_SPEED_COLOR_CONFIG.baseColor[i], ATTACK_SPEED_COLOR_CONFIG.targetColor[i], intensity);
    }
    state.lastKnownAttackSpeed = player.attackSpeed;
  }
  const alpha = 1 - Math.exp(-ATTACK_SPEED_COLOR_CONFIG.smoothingSpeed * k.dt());
  for (let i = 0; i < 3; i++) {
    state.interpolated[i] = lerp(state.interpolated[i], state.currentTarget[i], alpha);
  }
  player.color = k.rgb(...state.interpolated);
}

// --- Movement Trail ---
function initializeTrail(player) {
  player._cosmetics.trail = {
    baselineSpeed: player.speed,
    lastPos: player.pos.clone(),
  };
}
function updateTrail(k, player) {
  const state = player._cosmetics.trail;
  if (!TRAIL_CONFIG.enabled) return;
  const dt = k.dt();
  if (dt === 0) return;

  const currentPos = player.pos.clone();
  const displacement = currentPos.dist(state.lastPos);
  const currentSpeed = displacement / dt;
  state.lastPos = currentPos;

  const baselineSpeed = state.baselineSpeed;
  const speedRatio = clamp(currentSpeed / (baselineSpeed * 1.5), 0, 3);

  if (speedRatio > 1) {
    const numParticles = Math.floor(lerp(1, TRAIL_CONFIG.maxParticlesPerFrame, (speedRatio - 1) / 2));
    for (let i = 0; i < numParticles; i++) {
      const randomOffset = k.vec2(k.rand(-8, 8), k.rand(-8, 8));
      k.add([
        k.pos(player.pos.add(randomOffset)),
        k.rect(player.width, player.height, { radius: player.width * 0.5 }),
        k.anchor("center"),
        k.rotate(player.angle),
        k.color(player.color),
        k.scale(player.scale),
        k.opacity(lerp(TRAIL_CONFIG.minParticleAlpha, TRAIL_CONFIG.maxParticleAlpha, speedRatio / 3)),
        k.lifespan(lerp(TRAIL_CONFIG.minParticleLifespan, TRAIL_CONFIG.maxParticleLifespan, speedRatio / 3), { fade: 0.1 }),
        k.z(player.z - 1),
        "playerTrail",
      ]);
    }
  }
}

// --- Weapon Barrels ---
function initializeBarrels(k, player) {
  player._cosmetics.barrels = {
    entities: [],
    baselineBulletSpeed: player.bulletSpeed,
  };
}
function syncBarrelCount(k, player) {
  const state = player._cosmetics.barrels;
  const desiredCount = clamp(Math.floor(player.projectiles), 1, BARREL_CONFIG.maxBarrels);
  if (state.entities.length === desiredCount) return;
  state.entities.forEach(b => b.destroy());
  state.entities = [];
  for (let i = 0; i < desiredCount; i++) {
    const barrel = player.add([
      k.rect(BARREL_CONFIG.width, BARREL_CONFIG.height, { radius: BARREL_CONFIG.rounded ? 4 : 0 }),
      k.anchor("center"),
      k.color(...BARREL_CONFIG.colour),
      k.outline(BARREL_CONFIG.outlineWidth, k.rgb(...BARREL_CONFIG.outlineColour)),
      k.z(1),
      "playerBarrel",
    ]);
    state.entities.push(barrel);
  }
}
function updateBarrelTransforms(k, player) {
  const state = player._cosmetics.barrels;
  const entities = state.entities;
  if (entities.length === 0) return;
  let currentBarrelWidth = BARREL_CONFIG.width;
  if (BULLET_SPEED_BARREL_CONFIG.enabled && state.baselineBulletSpeed > 0) {
    const speedDifference = Math.max(0, player.bulletSpeed - state.baselineBulletSpeed);
    const lengthIncrease = BULLET_SPEED_BARREL_CONFIG.scalingFactor * Math.log1p(speedDifference / state.baselineBulletSpeed);
    currentBarrelWidth = clamp(BARREL_CONFIG.width + lengthIncrease, BARREL_CONFIG.width, BULLET_SPEED_BARREL_CONFIG.maxLength);
  }
  const numBarrels = entities.length;
  const totalSpread = toRadians(player.bulletSpreadDeg * Math.sqrt(numBarrels));
  const mountDistance = player.width / 2 + currentBarrelWidth / 2 - BARREL_CONFIG.inset;
  for (let i = 0; i < numBarrels; i++) {
    const barrel = entities[i];
    const angleOffset = numBarrels > 1 ? lerp(-totalSpread / 2, totalSpread / 2, i / (numBarrels - 1)) : 0;
    barrel.width = currentBarrelWidth;
    barrel.pos = k.Vec2.fromAngle(angleOffset).scale(mountDistance);
    barrel.angle = k.rad2deg(angleOffset);
  }
}