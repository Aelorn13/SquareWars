// components/utils/dpsHud.js
import { calcRequiredDPS } from "./requiredDps.js";
import { ENEMY_CONFIGS } from "../enemy/enemyConfig.js";
import { estimatePlayerDPS } from "./estimatePlayerDps.js";

const DEFAULTS = {
  labelPos: { x: 200, y: 14 },
  fontSize: 12,
  updateInterval: 2.0,
  projectileSize: 6,
  safetyFactor: 1.2,
  initialSpawnInterval: 2.0,
  minimalSpawnInterval: 0.2,
};

export function createDpsHud(k, player, gameState, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  let visible = false; // hidden by default
  let accumulator = 0;
  let wasTogglePreviouslyPressed = false;

  const label = k.add([
    k.text("", { size: cfg.fontSize }),
    k.pos(cfg.labelPos.x, cfg.labelPos.y),
    k.fixed(),
    k.z(200),
  ]);
  label.hidden = !visible;

  function buildText(req, playerDps) {
    const reqVal = Number.isFinite(req.requiredDPS) ? req.requiredDPS : (req.stabilityDPS || 0);
    const pSingle = (playerDps && playerDps.singleTarget && playerDps.singleTarget.totalDps) || 0;
    const pCrowd = (playerDps && playerDps.crowd && playerDps.crowd.totalDps) || 0;
    return `ReqDPS: ${reqVal.toFixed(1)} | P(s): ${pSingle.toFixed(1)} | P(c): ${pCrowd.toFixed(1)} | spawn/s: ${req.spawnRate.toFixed(2)} | prog: ${(gameState.spawnProgress*100).toFixed(0)}%`;
  }

  function detectEffects() {
    const effects = player._projectileEffects || [];
    // burn
    const be = effects.find(e => e.effectType === "burn" || e.type === "burn");
    const burnEffect = be ? (be.params || (be.bonuses ? be.bonuses[Object.keys(be.bonuses).sort((a,b)=>b-a)[0]] : null)) : null;
    // ricochet
    const ri = effects.find(e => e.effectType === "ricochet" || e.type === "ricochet");
    const ricochet = ri ? (ri.params || (ri.bonuses ? ri.bonuses[Object.keys(ri.bonuses).sort((a,b)=>b-a)[0]] : null)) : null;
    if (ricochet && ricochet.bounces == null) ricochet.bounces = ricochet.bounces || 1;
    return { burnEffect, ricochet };
  }

  function computeAvgTargetsInCone(req) {
    let activeEnemies = 0;
    try {
      const enemies = typeof k.get === "function" ? k.get("enemy") : null;
      activeEnemies = Array.isArray(enemies) ? enemies.length : 0;
    } catch (e) {
      activeEnemies = 0;
    }
    return Math.max(1, Math.min(activeEnemies || 1, Math.ceil(req.spawnRate * 1.2 + 0.5)));
  }

  function update(dt, keysPressed = {}, paused = false) {
    // toggle (KeyT) allowed regardless of paused
    if (keysPressed["KeyT"]) {
      if (!wasTogglePreviouslyPressed) {
        visible = !visible;
        label.hidden = !visible;
        wasTogglePreviouslyPressed = true;
      }
    } else {
      wasTogglePreviouslyPressed = false;
    }

    // If not visible or paused skip heavy work
    if (!visible || paused) return;

    accumulator += dt;
    if (accumulator < cfg.updateInterval) return;
    accumulator = 0;

    // required DPS
    const req = calcRequiredDPS(ENEMY_CONFIGS, {
      progress: gameState.spawnProgress,
      initialSpawnInterval: cfg.initialSpawnInterval,
      minimalSpawnInterval: cfg.minimalSpawnInterval,
      safetyFactor: cfg.safetyFactor,
      desiredTTK: null,
      targetingEfficiency: 1.0,
    });

    const avgTargetsInCone = computeAvgTargetsInCone(req);
    const { burnEffect, ricochet } = detectEffects();

    const playerRadius = player.size ? player.size / 2 : 14;
    const playerDps = estimatePlayerDPS(player, {
      mode: "single",
      target: { radius: playerRadius, distance: 240 },
      avgTargetsInCone,
      projectileSize: cfg.projectileSize,
      ricochet,
      burnEffect,
      buffMultiplier: 1,
    });

    label.text = buildText(req, playerDps);
  }

  function destroy() {
    try { k.destroy(label); } catch (e) {}
  }

  return { update, toggle: () => { visible = !visible; label.hidden = !visible; }, destroy, get visible() { return visible; } };
}
