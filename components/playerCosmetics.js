// components/player/setupPlayerCosmetics.js

export const SIZE_BY_HP = {
  minScale: 0.5,
  maxScale: 2,
  smoothingSpeed: 8,
};

export const ATTACK_SPEED_COLOUR = {
  baseColour: [0, 0, 255], // default player colour (blue)
  targetColour: [255, 255, 0], 
  smoothingSpeed: 10, // colour lerp responsiveness
};

// ---- utils ----
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function setupPlayerCosmetics(k, player, opts = {}) {
  const sizeCfg = { ...SIZE_BY_HP, ...(opts.sizeCfg || {}) };
  const colCfg = { ...ATTACK_SPEED_COLOUR, ...(opts.attackColourCfg || {}) };

  player._cosmetics = player._cosmetics || {};

  player._cosmetics._sizeCfg = sizeCfg;
  player._cosmetics._targetScale = 1;

  function recalcTargetScale() {
    const curHP =
      typeof player.hp === "function" ? player.hp() : player.hp ?? 1;
    const maxHP =
      typeof player.maxHP === "function"
        ? player.maxHP()
        : player.maxHP ?? curHP;
    const ratio = clamp(maxHP > 0 ? curHP / maxHP : 0, 0, 1);
    player._cosmetics._targetScale = lerp(
      sizeCfg.minScale,
      sizeCfg.maxScale,
      ratio
    );
  }

  if (typeof player.onHurt === "function") player.onHurt(recalcTargetScale);
  if (typeof player.onHeal === "function") player.onHeal(recalcTargetScale);
  if (typeof player.on === "function") {
    try {
      player.on("setMaxHP", recalcTargetScale);
    } catch (e) {
    }
  }
  recalcTargetScale();

  // -------------------------
  player._cosmetics._attackSpeedBaseline =
    Number(player._baseStats.attackSpeed) || 0;

  player._cosmetics._attackColourCurrent = [...colCfg.baseColour];
  player._cosmetics._attackColourTarget = [...colCfg.baseColour];

  player._cosmetics.recomputeAttackColourTarget = function () {
    const baseline =
      player._cosmetics._attackSpeedBaseline || Number(player.attackSpeed) || 0;
    const cur = Number(player.attackSpeed) || 0;

    if (!baseline || baseline <= 0) {
      player._cosmetics._attackColourTarget = [...colCfg.baseColour];
      return;
    }

    const raw = clamp((baseline - cur) / baseline, 0, 1);
    const ratio = Math.sqrt(raw); // tweak exponent (<1 -> more visible for small changes)

    player._cosmetics._attackColourTarget = [
      Math.round(lerp(colCfg.baseColour[0], colCfg.targetColour[0], ratio)),
      Math.round(lerp(colCfg.baseColour[1], colCfg.targetColour[1], ratio)),
      Math.round(lerp(colCfg.baseColour[2], colCfg.targetColour[2], ratio)),
    ];
  };

  player._cosmetics.recomputeAttackColourTarget();

  // -------------------------
  // Frame update: smooth interpolation for scale + colour
  // -------------------------
  player.onUpdate(() => {
    if (!player.exists?.()) return;

    // scale smoothing (exponential smoothing)
    const curScale = player.scale?.x ?? 1;
    const targetScale = player._cosmetics._targetScale ?? 1;
    const alphaS = 1 - Math.exp(-sizeCfg.smoothingSpeed * k.dt());
    const nextScale = curScale + (targetScale - curScale) * alphaS;
    player.scale = k.vec2(nextScale, nextScale);

    // colour smoothing
    const curC = player._cosmetics._attackColourCurrent;
    const tgtC = player._cosmetics._attackColourTarget;
    const alphaC = 1 - Math.exp(-colCfg.smoothingSpeed * k.dt());
    curC[0] += (tgtC[0] - curC[0]) * alphaC;
    curC[1] += (tgtC[1] - curC[1]) * alphaC;
    curC[2] += (tgtC[2] - curC[2]) * alphaC;

    // Apply to entity — use engine API k.color / k.rgb to actually set tint
    // (we keep variable names using British "colour" but engine uses k.color)
    player.use(
      k.color(
        k.rgb(Math.round(curC[0]), Math.round(curC[1]), Math.round(curC[2]))
      )
    );
  });
}
