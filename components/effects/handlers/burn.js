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
     * Attempts to install a burn buff onto target.
     * Returns true if a buff instance was actually applied, false otherwise.
     */
    install(target, ctx = {}) {
      if (!target?._buffManager) return false;

      target._burnStackCount = target._burnStackCount ?? 0;

      // Prevent rapid duplicate installs on the same target (same tick)
      if (target._pendingBurnInstall) return false;
      target._pendingBurnInstall = true;
      // clear lock next tick to allow legitimate subsequent stacks
      try {
        k.wait?.(0, () => { if (target) target._pendingBurnInstall = false; });
      } catch {
        setTimeout(() => { if (target) target._pendingBurnInstall = false; }, 0);
      }

      // compute per-stack caps
      const tickBudget = Number.isFinite(params.tickBudgetPerTarget) ? params.tickBudgetPerTarget : 6;
      const perStackTPS = 1 / Math.max(0.0001, interval);
      const computedCap = Math.max(1, Math.floor(tickBudget / perStackTPS));

      // bosses allowed more stacks (x2 multiplier)
      const defaultCap = isBoss(target) ? Math.max(1, Math.floor(computedCap * 2)) : computedCap;
      const maxStacks = Number.isFinite(requestedMaxStacks) ? requestedMaxStacks : defaultCap;

      // authoritative quick-check using tracked stack counter
      if (Number.isFinite(maxStacks) && (target._burnStackCount || 0) >= maxStacks) {
        return false;
      }

      // fallback: count existing burn buffs
      const currentStacks = (target._buffManager.buffs || []).filter(b => b.type === "burn").length;
      if (Number.isFinite(maxStacks) && currentStacks >= maxStacks) {
        return false;
      }

      // unique id for buff instance
      const baseId = genBuffId("burn", ctx) ?? `burn:${ctx.sourceId ?? "anon"}`;
      const uid = `${baseId}:${Date.now()}:${Math.floor(Math.random() * 1e9)}`;

      const showVfx = !(isBoss(target) && !allowBossVfx) && size > 0;

      // apply the buff; onApply will create persistent VFX and store it on the buff
      target._buffManager.applyBuff({
        id: uid,
        type: "burn",
        duration,
        tickInterval: interval,
        data: { damage: dmg, source: ctx.source, sourceId: ctx.sourceId },

        onApply(buff) {
          // track authoritative stack count
          target._burnStackCount = (target._burnStackCount || 0) + 1;

          if (showVfx) {
            try {
              // createBurnVfx returns node or array of nodes
              const offset = _randomLocalOffset(k, target, 0.45);
              const created = createBurnVfx(k, target, {
                stackCount: 1,
                offset,
                size: Math.max(12, size - 4),
                forceNew: true,
                allowMultiple: true,
                instanceId: uid,
                icon: params.icon ?? "🔥",
                randomSpot: true,
              });

              // normalize to array
              const nodes = Array.isArray(created) ? created.slice() : (created ? [created] : []);
              buff._vfxNodes = nodes;

              // Authoritative: stamp exact buff id on each created node so overlay updater can match.
              try {
                for (const n of nodes) {
                  if (n && (n._instanceId === undefined || n._instanceId === null)) {
                    n._instanceId = buff.id;
                  } else {
                    // ensure exact mapping for safety (overwrite)
                    n._instanceId = buff.id;
                  }
                }
              } catch (e) { /* ignore */ }

            } catch (e) {
              buff._vfxNodes = null;
            }
          } else {
            buff._vfxNodes = null;
          }
        },

        onTick(buff) {
          const damage = buff.data?.damage ?? 0;
          if (!target) return;
          try {
            if (typeof target.takeDamage === "function")
              target.takeDamage(damage, { source: buff.data?.source, type: "burn" });
            else if (typeof target.hurt === "function")
              target.hurt(damage);
            else
              target.hp = Math.max(0, (target.hp ?? 0) - damage);
          } catch (e) {
            console.error("burn onTick error", e);
          }
        },

        onRemove(buff) {
          try {
            if (buff._vfxNodes) {
              try { destroyBurnVfx(k, buff._vfxNodes); } catch { /* fallback */ }
            } else if (buff._vfxNode) {
              // legacy fallback if older code set single node
              try { destroyBurnVfx(k, buff._vfxNode); } catch { /* ignore */ }
            }
          } catch (e) {}

          target._burnStackCount = Math.max(0, (target._burnStackCount || 1) - 1);
        },
      });

      return true;
    },

    /**
     * apply() shows a short pop visual when the buff was NOT installed.
     * It will try to install if called directly; otherwise it acts as a fallback pop-only.
     */
    apply(target, ctx = {}) {
      if (!target) return;
      if (isBoss(target) && params.visualOnBoss === false && !params.forceVfx) return;

      // Try to install — if install applied a buff, do not create an extra pop overlay.
      let applied = false;
      try {
        if (target._buffManager) {
          applied = !!this.install(target, ctx);
        } else {
          applied = false; // no buff manager -> keep pop-only behavior
        }
      } catch (e) {
        applied = false;
      }

      // only create a short pop visual if the buff was NOT installed or no buff manager exists
      if (!applied) {
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
        } catch (e) {}
      }
    },
  };
};
