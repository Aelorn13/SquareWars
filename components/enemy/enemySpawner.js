// ===== components/enemy/enemySpawner.js =====
import { ENEMY_CONFIGS } from "./enemyConfig.js";
import { createEnemyGameObject, attachEnemyBehaviors } from "./enemyBehavior.js";
import { attachBossBrain } from "./boss/bossAI.js";
import { attachMinibossBrain } from "./boss/minibossAI.js";

import { createbroodsquareEnemy } from "./broodsquareEnemy.js";
import { createSniperEnemy } from "./sniperEnemy.js";
import { createCorruptorEnemy } from "./corruptorEnemy.js";
import { createGravitonEnemy } from "./gravitonEnemy.js";
import { createGlitchEnemy } from "./glitchEnemy.js";

import { clamp01, easeInOutSine, lerp } from "../utils/mathUtils.js";
const TELEGRAPH_DURATION = 0.6;

const specialEnemyHandlers = {
  broodsquare: createbroodsquareEnemy,
  sniper: createSniperEnemy,
  corruptor: createCorruptorEnemy,
  graviton: createGravitonEnemy,
  glitch: createGlitchEnemy,
};

export function spawnEnemy(k, player, gameContext, options = {}) {
  const { forceType, spawnPos: posOverride, progress = 0, ability, scaling = {}, difficulty } = options;

  if (!difficulty) {
    throw new Error("spawnEnemy requires a 'difficulty' controller instance in its options.");
  }

  const baseEnemyConfig = forceType ? ENEMY_CONFIGS[forceType] : chooseEnemyType(progress);
  if (!baseEnemyConfig) {
    console.error(`Failed to find enemy config for type: "${forceType}"`);
    return null;
  }

  const finalHp = difficulty.scaleStat(baseEnemyConfig.maxHp, progress);
  const finalSpeed = difficulty.scaleStat(baseEnemyConfig.speed, progress);
  let finalScore = baseEnemyConfig.score;

  if (difficulty.config.scoreStatMultiplier) {
    const scoreMultiplier = lerp(
      difficulty.config.scoreStatMultiplier.start,
      difficulty.config.scoreStatMultiplier.end,
      easeInOutSine(clamp01(progress))
    );
    finalScore = baseEnemyConfig.score * scoreMultiplier;
  }
  const finalEnemyConfig = {
    ...baseEnemyConfig,
    maxHp: finalHp,
    speed: finalSpeed,
    score: Math.round(finalScore),
  };

  const spawnPos = posOverride ?? pickEdgeSpawnPosFarFromPlayer(k, gameContext.sharedState, player);

  const createEnemy = () => {
    // Special enemy types
    const specialHandler = specialEnemyHandlers[finalEnemyConfig.name];
    if (specialHandler) {
      // If a special handler exists for this enemy name, use it.
      return specialHandler(k, player, gameContext, spawnPos);
    }

    // Standard enemy creation
    const enemy = createEnemyGameObject(k, player, finalEnemyConfig, spawnPos, gameContext);

    // Attach appropriate AI
    if (enemy.type === "boss") {
      if (typeof attachBossBrain === "function") {
        attachBossBrain(k, enemy, player, gameContext);
      } else {
        console.error("attachBossBrain function not found! Boss will have no AI.");
        // Attach default behavior as a fallback
        attachEnemyBehaviors(k, enemy, player);
      }
    } else if (enemy.type === "miniboss") {
      if (!ability || typeof ability.name !== "string") {
        console.error("Miniboss spawned with invalid or missing ability! Attaching default behavior.", ability);
        attachEnemyBehaviors(k, enemy, player);
      } else if (typeof attachMinibossBrain !== "function") {
        console.error("attachMinibossBrain function not found! Miniboss will have no AI.");
        attachEnemyBehaviors(k, enemy, player);
      } else {
        attachMinibossBrain(k, enemy, player, gameContext, ability, scaling);
      }
    } else {
      attachEnemyBehaviors(k, enemy, player);
    }
    return enemy;
  };

  // Immediate spawn if position override
  if (posOverride) {
    const enemy = createEnemy();
    if (finalEnemyConfig.name === "boss" || finalEnemyConfig.name === "miniboss") {
      return Promise.resolve(enemy);
    }
    return enemy;
  }

  // Show telegraph before spawning
  showSpawnTelegraph(k, spawnPos, gameContext.sharedState, TELEGRAPH_DURATION);

  // Boss spawns return a promise
  if (finalEnemyConfig.name === "boss" || finalEnemyConfig.name === "miniboss") {
    return new Promise((resolve) => {
      k.wait(TELEGRAPH_DURATION, () => resolve(createEnemy()));
    });
  }

  // Regular enemies spawn after telegraph
  k.wait(TELEGRAPH_DURATION, createEnemy);
  return null;
}

/**
 * Select enemy type based on game progress
 * Progress 0-1 interpolates between start and end spawn weights
 */
function chooseEnemyType(progress) {
  const types = Object.values(ENEMY_CONFIGS);
  const p = Math.max(0, Math.min(1, progress));

  // Calculate effective weights for current progress
  const weights = types.map((enemy) => {
    const start = enemy.spawnWeightStart ?? 0;
    if (start === 0) return 0; // Skip enemies with 0 start weight

    const end = enemy.spawnWeightEnd ?? start;
    return Math.max(0, start + (end - start) * p);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    // Fallback to first enemy with positive weight
    return types.find((e) => (e.spawnWeightStart ?? 0) > 0) ?? types[0];
  }

  // Weighted random selection
  let r = Math.random() * total;
  for (let i = 0; i < types.length; i++) {
    r -= weights[i];
    if (r <= 0) return types[i];
  }
  return types[0];
}

function sanitizeBounds(sharedState, k) {
  const a = sharedState?.area;
  const x = Number.isFinite(a?.x) ? a.x : 0;
  const y = Number.isFinite(a?.y) ? a.y : 0;
  const w = Number.isFinite(a?.w) ? a.w : k.width();
  const h = Number.isFinite(a?.h) ? a.h : k.height();
  return { x, y, w, h };
}

function pickEdgeSpawnPos(k, sharedState, offset = 24) {
  const bounds = sanitizeBounds(sharedState, k);

  const edges = [
    () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y - offset), // Top
    () => k.vec2(k.rand(bounds.x, bounds.x + bounds.w), bounds.y + bounds.h + offset), // Bottom
    () => k.vec2(bounds.x - offset, k.rand(bounds.y, bounds.y + bounds.h)), // Left
    () => k.vec2(bounds.x + bounds.w + offset, k.rand(bounds.y, bounds.y + bounds.h)), // Right
  ];

  const pos = k.choose(edges)();

  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
    console.error("[spawner.js] pickEdgeSpawnPos returned NaN. bounds:", bounds, "sharedState:", sharedState);
  }

  return pos;
}

/**
 * Find spawn position far from player
 */
function pickEdgeSpawnPosFarFromPlayer(k, sharedState, player, minDist = 120, maxTries = 8) {
  let best = null;

  for (let i = 0; i < maxTries; i++) {
    const pos = pickEdgeSpawnPos(k, sharedState, 48);
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && pos.dist(player.pos) >= minDist) {
      return pos;
    }
    if (!best && pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) best = pos;
  }

  return (
    best ||
    k.vec2(
      sanitizeBounds(sharedState, k).x + sanitizeBounds(sharedState, k).w / 2,
      sanitizeBounds(sharedState, k).y + sanitizeBounds(sharedState, k).h / 2
    )
  );
}

/**
 * Visual indicator for incoming enemy spawn
 */
function showSpawnTelegraph(k, pos, sharedState, duration) {
  const arena = sharedState?.area ?? {
    x: 0,
    y: 0,
    w: k.width(),
    h: k.height(),
  };
  const center = k.vec2(arena.x + arena.w / 2, arena.y + arena.h / 2);
  const dirToCenter = center.sub(pos).unit();

  const telegraph = k.add([
    k.pos(pos),
    "spawnTelegraph",
    {
      elapsed: 0,
      update() {
        this.elapsed += k.dt();
        if (this.elapsed >= duration) {
          k.destroy(this);
          return;
        }

        const progress = this.elapsed / duration;

        // Pulse ring
        const pulse = 0.6 + Math.sin(progress * Math.PI) * 0.6;
        this.ring.scale = k.vec2(pulse);
        this.ring.opacity = 0.9 * (1 - progress);

        // Animate pointer
        this.pointer.pos = dirToCenter.scale(8 * progress);
        this.pointer.scale = k.vec2(1 + progress * 0.4);
        this.pointer.opacity = 0.9 * (1 - progress);
      },
    },
  ]);

  // Ring indicator
  telegraph.ring = telegraph.add([
    k.circle(9),
    k.pos(0, 0),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.scale(1),
    k.z(60),
  ]);

  // Direction pointer
  telegraph.pointer = telegraph.add([
    k.rect(70, 6, { radius: 3 }),
    k.pos(0, 0),
    k.anchor("center"),
    k.rotate(dirToCenter.angle()),
    k.color(255, 255, 255),
    k.opacity(0.9),
    k.scale(1),
    k.z(61),
  ]);
}
