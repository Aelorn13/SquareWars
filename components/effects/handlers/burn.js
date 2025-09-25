// components/effects/handlers/burn.js
import { getKaboom, isBoss, genBuffId } from "../utils.js";
import { createOverlay, destroyOverlay } from "../vfx/overlayManager.js";
import { destroyBurnVfx } from "../vfx/index.js";
import { _randomLocalOffset } from "../vfx/utils.js";

export const burn = (kaboom, params = {}) => {
  const k = getKaboom(kaboom);
  const dmg = params.damagePerTick ?? 1;
  const duration = params.duration ?? 2;
  const interval = params.tickInterval ?? 0.5;
  const allowBossVfx = params.visualOnBoss !== false || params.forceVfx === true;
  const size = params.visualSize ?? 18;
  const requestedMaxStacks = Number.isFinite(params.maxStacks) ? params.maxStacks : 3;

  return {
    name: "burn",

    install(target, ctx = {}) {
      if (!target?._buffManager) return;

      target._burnStackCount = target._burnStackCount ?? 0;

      // calculate maxStacks
      const tickBudget = Number.isFinite(params.tickBudgetPerTarget) ? params.tickBudgetPerTarget : 6;
      const perStackTPS = 1 / Math.max(0.0001, interval);
      const computedCap = Math.max(1, Math.floor(tickBudget / perStackTPS));
      const defaultCap = isBoss(target) ? Math.max(8, computedCap * 3) : computedCap;
      const maxStacks = Number.isFinite(requestedMaxStacks) ? requestedMaxStacks : defaultCap;

      // pre-check: current active burn overlays (exclude buff to be added)
      const currentStacks = (target._buffManager.buffs || []).filter(b => b.type === "burn").length;
      if (Number.isFinite(maxStacks) && currentStacks >= maxStacks) {
        // Already at max stacks, just return without applying a new buff
        return;
      }

      const baseId = genBuffId("burn", ctx) ?? `burn:${ctx.sourceId ?? "anon"}`;
      const uid = `${baseId}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;

      const showVfx = !(isBoss(target) && !allowBossVfx) && size > 0;

      target._buffManager.applyBuff({
        id: uid,
        type: "burn",
        duration,
        tickInterval: interval,
        data: { damage: dmg, source: ctx.source, sourceId: ctx.sourceId },

        onApply(buff) {
          target._burnStackCount = (target._burnStackCount || 0) + 1;

          if (showVfx) {
            try {
              const offset = _randomLocalOffset(k, target, 0.45);
              buff._vfxNode = createOverlay(k, target, {
                type: "burn_icon",
                icon: params.icon ?? "🔥",
                size,
                forceNew: true,
                allowMultiple: true,
                instanceId: uid,
                offset,
              }) ?? null;
            } catch {
              buff._vfxNode = null;
            }
          } else {
            buff._vfxNode = null;
          }
        },

        onTick(buff) {
          const damage = buff.data?.damage ?? 0;
          if (!target) return;
          try {
            if (typeof target.takeDamage === "function")
              target.takeDamage(damage, { source: buff.data?.source, type: "burn" });
            else if (typeof target.hurt === "function") target.hurt(damage);
            else target.hp = Math.max(0, (target.hp ?? 0) - damage);
          } catch (e) {
            console.error("burn onTick error", e);
          }
        },

        onRemove(buff) {
          try {
            if (buff._vfxNode) {
              try { destroyBurnVfx(k, buff._vfxNode); } catch { destroyOverlay(k, buff._vfxNode); }
            }
          } catch {}

          target._burnStackCount = Math.max(0, (target._burnStackCount || 1) - 1);
        },
      });
    },

    apply(target, ctx = {}) {
      if (!target) return;
      if (isBoss(target) && params.visualOnBoss === false && !params.forceVfx) return;

      // check for matching buff from same source
      try {
        const bm = target._buffManager;
        if (bm?.buffs) {
          const srcId = ctx?.sourceId ?? ctx?.source?._id ?? ctx?.source?.id;
          const existing = bm.buffs.find(b =>
            b.type === "burn" &&
            ((b.data?.sourceId && srcId && b.data.sourceId === srcId) ||
             (b.data?.source && ctx?.source && b.data.source === ctx.source))
          );
          if (existing) return;
        }

        // pre-check max stacks for short-pop overlay
        const tickBudget = Number.isFinite(params.tickBudgetPerTarget) ? params.tickBudgetPerTarget : 6;
        const perStackTPS = 1 / Math.max(0.0001, interval);
        const computedCap = Math.max(1, Math.floor(tickBudget / perStackTPS));
        const defaultCap = isBoss(target) ? Math.max(8, computedCap * 3) : computedCap;
        const maxStacks = Number.isFinite(requestedMaxStacks) ? requestedMaxStacks : defaultCap;
        const currentStacks = (target._buffManager?.buffs || []).filter(b => b.type === "burn").length;
        if (Number.isFinite(maxStacks) && currentStacks >= maxStacks) return;
      } catch {}

      try {
        const offset = _randomLocalOffset(k, target, 0.45);
        const node = createOverlay(k, target, {
          type: "burn_icon",
          icon: params.icon ?? "🔥",
          size: Math.max(12, size - 4),
          forceNew: true,
          allowMultiple: true,
          instanceId: `burn_pop:${Date.now()}:${Math.floor(Math.random() * 1e6)}`,
          offset,
        });
        if (node) {
          k.wait?.(0.45, () => {
            try { destroyBurnVfx(k, node); } catch { destroyOverlay(k, node); }
          }) ?? setTimeout(() => {
            try { destroyBurnVfx(k, node); } catch { destroyOverlay(k, node); }
          }, 450);
        }
      } catch {}
    },
  };
};
