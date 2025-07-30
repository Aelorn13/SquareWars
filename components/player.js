import { keysPressed } from "./controls.js";

export function createPlayer(k) {
  const player = k.add([
    k.rect(32, 32),
    k.anchor("center"),
    k.pos(360, 360),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.health(3,10),
    "player",
    {
      speed: 120,
      bulletSpeed: 400,
      isShooting: false,
      attackSpeed: 0.3,
    },
  ]);

  // Add barrel as a child
  player.add([k.rect(25, 8), k.pos(0, -4), k.color(255, 255, 0)]);

  // Movement and rotation logic
  player.onUpdate(() => {
    player.rotateTo(k.mousePos().angle(player.pos));

    let dir = k.vec2(0, 0);
    if (keysPressed["ArrowLeft"] || keysPressed["KeyA"]) dir.x -= 1;
    if (keysPressed["ArrowRight"] || keysPressed["KeyD"]) dir.x += 1;
    if (keysPressed["ArrowUp"] || keysPressed["KeyW"]) dir.y -= 1;
    if (keysPressed["ArrowDown"] || keysPressed["KeyS"]) dir.y += 1;
    dir = dir.unit();
    player.move(dir.scale(player.speed));
  });

  return player;
}
