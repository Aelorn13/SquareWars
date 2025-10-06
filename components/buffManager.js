/**
 * components/buffManager.js
 */
export function attachBuffManager(k, entity, opts = {}) {
  // --- FIX STARTS HERE ---
  if (entity._buffManager) {
    // If a manager already exists, update its options.
    // This ensures the LATEST pauseCheck function is always used.
    if (opts.pauseCheck) {
      entity._buffManager.pauseCheck = opts.pauseCheck;
    }
    return entity._buffManager;
  }
  // --- FIX ENDS HERE ---

  // Note: The original early return is now gone.

  const debug = !!opts.debug;

  const manager = {
    buffs: [],
    baseStats: {},
    
    // Make pauseCheck a property of the manager object itself.
    pauseCheck: opts.pauseCheck,

    // Core buff operations
    findBuff(id) {
      return this.buffs.find(b => b.id === id);
    },

    applyBuff(buff) {
      // ... (no changes in this function)
      if (!buff?.id) {
        if (debug) console.warn("[buffManager] Invalid buff", buff);
        return null;
      }
      const existing = this.findBuff(buff.id);
      if (existing) {
        Object.assign(existing, buff, {
          duration: Number.isFinite(buff.duration) ? buff.duration : existing.duration,
          elapsed: 0,
          elapsedTick: 0
        });
        if (debug) console.log("[buffManager] Merged buff", buff.id);
        return existing;
      }
      const newBuff = {
        ...buff,
        elapsed: 0,
        elapsedTick: 0,
        duration: Number.isFinite(buff.duration) ? buff.duration : undefined
      };
      this.buffs.push(newBuff);
      try { newBuff.onApply?.(newBuff); } catch (e) { console.error("[buffManager] onApply error:", e); }
      if (debug) console.log("[buffManager] Applied buff", newBuff.id);
      return newBuff;
    },

    removeBuff(id) {
      // ... (no changes in this function)
      const index = this.buffs.findIndex(b => b.id === id);
      if (index < 0) return;
      const [buff] = this.buffs.splice(index, 1);
      try { buff.onRemove?.(buff); } catch (e) { console.error("[buffManager] onRemove error:", e); }
      if (debug) console.log("[buffManager] Removed buff", id);
    },

    // Get buffs by type
    getBuffsByType(type) {
      return this.buffs.filter(b => b.type === type);
    },

    // Count buffs by type
    countBuffsByType(type) {
      return this.buffs.filter(b => b.type === type).length;
    },

    update(dt) {
      // Use 'this.pauseCheck' now to reference the manager's property.
      if (!Number.isFinite(dt) || (this.pauseCheck && this.pauseCheck())) {
        return;
      }

      for (let i = this.buffs.length - 1; i >= 0; i--) {
        const buff = this.buffs[i];
        
        // Individual buff pause check remains the same
        if (buff.pauseCheck && buff.pauseCheck()) continue;
        
        buff.elapsed += dt;

        if (Number.isFinite(buff.tickInterval) && buff.tickInterval > 0) {
          buff.elapsedTick += dt;
          if (buff.elapsedTick >= buff.tickInterval) {
            buff.elapsedTick -= buff.tickInterval;
            try { buff.onTick?.(buff); } catch (e) { console.error("[buffManager] onTick error:", e); }
          }
        }

        if (Number.isFinite(buff.duration) && buff.elapsed >= buff.duration) {
          const [expired] = this.buffs.splice(i, 1);
          try { expired.onRemove?.(expired); } catch (e) { console.error("[buffManager] onRemove error:", e); }
          if (debug) console.log("[buffManager] Expired buff", expired.id);
        }
      }
    },

    destroy() {
      // ... (no changes in this function)
      while (this.buffs.length > 0) {
        this.removeBuff(this.buffs[0].id);
      }
      this.baseStats = {};
      if (k._globalBuffManagers) {
        const idx = k._globalBuffManagers.indexOf(this);
        if (idx >= 0) k._globalBuffManagers.splice(idx, 1);
      }
    }
  };

  entity._buffManager = manager;

  // ... (no changes to the rest of the file)
  if (entity.onUpdate) {
    entity.onUpdate(() => manager.update(k.dt()));
  } else {
    k._globalBuffManagers = k._globalBuffManagers || [];
    if (!k._globalBuffManagers.includes(manager)) {
      k._globalBuffManagers.push(manager);
    }
    if (!k._globalBuffManagersInitialized) {
      k._globalBuffManagersInitialized = true;
      k.onUpdate(() => {
        const dt = k.dt();
        for (const m of k._globalBuffManagers) {
          m?.update(dt);
        }
      });
    }
  }
  if (entity.onDestroy) {
    entity.onDestroy(() => manager.destroy());
  }

  return manager;
}