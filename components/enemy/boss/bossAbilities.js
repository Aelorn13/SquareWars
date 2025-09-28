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
    const doSpawn = () => {
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
    };

    if (!gameContext?.sharedState?.isPaused) {
      doSpawn();
      return;
    }

    // Defer until unpaused. Use entity.onUpdate so this callback is paused when the game is paused.
    const waiter = entity.onUpdate(() => {
      if (!entity.exists()) {
        waiter.cancel();
        return;
      }
      if (!gameContext.sharedState.isPaused) {
        waiter.cancel();
        doSpawn();
      }
    });
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
    const doShoot = () => {
      const angleStep = 360 / params.count;
      for (let i = 0; i < params.count; i++) {
        const currentAngle = i * angleStep;
        const angleInRadians = k.deg2rad(currentAngle);
        const direction = k.vec2(Math.cos(angleInRadians), Math.sin(angleInRadians));
k.add([
  k.rect(8, 8),
  k.pos(entity.pos),
  k.anchor("center"),
  k.color(255, 120, 0),
  k.opacity(1),              // required when using lifespan or fade
  k.area(),
  k.offscreen({ destroy: true }),
  "enemyProjectile",
  {
    damage: params.damage,
    // velocity stored so update() can move respecting pause
    velocity: direction.scale(params.speed),
    source: entity,
    _shouldDestroyAfterHit: true,
    
    update() {
      if (!gameContext.sharedState.isPaused) {
        this.pos = this.pos.add(this.velocity.scale(k.dt()));
      }
    },
  },
]);
      }
    };

    if (!gameContext?.sharedState?.isPaused) {
      doShoot();
      return;
    }

    const waiter = entity.onUpdate(() => {
      if (!entity.exists()) {
        waiter.cancel();
        return;
      }
      if (!gameContext.sharedState.isPaused) {
        waiter.cancel();
        doShoot();
      }
    });
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

  // Pause-aware execute: uses entity.onUpdate for timers so everything freezes on pause.
  execute(k, entity, player, gameContext, params) {
    const chargeDirection = entity.chargeDirection || player.pos.sub(entity.pos).unit();

    // ensure we have a safe original color array to avoid runtime errors
    const origColorArr = Array.isArray(entity.originalColor) ? entity.originalColor : [255, 255, 255];
    if (!Array.isArray(entity.originalColor)) {
      entity.originalColor = origColorArr;
    }

    let moveRemaining = params.moveDuration;
    let vulnRemaining = params.vulnerabilityDuration;
    let flashAcc = 0;
    const flashInterval = 0.15;

    const updater = entity.onUpdate(() => {
      if (!entity.exists()) {
        updater.cancel();
        return;
      }

      // honor global pause (also safe if k.dt() returns 0)
      if (gameContext && gameContext.sharedState && gameContext.sharedState.isPaused) {
        return;
      }

      const dt = k.dt();

      // Phase 1: moving
      if (moveRemaining > 0) {
        const moveVec = chargeDirection.scale(entity.baseSpeed * CHARGE_SPEED_MULTIPLIER);
        entity.pos = entity.pos.add(moveVec.scale(dt));
        moveRemaining -= dt;

        // transition to vulnerable when move finished
        if (moveRemaining <= 0) {
          entity.isVulnerable = true;
          // reset flash accumulator so first toggle happens after interval
          flashAcc = 0;
        }

        return;
      }

      // Phase 2: vulnerability flashing + timer
      if (entity.isVulnerable && vulnRemaining > 0) {
        vulnRemaining -= dt;
        flashAcc += dt;

        if (flashAcc >= flashInterval) {
          flashAcc -= flashInterval;
          // toggle color between original and vulnerable telegraph color
          const origCol = k.rgb(...origColorArr);
          const vulnCol = k.rgb(...BOSS_CONFIG.telegraphs.vulnerable.color);
          entity.color = entity.color.eq(origCol) ? vulnCol : origCol;
        }

        // finish vulnerability window
        if (vulnRemaining <= 0) {
          entity.color = k.rgb(...origColorArr);
          entity.isVulnerable = false;
          entity.isBusy = false;
          updater.cancel();
        }

        return;
      }

      // Safety: if not vulnerable and no move remaining, ensure we clean up
      if (moveRemaining <= 0 && vulnRemaining <= 0) {
        entity.color = k.rgb(...origColorArr);
        entity.isVulnerable = false;
        entity.isBusy = false;
        updater.cancel();
      }
    });
  },
};
