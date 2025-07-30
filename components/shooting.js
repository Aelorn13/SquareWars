export function setupShooting(k, player) {
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

  // Click shooting
  k.onClick(() => {
    shoot();
  });

  // Hold-to-shoot control
  k.onMouseDown(() => {
    player.isShooting = true;
  });

  k.onMouseRelease(() => {
    player.isShooting = false;
  });

  // Repeated shooting loop
  k.loop(player.attackSpeed, () => {
    if (player.isShooting) shoot();
  });
}
