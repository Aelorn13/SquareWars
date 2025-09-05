/**
 * @file A library of reusable abilities for bosses and minibosses.
 */
import { BOSS_CONFIG, CHARGE_MOVE_DURATION, CHARGE_SPEED_MULTIPLIER, VULNERABILITY_DURATION } from "./bossConfig.js";
import { telegraphEffect } from "./bossVisuals.js";
import { spawnEnemy } from "../enemySpawner.js";

/**
 * Summons a wave of minions around the boss.
 */
export function summonMinions(k, boss, player, gameContext, params) {
  boss.isBusy = true;
  const telegraph = BOSS_CONFIG.telegraphs.summon;
  telegraphEffect(k, boss, telegraph.color, telegraph.duration).then(() => {
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
    boss.isBusy = false;
  });
}

/**
 * Fires a circular spread of projectiles.
 */
export function spreadShot(k, boss, params) {
  boss.isBusy = true;
  const telegraph = BOSS_CONFIG.telegraphs.spreadShot;
  telegraphEffect(k, boss, telegraph.color, telegraph.duration).then(() => {
    const angleStep = 360 / params.count;
    for (let i = 0; i < params.count; i++) {
      const currentAngle = i * angleStep;
      const angleInRadians = k.deg2rad(currentAngle);
      const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));

      k.add([
        k.rect(8, 8),
        k.color(255, 120, 0),
        k.pos(boss.pos),
        k.area(),
        k.anchor("center"),
        k.offscreen({ destroy: true }),
        k.move(direction, params.speed), 
        "bossBullet",
        { damage: params.damage },
      ]);
    }
    boss.isBusy = false;
  });
}

/**
 * Executes a full charge sequence: wind-up, dash, and vulnerability phase.
 */
export function chargeAttack(k, boss, player) {
  boss.isBusy = true; 
  const chargeDirection = player.pos.sub(boss.pos).unit();
  const telegraph = BOSS_CONFIG.telegraphs.charge;

  telegraphEffect(k, boss, telegraph.color, telegraph.duration, false).then(() => {
    k.tween(
      boss.pos,
      boss.pos.add(chargeDirection.scale(boss.baseSpeed * CHARGE_SPEED_MULTIPLIER * CHARGE_MOVE_DURATION)),
      CHARGE_MOVE_DURATION,
      (p) => boss.pos = p,
      k.easings.easeOutQuad
    ).then(() => {
      boss.isVulnerable = true;
      const vulnerabilityTimer = k.loop(0.15, () => {
        boss.color = boss.color.eq(k.rgb(...boss.originalColor))
          ? k.rgb(...BOSS_CONFIG.telegraphs.vulnerable.color)
          : k.rgb(...boss.originalColor);
      });

      k.wait(VULNERABILITY_DURATION, () => {
        vulnerabilityTimer.cancel();
        boss.isVulnerable = false;
        boss.isBusy = false;
        boss.color = k.rgb(...boss.originalColor);
      });
    });
  });
}