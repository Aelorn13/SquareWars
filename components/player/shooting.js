// ===== components/player/shooting.js =====
import { inputState, updateInput, aimWorldTarget } from "./controls.js";
import { attachBuffManager } from "../buffManager.js";

const CONFIG = {
  BASE_SIZE: 6,
  MAX_SIZE: 20, // Hard cap on projectile size
  DEFAULT_SPREAD: 10,
  MIN_FIRE_RATE: 0.04,
  MULTI_SCALE: 0.65,
  PROJECTILE_SPEED: 800,

  // Visual scaling curves
  SIZE_CURVE: {
    damageExponent: 0.6, // sqrt-ish scaling instead of linear
    critMultiplier: 1.3, // Crits only 30% bigger, not 2x
  },
};

function getDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1;
  if (numProjectiles === 3) return CONFIG.MULTI_SCALE;
  return Math.max(0.1, CONFIG.MULTI_SCALE - 0.05 * (numProjectiles - 3));
}

/**
 * Calculate visual size with diminishing returns and hard cap
 */
function calculateProjectileSize(baseDamage, currentDamage, isCrit) {
  const damageRatio = currentDamage / baseDamage;
  const scaledRatio = Math.pow(damageRatio, CONFIG.SIZE_CURVE.damageExponent);
  const critScale = isCrit ? CONFIG.SIZE_CURVE.critMultiplier : 1;
  const size = CONFIG.BASE_SIZE * scaledRatio * critScale;
  return Math.min(CONFIG.MAX_SIZE, Math.max(4, size));
}

/**
 * Determine projectile shape based on effects
 */
function getProjectileShape(k, effects) {
  const hasRicochet = effects.some((e) => e.type === "ricochet");
  const hasPierce = effects.some((e) => e.type === "pierce");
  const hasBurn = effects.some((e) => e.type === "burn");
  const hasSlow = effects.some((e) => e.type === "slow");

  if (hasPierce) {
    return { type: "diamond" }; // Rotated square
  }
  if (hasBurn || hasSlow) {
    return { type: "hexagon" }; // Hexagon via polygon
  }

  return { type: "circle" }; // Default
}

/**
 * Create visual component based on shape type
 */
function createProjectileVisual(k, shape, size, color) {
  const radius = size / 2;

  switch (shape.type) {
    case "circle":
      return k.circle(radius);

    case "diamond": {
      const s = radius;
      return k.polygon([
        k.vec2(s, 0), // Right
        k.vec2(0, -s), // Top
        k.vec2(-s, 0), // Left
        k.vec2(0, s), // Bottom
      ]);
    }

    case "hexagon": {
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i; // 60 degrees
        points.push(k.vec2(Math.cos(angle) * radius, Math.sin(angle) * radius));
      }
      return k.polygon(points);
    }

    default:
      return k.rect(size, size);
  }
}

/**
 * Get projectile color with better distinction
 */
function getProjectileColor(k, isCrit, hasBuff, effects) {
  if (isCrit) {
    return k.rgb(255, 50, 50); // Bright red for crits
  }

  const hasBurn = effects.some((e) => e.type === "burn");
  const hasSlow = effects.some((e) => e.type === "slow");
  const hasKnockback = effects.some((e) => e.type === "knockback");
  const hasRicochet = effects.some((e) => e.type === "ricochet");
  const hasPierce = effects.some((e) => e.type === "pierce");

  if (hasBurn) return k.rgb(255, 140, 0); // Orange
  if (hasSlow) return k.rgb(100, 200, 255); // Light blue
  if (hasKnockback) return k.rgb(200, 200, 255); // Pale blue
  if (hasRicochet) return k.rgb(0, 255, 150); // Green-cyan
  if (hasPierce) return k.rgb(200, 50, 255); // Purple

  if (hasBuff) {
    return k.rgb(255, 100, 255); // Magenta for buffs
  }

  return k.rgb(255, 255, 100); // Default yellow
}

export function setupPlayerShooting(k, player, gameState) {
  let canFire = true;
  attachBuffManager(k, player);

  // Store base damage for scaling calculations
  const baseDamage = player.damage || 1;

  const getBuffMultiplier = () => {
    const base = player._baseStats?.damage;
    return base > 0 ? player.damage / base : 1;
  };

  const createProjectile = (angle, damage, size, color, effects, speed, shape) => {
    const dir = k.vec2(Math.cos(angle), Math.sin(angle));
    const sourceId = player.id ?? `p_${Date.now()}_${Math.random()}`;

    // Create visual component
    const visual = createProjectileVisual(k, shape, size, color);

    const proj = k.add([
      visual,
      k.color(color),
      k.pos(player.pos),
      k.z(player.z), // Slightly above player
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      k.opacity(0.9),
      "projectile",
      {
        velocity: dir.scale(speed),
        damage,
        isCritical: color.r > 240 && color.g < 100 && color.b < 100,
        effects: effects.map((e) => ({ ...e, params: { ...e.params } })),
        source: player,
        sourceId,
        _bouncesLeft: 0,
      },
    ]);

    // Initialize ricochet bounces
    const ricochet = proj.effects?.find((e) => e.type === "ricochet");
    if (ricochet?.params?.bounces) {
      proj._bouncesLeft = Math.floor(ricochet.params.bounces);
    }

    proj.onUpdate(() => {
      if (!gameState.isPaused) {
        proj.pos = proj.pos.add(proj.velocity.scale(k.dt()));
      }
    });

    return proj;
  };

  const fire = (forcedTarget) => {
    const target = forcedTarget ?? player._autoAimTarget ?? aimWorldTarget(k, player.pos);
    const baseAngle = Math.atan2(target.y - player.pos.y, target.x - player.pos.x);

    // Calculate damage modifiers
    const hasBuff = Math.abs(getBuffMultiplier() - 1) > 0.0001;
    const isCrit = Math.random() < (player.critChance || 0);
    const critMult = isCrit ? player.critMultiplier ?? 2 : 1;

    const count = Math.max(1, Math.floor(player.projectiles || 1));
    const spread = count === 1 ? 0 : (player.bulletSpreadDeg ?? CONFIG.DEFAULT_SPREAD) * Math.sqrt(count);
    const angles =
      count === 1 ? [0] : Array.from({ length: count }, (_, i) => -spread / 2 + (spread / (count - 1)) * i);

    const damagePerProj = player.damage * critMult * getDamageScale(count);

    const size = calculateProjectileSize(baseDamage, player.damage, isCrit);

    const effects = player._projectileEffects ?? [];

    const shape = getProjectileShape(k, effects);

    const color = getProjectileColor(k, isCrit, hasBuff, effects);

    angles.forEach((offsetDeg) => {
      createProjectile(
        baseAngle + (offsetDeg * Math.PI) / 180,
        damagePerProj,
        size,
        color,
        effects,
        player.bulletSpeed || CONFIG.PROJECTILE_SPEED,
        shape
      );
    });
  };

  const tryFire = () => {
    if (!canFire) return;
    fire();
    canFire = false;
    const rate = Math.max(CONFIG.MIN_FIRE_RATE, player.attackSpeed || 0.1);
    k.wait(rate, () => (canFire = true));
  };

  // Expose for auto-aim
  player.tryFire = tryFire;
  player.setAutoAimTarget = (vec) => {
    player._autoAimTarget = vec;
  };
  player.clearAutoAimTarget = () => {
    player._autoAimTarget = null;
  };

  // Input handlers
  k.onMouseDown(() => (player.isShooting = true));
  k.onMouseRelease(() => (player.isShooting = false));

  k.onUpdate(() => {
    if (gameState.isPaused) return;
    updateInput(k, player.pos);
    if (player.isShooting || inputState.firing) tryFire();
  });
}
