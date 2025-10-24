// ===== components/enemy/corruptorEnemy.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";

const TRAIL_COOLDOWN = 0.75;
const POOL_LIFESPAN = 5.0;   
const POOL_SIZE = 20;
const SLOW_MODIFIER = 0.5;   
const FADE_DURATION = 0.5;   

let isPuddleLogicSetup = false;

function setupPuddleLogic(k, gameContext) {
  if (isPuddleLogicSetup) return;

  k.onUpdate("slimePuddle", (puddle) => {
    if (gameContext.sharedState.isPaused || gameContext.sharedState.upgradeOpen) {
      return;
    }

    puddle._lifeTimer -= k.dt();

    if (puddle._lifeTimer <= FADE_DURATION) {
      puddle.opacity = Math.max(0, puddle._lifeTimer / FADE_DURATION);
    }
    
    if (puddle._lifeTimer <= 0) {
      puddle.destroy();
    }
  });

  isPuddleLogicSetup = true; 
}


export function createCorruptorEnemy(k, player, gameContext, spawnPos) {
  setupPuddleLogic(k, gameContext);

  const cfg = ENEMY_CONFIGS.slime;
  const slime = createEnemyGameObject(k, player, cfg, spawnPos, gameContext);

  attachEnemyBehaviors(k, slime, player);

  slime._trailCooldown = TRAIL_COOLDOWN;

  slime.onUpdate(() => {
    if (slime.dead || gameContext.sharedState.isPaused || gameContext.sharedState.upgradeOpen) return;

    slime._trailCooldown -= k.dt();
    if (slime._trailCooldown <= 0) {
      slime._trailCooldown = TRAIL_COOLDOWN;
      
      const slimePoolPoints = [
        k.vec2(0, -POOL_SIZE), k.vec2(POOL_SIZE * 0.8, -POOL_SIZE * 0.6),
        k.vec2(POOL_SIZE, 0), k.vec2(POOL_SIZE * 0.5, POOL_SIZE * 0.9),
        k.vec2(-POOL_SIZE * 0.2, POOL_SIZE), k.vec2(-POOL_SIZE, POOL_SIZE * 0.3),
        k.vec2(-POOL_SIZE * 0.9, -POOL_SIZE * 0.4),
      ];

      k.add([
        k.polygon(slimePoolPoints),
        k.pos(slime.pos),
        k.anchor("center"),
        k.area({ shape: new k.Polygon(slimePoolPoints) }),
        k.color(80, 150, 30),
        k.opacity(0.7),
        k.z(-1),
        "slimePuddle",
        {
          slowdownModifier: SLOW_MODIFIER,
          _lifeTimer: POOL_LIFESPAN, 
        }
      ]);
    }
  });

  return slime;
}