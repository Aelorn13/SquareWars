/**
 * @file A library of reusable abilities for bosses and minibosses.
 */
import { 
    BOSS_CONFIG, 
    CHARGE_MOVE_DURATION, 
    CHARGE_SPEED_MULTIPLIER, 
    VULNERABILITY_DURATION 
} from "./bossConfig.js";
import { telegraphEffect } from "./bossVisuals.js";
import { spawnEnemy } from "../enemySpawner.js";

export const summonMinions = {
  name: "summon",
  initiate(k, entity, player) {
    const telegraph = BOSS_CONFIG.telegraphs[this.name];
    telegraphEffect(k, entity, telegraph.color, telegraph.duration, true);
    return telegraph;
  },
  getParams(phase = 1) { return BOSS_CONFIG.phases[phase].abilities.summon; },
  execute(k, entity, player, gameContext, params) {
    for (let i = 0; i < params.count; i++) {
      const angleInRadians = k.deg2rad(k.rand(0, 360));
      const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));
      const baseDistance = entity.width * 0.75;
      const randomOffset = k.rand(30, 70);
      const offset = direction.scale(baseDistance + randomOffset);
      const spawnPos = entity.pos.add(offset);

      spawnEnemy(k, player, gameContext, {
        forceType: params.minionType,
        spawnPos,
      });
    }
  }
};

export const spreadShot = {
  name: "spreadShot",
  initiate(k, entity, player) {
    const telegraph = BOSS_CONFIG.telegraphs[this.name];
    telegraphEffect(k, entity, telegraph.color, telegraph.duration, true);
    return telegraph;
  },
  getParams(phase = 1) {
    const params = BOSS_CONFIG.phases[phase].abilities.spreadShot;
    return params || { damage: 1, speed: 250, count: 8 };
  },
  execute(k, entity, player, gameContext, params) {
    const angleStep = 360 / params.count;
    for (let i = 0; i < params.count; i++) {
      const currentAngle = i * angleStep;
      const angleInRadians = k.deg2rad(currentAngle);
      const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));
      k.add([
        k.rect(8, 8), k.color(255, 120, 0), k.pos(entity.pos), k.area(), k.anchor("center"),
        k.offscreen({ destroy: true }), "bossBullet",
        {
          damage: params.damage,
          velocity: direction.scale(params.speed),
          update() {
            if (!gameContext.sharedState.isPaused) {
              this.pos = this.pos.add(this.velocity.scale(k.dt()));
            }
          }
        },
      ]);
    }
  }
};


export const chargeAttack = {
  name: "charge",
  initiate(k, entity, player) {
    const telegraph = BOSS_CONFIG.telegraphs[this.name];
    entity.chargeDirection = player.pos.sub(entity.pos).unit();
    telegraphEffect(k, entity, telegraph.color, telegraph.duration, false);
    return telegraph;
  },
  getParams() {
    return {
      moveDuration: CHARGE_MOVE_DURATION,
      vulnerabilityDuration: VULNERABILITY_DURATION,
    };
  },
  // --- This function was already correct, using 'entity' ---
  execute(k, entity, player, gameContext, params) {
    const chargeDirection = entity.chargeDirection || player.pos.sub(entity.pos).unit();
    const moveEvent = entity.onUpdate(() => {
      const moveVector = chargeDirection.scale(entity.baseSpeed * CHARGE_SPEED_MULTIPLIER);
      entity.pos = entity.pos.add(moveVector.scale(k.dt()));
    });

    k.wait(params.moveDuration, () => {
      if (!entity.exists()) return;
      moveEvent.cancel();
      entity.isVulnerable = true;

      const flasher = k.loop(0.15, () => {
        if (!entity.exists() || gameContext.sharedState.isPaused) return;
        entity.color = entity.color.eq(k.rgb(...entity.originalColor))
          ? k.rgb(...BOSS_CONFIG.telegraphs.vulnerable.color)
          : k.rgb(...entity.originalColor);
      });

      k.wait(params.vulnerabilityDuration, () => {
        if (entity.exists()) {
          flasher.cancel();
          entity.color = k.rgb(...entity.originalColor);
          entity.isVulnerable = false;
          entity.isBusy = false;
        }
      });
    });
  }
};