import { keysPressed } from "./controls.js";
import {
  setupPlayerCosmetics,
  rebuildBarrelsAsEntities,
} from "./cosmetics/playerCosmetic.js";

const BASE_PLAYER_SIZE = 28; // Define the base size for the player character.

/**
 * Creates and initializes the player entity in the game world.
 * @param {object} k - The Kaboom.js context object.
 * @param {object} sharedState - An object containing shared game state properties like area and pause status.
 * @returns {object} The created player entity.
 */
export function createPlayer(k, sharedState) {
  // Define initial player stats and properties in a single, readable object.
  const playerStats = {
    bulletSpreadDeg: 10,
    critChance: 0.1,
    critMultiplier: 2,
    projectiles: 3,
    damage: 1,
    speed: 90,
    luck: 0.2,
    bulletSpeed: 300,
    isShooting: false,
    attackSpeed: 0.55,
    isDashing: false,
    dashDuration: 0.3, // seconds
    dashCooldown: 3, // seconds
    dashTimer: 0, // Time remaining until dash is off cooldown
    dashActiveTimer: 0, // Time remaining for the current dash
    isInvincible: false,
  };

  const player = k.add([
    k.rect(BASE_PLAYER_SIZE, BASE_PLAYER_SIZE),
    k.anchor("center"),
    // Position the player in the center of the defined game area.
    k.pos(
      sharedState.area.x + sharedState.area.w / 2,
      sharedState.area.y + sharedState.area.h / 2
    ),
    k.color(0, 0, 255), // Blue color for the player.
    k.rotate(0), // Initial rotation.
    k.area(), // Enable collision detection.
    k.body(), // Enable physics (gravity, collisions).
    k.health(3, 10), // Initial health 3, max health 10.
    "player", // Tag for easy identification.
    playerStats, // Spread the player stats directly onto the player object.
  ]);

  // Movement and rotation logic
  player.onUpdate(() => {
    if (sharedState.isPaused) return; // Halt all player updates if the game is paused.

    // Handle dash timers:
    // Update dash cooldown timer
    if (player.dashTimer > 0) {
      player.dashTimer = Math.max(0, player.dashTimer - k.dt());
    }
    // Update active dash duration timer
    if (player.dashActiveTimer > 0) {
      player.dashActiveTimer = Math.max(0, player.dashActiveTimer - k.dt());
      if (player.dashActiveTimer <= 0) {
        player.isDashing = false; // End the dash state
      }
    }

    // Player always faces the mouse cursor.
    player.rotateTo(k.mousePos().angle(player.pos));

    // Calculate movement direction based on key presses.
    let moveDirection = k.vec2(0, 0);
    if (keysPressed["ArrowLeft"] || keysPressed["KeyA"]) moveDirection.x -= 1;
    if (keysPressed["ArrowRight"] || keysPressed["KeyD"]) moveDirection.x += 1;
    if (keysPressed["ArrowUp"] || keysPressed["KeyW"]) moveDirection.y -= 1;
    if (keysPressed["ArrowDown"] || keysPressed["KeyS"]) moveDirection.y += 1;

    // Normalize the direction vector to ensure consistent speed when moving diagonally.
    moveDirection = moveDirection.unit();

    // Determine effective movement speed, applying dash multiplier if active.
    const effectiveMoveSpeed = player.isDashing
      ? player.speed * 4
      : player.speed;
    player.move(moveDirection.scale(effectiveMoveSpeed));

    // Clamp player position within the defined game area boundaries.
    player.pos.x = k.clamp(
      player.pos.x,
      sharedState.area.x,
      sharedState.area.x + sharedState.area.w
    );
    player.pos.y = k.clamp(
      player.pos.y,
      sharedState.area.y,
      sharedState.area.y + sharedState.area.h
    );
  });

  // Event listeners for key presses to update movement state.
  k.onKeyDown((key) => {
    keysPressed[key] = true;
  });

  k.onKeyRelease((key) => {
    keysPressed[key] = false;
  });

  // DASH on Space key press.
  k.onKeyPress("space", () => {
    // Prevent dashing if already dashing or dash is on cooldown.
    if (player.dashTimer > 0 || player.isDashing) return;

    player.isDashing = true; // Activate dash state.
    player.dashActiveTimer = player.dashDuration; // Set duration for active dash.
    player.dashTimer = player.dashCooldown; // Start dash cooldown.
  });

  /**
   * Calculates the progress of the dash cooldown.
   * @returns {number} A value between 0 (ready) and 1 (on cooldown).
   */
  player.getDashCooldownProgress = () => {
    return k.map(player.dashTimer, 0, player.dashCooldown, 1, 0); // Using k.map for cleaner interpolation
  };

  // Store initial stats for potential resets or percentage-based upgrades.
  player._baseStats = {
    damage: player.damage,
    speed: player.speed,
    attackSpeed: player.attackSpeed,
    bulletSpeed: player.bulletSpeed,
    projectiles: player.projectiles,
    critChance: player.critChance,
    luck: player.luck,
  };

  // Setup player visual cosmetics and dynamic barrel entities.
  setupPlayerCosmetics(k, player);
  rebuildBarrelsAsEntities(k, player, {
    width: 32,
    height: 6,
    colour: [255, 220, 20],
    rounded: false,
    inset: 16,
  });

  return player;
}
