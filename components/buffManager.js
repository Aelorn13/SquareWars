/**
 * attachBuffManager(k, entity, opts?)
 * - attaches entity._buffManager if missing
 * - opts: { pauseCheck: () => boolean, debug: boolean }
 *
 * Public API preserved: manager.buffs, manager.baseStats,
 * manager.applyBuff, manager.removeBuff, manager.update, manager.destroy
 */
export function attachBuffManager(k, entity, opts = {}) {
  if (entity._buffManager) return entity._buffManager;

  const pauseCheck = typeof opts.pauseCheck === "function" ? opts.pauseCheck : null;
  const debug = !!opts.debug;
  const isFiniteNum = Number.isFinite;

  const manager = {
    initialized: true,
    buffs: [],
    baseStats: {},
    pauseCheck,
    debug,

    // Find buff by id. Kept small for clarity and reuse.
    _findIndex(id) {
      return this.buffs.findIndex(b => b.id === id);
    },

    /**
     * Apply or merge a buff.
     * - If an identical id exists we merge non-duration fields and
     *   only overwrite duration when a finite value is provided.
     * - Timers reset on merge so the new/extended buff takes effect immediately.
     */
    applyBuff(buff) {
      if (!buff || !buff.id) {
        if (debug) console.warn("[buffManager] applyBuff called with invalid buff", buff);
        return null;
      }

      const idx = this._findIndex(buff.id);
      if (idx >= 0) {
        const existing = this.buffs[idx];
        // merge all keys except duration (duration handled specially)
        for (const key of Object.keys(buff)) {
          if (key === "duration") continue;
          existing[key] = buff[key];
        }
        // only overwrite duration when incoming is a finite number
        if (isFiniteNum(buff.duration)) existing.duration = buff.duration;
        // restart timers so extension behaves as expected
        existing.elapsed = 0;
        existing.elapsedTick = 0;
        if (debug) console.log("[buffManager] merged buff", existing.id, "duration->", existing.duration);
        return existing;
      }

      // Normalize bad durations for new buffs
      if (buff.duration !== undefined && !isFiniteNum(buff.duration)) {
        if (debug) {
          console.warn("[buffManager] new buff has non-finite duration; treating as indefinite", buff.id, buff.duration);
          console.trace();
        }
        buff.duration = undefined;
      }

      buff.elapsed = 0;
      buff.elapsedTick = 0;
      this.buffs.push(buff);

      try { buff.onApply?.(buff); } catch (e) { console.error(e); }
      if (debug) console.log("[buffManager] applied buff", buff.id, "duration->", buff.duration);
      return buff;
    },

    /**
     * Remove a buff by id and call its onRemove handler.
     * onRemove is invoked after the buff is removed from manager.buffs.
     */
    removeBuff(id) {
      const idx = this._findIndex(id);
      if (idx >= 0) {
        const [removed] = this.buffs.splice(idx, 1);
        try { removed.onRemove?.(removed); } catch (e) { console.error(e); }
        if (debug) console.log("[buffManager] removeBuff ->", id);
      }
    },

    /**
     * Tick method called every frame (dt in seconds).
     * - advances timers, runs tick handlers, and expires buffs.
     * - expires remove the buff from the list before calling onRemove so
     *   dependent logic (e.g., stat recompute) sees the buff as gone.
     */
    update(dt) {
      if (!isFiniteNum(dt)) return;
      if (typeof this.pauseCheck === "function" && this.pauseCheck()) return;

      for (let i = this.buffs.length - 1; i >= 0; i--) {
        const b = this.buffs[i];
        b.elapsed += dt;

        if (isFiniteNum(b.tickInterval) && b.tickInterval > 0) {
          b.elapsedTick += dt;
          if (b.elapsedTick >= b.tickInterval) {
            b.elapsedTick -= b.tickInterval;
            try { b.onTick?.(b); } catch (e) { console.error(e); }
          }
        }

        if (b.duration !== undefined && !isFiniteNum(b.duration)) {
          if (debug) { console.warn("[buffManager] buff has non-finite duration", b.id); console.trace(); }
          continue;
        }

        if (b.duration !== undefined && isFiniteNum(b.duration) && b.elapsed >= b.duration) {
          // remove first so onRemove sees manager.buffs without this buff
          const [removed] = this.buffs.splice(i, 1);
          try { removed.onRemove?.(removed); } catch (e) { console.error(e); }
          if (debug) console.log("[buffManager] expired buff", removed.id, "elapsed", removed.elapsed, "duration", removed.duration);
        }
      }
    },

    destroy() {
      this.buffs.length = 0;
      this.baseStats = {};
      this.initialized = false;
      try {
        if (k?._globalBuffManagers && Array.isArray(k._globalBuffManagers)) {
          const idx = k._globalBuffManagers.indexOf(this);
          if (idx >= 0) k._globalBuffManagers.splice(idx, 1);
        }
      } catch (e) { /* ignore */ }
    },
  };

  // Backwards compatibility aliases (preserve existing external usage).
  manager.tick = manager.update.bind(manager);
  manager.getIndex = manager._findIndex.bind(manager);

  entity._buffManager = manager;

  // Hook into entity update if available, otherwise use a global loop.
  if (typeof entity.onUpdate === "function") {
    entity.onUpdate(() => { manager.update(k.dt()); });
  } else {
    if (!k._globalBuffManagers) {
      k._globalBuffManagers = [];
      k.onUpdate(() => {
        const dt = k.dt();
        for (const m of Array.from(k._globalBuffManagers)) {
          if (m && m.initialized) m.update(dt);
        }
      });
    }
    if (!k._globalBuffManagers.includes(manager)) k._globalBuffManagers.push(manager);
  }

  if (typeof entity.onDestroy === "function") {
    try { entity.onDestroy(() => manager.destroy()); } catch (e) { /* ignore */ }
  }

  return manager;
}
