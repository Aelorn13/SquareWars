// visualEffects.js
// Burn VFX: improved with color flicker, subtle scaling pulse, and upward drift

function generateBuffId(effectType, context = {}) {
  const sourceId =
    context.sourceId ?? context.projectile?.id ?? context.source?.id ?? Math.floor(Math.random() * 1e9);
  const sourceUpgrade = context.sourceUpgrade ?? "generic";
  return `${effectType}_${sourceId}_${sourceUpgrade}`;
}

function safeVec2(k, x = 0, y = 0) {
  try { return k?.vec2 ? k.vec2(x, y) : { x, y }; } catch { return { x, y }; }
}

const activeBurnFlames = new Set();

function getEntityPos(entity) {
  if (!entity) return null;
  try {
    if (typeof entity.pos === "function") {
      const p = entity.pos();
      if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
      if (Array.isArray(p) && p.length >= 2) return { x: p[0], y: p[1] };
    }
  } catch {}
  if (entity.pos && typeof entity.pos.x === "number" && typeof entity.pos.y === "number") return { x: entity.pos.x, y: entity.pos.y };
  if (typeof entity.x === "number" && typeof entity.y === "number") return { x: entity.x, y: entity.y };
  return null;
}

// One-time updater for all burn flames
function startBurnUpdater(k) {
  if (startBurnUpdater._started) return;
  startBurnUpdater._started = true;

  k.onUpdate(() => {
    const t = k.time?.() ?? (performance ? performance.now() / 1000 : Date.now() / 1000);

    for (const flame of Array.from(activeBurnFlames)) {
      try {
        if (!flame?._follow) { activeBurnFlames.delete(flame); k.destroy?.(flame); continue; }

        const target = flame._follow;
        const removed = target.dead || target._isDead || target._destroyed || target._removed || target.hidden || target.parent == null;
        if (removed) { activeBurnFlames.delete(flame); k.destroy?.(flame); continue; }

        const pos = getEntityPos(target);
        if (!pos) { activeBurnFlames.delete(flame); k.destroy?.(flame); continue; }

        // Compute wobble and upward drift
        const offset = flame._off ?? { x: 0, y: -8 };
        const wobble = Math.sin(t * 6 + (flame._phase ?? 0)) * 3;
        const drift = (flame._drift ?? 0) + 0.02; // gradual upward drift
        flame._drift = drift;

        const tx = pos.x + offset.x;
        const ty = pos.y + offset.y + wobble + drift;
        if (flame.pos?.x !== undefined) { flame.pos.x = tx; flame.pos.y = ty; }
        else if (typeof flame.moveTo === "function") flame.moveTo(tx, ty);

        // Subtle color flicker
        if (typeof flame.color === "function") {
          const r = 255;
          const g = 130 + Math.floor(Math.random() * 40); // green flicker
          const b = 0;
          flame.color(r, g, b);
        } else if (flame.color) {
          flame.color.r = 255;
          flame.color.g = 130 + Math.floor(Math.random() * 40);
          flame.color.b = 0;
        }

        // Subtle, per-flame pulse
        const scaleValue = 1 + (flame._pulse ?? 0.05) * Math.sin(t * 10 + (flame._phase ?? 0));
        if (typeof flame.scale === "function") flame.scale(scaleValue);
        else if (flame.scale) flame.scale.x = flame.scale.y = scaleValue;
        else if (flame.width !== undefined && flame.height !== undefined) {
          const baseSize = flame._baseSize ?? 16;
          flame.width = baseSize * scaleValue;
          flame.height = baseSize * 0.6 * scaleValue;
        }

      } catch (err) {
        console.error("Burn updater error:", err);
        activeBurnFlames.delete(flame);
        k.destroy?.(flame);
      }
    }
  });
}

// Create burn flames attached to a target
function createBurnVfx(k, target, opts = {}) {
  if (!k?.add) return null;
  startBurnUpdater(k);

  const flames = [];
  const count = Math.max(1, Math.min(6, opts.count ?? 3));
  const size = Math.max(6, Math.min(48, opts.size ?? 18));
  const basePos = getEntityPos(target) ?? { x: 0, y: 0 };

  for (let i = 0; i < count; i++) {
    try {
      const offset = { x: (Math.random() - 0.5) * ((target?.width ?? 24) * 0.8), y: (Math.random() - 1.2) * ((target?.height ?? 24) * 0.6) };
      const phase = Math.random() * Math.PI * 2;
      const pulse = 0.04 + Math.random() * 0.04; // precompute subtle per-flame pulse

      const node = k.add([
        k.pos(basePos.x + offset.x, basePos.y + offset.y),
        k.rect(size, size * 0.6),
        k.origin?.("center") ?? {},
        k.color?.(255, 130 + Math.floor(Math.random() * 40), 0) ?? {},
        k.z?.(100) ?? {},
        "vfx_burn",
        { _follow: target, _off: offset, _phase: phase, _baseSize: size, _pulse: pulse, _drift: 0 }
      ]);

      flames.push(node);
      activeBurnFlames.add(node);
    } catch {}
  }

  return flames;
}

function destroyFlames(k, flames) { if (!Array.isArray(flames)) return; for (const f of flames) try { k.destroy?.(f); } catch {} }

export function registerVisualEffects(EFFECT_HANDLERS = {}, kInstance = null) {
  if (!EFFECT_HANDLERS) return;
  const origBurn = EFFECT_HANDLERS.burn;

  EFFECT_HANDLERS.burn = (kaboom, params = {}) => {
    const k = kaboom ?? kInstance ?? globalThis.k;
    const base = typeof origBurn === "function" ? origBurn(kaboom, params) : null;
    const duration = params.duration ?? 3;

    return {
      name: "burn",
      install(target, context = {}) {
        base?.install?.(target, context);

        const buffManager = target?._buffManager;
        const vfxBuffId = generateBuffId("burn_vfx", context);

        const createFlames = () => createBurnVfx(k, target, {
          count: Math.max(1, Math.min(4, Math.round(params.visualCount ?? 3))),
          size: params.visualSize ?? 18
        });

        if (buffManager?.applyBuff) {
          try {
            buffManager.applyBuff({
              id: vfxBuffId,
              type: "burn_vfx",
              duration,
              onApply(buff) { buff._vfx = createFlames(); },
              onRemove(buff) { destroyFlames(k, buff._vfx); }
            });
          } catch {
            const flames = createFlames();
            k.wait?.(duration, () => destroyFlames(k, flames)) || setTimeout(() => destroyFlames(k, flames), duration * 1000);
          }
        } else {
          const flames = createFlames();
          k.wait?.(duration, () => destroyFlames(k, flames)) || setTimeout(() => destroyFlames(k, flames), duration * 1000);
        }
      },

      apply(target) {
        base?.apply?.(target);
        const flames = createBurnVfx(k, target, { count: 1, size: Math.max(12, (params.visualSize ?? 18) - 4) });
        k.wait?.(0.45, () => destroyFlames(k, flames)) || setTimeout(() => destroyFlames(k, flames), 450);
      }
    };
  };
}
