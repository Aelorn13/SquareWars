/**
 * @file Contains the main AI brain that initializes the boss and controls its behavior.
 * This AI is now a high-level controller that triggers self-contained abilities.
 */
import { showCritEffect,lerpAngle } from "../enemyBehavior.js";
import { BOSS_CONFIG, VULNERABILITY_DAMAGE_MULTIPLIER } from "./bossConfig.js";
import { summonMinions, spreadShot, chargeAttack } from "./bossAbilities.js";

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

  boss.use(k.color(...boss.originalColor));

  // --- Main AI Update Loop ---
  boss.onUpdate(() => {
    // Global guard clause: If the game is paused, or the boss is dead or busy, do nothing.
    if (gameContext.sharedState.isPaused || boss.dead || boss.isBusy) {
      return;
    }

    // 1. Logic that runs when the boss is free to act.
    updateCooldowns(k, boss);
    updatePhase(k, boss);

    // 2. Decide on the next action.
    const didUseAbility = executeNextAbility(k, boss, player, gameContext);
    if (!didUseAbility) {
            // Move towards player when not using an ability
      // ---  SMOOTH ROTATION LOGIC ---
      const dir = player.pos.sub(boss.pos);
      const targetAngle = dir.angle() + 90;
      const smoothingFactor = 10; // Higher number means faster turning

      boss.angle = lerpAngle(
        boss.angle,
        targetAngle,
        k.dt() * smoothingFactor
      );

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

  // A helper function to orchestrate using a self-contained ability.
  const useAbility = (ability) => {
    boss.isBusy = true; // Set the lock to prevent other actions.
    const telegraph = ability.initiate(k, boss, player, gameContext);
    const params = ability.getParams(boss.phase);

    k.wait(telegraph.duration, () => {
      // After the telegraph, execute the ability's main logic.
      if (boss.exists()) { // Ensure boss wasn't killed during telegraph
        ability.execute(k, boss, player, gameContext, params);
      }
    });
    
    // For abilities that don't self-terminate (like summon/spreadshot), the AI releases the busy lock.
    // The self-contained chargeAttack handles this itself at the end of its full sequence.
    if (ability.name !== "charge") {
        k.wait(telegraph.duration + 0.1, () => { // A brief moment after execution starts
            if (boss.exists()) boss.isBusy = false;
        });
    }
  };

  // --- Ability Priority List ---
  if (phaseAbilities.charge && boss.cooldowns.charge <= 0) {
    boss.cooldowns.charge = BOSS_CONFIG.cooldowns.charge * (boss.phase === 3 ? 1.5 : 1);
    useAbility(chargeAttack);
    return true;
  }
  
  if (phaseAbilities.summon && boss.cooldowns.summon <= 0) {
    boss.cooldowns.summon = BOSS_CONFIG.cooldowns.summon;
    useAbility(summonMinions);
    return true;
  }
  
  if (phaseAbilities.spreadShot && boss.cooldowns.spreadShot <= 0) {
    boss.cooldowns.spreadShot = BOSS_CONFIG.cooldowns.spreadShot;
    useAbility(spreadShot);
    return true;
  }

  return false;
}