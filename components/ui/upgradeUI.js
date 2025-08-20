// components/ui/upgradeUI.js
// showUpgradeUI expects "chosen" to be pre-formatted upgrade objects:
// { icon, name, bonusText, color: [r,g,b], upgradeDef, rarity }
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
    const frame = k.rgb(...choice.color);

    const box = k.add([
      k.rect(200, 90, { radius: 10 }),
      k.color(40, 40, 40),
      k.outline(4, frame),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.scale(1),
      k.fixed(),
      k.z(500),
      "upgradeUI",
      { choice },
    ]);

    // title (icon + name)
    const titleLabel = k.add([
      k.text(`${choice.icon} ${choice.name}`, { size: 18, align: "center" }),
      k.pos(x, y - 15),
      k.anchor("center"),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    // bonus number (rarity-colored)
    const bonusLabel = k.add([
      k.text(choice.bonusText, { size: 20, align: "center" }),
      k.pos(x, y + 15),
      k.anchor("center"),
      k.color(...choice.color),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    // hover scale feedback
    box.onHoverUpdate(() => {
      box.scale = k.vec2(1.1, 1.1);
      titleLabel.scale = k.vec2(1.1, 1.1);
      bonusLabel.scale = k.vec2(1.1, 1.1);
    });
    box.onHoverEnd(() => {
      box.scale = k.vec2(1, 1);
      titleLabel.scale = k.vec2(1, 1);
      bonusLabel.scale = k.vec2(1, 1);
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
