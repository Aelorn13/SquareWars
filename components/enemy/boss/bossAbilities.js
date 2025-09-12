/**
 * @file A library of reusable abilities for bosses and minibosses.
 * This file defines the setup and execution logic for boss abilities.
 * The abilities are designed to be controlled by the state machine in brain.js.
 */
import { BOSS_CONFIG } from "./bossConfig.js";
import { telegraphEffect } from "./bossVisuals.js";
import { spawnEnemy } from "../enemySpawner.js";

/**
 * HELPER FUNCTION to reduce repetition in ability initiation.
 * Sets the boss's state for the start of a new ability.
 * @param {object} boss - The boss game object.
 * @param {string} abilityName - The name of the ability (e.g., "summon").
 * @returns {object} The telegraph configuration for the ability.
 */
function _initiateAbility(boss, abilityName) {
  boss.isBusy = true;
  boss.currentAbility = abilityName;
  boss.abilityStep = "telegraph";
  const telegraph = BOSS_CONFIG.telegraphs[abilityName];
  boss.stepTimer = telegraph.duration;
  return telegraph;
}

/**
 * Summons a wave of minions around the boss.
 */
export const summonMinions = {
  /**
   * Initiates the summon ability, starting the telegraph.
   */
  initiate(k, boss) {
    const telegraph = _initiateAbility(boss, "summon");
    telegraphEffect(k, boss, telegraph.color, boss.stepTimer);
  },

  /**
   * Executes the summon after the telegraph finishes.
   */
  execute(k, boss, player, gameContext, params) {
    for (let i = 0; i < params.count; i++) {
      const randomAngle = k.rand(0, 360);
      const angleInRadians = k.deg2rad(randomAngle);
      const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));
      const offset = direction.scale(k.rand(80, 120));
      const spawnPos = boss.pos.add(offset);

      spawnEnemy(k, player, gameContext, {
        forceType: params.minionType,
        spawnPos,
      });
    }
  }
};

/**
 * Fires a circular spread of projectiles.
 */
export const spreadShot = {
  /**
   * Initiates the spread shot ability, starting the telegraph.
   */
  initiate(k, boss) {
    const telegraph = _initiateAbility(boss, "spreadShot");
    telegraphEffect(k, boss, telegraph.color, boss.stepTimer);
  },

  /**
   * Executes the spread shot after the telegraph, creating pausable bullets.
   */
  execute(k, boss, gameContext, params) {
    const angleStep = 360 / params.count;
    for (let i = 0; i < params.count; i++) {
      const currentAngle = i * angleStep;
      const angleInRadians = k.deg2rad(currentAngle);
      const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));

      const bullet = k.add([
        k.rect(8, 8),
        k.color(255, 120, 0),
        k.pos(boss.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }),
        "bossBullet",
        {
          damage: params.damage,
          velocity: direction.scale(params.speed),
        },
      ]);

      bullet.onUpdate(() => {
        if (!gameContext.sharedState.isPaused) {
          bullet.pos = bullet.pos.add(bullet.velocity.scale(k.dt()));
        }
      });
    }
  }
};

/**
 * Handles the multi-stage charge attack.
 */
export const chargeAttack = {
  /**
   * Initiates the charge sequence.
   */
  initiate(k, boss, player) {
    const telegraph = _initiateAbility(boss, "charge");
    
    // Logic specific to charge attack
    boss.chargeDirection = player.pos.sub(boss.pos).unit();

    // The telegraphEffect call is slightly different for charge
    telegraphEffect(k, boss, telegraph.color, boss.stepTimer, false);
  }
  // The 'execute' logic for charge is handled by the state machine in brain.js
};