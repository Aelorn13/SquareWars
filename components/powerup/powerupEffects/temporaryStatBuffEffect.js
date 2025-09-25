import { attachBuffManager } from '../../buffManager.js';

/* ---------- Helpers ---------- */

function computeFinalFromBase(base, buffs) {
  let finalValue = base;
  if (!buffs || buffs.length === 0) return finalValue;

  const absoluteBuff = (buffs.find?.(b => b.mode === "absolute")) ?? null;
  if (absoluteBuff) return absoluteBuff.value;

  // multiplicative are applied as multipliers, additive add
  // Note: multiplicative `value` is expected as multiplier (e.g., 0.8 to reduce to 80%).
  for (const buff of buffs) {
    if (buff.mode === "additive") finalValue += buff.value;
    else if (buff.mode === "multiplicative") finalValue *= buff.value;
  }
  return finalValue;
}

/**
 * Recompute a single stat using the manager.baseStats and all active 'stat' buffs
 */
function recomputeStatFor(target, statName, mgr) {
  if (!target || !mgr) return;

  // ensure baseStats object exists
  mgr.baseStats = mgr.baseStats || {};

  // prefer any explicit permanent base stored on entity
  if (target._baseStats && target._baseStats[statName] !== undefined) {
    mgr.baseStats[statName] = Number(target._baseStats[statName]);
  }

  if (mgr.baseStats[statName] === undefined) {
    mgr.baseStats[statName] = Number(target[statName]) || 0;
  }

  // gather active stat buffs from the common buff list
  const active = (mgr.buffs || []).filter(b => b.type === 'stat' && b.data?.stat === statName).map(b => b.data ?? {});
  const finalValue = computeFinalFromBase(mgr.baseStats[statName], active);

  try { target[statName] = finalValue; } catch (e) { /* ignore assignment errors */ }

  // when no stat buffs remain, sync baseStats back to the entity and mirror to _baseStats/_buffManager
  if (active.length === 0) {
    mgr.baseStats[statName] = Number(target[statName]) || 0;
    target._baseStats ??= {};
    target._baseStats[statName] = mgr.baseStats[statName];

    if (target._buffManager) {
      try { target._buffManager.baseStats = mgr.baseStats; } catch (e) { /* ignore */ }
    }
  }
}

/* ---------- Public API (keeps same function names) ---------- */

/**
 * Apply a temporary stat buff; stacked durations when identical stat/mode/value already present.
 */
export function applyTemporaryStatBuff(
  k,
  target,
  statName,
  value,
  durationSeconds,
  mode = "multiplicative",
  gameContext
) {
  if (!target) return;

  const DEFAULT_DUR = 10;
  const dur = Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DUR;
  const pauseCheck = () => !!gameContext?.sharedState?.isPaused;
  const mgr = attachBuffManager(k, target, { pauseCheck });
  if (!mgr) return;

  // expose recomputeStat API
  target.recomputeStat = (s) => recomputeStatFor(target, s, mgr);

  mgr.baseStats = mgr.baseStats || {};
  if (target._baseStats && target._baseStats[statName] !== undefined) {
    mgr.baseStats[statName] = Number(target._baseStats[statName]);
  }

  const id = `stat_${statName}_${mode}_${String(value)}`;

  const existing = mgr.buffs.find(b => b.id === id);
  if (existing) {
    const old = existing.duration || 0;
  existing.duration = old + dur;
    existing.elapsed = 0;
    existing.elapsedTick = 0;

    recomputeStatFor(target, statName, mgr);
    return;
  }

  mgr.applyBuff({
    id,
    type: 'stat',
    duration: dur,
    data: { stat: statName, mode, value },
    onApply() {
      mgr.baseStats[statName] = mgr.baseStats[statName] ?? Number(target._baseStats?.[statName] ?? target[statName] ?? 0);
      recomputeStatFor(target, statName, mgr);
    },
    onRemove() {
      recomputeStatFor(target, statName, mgr);
    },
  });
}


/**
 * Apply temporary invincibility using the central buff manager.
 * Stacks by adding duration when already present.
 */export function applyInvincibility(k, player, durationSeconds, gameContext) {
  if (!player) return;

  const DEFAULT_DUR = 10;
  const dur = Number.isFinite(durationSeconds) ? durationSeconds : DEFAULT_DUR;


  const pauseCheck = () => !!gameContext?.sharedState?.isPaused;
  const mgr = attachBuffManager(k, player, { pauseCheck });
  if (!mgr) return;

  const id = 'invincibility';
  const existing = mgr.buffs.find(b => b.id === id);
  if (existing) {
    existing.duration = (existing.duration || 0) + dur;
    existing.elapsed = 0;
    existing.elapsedTick = 0;
    player.isInvincible = true;
    return;
  }

  mgr.applyBuff({
    id,
    type: 'invincibility',
    duration: dur,
    onApply(buff) {
      try { player.isInvincible = true; } catch (e) {}
      try {
        buff._blink = k.loop?.(0.12, () => { try { player.hidden = !player.hidden; } catch (e) {} });
      } catch (e) {
        buff._blink = null;
      }
    },
    onRemove(buff) {
      try { player.isInvincible = false; } catch (e) {}
      try { player.hidden = false; } catch (e) {}
      try { buff._blink?.cancel?.(); } catch (e) {}
    },
  });
}

