const bulletWidth = 8;
const bulletHeight = 4;
export function setupShooting(k, player, sharedState) {
  let canShoot = true;

  const shoot = () => {
    const dir = k.mousePos().sub(player.pos).unit();
    const hasDamageBuff = !!player._buffData?.damage;
    let damageMultiplier = 1;
    if (player._buffData && player._buffData.damage) {
      damageMultiplier = player.damage / player._buffData.damage.original;
    }
    const bullet = k.add([
      k.rect(
        hasDamageBuff ? bulletWidth * damageMultiplier : bulletWidth,
        hasDamageBuff ? bulletHeight * damageMultiplier : bulletHeight
      ),
      k.color(hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0)),
      k.pos(player.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      k.rotate(player.angle),
      "bullet",
      {
        originalVel: dir.scale(player.bulletSpeed),
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
