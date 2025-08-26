// components/shooting.js
const BASE_BULLET_SIZE = 8;
const DEFAULT_BASE_SPREAD_DEG = 10;
const MIN_ATTACK_SPEED = 0.04;

// Damage scaling when using multiple projectiles.
// Example: 3 projectiles → 0.70, 5 projectiles → 0.65, 7 → 0.60, etc.
function getProjectileDamageScale(numProjectiles) {
  if (numProjectiles <= 1) return 1;         // single bullet = 100%
  if (numProjectiles === 3) return 0.70;     // baseline for spread shots
  const extra = numProjectiles - 3;          // every extra projectile reduces damage
  return Math.max(0.1, 0.70 - 0.05 * extra); // floor at 10% so it never hits 0
}

export function setupShooting(k, player, sharedState) {
  let canShoot = true;
  const toRad = (deg) => (deg * Math.PI) / 180;

  // Return ratio: currentDamage / baseDamage (>= 0). Falls back to 1 if no base found.
  const getDamageBuffMultiplier = () => {
    const baseFromBaseStats = player._baseStats?.damage;
    if (typeof baseFromBaseStats === "number" && baseFromBaseStats !== 0) {
      return player.damage / baseFromBaseStats;
    }
    return 1;
  };

  const shoot = () => {
    const mp = k.mousePos();
    const dx = mp.x - player.pos.x;
    const dy = mp.y - player.pos.y;
    const baseAngle = Math.atan2(dy, dx);

    const damageBuffMultiplier = getDamageBuffMultiplier();
    const hasDamageBuff = Math.abs(damageBuffMultiplier - 1) > 0.0001;

    const numProjectiles = Math.max(1, Math.floor(player.projectiles || 1));
    const baseSpreadDeg = player.bulletSpreadDeg ?? DEFAULT_BASE_SPREAD_DEG;
    const spreadDeg =
      numProjectiles === 1 ? 0 : baseSpreadDeg * Math.sqrt(numProjectiles);

    // Calculate projectile offsets
    const offsetsDeg = [];
    if (numProjectiles === 1) {
      offsetsDeg.push(0);
    } else {
      const step = spreadDeg / (numProjectiles - 1);
      const start = -spreadDeg / 2;
      for (let i = 0; i < numProjectiles; i++) offsetsDeg.push(start + i * step);
    }

    // Shared crit roll for the whole shot
    const critChance = Math.max(0, Math.min(1, player.critChance || 0));
    const isCritShot = Math.random() < critChance;
    const critMul = isCritShot ? (player.critMultiplier ?? 2) : 1;

    // Final per-bullet damage scaling
    const projectileScale = getProjectileDamageScale(numProjectiles);
    const damagePerBullet = player.damage * critMul * projectileScale;

    for (let i = 0; i < offsetsDeg.length; i++) {
      const angle = baseAngle + toRad(offsetsDeg[i]);
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));

      const sizeMul = damageBuffMultiplier * critMul;
      const size = Math.max(2, BASE_BULLET_SIZE * sizeMul);

      // color: damage-buff color (magenta) or default (yellow). Crit overrides to red.
      let bulletColor = hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0);
      if (isCritShot) bulletColor = k.rgb(255, 0, 0);

      const bullet = k.add([
        k.rect(size, size),
        k.color(bulletColor),
        k.pos(player.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }),
        "bullet",
        {
          originalVel: dir.scale(player.bulletSpeed),
          damage: damagePerBullet,
          isCrit: isCritShot,
        },
      ]);

      bullet.onUpdate(() => {
        if (!sharedState.isPaused) {
          bullet.pos = bullet.pos.add(bullet.originalVel.scale(k.dt()));
        }
      });
    }
  };

  const tryShoot = () => {
    if (!canShoot) return;
    shoot();
    canShoot = false;
    const waitTime = Math.max(MIN_ATTACK_SPEED, player.attackSpeed || 0.1);
    k.wait(waitTime, () => {
      canShoot = true;
    });
  };

  k.onMouseDown(() => (player.isShooting = true));
  k.onMouseRelease(() => (player.isShooting = false));

  k.onUpdate(() => {
    if (sharedState.isPaused) return;
    if (player.isShooting) tryShoot();
  });
}
