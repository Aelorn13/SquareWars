// components/upgrade/statManager.js
export function getPermanentBaseStat(entity, statName) {
  entity._baseStats ??= {};
  // use direct call to avoid runtime aliasing issues
  const b1 = Object.prototype.hasOwnProperty.call(entity._baseStats, statName)
    ? entity._baseStats[statName]
    : undefined;

  const b2 = (entity._buffManager?.baseStats && Object.prototype.hasOwnProperty.call(entity._buffManager.baseStats, statName))
    ? entity._buffManager.baseStats[statName]
    : undefined;

  return b1 ?? b2 ?? entity[statName] ?? 0;
}

export function applyPermanentUpgrade(entity, statName, newBaseValue) {
  entity._baseStats ??= {};
  entity._baseStats[statName] = newBaseValue;

  // Keep buff-manager's base copy in sync (if it's present).
  if (entity._buffManager?.initialized) {
    entity._buffManager.baseStats ??= {};
    entity._buffManager.baseStats[statName] = newBaseValue;
  }

  // Prefer calling an exposed recompute function on the entity (added by buff manager).
  if (typeof entity.recomputeStat === 'function') {
    entity.recomputeStat(statName);
  } else {
    // Fallback: update visible stat.
    entity[statName] = newBaseValue;
  }
}
