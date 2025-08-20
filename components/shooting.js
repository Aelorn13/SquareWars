// components/shooting.js
const BASE_BULLET_SIZE = 8;
const DEFAULT_BASE_SPREAD_DEG = 10;
const MIN_ATTACK_SPEED = 0.04;

export function setupShooting(k, player, sharedState) {
  let canShoot = true;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const shoot = () => {
    const mp = k.mousePos();
    const dx = mp.x - player.pos.x;
    const dy = mp.y - player.pos.y;
    const baseAngle = Math.atan2(dy, dx);

    const hasDamageBuff = !!player._buffData?.damage;
    let damageBuffMultiplier = 1;
    if (hasDamageBuff) {
      const orig = player._buffData?.damage?.original ?? player.damage;
      damageBuffMultiplier = player.damage / orig;
    }

    const numProjectiles = Math.max(1, Math.floor(player.projectiles || 1));
    const baseSpreadDeg = player.bulletSpreadDeg ?? DEFAULT_BASE_SPREAD_DEG;
    const spreadDeg = numProjectiles === 1 ? 0 : baseSpreadDeg * Math.sqrt(numProjectiles);

    const offsetsDeg = [];
    if (numProjectiles === 1) {
      offsetsDeg.push(0);
    } else {
      const step = spreadDeg / (numProjectiles - 1);
      const start = -spreadDeg / 2;
      for (let i = 0; i < numProjectiles; i++) offsetsDeg.push(start + i * step);
    }

    const critChance = Math.max(0, Math.min(1, player.critChance || 0));
    const isCritShot = Math.random() < critChance;
    const critMul = isCritShot ? (player.critMultiplier ?? 2) : 1;

    const damagePerBullet = player.damage * critMul;

    for (let i = 0; i < offsetsDeg.length; i++) {
      const angle = baseAngle + toRad(offsetsDeg[i]);
      const dir = k.vec2(Math.cos(angle), Math.sin(angle));

      const sizeMul = damageBuffMultiplier * critMul;
      const size = BASE_BULLET_SIZE * sizeMul;

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
