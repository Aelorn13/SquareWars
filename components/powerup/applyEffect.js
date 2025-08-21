// components/powerup/buffs.js

// applyTemporaryStatBuff:
// - multiplies (or sets absolute if `absolute === true`) the stat
// - stores original value in obj._buffData[stat].original
// - stacks duration by extending endTime if buff exists
// - cancels/reschedules a single k.wait timer for expiration
export function applyTemporaryStatBuff(k, obj, stat, multiplier, duration, absolute = false) {
  if (!obj) return;
  if (!obj._buffData) obj._buffData = {};

  const now = Date.now();

  // first application
  if (!obj._buffData[stat]) {
    obj._buffData[stat] = {
      original: obj[stat],
      endTime: now + duration * 1000,
      timer: null,
      absolute: !!absolute,
    };

    if (absolute) {
      obj[stat] = multiplier;
    } else {
      obj[stat] = obj[stat] * multiplier;
    }

    const schedule = () => {
      const data = obj._buffData[stat];
      if (!data) return;
      const remainingMs = Math.max(0, data.endTime - Date.now());
      if (data.timer) data.timer.cancel?.();
      data.timer = k.wait(Math.max(0.001, remainingMs / 1000), () => {
        // restore original value
        obj[stat] = data.original;
        // cleanup
        if (data.timer) data.timer.cancel?.();
        delete obj._buffData[stat];
      });
    };

    schedule();
  } else {
    // already active -> extend duration (stack)
    const data = obj._buffData[stat];
    data.endTime += duration * 1000;
    // reschedule timer
    if (data.timer) data.timer.cancel?.();
    const remainingMs = Math.max(0, data.endTime - Date.now());
    data.timer = k.wait(Math.max(0.001, remainingMs / 1000), () => {
      obj[stat] = data.original;
      if (data.timer) data.timer.cancel?.();
      delete obj._buffData[stat];
    });
  }
}


// spawnShockwave:
// - visual ring made of small segments
// - uses a snapshot of existing enemies at moment of spawn (so enemies spawned later are safe)
export function spawnShockwave(k, centerPos, opts = {}) {
  const DAMAGE = opts.damage ?? 5;
  const MAX_RADIUS = opts.maxRadius ?? 320;
  const SPEED = opts.speed ?? 600; // px/sec
  const SEGMENTS = Math.max(6, opts.segments ?? 28);
  const SEG_SIZE = Math.max(6, opts.segSize ?? 10);
  const SEG_COLOR = opts.color ?? k.rgb(200, 200, 255);

  // snapshot of enemies existing now (so we don't hit newly spawned enemies)
  const initialEnemies = (k.get?.("enemy") || []).slice();

  const segs = new Array(SEGMENTS);
  for (let i = 0; i < SEGMENTS; i++) {
    segs[i] = k.add([
      k.rect(SEG_SIZE, SEG_SIZE, { radius: SEG_SIZE / 2 }),
      k.color(SEG_COLOR),
      k.pos(centerPos.x, centerPos.y),
      k.anchor("center"),
      k.z(210),
      "shockSeg",
    ]);
  }

  const hit = new Set();

  k.add([
    {
      center: centerPos.clone(),
      radius: 0,
      update() {
        this.radius += SPEED * k.dt();
        const progress = Math.min(1, this.radius / MAX_RADIUS);

        for (let i = 0; i < SEGMENTS; i++) {
          const a = (i / SEGMENTS) * Math.PI * 2;
          const pos = this.center.add(k.vec2(Math.cos(a), Math.sin(a)).scale(this.radius));
          const s = segs[i];
          if (!s) continue;
          if (typeof s.exists === "function" && !s.exists()) continue;
          s.pos = pos;
          s.opacity = Math.max(0, 1 - progress);
          const scale = 1 + 0.6 * (1 - Math.abs(0.5 - progress));
          s.scale = k.vec2(scale, scale);
        }

        for (const e of initialEnemies) {
          if (!e) continue;
          if (typeof e.exists === "function" && !e.exists()) continue;
          if (e.dead) continue;
          if (!e.pos) continue;
          if (hit.has(e)) continue;

          const d = e.pos.dist(this.center);
          const eRadius = Math.max(e.width ?? 0, e.height ?? 0) * 0.5;
          if (d <= this.radius + eRadius) {
            try {
              if (typeof e.hurt === "function") {
                e.hurt(DAMAGE);
              } else if (typeof e.hp === "number") {
                e.hp = Math.max(0, e.hp - DAMAGE);
              }
            } catch (err) {
              console.warn("Shockwave: error applying damage to enemy", err);
            }
            hit.add(e);
          }
        }

        if (this.radius >= MAX_RADIUS) {
          for (const s of segs) {
            if (s && typeof s.exists === "function" && s.exists()) k.destroy(s);
          }
          k.destroy(this);
        }
      },
    },
  ]);

  // central flash
  const flash = k.add([
    k.text("💥", { size: 32 }),
    k.pos(centerPos.x, centerPos.y),
    k.anchor("center"),
    k.z(220),
  ]);
  k.wait(0.36, () => {
    if (flash && typeof flash.exists === "function" && flash.exists()) k.destroy(flash);
  });
}
