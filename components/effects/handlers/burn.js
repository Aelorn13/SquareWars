// components/effects/handlers/burn.js
import { getKaboom, isBoss, genBuffId } from "../utils.js";
import { createOverlay, destroyOverlay } from "../vfx/overlayManager.js";
import { createBurnVfx, destroyBurnVfx } from "../vfx/index.js";
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

    /**
     * Attempts to install or refresh a burn buff on the target.
     * Returns true if a buff was applied or refreshed, false otherwise.
     */
    install(target, ctx = {}) {
      if (!target?._buffManager) return false;

      // Prevent rapid duplicate installs on the same target (same tick)
      if (target._pendingBurnInstall) return false;
      target._pendingBurnInstall = true;
      k.wait?.(0, () => { if (target) target._pendingBurnInstall = false; });

      const tickBudget = params.tickBudgetPerTarget ?? 6;
      const perStackTPS = 1 / Math.max(0.0001, interval);
      const computedCap = Math.max(1, Math.floor(tickBudget / perStackTPS));
      const defaultCap = isBoss(target) ? Math.max(1, computedCap * 2) : computedCap;
      const maxStacks = requestedMaxStacks ?? defaultCap;

      // If stacks are at the limit, refresh existing burn buffs instead of adding a new one.
      const currentStacks = (target._buffManager.buffs || []).filter(b => b.type === "burn").length;
      if (currentStacks >= maxStacks) {
        for (const buff of target._buffManager.buffs) {
          if (buff.type === "burn") {
            buff.duration = duration; // Refresh the duration
          }
        }
        // Return true to signify the effect was handled (refreshed),
        // preventing the fallback apply() method from being called.
        return true;
      }
      
      const baseId = genBuffId("burn", ctx) ?? `burn:${ctx.sourceId ?? "anon"}`;
      const uid = `${baseId}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;
      const showVfx = !(isBoss(target) && !allowBossVfx) && size > 0;

      // Apply the buff; onApply will create a persistent VFX and store it on the buff
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
              const created = createBurnVfx(k, target, {
                stackCount: 1, // We are creating visuals for this one new stack.
                offset,
                size: Math.max(12, size - 4),
                forceNew: true, // This forces the overlay manager to create a new object.
                allowMultiple: true, // This allows multiple burn icons on the same target.
                instanceId: uid, // Links this VFX to this specific buff.
                icon: params.icon ?? "🔥",
              });

              // Normalize to an array and store on the buff for later cleanup
              const nodes = Array.isArray(created) ? created : (created ? [created] : []);
              buff._vfxNodes = nodes;
              
              for (const node of nodes) {
                if (node) node._instanceId = buff.id;
              }
            } catch (e) {
                buff._vfxNodes = null;
            }
          } else {
              buff._vfxNodes = null;
          }
        },

        onTick(buff) {
          const damage = buff.data?.damage ?? 0;
          if (!target || !target.exists()) return;
          try {
            if (typeof target.takeDamage === "function") {
              target.takeDamage(damage, { source: buff.data?.source, type: "burn" });
            } else if (typeof target.hurt === "function") {
              target.hurt(damage);
            }
          } catch (e) {
            console.error("burn onTick error", e);
          }
        },

        onRemove(buff) {
          if (buff._vfxNodes) {
            destroyBurnVfx(k, buff._vfxNodes);
          }
          target._burnStackCount = Math.max(0, (target._burnStackCount || 1) - 1);
        },
      });

      return true;
    },

    /**
     * apply() shows a short "pop" visual ONLY if the buff could not be installed.
     */
    apply(target, ctx = {}) {
      if (!target || (isBoss(target) && !allowBossVfx)) return;

      // If install successfully applies or refreshes a buff, do nothing here.
      if (this.install(target, ctx)) {
        return;
      }

      // Only create a pop visual if install() returned false (e.g., target has no buff manager).
      const offset = _randomLocalOffset(k, target, 0.45);
      const node = createOverlay(k, target, {
        type: "burn_icon_pop",
        icon: params.icon ?? "🔥",
        size: Math.max(12, size - 4),
        instanceId: `burn_pop:${Math.random()}`,
        offset,
      });

      if (node) {
        k.wait(0.45, () => destroyOverlay(k, node));
      }
    },
  };
};