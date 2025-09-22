// components/enemy/boss/bossAI.js
import { rotateTowardsPlayer, useAbilityHelper, attachProjectileDamageHandler } from "./bossAIcommon.js";
import { BOSS_CONFIG } from "./bossConfig.js";
import { summonMinions, spreadShot, chargeAttack } from "./bossAbilities.js";

/**
 * Attach boss brain.
 */
export function attachBossBrain(k, boss, player, gameContext) {
  const phase1Config = BOSS_CONFIG.phases[1];
  boss.phase = 1;
  boss.originalColor = [...phase1Config.color];
  boss.speed = boss.baseSpeed * phase1Config.speedMultiplier;
  boss.cooldowns = { ...BOSS_CONFIG.cooldowns };

  boss.isBusy = false;
  boss.isVulnerable = false;
  boss.tag("boss");
  boss.use(k.color(...boss.originalColor));

  boss.onUpdate(() => {
    if (gameContext.sharedState.isPaused || boss.dead || boss.isBusy) {
      return;
    }

    // update cooldowns
    for (const key in boss.cooldowns) {
      if (boss.cooldowns[key] > 0) boss.cooldowns[key] -= k.dt();
    }

    // update phase
    const hpRatio = boss.hp() / boss.maxHp;
    let newPhase = boss.phase;
    if (hpRatio <= 0.3 && boss.phase < 3) newPhase = 3;
    else if (hpRatio <= 0.6 && boss.phase < 2) newPhase = 2;
    if (newPhase !== boss.phase) {
      boss.phase = newPhase;
      const phaseConfig = BOSS_CONFIG.phases[boss.phase];
      boss.originalColor = [...phaseConfig.color];
      boss.speed = boss.baseSpeed * phaseConfig.speedMultiplier;
      if (!boss.isVulnerable) boss.use(k.color(...boss.originalColor));
    }

    // decide ability (priority: charge, summon, spreadShot)
    const phaseAbilities = BOSS_CONFIG.phases[boss.phase].abilities;

    if (phaseAbilities.charge && boss.cooldowns.charge <= 0) {
      boss.cooldowns.charge = BOSS_CONFIG.cooldowns.charge * (boss.phase === 3 ? 1.5 : 1);
      // call the charge ability
      useAbilityHelper(k, boss, player, gameContext, chargeAttack, {
        blockDuringTelegraph: true,
      });
      return;
    }

    if (phaseAbilities.summon && boss.cooldowns.summon <= 0) {
      boss.cooldowns.summon = BOSS_CONFIG.cooldowns.summon;
      useAbilityHelper(k, boss, player, gameContext, summonMinions, {
        blockDuringTelegraph: true,
      });
      return;
    }

    if (phaseAbilities.spreadShot && boss.cooldowns.spreadShot <= 0) {
      boss.cooldowns.spreadShot = BOSS_CONFIG.cooldowns.spreadShot;
      useAbilityHelper(k, boss, player, gameContext, spreadShot, {
        blockDuringTelegraph: true,
      });
      return;
    }

    // no ability used, move toward player
    rotateTowardsPlayer(k, boss, player, 10);
    boss.moveTo(player.pos, boss.speed);
  });

  // shared projectile handling (damage, buffs, death)
  attachProjectileDamageHandler(k, boss, player, gameContext);
}
