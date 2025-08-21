import { keysPressed } from "./controls.js";

export function createPlayer(k, sharedState) {
  const player = k.add([
    k.rect(28, 28),
    k.anchor("center"),
    k.pos(
      k.vec2(
        sharedState.area.x + sharedState.area.w / 2,
        sharedState.area.y + sharedState.area.h / 2
      )
    ),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.body(),
    k.health(3, 10),
    "player",
    {
      critChance: 0.2,
      critMultiplier: 2,
      projectiles: 1,
      damage: 1,
      speed: 90,
      luck: 0.2,
      bulletSpeed: 350,
      isShooting: false,
      attackSpeed: 0.5,
      isDashing: false,
      dashDuration: 0.3, // seconds
      dashCooldown: 3, // seconds
      dashTimer: 0,
      isInvincible: false,
    },
  ]);

  // Add barrel as a child
  player.add([k.rect(25, 8), k.pos(-6, -4), k.color(255, 255, 0)]);

  // Movement and rotation logic
  player.onUpdate(() => {
    if (sharedState.isPaused) return;
    if (player.dashTimer > 0) {
      player.dashTimer -= k.dt();
      if (player.dashTimer < 0) player.dashTimer = 0;
    }
    if (player.dashDurationTimer > 0) {
      player.dashDurationTimer -= k.dt();
      if (player.dashDurationTimer <= 0) {
        player.isDashing = false;
        player.dashDurationTimer = 0;
      }
    }

    player.rotateTo(k.mousePos().angle(player.pos));

    let dir = k.vec2(0, 0);
    if (keysPressed["ArrowLeft"] || keysPressed["KeyA"]) dir.x -= 1;
    if (keysPressed["ArrowRight"] || keysPressed["KeyD"]) dir.x += 1;
    if (keysPressed["ArrowUp"] || keysPressed["KeyW"]) dir.y -= 1;
    if (keysPressed["ArrowDown"] || keysPressed["KeyS"]) dir.y += 1;
    dir = dir.unit();

    const moveSpeed = player.isDashing ? player.speed * 4 : player.speed;
    player.move(dir.scale(moveSpeed));
    player.pos.x = Math.min(
      Math.max(player.pos.x, sharedState.area.x),
      sharedState.area.x + sharedState.area.w
    );
    player.pos.y = Math.min(
      Math.max(player.pos.y, sharedState.area.y),
      sharedState.area.y + sharedState.area.h
    );
  });

  // Track keydowns/ups for direction
  k.onKeyDown((key) => {
    keysPressed[key] = true;
  });

  k.onKeyRelease((key) => {
    keysPressed[key] = false;
  });

  // DASH on Space
  k.onKeyPress("space", () => {
    if (player.dashTimer > 0 || player.dashDurationTimer > 0) return;

    player.isDashing = true;
    player.dashDurationTimer = player.dashDuration;
    player.dashTimer = player.dashCooldown;
  });

  player.getDashCooldownProgress = () => {
    return Math.max(0, Math.min(1, player.dashTimer / player.dashCooldown));
  };

  return player;
}
