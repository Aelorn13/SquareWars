// components/effects/applyProjectileEffects.js
import { EFFECT_HANDLERS } from "./index.js";

// Apply all effects from a projectile to a target
export function applyProjectileEffects(k, projectile, target, ctx = {}) {
  const effects = projectile.effects ?? [];
  const source = projectile.owner ?? projectile.source ?? ctx.source ?? null;
  const sourceId =
    projectile.owner?.id ??
    projectile.source?.id ??
    projectile._ownerId ??
    ctx.sourceId;

  for (const effect of effects) {
    try {
      const factory = EFFECT_HANDLERS[effect.type];
      if (!factory) {
        console.warn("Unknown effect type:", effect.type);
        continue;
      }

      const handler = factory(k, effect.params || {});
      const effectCtx = {
        ...ctx,
        k,
        params: effect.params || {},
        rarity: effect.rarity,
        sourceUpgrade: effect.sourceUpgrade,
        source,
        sourceId,
        projectile,
      };

      // Try install first. If install indicates it successfully applied a persistent
      // buff then skip apply(). If install returns a Promise handle that case.
      try {
        const installed = handler.install?.(target, effectCtx);
        if (installed && typeof installed.then === "function") {
          // async install -> await result then call apply only if install failed
          installed
            .then((res) => {
              if (!res) handler.apply?.(target, effectCtx, projectile);
            })
            .catch(() => {
              handler.apply?.(target, effectCtx, projectile);
            });
        } else {
          // sync install result (boolean-ish). If not installed call apply.
          if (!installed) handler.apply?.(target, effectCtx, projectile);
        }
      } catch (err) {
        // If install throws, fall back to apply to preserve visual feedback
        handler.apply?.(target, effectCtx, projectile);
      }
    } catch (err) {
      console.error("Error applying effect", effect, err);
    }
  }
}
