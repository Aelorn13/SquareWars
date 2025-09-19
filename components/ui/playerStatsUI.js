// playerStatsUI.js

/* ---------- Configuration / shared key order ---------- */
const PREFERRED_ORDER = [
  "hp",
  "health",
  "maxHp",
  "damage",
  "speed",
  "attackSpeed",
  "bulletSpeed",
  "critChance",
  "critMultiplier",
  "projectiles",
  "luck",
];

/* ---------- Snapshot builder (NOW FIXED TO HANDLE FUNCTIONS) ---------- */
/**
 * Build a plain object snapshot of player's stats.
 */
export function getPlayerStatsSnapshot(player) {
  const snap = {};
  if (!player || typeof player !== "object") return snap;

  for (const key of PREFERRED_ORDER) {
    let value = player[key];

    // If the property is a function, call it to get the stat value
    if (typeof value === "function") {
      value = value.call(player);
    }

    // Now check the resolved value
    if (typeof value === "number" || typeof value === "string") {
      snap[key] = value;
    }
  }

  return snap;
}


/* ---------- Helpers (labels / formatting) ---------- */

// CORRECTED ORDER: Most specific keys now come first.
const ICON_LABEL_MAP = [
  ["hp", "❤️ Health"],
  ["health", "❤️ Health"],
  ["damage", "🗡 Damage"],
  ["attackSpeed", "⚡ Attack SPD"], // MOVED UP
  ["bulletSpeed", "💨 Bullet SPD"], // MOVED UP
  ["speed", "🏃 Speed"], // Generic key is now last
  ["critChance", "🎯 Crit Chance"],
  ["critMultiplier", "💥 Crit x"],
  ["projectiles", "🔱 Projectiles"],
  ["luck", "🍀 Luck"],
  ["dashCooldown", "♻️ Dash CD"],
  ["dashDuration", "⏱️ Dash Dur"],
  ["dashSpeedMultiplier", "➡ Dash x"],
];

function niceLabel(key) {
  const lk = key.toLowerCase();
  for (const [k, label] of ICON_LABEL_MAP) {
    if (lk.includes(k.toLowerCase())) return label;
  }
  const words = key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_\-]+/g, " ")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatStat(key, val) {
  if (typeof val === "number") {
    const lk = key.toLowerCase();
    if (lk.includes("chance") || lk.includes("luck")) return `${(val * 100).toFixed(1)}%`;
    if (lk.includes("duration") || lk.includes("cooldown") || lk.includes("attack")) return `${val.toFixed(2)}s`;
    // pretty float formatting
    if (!Number.isInteger(val)) {
      if (Math.abs(val) < 1) return val.toFixed(2);
      if (Math.abs(val) >= 1000) return val.toFixed(0);
      return val.toFixed(2);
    }
    return String(val);
  }
  return String(val);
}

/* ---------- Live UI (for pause) ---------- */
// ... (rest of the file is unchanged)
/**
 * createPlayerStatsUI(k, player, opts)
 * - k: kaboom instance
 * - player: the player entity (live)
 * - opts: { x=12, y=12, width=280, size=16, z=9999 }
 *
 * returns { show(), hide(), destroy() }
 */
export function createPlayerStatsUI(k, player, opts = {}) {
  const x = opts.x ?? 12;
  const y = opts.y ?? 12;
  const width = opts.width ?? 280;
  const fontSize = opts.size ?? 16;
  const z = opts.z ?? 9999;
  const padding = 10;
  const lineH = Math.max(fontSize + 4, 18);

  // Only include keys from the preferred list that exist as number/string on player
  const keys = PREFERRED_ORDER.filter((key) => {
    let value = player?.[key];
    if (typeof value === 'function') {
      value = value.call(player);
    }
    return typeof value === "number" || typeof value === "string";
  });

  // If nothing to show, return a safe no-op UI object
  if (!keys.length) {
    return {
      show() {},
      hide() {},
      destroy() {},
    };
  }

  const bgHeight = padding * 2 + (keys.length + 1) * lineH;
  const bg = k.add([
    k.rect(width, bgHeight),
    k.pos(x, y),
    k.anchor("topleft"),
    k.color(15, 15, 15),
    k.z(z),
  ]);

  const title = k.add([
    k.text("PLAYER STATS", { size: fontSize, width: width - padding * 2 }),
    k.pos(x + padding, y + 2),
    k.anchor("topleft"),
    k.z(z + 1),
  ]);

  const items = [];
  const startY = y + padding + fontSize + 4;

  keys.forEach((key, idx) => {
    const label = niceLabel(key);
    let value = player[key];
     if (typeof value === 'function') {
      value = value.call(player);
    }
    const t = k.add([
      k.text(`${label}: ${formatStat(key, value)}`, { size: fontSize }),
      k.pos(x + padding, startY + idx * lineH),
      k.anchor("topleft"),
      k.z(z + 1),
    ]);
    items.push({ key, textObj: t });
  });

  const loopHandle = k.loop(0.12, () => {
    if (!player || typeof player !== "object") {
      destroy();
      return;
    }
    for (const item of items) {
      let v = player[item.key];
      if (typeof v === 'function') {
        v = v.call(player);
      }
      item.textObj.text = `${niceLabel(item.key)}: ${formatStat(item.key, v)}`;
    }
  });

  function show() {
    bg.hidden = false;
    title.hidden = false;
    items.forEach((it) => (it.textObj.hidden = false));
  }
  function hide() {
    bg.hidden = true;
    title.hidden = true;
    items.forEach((it) => (it.textObj.hidden = true));
  }
  function destroy() {
    try { loopHandle.cancel(); } catch (e) {}
    try { bg.destroy(); title.destroy(); items.forEach((it) => it.textObj.destroy()); } catch (e) {}
  }

  return { show, hide, destroy };
}

/* ---------- Static snapshot UI (for gameover / victory scenes) ---------- */

/**
 * createPlayerStatsSnapshotUI(k, statsSnapshot, opts)
 * - statsSnapshot: plain object returned by getPlayerStatsSnapshot(player)
 * Creates a non-updating overlay suitable for end scenes.
 */
export function createPlayerStatsSnapshotUI(k, statsSnapshot = {}, opts = {}) {
  const x = opts.x ?? 12;
  const y = opts.y ?? 12;
  const width = opts.width ?? 360;
  const fontSize = opts.size ?? 18;
  const z = opts.z ?? 9999;
  const padding = 12;
  const lineH = Math.max(fontSize + 6, 20);

  // Respect preferred order for display; only include keys present in statsSnapshot
  const keys = PREFERRED_ORDER.filter((kName) => kName in statsSnapshot);
  if (!keys.length) {
    return { destroy() {} };
  }

  const bgHeight = padding * 2 + (keys.length + 1) * lineH;
  const bg = k.add([k.rect(width, bgHeight), k.pos(x, y), k.anchor("topleft"), k.color(20, 20, 20), k.z(z)]);

  const title = k.add([k.text("FINAL PLAYER STATS", { size: fontSize + 2 }), k.pos(x + padding, y + 6), k.anchor("topleft"), k.z(z + 1)]);

  const items = [];
  keys.forEach((key, idx) => {
    const label = niceLabel(key);
    const value = formatStat(key, statsSnapshot[key]);
    const t = k.add([k.text(`${label}: ${value}`, { size: fontSize }), k.pos(x + padding, y + padding + (idx + 1) * lineH), k.anchor("topleft"), k.z(z + 1)]);
    items.push(t);
  });

  return {
    destroy() {
      try {
        bg.destroy();
        title.destroy();
        items.forEach((it) => it.destroy());
      } catch (e) {}
    },
  };
}