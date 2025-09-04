// components/enemy/boss.js
import { spawnEnemy } from "./enemy.js";

// --- Constants ---
// Cooldown durations for various boss abilities, in seconds.
export const SUMMON_COOLDOWN = 9;
export const SHOOT_COOLDOWN = 2;
export const CHARGE_COOLDOWN = 5;

// Telegraph animation durations for different actions.
const TELEGRAPH_SUMMON_DURATION = 0.4;
const TELEGRAPH_SPREAD_SHOT_DURATION = 0.25;
const TELEGRAPH_CHARGE_WINDUP = 1.0;
const TELEGRAPH_FADE_OUT_DURATION = 0.2;

// Boss colors for telegraphing actions.
const COLOR_SUMMON_TELEGRAPH = [0, 200, 0]; // Green for summoning minions
const COLOR_SPREAD_SHOT_TELEGRAPH = [200, 100, 0]; // Orange for spread shot
const COLOR_CHARGE_TELEGRAPH = [200, 0, 0]; // Red for charging

// Boss base colors for each phase (darker variations)
const PHASE_COLORS = {
  1: [60, 20, 20],   // Dark reddish
  2: [60, 40, 20],   // Dark orange-ish
  3: [40, 20, 60]    // Dark purplish (example for phase 3)
};

// Charge ability specific constants
const CHARGE_MOVE_DURATION = 0.6; // How long the boss moves during a charge
const CHARGE_SPEED_MULTIPLIER = 6; // Multiplier for boss speed during charge

// New constants for vulnerability
const VULNERABILITY_DURATION = 1.5; // Boss vulnerable for 1.5 seconds after charge
export const VULNERABILITY_DAMAGE_MULTIPLIER = 2; // Takes 2x damage when vulnerable

// --- Utility functions ---

/**
 * Linearly interpolates between two RGB colors.
 * @param {number[]} from - The starting RGB color [r, g, b].
 * @param {number[]} to - The ending RGB color [r, g, b].
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number[]} The interpolated RGB color.
 */
function lerpColor(from, to, t) {
  return [
    Math.floor(from[0] * (1 - t) + to[0] * t),
    Math.floor(from[1] * (1 - t) + to[1] * t),
    Math.floor(from[2] * (1 - t) + to[2] * t),
  ];
}

/**
 * Initiates a visual telegraph animation for the boss, changing its color.
 * @param {object} boss - The boss game object.
 * @param {number[]} toColor - The target RGB color for the telegraph.
 * @param {number} duration - How long the color change takes.
 * @param {boolean} [returnToOriginal=true] - If true, the color will fade back to the original after the telegraph.
 */
function startTelegraph(boss, toColor, duration, returnToOriginal = true) {
  // Ensure that if a telegraph is already ongoing, it completes or transitions smoothly
  if (boss._telegraphProgress != null && boss._telegraphProgress < boss._telegraphDuration) {
    // If a telegraph is active, blend from the current display color, not originalColor
    boss._telegraphFrom = [boss.color.r, boss.color.g, boss.color.b];
  } else {
    boss._telegraphFrom = boss.originalColor; // Start from the current phase color
  }

  boss._telegraphProgress = 0;
  boss._telegraphDuration = duration;
  boss._telegraphTo = toColor;
  boss._telegraphReturn = returnToOriginal;
}

// --- Boss actions ---

/**
 * Makes the boss summon a specified number of minions.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 * @param {function} updateHealthBar - Function to update the player's health bar.
 * @param {function} updateScoreLabel - Function to update the score display.
 * @param {function} increaseScore - Function to increase the player's score.
 * @param {object} sharedState - Global game state object (e.g., for pause status).
 * @param {number} [count=3] - The number of minions to summon.
 */
function bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, count = 3) {
  startTelegraph(boss, COLOR_SUMMON_TELEGRAPH, TELEGRAPH_SUMMON_DURATION);

  // After the telegraph, spawn the minions
  k.wait(TELEGRAPH_SUMMON_DURATION, () => {
    for (let i = 0; i < count; i++) {
      // Calculate a random offset near the boss for minion spawn position
      const offset = k.vec2(k.rand(-100, 100), k.rand(-100, 100));
      const spawnPosition = boss.pos.add(offset);

      spawnEnemy(
        k,
        player,
        updateHealthBar,
        updateScoreLabel,
        increaseScore,
        sharedState,
        null, // random enemy type
        spawnPosition, // spawn near boss
        sharedState.spawnProgress ?? 1, // Use sharedState.spawnProgress or default to 1
        false // Do not immediately aggro (adjust as per game logic)
      );
    }
  });
}

/**
 * Makes the boss fire bullets in a full circle (spread shot).
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} sharedState - Global game state object.
 * @param {number} [damage=2] - Damage dealt by each bullet.
 * @param {number} [speed=120] - Speed of the bullets.
 * @param {number} [count=12] - Number of bullets to fire.
 */
function bossSpreadShot(k, boss, sharedState, damage = 2, speed = 120, count = 12) {
  startTelegraph(boss, COLOR_SPREAD_SHOT_TELEGRAPH, TELEGRAPH_SPREAD_SHOT_DURATION);

  // Wait for telegraph to complete before shooting
  k.wait(TELEGRAPH_SPREAD_SHOT_DURATION, () => {
    const angleStep = (Math.PI * 2) / count; // Angle between each bullet

    for (let i = 0; i < count; i++) {
      const direction = k.vec2(Math.cos(angleStep * i), Math.sin(angleStep * i));
      const bullet = k.add([
        k.rect(8, 8),
        k.color(k.rgb(255, 120, 0)), // Orange color for boss bullets
        k.pos(boss.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }), // Destroy bullet when it goes off-screen
        "bossBullet", // Tag for collision detection
        { vel: direction.scale(speed), damage }, // Custom component for velocity and damage
      ]);

      // Update bullet position only when game is not paused
      bullet.onUpdate(() => {
        if (!sharedState.isPaused) {
          bullet.pos = bullet.pos.add(bullet.vel.scale(k.dt()));
        }
      });
    }
  });
}

/**
 * Initiates the boss's charge sequence towards the player.
 * The charge has two states: "windup" and "moving".
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 */
function startCharge(boss, player) {
  // Only start charge if boss is idle
  if (boss.chargeState !== "idle") return;

  boss.chargeState = "windup";
  boss.chargeTimer = 0;
  // Calculate the direction towards the player
  boss.chargeDirection = player.pos.sub(boss.pos).unit();
  // Start telegraphing the charge (color changes to red)
  startTelegraph(boss, COLOR_CHARGE_TELEGRAPH, TELEGRAPH_CHARGE_WINDUP, false);
}

// --- Brain attachment ---

/**
 * Attaches the main AI logic to the boss game object.
 * This includes handling phase transitions, abilities, cooldowns, and charge mechanics.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 * @param {function} updateHealthBar - Function to update the player's health bar.
 * @param {function} updateScoreLabel - Function to update the score display.
 * @param {function} increaseScore - Function to increase the player's score.
 * @param {object} sharedState - Global game state object (e.g., for pause status).
 */
export function attachBossBrain(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState) {
  // --- Global Collision Handler for Boss Bullets ---
  // Ensure this handler is only registered once globally to prevent multiple executions.
  if (!sharedState._bossBulletHook) {
    sharedState._bossBulletHook = true; // Mark as registered
    k.onCollide("player", "bossBullet", (p, bullet) => {
      // If player is invincible, ignore collision
      if (p.isInvincible) return;

      p.hurt(bullet.damage ?? 2); // Player takes damage
      updateHealthBar?.(); // Update health bar if available
      k.destroy(bullet); // Destroy the bullet

      // If player's HP drops to 0 or below, trigger game over
      if (p.hp() <= 0) {
        k.go("gameover");
      }
    });
  }

  // --- Initialise Boss State ---
  boss.phase = 1; // Current boss phase
  boss.cooldowns = {
    summon: SUMMON_COOLDOWN,
    shoot: SHOOT_COOLDOWN,
    charge: CHARGE_COOLDOWN,
  };
  // Charge state machine: "idle" | "windup" | "moving"
  boss.chargeState = "idle";
  boss.chargeTimer = 0; // Timer for charge duration
  boss.chargeDirection = k.vec2(0, 0); // Direction of the charge
  boss.isVulnerable = false; // NEW: Boss vulnerability flag

  // Store the boss's original color to return to after telegraphs
  // This assumes `boss.color` is set during boss creation and can be read.
  // If not, you might need to explicitly set `boss.originalColor` during boss creation.
  boss.originalColor = PHASE_COLORS[1];
  // Apply the initial phase color immediately
  boss.use(k.color(k.rgb(...boss.originalColor)));


  // --- Boss Update Loop ---
  boss.onUpdate(() => {
    // If game is paused or boss is dead, do nothing
    if (sharedState.isPaused || boss.dead) return;

    // --- Telegraph Animation Update ---
    if (boss._telegraphProgress != null) {
      boss._telegraphProgress += k.dt();
      // Calculate progress (0.0 to 1.0)
      const progressRatio = Math.min(1, boss._telegraphProgress / boss._telegraphDuration);

      // Apply the interpolated color to the boss
      // If boss is vulnerable, make it flash a bright color, otherwise use telegraph lerp
      if (boss.isVulnerable && boss._telegraphProgress % 0.2 < 0.1) { // Simple flash effect
          boss.use(k.color(k.rgb(255, 255, 100))); // Bright yellow flash
      } else {
          boss.use(k.color(k.rgb(...lerpColor(boss._telegraphFrom, boss._telegraphTo, progressRatio))));
      }


      // Check if telegraph animation is complete
      if (progressRatio >= 1) {
        if (boss._telegraphReturn) {
          // If returning to original color, set up a quick fade back
          boss._telegraphFrom = boss._telegraphTo;
          boss._telegraphTo = boss.originalColor; // Fade back to the current phase color
          boss._telegraphDuration = TELEGRAPH_FADE_OUT_DURATION; // Quicker fade out
          boss._telegraphProgress = 0;
          boss._telegraphReturn = false; // No longer returning
        } else {
          // Animation finished, reset telegraph state and ensure original color is applied
          boss._telegraphProgress = null;
          // Only apply original color if not currently vulnerable
          if (!boss.isVulnerable) {
              boss.use(k.color(k.rgb(...boss.originalColor)));
          }
        }
      }
    }

    // --- Phase Transitions ---
    const hpRatio = boss.hp() / boss.maxHp;
    const previousPhase = boss.phase; // Store current phase to detect changes

    // Phase 1 to Phase 2 transition
    if (hpRatio <= 0.6 && boss.phase === 1) {
      boss.phase = 2;
      boss.speed *= 1.2; // Increase speed
    }
    // Phase 2 to Phase 3 transition
    if (hpRatio <= 0.3 && boss.phase === 2) {
      boss.phase = 3;
      boss.speed *= 1.4; // Further increase speed
    }

    // Update boss color if phase has changed
    if (boss.phase !== previousPhase) {
      boss.originalColor = PHASE_COLORS[boss.phase];
      // Immediately apply the new phase color (unless currently vulnerable)
      if (!boss.isVulnerable) {
          boss.use(k.color(k.rgb(...boss.originalColor)));
      }
      // You could also add a temporary flash or animation here to highlight the phase change
    }


    // --- Cooldown Management ---
    // Decrease all ability cooldowns by elapsed time
    boss.cooldowns.summon -= k.dt();
    boss.cooldowns.shoot -= k.dt();
    boss.cooldowns.charge -= k.dt();

    // --- Ability Activation Logic ---

    // Summon Minions ability
    if (boss.cooldowns.summon <= 0) {
      let minionCount;
      if (boss.phase === 1) minionCount = 3;
      else if (boss.phase === 2) minionCount = 5;
      else minionCount = 8; // Phase 3

      bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, minionCount);
      boss.cooldowns.summon = SUMMON_COOLDOWN; // Reset cooldown
    }

    // Spread Shot ability (only from Phase 2 onwards)
    if (boss.phase >= 2 && boss.cooldowns.shoot <= 0) {
      let bulletDamage = 2;
      let bulletSpeed = 120;
      let bulletCount = 12;

      if (boss.phase === 3) {
        bulletDamage = 3;
        bulletSpeed = 160;
        bulletCount = 18;
      }

      bossSpreadShot(k, boss, sharedState, bulletDamage, bulletSpeed, bulletCount);
      boss.cooldowns.shoot = SHOOT_COOLDOWN; // Reset cooldown
    }

    // Charge ability
    const canCharge = boss.cooldowns.charge <= 0 && boss.chargeState === "idle";

    if (canCharge) {
      if (boss.phase === 1) {
        startCharge(boss, player);
        boss.cooldowns.charge = CHARGE_COOLDOWN; // Reset for Phase 1
      } else if (boss.phase === 3) {
        // Phase 3 charge has a longer cooldown to balance increased difficulty
        startCharge(boss, player);
        boss.cooldowns.charge = CHARGE_COOLDOWN * 2; // Longer cooldown for Phase 3
      }
    }

    // --- Charge State Machine Update ---
    switch (boss.chargeState) {
      case "windup":
        boss.chargeTimer += k.dt();
        // The telegraph function already handles the color change during windup
        if (boss.chargeTimer >= TELEGRAPH_CHARGE_WINDUP) {
          boss.chargeTimer = 0;
          boss.chargeState = "moving";
        }
        break;

      case "moving":
        boss.chargeTimer += k.dt();
        // Move the boss in the calculated charge direction
        boss.pos = boss.pos.add(boss.chargeDirection.scale(boss.speed * CHARGE_SPEED_MULTIPLIER * k.dt()));
        if (boss.chargeTimer >= CHARGE_MOVE_DURATION) {
          boss.chargeTimer = 0;
          boss.chargeState = "idle"; // Return to idle state

          // NEW: Trigger vulnerability after charge finishes
          boss.isVulnerable = true;
          // Apply a visual cue for vulnerability (e.g., a rapid flash)
          startTelegraph(boss, [255, 255, 100], VULNERABILITY_DURATION, false); // Flash yellow, don't return via telegraph system

          k.wait(VULNERABILITY_DURATION, () => {
            boss.isVulnerable = false;
            // Restore original color when vulnerability ends, if no other telegraph is active
            if (boss._telegraphProgress === null) {
                boss.use(k.color(k.rgb(...boss.originalColor)));
            }
          });
        }
        break;

      case "idle":
      default:
        // Do nothing when idle
        break;
    }
  });
}