// components/ui/upgradeUI.js
/**
 * showUpgradeUI(k, chosenUpgrades, onPick)
 * cleanupUpgradeUI(k)
 *
 * chosenUpgrades: array of objects (recommended length 3) with:
 *   { stat, name, icon, bonusText, description, color: [r,g,b], rarity, ... }
 *
 * onPick receives the chosen upgrade object or the string "skip".
 */

export function showUpgradeUI(k, chosenUpgrades = [], onPick = () => {}) {
  // Ensure array and length 3
  chosenUpgrades = Array.isArray(chosenUpgrades) ? chosenUpgrades.slice(0, 3) : [];
  while (chosenUpgrades.length < 3) {
    chosenUpgrades.push({
      stat: "__empty__",
      name: "No Upgrade",
      icon: "–",
      bonusText: "",
      description: "",
      color: [120, 120, 120],
    });
  }

  const centerX = (typeof k.width === "function") ? k.width() / 2 : 400;
  const centerY = (typeof k.height === "function") ? k.height() / 2 : 300;

  // dark background
  try {
    k.add([
      k.rect(k.width(), k.height()),
      k.color(0, 0, 0),
      k.opacity(0.6),
      k.pos(0, 0),
      k.fixed(),
      k.z(499),
      "upgradeUI",
    ]);
  } catch (e) {
    // fallback sizes if any function missing
    try {
      k.add([k.rect(800, 600), k.color(0, 0, 0), k.opacity(0.6), k.pos(0, 0), k.fixed(), k.z(499), "upgradeUI"]);
    } catch (err) {}
  }

  const cardSpacing = 230;
  const cardY = centerY;
  const cardXs = [centerX - cardSpacing, centerX, centerX + cardSpacing];

  const createUpgradeCard = (x, y, upgradeChoice) => {
    const colorArr = Array.isArray(upgradeChoice?.color) && upgradeChoice.color.length >= 3
      ? upgradeChoice.color
      : [200, 200, 200];

    const frameColor = (typeof k.rgb === "function") ? k.rgb(...colorArr) : k.color(...colorArr);

    const cardBox = k.add([
      k.rect(220, 110, { radius: 10 }),
      k.color(40, 40, 40),
      // outline expects a color object in some kaboom versions; use rgb if available
      (typeof k.outline === "function") ? k.outline(4, frameColor) : k.pos(0,0),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.scale(1),
      k.fixed(),
      k.z(500),
      "upgradeUI",
      { upgradeChoice }, // attach data
    ]);

    const titleText = k.add([
      k.text(`${upgradeChoice.icon ?? ""} ${upgradeChoice.name ?? "Upgrade"}`, { size: 18, align: "center" }),
      k.pos(x, y - 30),
      k.anchor("center"),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    const bonusText = k.add([
      k.text(upgradeChoice.bonusText ?? "", { size: 16, align: "center" }),
      k.pos(x, y - 6),
      k.anchor("center"),
      k.color(...colorArr),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    const descriptionText = k.add([
      k.text(upgradeChoice.description ?? "", { size: 12, align: "center", width: 200 }),
      k.pos(x, y + 34),
      k.anchor("center"),
      k.color(200, 200, 200),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    // Hover scaling if API exists (guarded)
    try {
      if (typeof cardBox.onHoverUpdate === "function" && typeof cardBox.onHoverEnd === "function") {
        cardBox.onHoverUpdate(() => {
          const scaleFactor = (typeof k.vec2 === "function") ? k.vec2(1.08, 1.08) : 1.08;
          cardBox.scale = scaleFactor;
          titleText.scale = scaleFactor;
          bonusText.scale = scaleFactor;
          descriptionText.scale = scaleFactor;
        });
        cardBox.onHoverEnd(() => {
          const normalScale = (typeof k.vec2 === "function") ? k.vec2(1, 1) : 1;
          cardBox.scale = normalScale;
          titleText.scale = normalScale;
          bonusText.scale = normalScale;
          descriptionText.scale = normalScale;
        });
      }
    } catch (e) {}

    // Click to pick (guard)
    try {
      if (typeof cardBox.onClick === "function") {
        cardBox.onClick(() => onPick(upgradeChoice));
      } else {
        // fallback: listen for area click via k.mouseClick? (not assuming)
        // If no onClick, still support programmatic pick via cardBox.upgradeChoice
      }
    } catch (e) {}
  };

  // Create cards
  createUpgradeCard(cardXs[0], cardY, chosenUpgrades[0]);
  createUpgradeCard(cardXs[1], cardY, chosenUpgrades[1]);
  createUpgradeCard(cardXs[2], cardY, chosenUpgrades[2]);

  // Skip button
  const skipButtonX = centerX + 320;
  const skipButtonY = centerY - 140;
  const skipButton = k.add([
    k.rect(140, 36, { radius: 8 }),
    k.color(90, 90, 90),
    k.outline ? k.outline(2, k.rgb(220, 220, 220)) : k.pos(0,0),
    k.pos(skipButtonX, skipButtonY),
    k.anchor("center"),
    k.area(),
    k.scale(1),
    k.fixed(),
    k.z(502),
    "upgradeUI",
  ]);

  k.add([
    k.text("Skip (+10 score)", { size: 14 }),
    k.pos(skipButtonX, skipButtonY),
    k.anchor("center"),
    k.color(255, 255, 255),
    k.fixed(),
    k.z(503),
    "upgradeUI",
  ]);

  try {
    if (typeof skipButton.onHoverUpdate === "function" && typeof skipButton.onHoverEnd === "function") {
      skipButton.onHoverUpdate(() => { skipButton.scale = (typeof k.vec2 === "function") ? k.vec2(1.06, 1.06) : 1.06; });
      skipButton.onHoverEnd(() => { skipButton.scale = (typeof k.vec2 === "function") ? k.vec2(1, 1) : 1; });
    }
  } catch (e) {}

  try {
    if (typeof skipButton.onClick === "function") {
      skipButton.onClick(() => onPick("skip"));
    }
  } catch (e) {}
}

export function cleanupUpgradeUI(k) {
  try {
    if (typeof k.destroyAll === "function") {
      k.destroyAll("upgradeUI");
      return;
    }
  } catch (e) {}
  // best-effort fallback: try to query and destroy
  try {
    const items = k.every ? k.every("upgradeUI") : [];
    for (const it of items) {
      try { k.destroy(it); } catch (e) {}
    }
  } catch (e) {}
}
