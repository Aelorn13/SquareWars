// components/player/setupPlayerCosmetics.js

export const SIZE_BY_HP = {
  minScale: 0.5,
  maxScale: 2,
  smoothingSpeed: 8, // higher = faster smoothing
};

export function setupPlayerCosmetics(k, player, opts = {}) {
  const cfg = { ...SIZE_BY_HP, ...opts };
  player._cosmetics ??= {};
  player._cosmetics._sizeCfg = cfg;
  player._cosmetics._targetScale = 1; // start at base

  // helper to update target scale based on HP
  function recalcTargetScale() {
    const curHP = player.hp?.() ?? 1;
    const maxHP = player.maxHP?.() ?? curHP;
    const ratio = clamp(maxHP > 0 ? curHP / maxHP : 0, 0, 1);
    player._cosmetics._targetScale = lerp(cfg.minScale, cfg.maxScale, ratio);
  }

  // Call whenever HP changes
  recalcTargetScale();
  player.onHurt(recalcTargetScale);
  player.onHeal(recalcTargetScale);
  // (Optional) hook if your   maxHP change via upgrades at some point
  player.on("setMaxHP", recalcTargetScale);

  // Smooth interpolation every frame, no extra HP lookups
  player.onUpdate(() => {
    if (!player.exists?.()) return;
    const current = player.scale?.x ?? 1;
    const target = player._cosmetics._targetScale;
    const alpha = 1 - Math.exp(-cfg.smoothingSpeed * k.dt());
    const next = current + (target - current) * alpha;
    player.scale = k.vec2(next, next);
  });
}

// ---- utils ----
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
