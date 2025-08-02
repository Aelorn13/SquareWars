export function setupShooting(k, player) {
  let canShoot = true;

  const shoot = () => {
    const hasDamageBuff = !!player._buffData?.damage;
    k.add([
      k.rect(hasDamageBuff ? 10 : 6, hasDamageBuff ? 10 : 6),
      k.color(hasDamageBuff ? k.rgb(255, 0, 255) : k.rgb(255, 255, 0)),
      k.pos(player.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      k.rotate(player.angle),
      k.move(k.mousePos().sub(player.pos).unit(), player.bulletSpeed),
      "bullet",
    ]);
  };

  const tryShoot = () => {
    if (!canShoot) return;
    shoot();
    canShoot = false;
    k.wait(player.attackSpeed, () => { canShoot = true; });
  };

  k.onMouseDown(() => { player.isShooting = true; });
  k.onMouseRelease(() => { player.isShooting = false; });

  k.onUpdate(() => {
    if (player.isShooting) tryShoot();
  });
}
