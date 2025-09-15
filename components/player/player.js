// components/player/player.js

import { keysPressed, mobileControls } from "./controls.js";
import { setupPlayerCosmetics } from "./cosmetics/playerCosmetic.js";

const BASE_PLAYER_SIZE = 28;

/**
 * Creates and initializes the player entity with all its stats and behaviors.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} sharedState - Contains shared game state like arena boundaries and pause status.
 * @param {boolean} isMobile - Flag to determine if the game is on a mobile device.
 * @returns {object} The created player entity.
 */
export function createPlayer(k, sharedState, isMobile) {
  // A self-contained handler for all dash-related logic and state.
  const dashHandler = {
    isDashing: false,
    cooldownTimer: 0,
    activeTimer: 0,

    update(dt) {
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

    execute(player) {
      if (this.cooldownTimer > 0 || this.isDashing) return;
      this.isDashing = true;
      this.activeTimer = player.dashDuration;
      this.cooldownTimer = player.dashCooldown;
    },

    getCooldownProgress(player) {
      if (player.dashCooldown === 0) return 1;
      return 1 - this.cooldownTimer / player.dashCooldown;
    },
  };

  const player = k.add([
    k.rect(BASE_PLAYER_SIZE, BASE_PLAYER_SIZE),
    k.anchor("center"),
    k.pos(
      sharedState.area.x + sharedState.area.w / 2,
      sharedState.area.y + sharedState.area.h / 2
    ),
    k.color(0, 0, 255),
    k.rotate(0),
    k.area(),
    k.body({ isSensor: true }),
    k.health(3, 10),
    k.scale(1),
    k.z(0),
    "player",
    // --- Player Stats (unchanged) ---
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
      takeDamage(damageAmount) {
        if (this.isInvincible) return;
        this.hurt(damageAmount);
        this.applyInvincibility(2);
        k.shake(10);
      },
      applyInvincibility(duration) {
        this.isInvincible = true;
        const flashEffect = k.loop(0.1, () => {
          this.hidden = !this.hidden;
        });
        k.wait(duration, () => {
          this.isInvincible = false;
          this.hidden = false;
          flashEffect.cancel();
        });
      },
    },
  ]);

  // --- Main Update Loop ---
  player.onUpdate(() => {
    if (sharedState.isPaused) return;

    dashHandler.update(k.dt());

    // Pass isMobile flag to input handlers
    handleRotation(player, k, isMobile);
    handleMovement(player, k, dashHandler, isMobile);
    clampPosition(player, k, sharedState.area);
  });

  // --- Input Handlers based on platform ---
  if (isMobile) {
    // For mobile, we check the state of mobileControls every frame.
    k.onUpdate(() => {
        if (mobileControls.dash) {
            dashHandler.execute(player);
            mobileControls.dash = false; // Consume the dash press
        }
    });
  } else {
    // For PC, we use key press events.
    k.onKeyPress("space", () => dashHandler.execute(player));
  }

  // --- Public Methods ---
  player.getDashCooldownProgress = () =>
    dashHandler.getCooldownProgress(player);

  setupPlayerCosmetics(k, player);

  return player;
}

// --- Helper Functions updated for mobile ---

function handleRotation(player, k, isMobile) {
    if (isMobile) {
        // If the shooting joystick is active, rotate the player to face that direction.
        if (mobileControls.shooting.active) {
            const shootVector = k.vec2(mobileControls.shooting.x, mobileControls.shooting.y);
            if (shootVector.len() > 0) {
                 player.angle = shootVector.angle();
            }
        }
    } else {
        // PC: Player always faces the mouse cursor for aiming.
        player.rotateTo(k.mousePos().angle(player.pos));
    }
}

function handleMovement(player, k, dashHandler, isMobile) {
  let moveDirection = k.vec2(0, 0);

  if (isMobile) {
    // Mobile: Read direction from the movement joystick state.
    moveDirection.x = mobileControls.movement.x;
    moveDirection.y = mobileControls.movement.y;
  } else {
    // PC: Read direction from the keyboard state.
    if (keysPressed["KeyA"]) moveDirection.x -= 1;
    if (keysPressed["KeyD"]) moveDirection.x += 1;
    if (keysPressed["KeyW"]) moveDirection.y -= 1;
    if (keysPressed["KeyS"]) moveDirection.y += 1;
  }

  if (moveDirection.len() > 0) {
    moveDirection = moveDirection.unit();
  }

  const effectiveSpeed = dashHandler.isDashing
    ? player.speed * player.dashSpeedMultiplier
    : player.speed;

  player.move(moveDirection.scale(effectiveSpeed));
}

function clampPosition(player, k, area) {
  player.pos.x = k.clamp(player.pos.x, area.x, area.x + area.w);
  player.pos.y = k.clamp(player.pos.y, area.y, area.y + area.h);
}