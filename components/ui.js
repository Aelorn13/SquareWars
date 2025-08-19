// --- Timer UI ---
export function createTimerLabel(k, spawnInterval, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE) {
  // calculate total seconds until cap
  const totalSeconds = Math.floor(
    (spawnInterval - MINIMAL_SPAWN_INTERVAL) / INTERVAL_DECREASE
  );

  const label = k.add([
    k.text(`Time left: ${totalSeconds}`, { size: 20 }),
    k.pos(20, 50), // just below score label
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "timerLabel",
    { timeLeft: totalSeconds },
  ]);

  return label;
}

export function updateTimerLabel(label, delta, MINIMAL_SPAWN_INTERVAL, INTERVAL_DECREASE, spawnInterval) {
  // only tick if spawnInterval > MINIMAL
  if (spawnInterval > MINIMAL_SPAWN_INTERVAL) {
    label.timeLeft = Math.max(0, label.timeLeft - delta);
    label.text = `Time left: ${Math.ceil(label.timeLeft)}`;
  } else {
    label.text = "Max Difficulty!";
  }
}
export function createPauseLabel(k) {
  const pauseLabel = k.add([
    k.text("PAUSE", { size: 48 }),
    k.anchor("center"),
    k.pos(k.width() / 2, k.height() / 2),
    k.color(255, 255, 255),
    k.z(200),
    k.fixed(),
    "pauseLabel",
  ]);
  pauseLabel.hidden = true; // hidden until pause is triggered
  return pauseLabel;
}

export function createScoreLabel(k) {
  const label = k.add([
    k.text("Score: 0", { size: 24 }),
    k.pos(20, 20),
    k.layer("ui"),
    k.fixed(),
    k.z(100),
    "scoreLabel",
  ]);
  return label;
}

export function updateScoreLabel(label, score) {
  label.text = `Score: ${score}`;
}

export function drawHealthBar(k, hp) {
  k.get("hp-ui").forEach(k.destroy);
  const squareSize = 20;
  const margin = 8;
  for (let i = 0; i < hp; i++) {
    k.add([
      k.rect(squareSize, squareSize),
      k.color(0, 255, 0),
      k.pos(k.width() - (squareSize + margin) * (i + 1), margin),
      k.fixed(),
      k.z(100),
      "hp-ui",
    ]);
  }
}
export function drawDashCooldownBar(k) {
  const barWidth = 76;
  k.add([
    k.rect(barWidth, 10),
    k.pos(k.width() - barWidth - 8, 36),
    k.color(60, 60, 60),
    k.fixed(),
    k.z(100),
  ]);

  const dashBarFill = k.add([
    k.rect(barWidth, 10),
    k.pos(k.width() - barWidth - 8, 36),
    k.color(255, 255, 0),
    k.fixed(),
    k.z(101),
    { fullWidth: barWidth },
  ]);

  return dashBarFill;
}

// --- Upgrade Draft UI ---
export function showUpgradeUI(k, chosen, onPick) {
  const cx = k.width() / 2;
  const cy = k.height() / 2;

  // dark overlay
  k.add([
    k.rect(k.width(), k.height()),
    k.color(0, 0, 0),
    k.opacity(0.6),
    k.pos(0, 0),
    k.fixed(),
    k.z(499),
    "upgradeUI",
  ]);

  const makeCard = (x, y, choice) => {
    const frame = k.rgb(...choice.rarity.color);

    const box = k.add([
      k.rect(200, 90, { radius: 10 }),
      k.color(40, 40, 40), // neutral background
      k.outline(4, frame), // rarity-colored frame
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.scale(1),
      k.fixed(),
      k.z(500),
      "upgradeUI",
      { choice },
    ]);

    // title + stat line (rarity-colored text)
  const label = k.add([
    k.text(
      `${choice.upgradeDef.icon} ${choice.upgradeDef.name}\n+${Math.round(
        choice.rarity.multiplier * 100
      )}% ${choice.upgradeDef.stat}`,
      { size: 16, align: "center" }
    ),
    k.pos(x, y),
    k.anchor("center"),
    k.scale(1),         
    k.fixed(),
    k.z(501),
    "upgradeUI",
  ]);

    // hover scale feedback
    box.onHoverUpdate(() => {
      box.scale = k.vec2(1.1, 1.1);
      label.scale = k.vec2(1.1, 1.1);

    });
    box.onHoverEnd(() => {
      box.scale = k.vec2(1, 1);
      label.scale = k.vec2(1, 1);

    });

    box.onClick(() => onPick(choice));
  };

  makeCard(cx - 230, cy, chosen[0]);
  makeCard(cx, cy, chosen[1]);
  makeCard(cx + 230, cy, chosen[2]);

  // Skip button
  const skipX = cx + 320;
  const skipY = cy - 140;

  const skipBtn = k.add([
    k.rect(140, 36, { radius: 8 }),
    k.color(90, 90, 90),
    k.outline(2, k.rgb(220, 220, 220)),
    k.pos(skipX, skipY),
    k.anchor("center"),
    k.area(),
    k.scale(1),
    k.fixed(),
    k.z(502),
    "upgradeUI",
  ]);

  k.add([
    k.text("Skip (+10 score)", { size: 14 }),
    k.pos(skipX, skipY),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.fixed(),
    k.z(503),
    "upgradeUI",
  ]);

  skipBtn.onHoverUpdate(() => {
    skipBtn.scale = k.vec2(1.06, 1.06);
  });
  skipBtn.onHoverEnd(() => {
    skipBtn.scale = k.vec2(1, 1);
  });

  skipBtn.onClick(() => onPick("skip"));
}

export function cleanupUpgradeUI(k) {
  k.destroyAll("upgradeUI");
}
