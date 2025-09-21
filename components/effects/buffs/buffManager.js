// components/buffs/buffManager.js
/**
 * attachBuffManager(k, entity)
 * Adds a _buffManager to entity with: applyBuff, removeBuff, update(dt), destroy()
 */

export function attachBuffManager(k, entity) {
  if (entity._buffManager) return entity._buffManager;

  const manager = {
    initialized: true,
    buffs: [],
    baseStats: {},

    applyBuff(buff) {
      if (!buff || !buff.id) {
        console.warn("applyBuff called with invalid buff", buff);
        return null;
      }
      const existing = this.buffs.find(b => b.id === buff.id);
      if (existing) {
        // Merge new values onto existing, but reset timers
        Object.assign(existing, { ...existing, ...buff });
        existing.duration = buff.duration ?? existing.duration;
        existing.elapsed = 0;
        existing.elapsedTick = 0;
        return existing;
      }

      buff.elapsed = 0;
      buff.elapsedTick = 0;
      this.buffs.push(buff);
      try { buff.onApply?.(buff); } catch (e) { console.error(e); }
      return buff;
    },

    removeBuff(id) {
      const idx = this.buffs.findIndex(b => b.id === id);
      if (idx >= 0) {
        const [b] = this.buffs.splice(idx, 1);
        try { b.onRemove?.(b); } catch (e) { console.error(e); }
      }
    },

    update(dt) {
      if (!Number.isFinite(dt)) return;
      for (let i = this.buffs.length - 1; i >= 0; i--) {
        const b = this.buffs[i];
        b.elapsed += dt;
        if (Number.isFinite(b.tickInterval) && b.tickInterval > 0) {
          b.elapsedTick += dt;
          if (b.elapsedTick >= b.tickInterval) {
            b.elapsedTick -= b.tickInterval;
            try { b.onTick?.(b); } catch (e) { console.error(e); }
          }
        }
        if (b.duration !== undefined && b.elapsed >= b.duration) {
          try { b.onRemove?.(b); } catch (e) { console.error(e); }
          this.buffs.splice(i, 1);
        }
      }
    },

    destroy() {
      // clear buffs and mark uninitialized
      this.buffs.length = 0;
      this.baseStats = {};
      this.initialized = false;
      // remove from global registry if present
      try {
        if (k?._globalBuffManagers && Array.isArray(k._globalBuffManagers)) {
          const idx = k._globalBuffManagers.indexOf(this);
          if (idx >= 0) k._globalBuffManagers.splice(idx, 1);
        }
      } catch (e) { /* ignore */ }
    },
  };

  entity._buffManager = manager;

  // Hook into entity update if available, otherwise use global manager loop.
  if (typeof entity.onUpdate === "function") {
    entity.onUpdate(() => {
      manager.update(k.dt());
    });
  } else {
    if (!k._globalBuffManagers) {
      k._globalBuffManagers = [];
      k.onUpdate(() => {
        const dt = k.dt();
        for (const m of Array.from(k._globalBuffManagers)) {
          // skip invalid/uninitialized managers
          if (m && m.initialized) m.update(dt);
        }
      });
    }
    // avoid duplicate pushes
    if (!k._globalBuffManagers.includes(manager)) k._globalBuffManagers.push(manager);
  }

  // If entity supports onDestroy, ensure we cleanup to avoid leaks.
  if (typeof entity.onDestroy === "function") {
    try {
      entity.onDestroy(() => {
        manager.destroy();
      });
    } catch (e) {
      // not critical if onDestroy API differs; destroy can be called externally
    }
  }

  return manager;
}
