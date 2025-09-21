// components/effects/effectRegistry.js
/**
 * Defensive, Kaboom-safe effect handler registry.
 * Each factory: (k, params) => handler
 * Handler may implement:
 *  - install(target, ctx)         // buff-style (DoT/slow/heal)
 *  - apply(target, ctx, projectile) // immediate action (knockback, ricochet)
 */

export const EFFECT_HANDLERS = {
  // BURN (DoT)
  burn: (k, params = {}) => {
    const damagePerTick = params.damagePerTick ?? 1;
    const duration = params.duration ?? 3;
    const tickInterval = params.tickInterval ?? 1;
    return {
      name: "burn",
      install(target, ctx = {}) {
        if (!target?._buffManager) return;
        const sid = ctx.sourceId ?? ctx.projectile?.id ?? ctx.source?.id ?? Math.floor(Math.random() * 1e9);
        const id = `burn_${sid}_${ctx.sourceUpgrade ?? "generic"}`;
        target._buffManager.applyBuff({
          id,
          type: "burn",
          duration,
          tickInterval,
          data: { dmg: damagePerTick, source: ctx.source },
          onTick(self) {
            const dmg = self.data.dmg ?? 0;
            if (typeof target.takeDamage === "function") {
              target.takeDamage(dmg, { source: self.data.source, type: "burn" });
            } else {
              target.hp = Math.max(0, (target.hp ?? 0) - dmg);
            }
          },
        });
      },
    };
  },

  // KNOCKBACK (push away from shooter)
  knockback: (k, params = {}) => {
    const force = params.force ?? 600;
    const duration = params.duration ?? 0.14;
    return {
      name: "knockback",
      apply(target, ctx = {}, projectile = {}) {
        if (!target) return;

        const K = ctx.k ?? k ?? globalThis.k;

        // Determine direction vector robustly
        let dirVec = null;
        try {
          if (projectile?.pos && target?.pos && typeof projectile.pos.x === "number" && typeof target.pos.x === "number") {
            dirVec = target.pos.sub(projectile.pos).unit();
          } else if (projectile?.velocity && typeof projectile.velocity.x === "number") {
            const v = projectile.velocity;
            const s = Math.max(1e-6, Math.sqrt((v.x || 0) ** 2 + (v.y || 0) ** 2));
            dirVec = (K?.vec2 ? K.vec2((v.x || 0) / s, (v.y || 0) / s) : { x: (v.x || 0) / s, y: (v.y || 0) / s });
          }
        } catch (e) {
          dirVec = null;
        }
        if (!dirVec) dirVec = (K?.vec2 ? K.vec2(0, -1) : { x: 0, y: -1 });

        // compute impulse robustly
        let impulse;
        try { impulse = dirVec.scale(force); } catch (e) { impulse = { x: (dirVec.x || 0) * force, y: (dirVec.y || 0) * force }; }

        // Add to velocity if possible, otherwise nudge position
        if (target?.velocity && typeof target.velocity.add === "function") {
          try { target.velocity = target.velocity.add(impulse); } catch (e) {
            target.velocity = { x: (target.velocity.x || 0) + (impulse.x || 0), y: (target.velocity.y || 0) + (impulse.y || 0) };
          }
        } else if (target?.velocity && typeof target.velocity.x === "number") {
          target.velocity = { x: (target.velocity.x || 0) + (impulse.x || 0), y: (target.velocity.y || 0) + (impulse.y || 0) };
        } else if (target?.pos && typeof target.pos.x === "number") {
          try {
            if (typeof target.pos.add === "function") target.pos = target.pos.add((impulse.x ?? 0) * 0.03, (impulse.y ?? 0) * 0.03);
            else { target.pos.x = (target.pos.x || 0) + (impulse.x ?? 0) * 0.03; target.pos.y = (target.pos.y || 0) + (impulse.y ?? 0) * 0.03; }
          } catch (e) {
            target.pos.x = (target.pos.x || 0) + (impulse.x ?? 0) * 0.03;
            target.pos.y = (target.pos.y || 0) + (impulse.y ?? 0) * 0.03;
          }
        }

        // Stun via buff manager (non-stacking id)
        if (target?._buffManager) {
          const sid = ctx.sourceId ?? ctx.projectile?.id ?? ctx.source?.id ?? Math.floor(Math.random() * 1e9);
          const id = `knockback_${sid}_${ctx.sourceUpgrade ?? "generic"}`;
          target._buffManager.applyBuff({
            id,
            type: "knockback",
            duration,
            data: { source: ctx.source },
            onApply(self) { target._isStunned = true; },
            onRemove(self) { target._isStunned = false; },
          });
        } else {
          target._isStunned = true;
          // Use K.wait if available (kaboom), else fallback to setTimeout (ms)
          try {
            if (K?.wait) K.wait(duration, () => { target._isStunned = false; });
            else setTimeout(() => { target._isStunned = false; }, duration * 1000);
          } catch (e) {
            setTimeout(() => { target._isStunned = false; }, duration * 1000);
          }
        }
      },
    };
  },

  // SLOW (install as buff)
  slow: (k, params = {}) => {
    const slowFactor = Math.max(0, Math.min(0.99, params.slowFactor ?? 0.3));
    const duration = params.duration ?? 2.0;
    return {
      name: "slow",
      install(target, ctx = {}) {
        if (!target?._buffManager) return;
        const sid = ctx.sourceId ?? ctx.projectile?.id ?? ctx.source?.id ?? Math.floor(Math.random() * 1e9);
        const id = `slow_${sid}_${ctx.sourceUpgrade ?? "generic"}`;
        target._buffManager.applyBuff({
          id,
          type: "slow",
          duration,
          data: { factor: slowFactor, source: ctx.source },
          onApply(self) {
            target._slowMultipliers ??= [];
            target._slowMultipliers.push(self.data.factor);
            if (typeof target.recomputeStat === "function") target.recomputeStat("moveSpeed");
          },
          onRemove(self) {
            if (Array.isArray(target._slowMultipliers)) {
              const idx = target._slowMultipliers.indexOf(self.data.factor);
              if (idx >= 0) target._slowMultipliers.splice(idx, 1);
            }
            if (typeof target.recomputeStat === "function") target.recomputeStat("moveSpeed");
          },
        });
      },
    };
  },

  // RICOCHET (bounce)
   ricochet: (k, params = {}) => {
    const spread = params.spread ?? 20;
    const fallbackSpeed = Number(params.fallbackSpeed ?? params._fallbackSpeed ?? 300);
    return {
      name: "ricochet",
      apply(target, ctx = {}, projectile = {}) {
        if (!projectile) return;
        // initialize bounces if missing (reading params.bounces)
        if (projectile._bouncesLeft === undefined) {
          projectile._bouncesLeft = Math.max(0, Math.floor(Number(params.bounces) || 0));
        }

        // if no bounces left, mark for destruction and exit
        if (!(projectile._bouncesLeft > 0)) {
          projectile._shouldDestroyAfterHit = true;
          return;
        }

        const K = ctx.k ?? k ?? globalThis.k;

        if (projectile.velocity && typeof projectile.velocity.x === "number") {
          const v = projectile.velocity;
          const speed = Math.max(1e-6, Math.sqrt((v.x || 0) ** 2 + (v.y || 0) ** 2));
          const incident = (K?.vec2 ? K.vec2((v.x || 0) / speed, (v.y || 0) / speed) : { x: (v.x || 0) / speed, y: (v.y || 0) / speed });

          // compute normal robustly: projectile.pos -> target.pos
          let normal = null;
          if (projectile?.pos && target?.pos && typeof projectile.pos.x === "number" && typeof target.pos.x === "number") {
            try {
              const nv = projectile.pos.sub(target.pos);
              // compute length either via API or by hand
              const len = (typeof nv.len === "function") ? nv.len() : Math.sqrt((nv.x || 0) ** 2 + (nv.y || 0) ** 2);
              if (len > 1e-6) {
                normal = (typeof nv.unit === "function") ? nv.unit() : (K?.vec2 ? K.vec2(nv.x / len, nv.y / len) : { x: nv.x / len, y: nv.y / len });
              } else {
                normal = null;
              }
            } catch (e) { normal = null; }
          }
          // fallback normal (opposite incident)
          if (!normal) normal = (K?.vec2 ? K.vec2(-incident.x, -incident.y) : { x: -incident.x, y: -incident.y });

          const dot = (incident.x * normal.x) + (incident.y * normal.y);
          let refl = (K?.vec2
            ? K.vec2(incident.x - 2 * dot * normal.x, incident.y - 2 * dot * normal.y)
            : { x: incident.x - 2 * dot * normal.x, y: incident.y - 2 * dot * normal.y });

          // add spread
          const ang = (Math.random() - 0.5) * (spread * Math.PI / 180);
          const cos = Math.cos(ang), sin = Math.sin(ang);
          if (K?.vec2) {
            refl = K.vec2(refl.x * cos - refl.y * sin, refl.x * sin + refl.y * cos);
            projectile.velocity = refl.scale(speed);
          } else {
            const rx = refl.x * cos - refl.y * sin;
            const ry = refl.x * sin + refl.y * cos;
            projectile.velocity = { x: rx * speed, y: ry * speed };
          }

          // safe nudge if pos exists
          if (projectile.pos && typeof projectile.pos.x === "number") {
            try {
              if (typeof projectile.pos.add === "function" && typeof projectile.velocity.scale === "function") {
                projectile.pos = projectile.pos.add(projectile.velocity.scale(0.02));
              } else {
                projectile.pos.x = (projectile.pos.x || 0) + (projectile.velocity.x || 0) * 0.02;
                projectile.pos.y = (projectile.pos.y || 0) + (projectile.velocity.y || 0) * 0.02;
              }
            } catch (e) {}
          }
        } else {
          // fallback random deflection
          const angle = (Math.random() - 0.5) * (spread * Math.PI / 180);
          const dir = K?.vec2 ? K.vec2(Math.cos(angle), Math.sin(angle)) : { x: Math.cos(angle), y: Math.sin(angle) };
          projectile.velocity = (K?.vec2 ? dir.scale(fallbackSpeed) : { x: dir.x * fallbackSpeed, y: dir.y * fallbackSpeed });
        }

        // consume one bounce but keep projectile alive now.
        projectile._bouncesLeft = Math.max(0, projectile._bouncesLeft - 1);

        // IMPORTANT: keep projectile alive after reflection so it can hit next target.
        // It will be destroyed on the next hit if _bouncesLeft === 0.
        projectile._shouldDestroyAfterHit = false;
      },
    };
  },

  // HEAL (install)
  heal: (k, params = {}) => {
    const healPerTick = params.healPerTick ?? 1;
    const duration = params.duration ?? 3;
    const tickInterval = params.tickInterval ?? 1;
    return {
      name: "heal",
      install(target, ctx = {}) {
        if (!target?._buffManager) return;
        const sid = ctx.sourceId ?? ctx.projectile?.id ?? ctx.source?.id ?? Math.floor(Math.random() * 1e9);
        const id = `heal_${sid}_${ctx.sourceUpgrade ?? "generic"}`;
        target._buffManager.applyBuff({
          id,
          type: "heal",
          duration,
          tickInterval,
          data: { heal: healPerTick, source: ctx.source },
          onTick(self) {
            const h = self.data.heal ?? 0;
            if (typeof target.heal === "function") target.heal(h);
            else target.hp = Math.min((target.maxHp ?? 99999), (target.hp ?? 0) + h);
          },
        });
      },
    };
  },
};
