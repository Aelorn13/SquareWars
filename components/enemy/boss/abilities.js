// components/boss/abilities.js

import { spawnEnemy } from "../enemy.js";
import { startTelegraph } from "./utils.js";
import {
  COLOR_SUMMON_TELEGRAPH,
  TELEGRAPH_SUMMON_DURATION,
  COLOR_SPREAD_SHOT_TELEGRAPH,
  TELEGRAPH_SPREAD_SHOT_DURATION,
  COLOR_CHARGE_TELEGRAPH,
  TELEGRAPH_CHARGE_WINDUP,
  CHARGE_MOVE_DURATION,
  CHARGE_SPEED_MULTIPLIER,
  VULNERABILITY_DURATION,
} from "./constants.js";

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
export function bossSummonMinions(k, boss, player, updateHealthBar, updateScoreLabel, increaseScore, sharedState, count = 3) {
  startTelegraph(boss, COLOR_SUMMON_TELEGRAPH, TELEGRAPH_SUMMON_DURATION);

  k.wait(TELEGRAPH_SUMMON_DURATION, () => {
    for (let i = 0; i < count; i++) {
      const offset = k.vec2(k.rand(-100, 100), k.rand(-100, 100));
      const spawnPosition = boss.pos.add(offset);

      spawnEnemy(
        k,
        player,
        updateHealthBar,
        updateScoreLabel,
        increaseScore,
        sharedState,
        null,
        spawnPosition,
        sharedState.spawnProgress ?? 1,
        false
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
export function bossSpreadShot(k, boss, sharedState, damage = 2, speed = 120, count = 12) {
  startTelegraph(boss, COLOR_SPREAD_SHOT_TELEGRAPH, TELEGRAPH_SPREAD_SHOT_DURATION);

  k.wait(TELEGRAPH_SPREAD_SHOT_DURATION, () => {
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const direction = k.vec2(Math.cos(angleStep * i), Math.sin(angleStep * i));
      const bullet = k.add([
        k.rect(8, 8),
        k.color(k.rgb(255, 120, 0)),
        k.pos(boss.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }),
        "bossBullet",
        { vel: direction.scale(speed), damage },
      ]);

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
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 * @param {object} player - The player game object.
 */
export function startCharge(k, boss, player) {
  if (boss.chargeState !== "idle") return;

  boss.chargeState = "windup";
  boss.chargeTimer = 0;
  boss.chargeDirection = player.pos.sub(boss.pos).unit();
  startTelegraph(boss, COLOR_CHARGE_TELEGRAPH, TELEGRAPH_CHARGE_WINDUP, false);
}

/**
 * Updates the boss's charge state machine.
 * @param {object} k - The Kaboom.js context.
 * @param {object} boss - The boss game object.
 */
export function updateChargeState(k, boss) {
  switch (boss.chargeState) {
    case "windup":
      boss.chargeTimer += k.dt();
      if (boss.chargeTimer >= TELEGRAPH_CHARGE_WINDUP) {
        boss.chargeTimer = 0;
        boss.chargeState = "moving";
      }
      break;

    case "moving":
      boss.chargeTimer += k.dt();
      boss.pos = boss.pos.add(boss.chargeDirection.scale(boss.speed * CHARGE_SPEED_MULTIPLIER * k.dt()));
      if (boss.chargeTimer >= CHARGE_MOVE_DURATION) {
        boss.chargeTimer = 0;
        boss.chargeState = "idle";

        boss.isVulnerable = true;
        startTelegraph(boss, [255, 255, 100], VULNERABILITY_DURATION, false);

        k.wait(VULNERABILITY_DURATION, () => {
          boss.isVulnerable = false;
          if (boss._telegraphProgress === null) {
            boss.use(k.color(k.rgb(...boss.originalColor)));
          }
        });
      }
      break;

    case "idle":
    default:
      break;
  }
}