const bulletWidth = 8;
const bulletHeight = 4;
export function setupShooting(k, player, sharedState) {
  let canShoot = true;

const shoot = () => {
  const dir = k.mousePos().sub(player.pos).unit();
  const hasDamageBuff = !!player._buffData?.damage;
  let damageMultiplier = 1;

  if (hasDamageBuff) {
    damageMultiplier = player.damage / player._buffData.damage.original;
  }

  // Check crit
  const isCrit = Math.random() < (player.critChance || 0);
  const critMultiplier = isCrit ? (player.critMultiplier || 2) : 1;

  // Final bullet damage
  const bulletDamage = player.damage * critMultiplier;

  // Bullet size
  const width = (hasDamageBuff ? bulletWidth * damageMultiplier : bulletWidth) * critMultiplier;
  const height = (hasDamageBuff ? bulletHeight * damageMultiplier : bulletHeight) * critMultiplier;

  // Bullet color
  let bulletColor = hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0);
  if (isCrit) bulletColor = k.rgb(255, 0, 0); // crit overrides color

  const bullet = k.add([
    k.rect(width, height),
    k.color(bulletColor),
    k.pos(player.pos),
    k.area(),
    k.anchor("center"),
    k.offscreen({ destroy: true }),
    k.rotate(player.angle),
    "bullet",
    {
      originalVel: dir.scale(player.bulletSpeed),
      damage: bulletDamage,   // <-- store damage in bullet
      isCrit,                // optional, for effects
    },
  ]);

  bullet.onUpdate(() => {
    if (!sharedState.isPaused) {
      bullet.pos = bullet.pos.add(bullet.originalVel.scale(k.dt()));
    }
  });
};

  const tryShoot = () => {
    if (!canShoot) return;
    shoot();
    canShoot = false;
    k.wait(player.attackSpeed, () => {
      canShoot = true;
    });
  };

  k.onMouseDown(() => {
    player.isShooting = true;
  });
  k.onMouseRelease(() => {
    player.isShooting = false;
  });

  k.onUpdate(() => {
    if (sharedState.isPaused) return;
    if (player.isShooting) tryShoot();
  });
}
