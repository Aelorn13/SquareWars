/**
 * @file Contains the main AI brain that initializes the boss and controls its behavior.
 */

import { BOSS_CONFIG, VULNERABILITY_DAMAGE_MULTIPLIER, CHARGE_MOVE_DURATION, VULNERABILITY_DURATION, CHARGE_SPEED_MULTIPLIER } from "./bossConfig.js";
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

  // --- Core State Properties ---
  boss.isBusy = false;
  boss.isVulnerable = false;

  // --- State Machine Properties for Resumable Abilities ---
  boss.currentAbility = null; // e.g., "charge"
  boss.abilityStep = null;    // e.g., "telegraph", "move", "vulnerable"
  boss.stepTimer = 0;         // A manual timer for each step
  boss.chargeDirection = null;  // To store data between steps

  boss.use(k.color(...boss.originalColor));

  // --- Main AI Update Loop ---
  boss.onUpdate(() => {
    // 1. Global Guard Clauses: Game is paused or boss is dead
    if (gameContext.sharedState.isPaused || boss.dead) return;

    // 2. STATE MACHINE LOGIC: If an ability is in progress, handle it
    if (boss.isBusy && boss.currentAbility) {
      boss.stepTimer -= k.dt(); // Countdown the timer for the current step

      // A. LOGIC TO RUN *DURING* A STEP
      if (boss.abilityStep === "move") {
        const moveVector = boss.chargeDirection.scale(boss.baseSpeed * CHARGE_SPEED_MULTIPLIER);
        boss.pos = boss.pos.add(moveVector.scale(k.dt()));
      }

      // B. LOGIC TO RUN WHEN A STEP *ENDS*
      if (boss.stepTimer <= 0) {
        // When timer ends, transition to the NEXT step
        switch (`${boss.currentAbility}-${boss.abilityStep}`) {

          // --- Summon Minions Transitions ---
          case "summon-telegraph":
            // Telegraph is over, now execute the summon
            const summonParams = BOSS_CONFIG.phases[boss.phase].abilities.summon;
            summonMinions.execute(k, boss, player, gameContext, summonParams);
            boss.isBusy = false;
            boss.currentAbility = null;
            break;
            
          // --- Spread Shot Transitions ---
          case "spreadShot-telegraph":
            // Telegraph is over, now execute the shot
            const spreadParams = BOSS_CONFIG.phases[boss.phase].abilities.spreadShot;
            spreadShot.execute(k, boss, gameContext, spreadParams);
            boss.isBusy = false;
            boss.currentAbility = null;
            break;

          // --- Charge Attack Transitions ---
          case "charge-telegraph":
            boss.abilityStep = "move";
            boss.stepTimer = CHARGE_MOVE_DURATION;
            break;

          case "charge-move":
            boss.abilityStep = "vulnerable";
            boss.stepTimer = VULNERABILITY_DURATION;
            boss.isVulnerable = true;
            // Start the flashing effect
            boss.vulnerabilityFlasher = k.loop(0.15, () => {
              if (gameContext.sharedState.isPaused) return;
              boss.color = boss.color.eq(k.rgb(...boss.originalColor))
                ? k.rgb(...BOSS_CONFIG.telegraphs.vulnerable.color)
                : k.rgb(...boss.originalColor);
            });
            break;

          case "charge-vulnerable":
            // Ability is over, reset state
            boss.vulnerabilityFlasher.cancel();
            boss.isVulnerable = false;
            boss.isBusy = false;
            boss.currentAbility = null;
            boss.color = k.rgb(...boss.originalColor);
            break;
        }
      }
      return; // If busy with an ability, don't do anything else
    }

    // 3. Logic that should ALWAYS run when not busy: updating cooldowns and phase.
    updateCooldowns(k, boss);
    updatePhase(k, boss);

    // 4. Action/Decision logic.
    if (boss.isBusy) return; // Should not be reached if state machine is active, but good failsafe

    const didUseAbility = executeNextAbility(k, boss, player, gameContext);
    if (!didUseAbility) {
      boss.moveTo(player.pos, boss.speed);
    }
  });

  // --- Collision Logic ---
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

function executeNextAbility(k, boss, player, gameContext) {
  const phaseAbilities = BOSS_CONFIG.phases[boss.phase].abilities;

  if (phaseAbilities.charge && boss.cooldowns.charge <= 0) {
    boss.cooldowns.charge = BOSS_CONFIG.cooldowns.charge * (boss.phase === 3 ? 1.5 : 1);
    chargeAttack.initiate(k, boss, player, gameContext);
    return true;
  }
  
  if (phaseAbilities.summon && boss.cooldowns.summon <= 0) {
    boss.cooldowns.summon = BOSS_CONFIG.cooldowns.summon;
    summonMinions.initiate(k, boss, gameContext, phaseAbilities.summon);
    return true;
  }
  
  if (phaseAbilities.spreadShot && boss.cooldowns.spreadShot <= 0) {
    boss.cooldowns.spreadShot = BOSS_CONFIG.cooldowns.spreadShot;
    spreadShot.initiate(k, boss, gameContext, phaseAbilities.spreadShot);
    return true;
  }

  return false;
}