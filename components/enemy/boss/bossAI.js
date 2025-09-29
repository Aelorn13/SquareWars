// ===== components/enemy/boss/bossAI.js =====
import { rotateTowardsPlayer, useAbilityHelper, attachProjectileDamageHandler } from "./bossAIcommon.js";
import { BOSS_CONFIG } from "./bossConfig.js";
import { summonMinions, spreadShot, chargeAttack } from "./bossAbilities.js";

export function attachBossBrain(k, boss, player, gameContext) {
  // Initialize phase 1
  const phase1 = BOSS_CONFIG.phases[1];
  boss.phase = 1;
  boss.originalColor = [...phase1.color];
  boss.speed = boss.baseSpeed * phase1.speedMultiplier;
  boss.cooldowns = { ...BOSS_CONFIG.cooldowns };
  boss.isBusy = false;
  boss.isVulnerable = false;
  boss.tag("boss");
  boss.use(k.color(...boss.originalColor));

  boss.onUpdate(() => {
    if (gameContext.sharedState.isPaused || boss.dead || boss.isBusy) return;

    // Update cooldowns
    Object.keys(boss.cooldowns).forEach(key => {
      if (boss.cooldowns[key] > 0) boss.cooldowns[key] -= k.dt();
    });

    // Update phase based on HP
    const hpRatio = boss.hp() / boss.maxHp;
    let newPhase = boss.phase;
    if (hpRatio <= 0.3 && boss.phase < 3) newPhase = 3;
    else if (hpRatio <= 0.6 && boss.phase < 2) newPhase = 2;

    if (newPhase !== boss.phase) {
      boss.phase = newPhase;
      const config = BOSS_CONFIG.phases[boss.phase];
      boss.originalColor = [...config.color];
      boss.speed = boss.baseSpeed * config.speedMultiplier;
      if (!boss.isVulnerable) boss.use(k.color(...boss.originalColor));
    }

    const abilities = BOSS_CONFIG.phases[boss.phase].abilities;

    // Priority: charge > summon > spreadShot
    if (abilities.charge && boss.cooldowns.charge <= 0) {
      boss.cooldowns.charge = BOSS_CONFIG.cooldowns.charge * (boss.phase === 3 ? 1.5 : 1);
      useAbilityHelper(k, boss, player, gameContext, chargeAttack, { blockDuringTelegraph: true });
      return;
    }

    if (abilities.summon && boss.cooldowns.summon <= 0) {
      boss.cooldowns.summon = BOSS_CONFIG.cooldowns.summon;
      useAbilityHelper(k, boss, player, gameContext, summonMinions, { blockDuringTelegraph: true });
      return;
    }

    if (abilities.spreadShot && boss.cooldowns.spreadShot <= 0) {
      boss.cooldowns.spreadShot = BOSS_CONFIG.cooldowns.spreadShot;
      useAbilityHelper(k, boss, player, gameContext, spreadShot, { blockDuringTelegraph: true });
      return;
    }

    // Default: move toward player
    rotateTowardsPlayer(k, boss, player, 10);
    boss.moveTo(player.pos, boss.speed);
  });

  attachProjectileDamageHandler(k, boss, player, gameContext);
}