import { keysPressed } from "./controls.js";
import { setupPlayerCosmetics } from "./cosmetics/playerCosmetic.js";

const BASE_PLAYER_SIZE = 28;

/**
 * Creates and initializes the player entity with all its stats and behaviors.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} sharedState - Contains shared game state like arena boundaries and pause status.
 * @returns {object} The created player entity.
 */
export function createPlayer(k, sharedState) {
  // A self-contained handler for all dash-related logic and state.
  const dashHandler = {
    isDashing: false,
    cooldownTimer: 0,
    activeTimer: 0,

    // Decrements timers each frame.
    update(dt, player) {
      if (this.cooldownTimer > 0) {
        this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
      }
      if (this.activeTimer > 0) {
        this.activeTimer = Math.max(0, this.activeTimer - dt);
        if (this.activeTimer === 0) {
          this.isDashing = false;
        }
      }
    },

    // Executes the dash if conditions are met.
    execute(player) {
      if (this.cooldownTimer > 0 || this.isDashing) return;
      this.isDashing = true;
      this.activeTimer = player.dashDuration;
      this.cooldownTimer = player.dashCooldown;
    },

    // Calculates cooldown progress for the UI bar.
    getCooldownProgress(player) {
      if (player.dashCooldown === 0) return 1;
      return 1 - (this.cooldownTimer / player.dashCooldown);
    }
  };

  const player = k.add([
    k.rect(BASE_PLAYER_SIZE, BASE_PLAYER_SIZE),
    k.anchor("center"),
    k.pos(sharedState.area.x + sharedState.area.w / 2, sharedState.area.y + sharedState.area.h / 2),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.body({ isSensor: true }), // isSensor prevents forceful pushing by other physics bodies.
    k.health(3, 10),
    k.scale(1),
    k.z(0),
    "player",
    // --- Initial Player Stats ---
    {
      bulletSpreadDeg: 10,
      critChance: 0.1,
      critMultiplier: 2,
      projectiles: 1,
      damage: 1,
      speed: 90, 
      luck: 0.1,
      bulletSpeed: 300,
      attackSpeed: 0.5,
      isShooting: false,
      isInvincible: false,
      dashDuration: 0.2,
      dashCooldown: 3,
      dashSpeedMultiplier: 4,
    },
  ]);

  // --- Main Update Loop ---
  player.onUpdate(() => {
    if (sharedState.isPaused) return;

    // Delegate all timer management to the dash handler.
    dashHandler.update(k.dt(), player);

    handleRotation(player, k);
    handleMovement(player, k, dashHandler);
    clampPosition(player, k, sharedState.area);
  });

  // --- Input Handlers ---
  k.onKeyDown((key) => { keysPressed[key] = true; });
  k.onKeyRelease((key) => { keysPressed[key] = false; });
  k.onKeyPress("space", () => dashHandler.execute(player));

  // --- Public Methods ---
  player.getDashCooldownProgress = () => dashHandler.getCooldownProgress(player);

  setupPlayerCosmetics(k, player);

  return player;
}


// --- Helper Functions for `createPlayer` ---

function handleRotation(player, k) {
  // Player always faces the mouse cursor for aiming.
  player.rotateTo(k.mousePos().angle(player.pos));
}

function handleMovement(player, k, dashHandler) {
  let moveDirection = k.vec2(0, 0);
  if (keysPressed["KeyA"]) moveDirection.x -= 1;
  if (keysPressed["KeyD"]) moveDirection.x += 1;
  if (keysPressed["KeyW"]) moveDirection.y -= 1;
  if (keysPressed["KeyS"]) moveDirection.y += 1;

  // Normalize to prevent faster diagonal movement.
  if (moveDirection.len() > 0) {
    moveDirection = moveDirection.unit();
  }

  // Apply dash multiplier if the dash is active.
  const effectiveSpeed = dashHandler.isDashing
    ? player.speed * player.dashSpeedMultiplier
    : player.speed;

  player.move(moveDirection.scale(effectiveSpeed));
}

function clampPosition(player, k, area) {
  player.pos.x = k.clamp(player.pos.x, area.x, area.x + area.w);
  player.pos.y = k.clamp(player.pos.y, area.y, area.y + area.h);
}