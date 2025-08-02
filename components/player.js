import { keysPressed } from "./controls.js";

export function createPlayer(k) {
  const player = k.add([
    k.rect(28, 28),
    k.anchor("center"),
    k.pos(360, 360),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.body(),
    k.health(3, 10),
    "player",
    {
      damage: 1,
      speed: 95,
      luck: 0.2,
      bulletSpeed: 400,
      isShooting: false,
      attackSpeed: 0.4,
      isDashing: false,
      dashDuration: 0.3, // seconds
      dashCooldown: 3, // seconds
      dashTimer: 0,
      canDash: true,
      isInvincible: false
    },
  ]);

  // Add barrel as a child
  player.add([k.rect(25, 8), k.pos(-6, -4), k.color(255, 255, 0)]);

  // Movement and rotation logic
  player.onUpdate(() => {
    if (player.dashTimer > 0) {
      player.dashTimer -= k.dt(); // dt() gives delta time
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
    if (!player.canDash || player.isDashing) return;

    player.isDashing = true;
    player.canDash = false;
    if (player.dashTimer <= 0) {
      // perform dash
      player.dashTimer = player.dashCooldown;

      k.wait(player.dashDuration, () => {
        player.isDashing = false;
      });

      k.wait(player.dashCooldown, () => {
        player.canDash = true;
      });
    }
  });

  player.updateDashCooldown = () => {
    if (!player.canDash) {
      player._dashTimer += k.dt();
      if (player._dashTimer >= player.dashCooldown && !player.isDashing) {
        player.canDash = true;
        player._dashTimer = 0;
      }
    }
  };
  player.getDashCooldownProgress = () => {
    return 1 - Math.min(player.dashTimer / player.dashCooldown, 1);
  };

  return player;
}
