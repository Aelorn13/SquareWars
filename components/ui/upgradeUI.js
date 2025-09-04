// components/ui/upgradeUI.js
/**
 * Displays an upgrade selection UI to the player.
 * @param {object} k - The Kaboom.js context object.
 * @param {Array<object>} chosenUpgrades - An array of pre-formatted upgrade objects:
 *   { icon, name, bonusText, color: [r,g,b], upgradeDef, rarity }
 * @param {function} onPick - Callback function when an upgrade is chosen or skipped.
 */
export function showUpgradeUI(k, chosenUpgrades, onPick) {
  const centerX = k.width() / 2;
  const centerY = k.height() / 2;

  // Dim background to focus on the UI
  k.add([
    k.rect(k.width(), k.height()),
    k.color(0, 0, 0),
    k.opacity(0.6),
    k.pos(0, 0),
    k.fixed(),
    k.z(499),
    "upgradeUI",
  ]);

  /**
   * Creates an upgrade card UI element.
   * @param {number} x - X position of the card.
   * @param {number} y - Y position of the card.
   * @param {object} upgradeChoice - The upgrade data for this card.
   */
  const createUpgradeCard = (x, y, upgradeChoice) => {
    const frameColor = k.rgb(...upgradeChoice.color);

    const cardBox = k.add([
      k.rect(200, 90, { radius: 10 }),
      k.color(40, 40, 40),
      k.outline(4, frameColor),
      k.pos(x, y),
      k.anchor("center"),
      k.area(),
      k.scale(1),
      k.fixed(),
      k.z(500),
      "upgradeUI",
      { upgradeChoice }, // Attach upgrade data directly to the component
    ]);

    const titleText = k.add([
      k.text(`${upgradeChoice.icon} ${upgradeChoice.name}`, { size: 18, align: "center" }),
      k.pos(x, y - 15),
      k.anchor("center"),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    const bonusText = k.add([
      k.text(upgradeChoice.bonusText, { size: 20, align: "center" }),
      k.pos(x, y + 15),
      k.anchor("center"),
      k.color(...upgradeChoice.color),
      k.fixed(),
      k.z(501),
      "upgradeUI",
    ]);

    // Apply hover scaling to card elements
    cardBox.onHoverUpdate(() => {
      const scaleFactor = k.vec2(1.1, 1.1);
      cardBox.scale = scaleFactor;
      titleText.scale = scaleFactor;
      bonusText.scale = scaleFactor;
    });

    cardBox.onHoverEnd(() => {
      const normalScale = k.vec2(1, 1);
      cardBox.scale = normalScale;
      titleText.scale = normalScale;
      bonusText.scale = normalScale;
    });

    cardBox.onClick(() => onPick(upgradeChoice));
  };

  // Position and create upgrade cards
  const cardSpacing = 230;
  createUpgradeCard(centerX - cardSpacing, centerY, chosenUpgrades[0]);
  createUpgradeCard(centerX, centerY, chosenUpgrades[1]);
  createUpgradeCard(centerX + cardSpacing, centerY, chosenUpgrades[2]);

  // Skip button positioning
  const skipButtonX = centerX + 320;
  const skipButtonY = centerY - 140;

  const skipButton = k.add([
    k.rect(140, 36, { radius: 8 }),
    k.color(90, 90, 90),
    k.outline(2, k.rgb(220, 220, 220)),
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

  // Apply hover scaling to skip button
  skipButton.onHoverUpdate(() => {
    skipButton.scale = k.vec2(1.06, 1.06);
  });
  skipButton.onHoverEnd(() => {
    skipButton.scale = k.vec2(1, 1);
  });

  skipButton.onClick(() => onPick("skip"));
}

/**
 * Destroys all UI elements related to the upgrade selection.
 * @param {object} k - The Kaboom.js context object.
 */
export function cleanupUpgradeUI(k) {
  k.destroyAll("upgradeUI");
}