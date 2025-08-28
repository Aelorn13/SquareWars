// ==============================
// applyTemporaryStatBuff
// ==============================
// Layered, time-limited stat buffing that plays nice with permanent upgrades.
// - Keeps a base snapshot per stat in obj._baseStats (set on first buff).
// - Active buffs live in obj._buffLayers[stat].
// - Extending a buff schedules expiry for the *existing* entry (not a new one).
// - When no buffs are left, the stat is restored to base and base is synced to
//   current value (so future buffs use the latest base).
// Extended to support additive buffs (for stats like projectiles).
// Modes:
// - multiplier (default): val *= multiplier
// - absolute: val = multiplier
// - additive: val = base + amount
export function applyTemporaryStatBuff(
  k,
  obj,
  stat,
  value,
  durationSeconds,
  mode = "multiplier", // "multiplier" | "absolute" | "additive"
) {
  if (!obj) return;

  const layers = (obj._buffLayers ??= {});
  const base   = (obj._baseStats  ??= {});
  const now    = Date.now();
  const durMs  = Math.max(0, durationSeconds * 1000);

  // First time we ever buff this stat → snapshot base from current value
  if (base[stat] === undefined) {
    base[stat] = Number(obj[stat]) || 0;
  }

  // Compute effective value from base + all active buffs
  const recompute = () => {
    let val = base[stat];
    const arr = layers[stat] || [];

    if (arr.length) {
      let absoluteSeen = false;
      for (const b of arr) {
        if (b.mode === "absolute") {
          val = b.value;
          absoluteSeen = true;
        } else if (!absoluteSeen) {
          if (b.mode === "multiplier") {
            val *= b.value;
          } else if (b.mode === "additive") {
            val += b.value;
          }
        }
      }
    }
    obj[stat] = val;
    if (stat === "attackSpeed") {
  obj._cosmetics?.updateAttackSpeedColor?.();
}
    // If no active buffs remain, sync base to current so future buffs
    // start from the latest permanently-upgraded value.
    if (!layers[stat] || layers[stat].length === 0) {
      base[stat] = Number(obj[stat]) || 0;
    }
  };

  const schedule = (buff) => {
    const remaining = Math.max(0.001, (buff.endTime - Date.now()) / 1000);
    buff.timer?.cancel?.();
    buff.timer = k.wait(remaining, () => {
      const arr = layers[stat];
      if (arr) {
        const idx = arr.indexOf(buff);
        if (idx >= 0) arr.splice(idx, 1);
        if (arr.length === 0) delete layers[stat];
      }
      recompute();
    });
  };

  const arr = (layers[stat] ??= []);
  // “Same signature” buff: same mode + same value → just extend
  const existing = arr.find(b => b.mode === mode && b.value === value);

  if (existing) {
    existing.endTime += durMs;
    schedule(existing);
  } else {
    const entry = {
      mode,
      value,
      endTime: now + durMs,
      timer: null,
    };
    arr.push(entry);
    recompute();
    schedule(entry);
  }
}




// ==============================
// spawnShockwave
// ==============================
/**
 * Spawns a circular "shockwave" that expands from `centerPos`, damages each
 * enemy (present at cast time) once when the ring reaches them, and then fades.
 *
 * Notes:
 * - snapshot enemies at the moment of cast so *newly spawned* enemies
 *   are not affected (prevents "dying on spawn" issues).
 * - Visual ring is composed of `SEGMENTS` little rounded squares for a light,
 *   cheap effect. We precompute unit direction vectors to reduce Math work.
 */
export function spawnShockwave(k, centerPos, opts = {}) {
  const DAMAGE     = opts.damage    ?? 5;
  const MAX_RADIUS = opts.maxRadius ?? 320;
  const SPEED      = opts.speed     ?? 600; // px / second
  const SEGMENTS   = Math.max(6, opts.segments ?? 28);
  const SEG_SIZE   = Math.max(6, opts.segSize ?? 10);
  const SEG_COLOR  = opts.color     ?? k.rgb(200, 200, 255);

  // Snapshot of enemies *now*: protects enemies that spawn later.
  const enemySnapshot = ((k.get && k.get("enemy")) || []).slice();

  // Precompute evenly distributed unit vectors around the circle.
  const dir = new Array(SEGMENTS);
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    dir[i] = k.vec2(Math.cos(a), Math.sin(a));
  }

  // Create visual ring segments
  const segments = new Array(SEGMENTS);
  for (let i = 0; i < SEGMENTS; i++) {
    segments[i] = k.add([
      k.rect(SEG_SIZE, SEG_SIZE, { radius: SEG_SIZE / 2 }),
      k.color(SEG_COLOR),
      k.pos(centerPos.x, centerPos.y),
      k.anchor("center"),
      k.z(210),
      "shockSeg",
    ]);
  }

  // Track which enemies we've already damaged
  const hitOnce = new Set();

  // Controller drives expansion + collision checks
  const controller = k.add([
    {
      center: centerPos.clone(),
      radius: 0,
      speed: SPEED,

      update() {
        // Expand the ring
        this.radius += this.speed * k.dt();
        const t = Math.min(1, this.radius / MAX_RADIUS); // 0..1 progress
        const alpha = Math.max(0, 1 - t);                // fade out over time

        // Position & fade segments
        for (let i = 0; i < SEGMENTS; i++) {
          const s = segments[i];
          if (!s) continue;
          if (s.exists && !s.exists()) continue;

          // center + direction * radius
          s.pos = this.center.add(dir[i].scale(this.radius));
          s.opacity = alpha;

          // A gentle "breathing" scale as the ring travels
          const pulse = 1 + 0.6 * (1 - Math.abs(0.5 - t) * 2); // 1..1.6..1
          s.scale = k.vec2(pulse, pulse);
        }

        // Damage each snapshot enemy at most once as the ring passes
        for (const e of enemySnapshot) {
          if (!e) continue;
          if (e.exists && !e.exists()) continue;
          if (e.dead) continue;
          if (!e.pos) continue;
          if (hitOnce.has(e)) continue;

          // Treat enemy as a circle using half of max(width,height)
          const enemyRadius =
            Math.max(e.width ?? 0, e.height ?? 0) * 0.5;

          // If ring's radius reaches enemy's center (expanded by enemyRadius), hit it
          if (e.pos.dist(this.center) <= this.radius + enemyRadius) {
            try {
              if (typeof e.hurt === "function") {
                e.hurt(DAMAGE);
              } else if (typeof e.hp === "number") {
                e.hp = Math.max(0, e.hp - DAMAGE);
              }
            } catch (err) {
              console.warn("Shockwave: couldn't apply damage:", err);
            }
            hitOnce.add(e);
          }
        }

        // Cleanup when the wave finishes expanding
        if (this.radius >= MAX_RADIUS) {
          for (const s of segments) {
            if (s && s.exists && s.exists()) k.destroy(s);
          }
          k.destroy(this);
        }
      },
    },
  ]);

  // Quick central flash for feedback
  const flash = k.add([
    k.text("💥", { size: 32 }),
    k.pos(centerPos.x, centerPos.y),
    k.anchor("center"),
    k.z(220),
  ]);
  k.wait(0.36, () => {
    if (flash && flash.exists && flash.exists()) k.destroy(flash);
  });

  // Optional: return controller if caller wants to tweak/track it
  return controller;
}

