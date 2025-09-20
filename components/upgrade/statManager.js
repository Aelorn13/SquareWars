export function getPermanentBaseStat(entity, statName) {
  entity._baseStats ??= {};
  // Prefer the explicit permanent store, then the buff-manager's base copy, then current visible stat.
  return (
    (entity._baseStats[statName] !== undefined ? entity._baseStats[statName] : undefined) ??
    (entity._buffManager?.baseStats?.[statName] !== undefined ? entity._buffManager.baseStats[statName] : undefined) ??
    entity[statName] ??
    0
  );
}

export function applyPermanentUpgrade(entity, statName, newBaseValue) {
  entity._baseStats ??= {};
  entity._baseStats[statName] = newBaseValue;

  // Keep buff-manager's base copy in sync (if it's present).
  if (entity._buffManager?.initialized) {
    entity._buffManager.baseStats[statName] = newBaseValue;
  }

  // Prefer calling an exposed recompute function on the entity (added by buff manager).
  if (typeof entity.recomputeStat === 'function') {
    entity.recomputeStat(statName);
  } else {
    // Fallback: update visible stat. (If buff system exists but recompute isn't exposed somehow,
    // we've still kept the manager.baseStats in sync above.)
    entity[statName] = newBaseValue;
  }
}
