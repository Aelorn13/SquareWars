/**components/buffManager.js
 * attachBuffManager(k, entity, opts?)
 * Adds entity._buffManager if missing. opts: { pauseCheck: () => boolean }
 */
export function attachBuffManager(k, entity, opts = {}) {
  if (entity._buffManager) return entity._buffManager;

  const manager = {
    initialized: true,
    buffs: [],
    baseStats: {},
    // optional function that, when true, causes update() to skip ticking
    pauseCheck: typeof opts.pauseCheck === "function" ? opts.pauseCheck : null,

    applyBuff(buff) {
  if (!buff || !buff.id) {
    console.warn('[buffManager] applyBuff called with invalid buff', buff);
    return null;
  }

  const existing = this.buffs.find(b => b.id === buff.id);
  if (existing) {
    // preserve oldDuration before merging
    const oldDuration = existing.duration;

    // merge incoming fields but DO NOT blindly overwrite duration
    for (const key of Object.keys(buff)) {
      if (key === 'duration') continue;
      existing[key] = buff[key];
    }

    // only set duration when the incoming value is a finite number
    existing.duration = Number.isFinite(buff.duration) ? buff.duration : oldDuration;

    // restart timers when merging/extending
    existing.elapsed = 0;
    existing.elapsedTick = 0;
    return existing;
  }

  // new buff: normalise duration; warn + trace if non-finite
  if (buff.duration !== undefined && !Number.isFinite(buff.duration)) {
    console.warn('[buffManager] new buff has non-finite duration; setting to undefined', buff.id, buff.duration);
    console.trace();
    buff.duration = undefined;
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
  if (typeof this.pauseCheck === "function" && this.pauseCheck()) return;

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

    if (b.duration !== undefined && !Number.isFinite(b.duration)) {
      console.warn('[buffManager] buff has non-finite duration', b.id, b.duration, b);
      console.trace();
    }

    if (b.duration !== undefined && Number.isFinite(b.duration) && b.elapsed >= b.duration) {
      // remove first so onRemove runs with the buff already gone from manager.buffs
      const [removed] = this.buffs.splice(i, 1);
      try { removed.onRemove?.(removed); } catch (e) { console.error(e); }
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
          if (m && m.initialized) m.update(dt);
        }
      });
    }
    if (!k._globalBuffManagers.includes(manager)) k._globalBuffManagers.push(manager);
  }

  // Cleanup on destroy if possible
  if (typeof entity.onDestroy === "function") {
    try {
      entity.onDestroy(() => {
        manager.destroy();
      });
    } catch (e) {
      /* ignore */
    }
  }

  return manager;
}
