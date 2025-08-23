// Helpers for managing permanent base values and recomputing visible stat
// when temporary buff layers exist.

/**
 * inferPermanentBase(obj, stat)
 * - returns the permanent/base value for obj[stat].
 * - if _baseStats[stat] already exists, returns it.
 * - otherwise attempts to infer it by reversing multiplicative active layers.
 * - if an "absolute" layer exists we can't safely reverse — fallback to current value.
 * - stores the inferred value into obj._baseStats[stat] for future use.
 */
export function inferPermanentBase(obj, stat) {
  obj._baseStats ??= {};
  if (obj._baseStats[stat] !== undefined) return obj._baseStats[stat];

  const layers = (obj._buffLayers ?? {});
  const arr = layers[stat] ?? [];

  if (arr.length === 0) {
    obj._baseStats[stat] = Number(obj[stat]) || 0;
    return obj._baseStats[stat];
  }

  for (const b of arr) {
    if (b.absolute) {
      obj._baseStats[stat] = Number(obj[stat]) || 0;
      return obj._baseStats[stat];
    }
  }

  let prod = 1;
  for (const b of arr) prod *= b.multiplier;
  const inferred = (Number(obj[stat]) || 0) / (prod || 1);
  obj._baseStats[stat] = inferred;
  return inferred;
}

/**
 * setPermanentBaseAndRecompute(obj, stat, newBase)
 * - stores the new permanent base and then reapplies active temporary layers
 *   (stored in obj._buffLayers) to compute final visible obj[stat].
 *
 * Note: temporary layers are expected to be objects: { absolute:bool, multiplier:number, endTime, timer }
 */
export function setPermanentBaseAndRecompute(obj, stat, newBase) {
  obj._baseStats ??= {};
  obj._baseStats[stat] = Number(newBase);

  const layers = (obj._buffLayers ?? {});
  const arr = layers[stat] ?? [];

  let val = obj._baseStats[stat];
  if (arr.length) {
    let absoluteSeen = false;
    for (const b of arr) {
      if (b.absolute) {
        val = b.multiplier;
        absoluteSeen = true;
      } else if (!absoluteSeen) {
        val *= b.multiplier;
      }
    }
  }
  obj[stat] = val;
}
