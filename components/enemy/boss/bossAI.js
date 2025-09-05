/**
 * @file Contains the main AI brain that initializes the boss and controls its behavior.
 */

import { BOSS_CONFIG, VULNERABILITY_DAMAGE_MULTIPLIER } from "./bossConfig.js";
import { summonMinions, spreadShot, chargeAttack } from "./bossAbilities.js";
import { showCritEffect } from "../enemyBehavior.js";

/**
 * Attaches the main AI logic to the boss game object.
 */
export function attachBossBrain(k, boss, player, gameContext) {
  // --- Initialize Boss State ---
  const phase1Config = BOSS_CONFIG.phases[1];
  boss.phase = 1;
  boss.originalColor = [...phase1Config.color];
  boss.speed = boss.baseSpeed * phase1Config.speedMultiplier;
  boss.cooldowns = { ...BOSS_CONFIG.cooldowns };
  boss.isBusy = false;
  boss.isVulnerable = false;
  boss.use(k.color(...boss.originalColor));

  // --- Main AI Update Loop (Restructured for reliability) ---
  boss.onUpdate(() => {
    // 1. Initial guard clauses.
    if (gameContext.sharedState.isPaused || boss.dead) return;

    // 2. Logic that should ALWAYS run: updating timers and phase.
    updateCooldowns(k, boss);
    updatePhase(k, boss); // This function will now work correctly.

    // 3. Action/Decision logic.
    if (boss.isBusy) return;

    // If not busy, decide on the next action: either move or use an ability.
    const didUseAbility = executeNextAbility(k, boss, player, gameContext);

    // Only move towards the player if no ability was used this frame.
    if (!didUseAbility) {
      boss.moveTo(player.pos, boss.speed);
    }
  });

  boss.onCollide("projectile", (projectile) => {
    if (boss.dead) return;
    k.destroy(projectile);

    let damage = projectile.damage;
    if (boss.isVulnerable) {
      damage *= VULNERABILITY_DAMAGE_MULTIPLIER;
      showCritEffect(k, boss.pos, "CRIT!", k.rgb(255, 255, 0));
      k.shake(3);
    } else if (projectile.isCrit) {
      showCritEffect(k, boss.pos, "CRIT!", k.rgb(255, 0, 0));
    }

    boss.hurt(damage);

    if (boss.hp() <= 0) {
      boss.die();
    }
  });
}

// --- Internal AI Logic ---

function updatePhase(k, boss) {
  const hpRatio = boss.hp() / boss.maxHp;
  let newPhase = boss.phase;

  if (hpRatio <= 0.3 && boss.phase < 3) newPhase = 3;
  else if (hpRatio <= 0.6 && boss.phase < 2) newPhase = 2;

  if (newPhase !== boss.phase) {
    boss.phase = newPhase;
    const phaseConfig = BOSS_CONFIG.phases[boss.phase];
    boss.originalColor = [...phaseConfig.color];
    boss.speed = boss.baseSpeed * phaseConfig.speedMultiplier;
    
    if (!boss.isVulnerable) {
      boss.use(k.color(...boss.originalColor));
    }
  }
}

function updateCooldowns(k, boss) {
  for (const key in boss.cooldowns) {
    if (boss.cooldowns[key] > 0) {
      boss.cooldowns[key] -= k.dt();
    }
  }
}

/**
 * Checks and executes the highest priority ability that is off cooldown.
 * @returns {boolean} - True if an ability was used, false otherwise.
 */
function executeNextAbility(k, boss, player, gameContext) {
  const phaseAbilities = BOSS_CONFIG.phases[boss.phase].abilities;

  if (phaseAbilities.charge && boss.cooldowns.charge <= 0) {
    boss.cooldowns.charge = BOSS_CONFIG.cooldowns.charge * (boss.phase === 3 ? 1.5 : 1);
    chargeAttack(k, boss, player);
    return true; // An ability was used
  }
  
  if (phaseAbilities.summon && boss.cooldowns.summon <= 0) {
    boss.cooldowns.summon = BOSS_CONFIG.cooldowns.summon;
    summonMinions(k, boss, player, gameContext, phaseAbilities.summon);
    return true; // An ability was used
  }
  
  if (phaseAbilities.spreadShot && boss.cooldowns.spreadShot <= 0) {
    boss.cooldowns.spreadShot = BOSS_CONFIG.cooldowns.spreadShot;
    spreadShot(k, boss, phaseAbilities.spreadShot);
    return true; // An ability was used
  }

  return false; // No ability was used
}