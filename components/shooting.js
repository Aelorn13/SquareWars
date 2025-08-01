export function setupShooting(k, player) {
  let canShoot = true;

  // Shoot a single bullet
  function shoot() {
    k.add([
      k.rect(10, 6, { radius: 6 }),
      k.color(255, 255, 0),
      k.pos(player.pos),
      k.area(),
      k.anchor("center"),
      k.offscreen({ destroy: true }),
      k.rotate(player.angle),
      k.move(k.mousePos().sub(player.pos).unit(), player.bulletSpeed),
      "bullet",
    ]);
  }

  // Only allow shooting if cooldown is ready
  function tryShoot() {
    if (!canShoot) return;

    shoot();
    canShoot = false;

    // Use current attackSpeed
    k.wait(player.attackSpeed, () => {
      canShoot = true;
    });
  }

  // Handle holding mouse button to shoot
  k.onMouseDown(() => {
    player.isShooting = true;
  });

  k.onMouseRelease(() => {
    player.isShooting = false;
  });

  // Update shooting logic each frame
  k.onUpdate(() => {
    if (player.isShooting) tryShoot();
  });
}
