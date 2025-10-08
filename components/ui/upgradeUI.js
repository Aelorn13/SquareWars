// components/ui/upgradeUI.js
// Mobile+desktop robust upgrade UI with "Choose an upgrade" title.

// Module-level refs for cleanup
let _pointerHandler = null;
let _canvasEl = null;

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
  // normalize input
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

  // dark overlay
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
    try {
      k.add([k.rect(800, 600), k.color(0, 0, 0), k.opacity(0.6), k.pos(0, 0), k.fixed(), k.z(499), "upgradeUI"]);
    } catch (err) {}
  }

  // Title
  try {
    const titleY = centerY - 180;
    // shadow
    k.add([
      k.text("Choose an upgrade", { size: 36, align: "center" }),
      k.pos(centerX + 2, titleY + 2),
      k.anchor("center"),
      k.color(0, 0, 0),
      k.fixed(),
      k.z(504),
      "upgradeUI",
    ]);
    k.add([
      k.text("Choose an upgrade", { size: 36, align: "center" }),
      k.pos(centerX, titleY),
      k.anchor("center"),
      k.color(255, 255, 255),
      k.fixed(),
      k.z(505),
      "upgradeUI",
    ]);
  } catch (e) {}

  const cardSpacing = 230;
  const cardY = centerY;
  const cardXs = [centerX - cardSpacing, centerX, centerX + cardSpacing];

  const mkVec = (x, y) => (typeof k.vec2 === "function" ? k.vec2(x, y) : { x, y });

  // helper: robust point-in-item test
  const itemHasPoint = (item, point) => {
    try {
      if (!item) return false;
      if (typeof item.hasPoint === "function") return item.hasPoint(point);
      // fallback: try bounding box using pos + rect size if available
      const pos = item.pos || (typeof item.getPos === "function" ? item.getPos() : null);
      if (!pos) return false;
      const w = (item.width ?? item._width ?? 0) || 0;
      const h = (item.height ?? item._height ?? 0) || 0;
      // If width/height are not present assume common card size 220x110 for rects.
      const useW = w || 220;
      const useH = h || 110;
      const left = (pos.x ?? 0) - useW / 2;
      const top = (pos.y ?? 0) - useH / 2;
      const px = point.x ?? point[0] ?? 0;
      const py = point.y ?? point[1] ?? 0;
      return px >= left && px <= left + useW && py >= top && py <= top + useH;
    } catch (e) {
      return false;
    }
  };

  const createUpgradeCard = (x, y, upgradeChoice) => {
    const colorArr = Array.isArray(upgradeChoice?.color) && upgradeChoice.color.length >= 3
      ? upgradeChoice.color
      : [200, 200, 200];

    // Use rgb if available, otherwise k.color fallback
    const outlineColor = (typeof k.rgb === "function") ? k.rgb(...colorArr) : k.color(...colorArr);

    const cardBox = k.add([
      k.rect(220, 110, { radius: 10 }),
      k.color(40, 40, 40),
      (typeof k.outline === "function") ? k.outline(4, outlineColor) : k.pos(0, 0),
      k.pos(x, y),
      k.anchor("center"),
      k.area(), // ensures hasPoint exists in many kaboom versions
      k.fixed(),
      k.z(500),
      "upgradeUI",
      "upgradeCard",
    ]);

    // attach data
    try { cardBox.upgradeChoice = upgradeChoice; } catch (e) {}

    // texts
    k.add([k.text(`${upgradeChoice.icon ?? ""} ${upgradeChoice.name ?? "Upgrade"}`, { size: 18, align: "center" }), k.pos(x, y - 30), k.anchor("center"), k.fixed(), k.z(501), "upgradeUI"]);
    k.add([k.text(upgradeChoice.bonusText ?? "", { size: 16, align: "center" }), k.pos(x, y - 6), k.anchor("center"), k.color(...colorArr), k.fixed(), k.z(501), "upgradeUI"]);
    k.add([k.text(upgradeChoice.description ?? "", { size: 12, align: "center", width: 200 }), k.pos(x, y + 34), k.anchor("center"), k.color(200, 200, 200), k.fixed(), k.z(501), "upgradeUI"]);

    try {
      if (typeof cardBox.onClick === "function") {
        cardBox.onClick(() => {
          // remove global handler immediately if present
          if (_pointerHandler && _canvasEl) {
            _canvasEl.removeEventListener("pointerdown", _pointerHandler, { passive: false });
            _canvasEl.removeEventListener("touchstart", _pointerHandler, { passive: false });
            _pointerHandler = null;
            _canvasEl = null;
          }
          onPick(cardBox.upgradeChoice);
        });
        return;
      }
    } catch (e) {}
    // else global pointer fallback will handle clicks
  };

  createUpgradeCard(cardXs[0], cardY, chosenUpgrades[0]);
  createUpgradeCard(cardXs[1], cardY, chosenUpgrades[1]);
  createUpgradeCard(cardXs[2], cardY, chosenUpgrades[2]);

  // Skip button
  const skipButtonX = centerX + 320;
  const skipButtonY = centerY - 140;
  const skipButton = k.add([
    k.rect(140, 36, { radius: 8 }),
    k.color(90, 90, 90),
    (typeof k.outline === "function") ? k.outline(2, (typeof k.rgb === "function" ? k.rgb(220,220,220) : k.color(220,220,220))) : k.pos(0,0),
    k.pos(skipButtonX, skipButtonY),
    k.anchor("center"),
    k.area(),
    k.fixed(),
    k.z(502),
    "upgradeUI",
    "skipButton",
  ]);
  k.add([k.text("Skip (+10 score)", { size: 14 }), k.pos(skipButtonX, skipButtonY), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(503), "upgradeUI"]);

  // per-entity click for skip if available
  try {
    if (typeof skipButton.onClick === "function") {
      skipButton.onClick(() => {
        if (_pointerHandler && _canvasEl) {
          _canvasEl.removeEventListener("pointerdown", _pointerHandler, { passive: false });
          _canvasEl.removeEventListener("touchstart", _pointerHandler, { passive: false });
          _pointerHandler = null;
          _canvasEl = null;
        }
        onPick("skip");
      });
    }
  } catch (e) {}

  // If runtime already supplies reliable onClick handlers we are done.
  // If not, install a robust pointerdown handler on the canvas that computes correct local coords.
  // This handles mobile touch and desktop pointer events consistently.
  if (!_pointerHandler) {
    try {
      // get canvas element reliably
      _canvasEl = document.querySelector("canvas") || null;
      if (!_canvasEl) {
        // no canvas found, skip pointer fallback
        return;
      }

      _pointerHandler = function (ev) {
        // prevent default so touches don't generate synthetic mouse events
        try { ev.preventDefault(); } catch (e) {}

        // compute canvas-local coordinates scaled to game resolution
        const rect = _canvasEl.getBoundingClientRect();
        const clientX = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0].clientX : ev.clientX;
        const clientY = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0].clientY : ev.clientY;

        const scaleX = (typeof k.width === "function" && rect.width) ? (k.width() / rect.width) : 1;
        const scaleY = (typeof k.height === "function" && rect.height) ? (k.height() / rect.height) : 1;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const pos = mkVec(x, y);

        // collect clickable items
        const cards = (typeof k.get === "function") ? (k.get("upgradeCard") || []) : [];
        const skips = (typeof k.get === "function") ? (k.get("skipButton") || []) : [];
        const clickable = [...cards, ...skips];

        // sort by z desc so top-most handles first
        clickable.sort((a, b) => (b.z ?? 0) - (a.z ?? 0));

        for (const it of clickable) {
          if (itemHasPoint(it, pos)) {
            // remove handler immediately to avoid double picks
            if (_canvasEl && _pointerHandler) {
              _canvasEl.removeEventListener("pointerdown", _pointerHandler, { passive: false });
              _canvasEl.removeEventListener("touchstart", _pointerHandler, { passive: false });
              _pointerHandler = null;
              _canvasEl = null;
            }
            try {
              if (it.is && typeof it.is === "function") {
                if (it.is("upgradeCard")) {
                  onPick(it.upgradeChoice ?? it.upgradeChoice);
                } else if (it.is("skipButton")) {
                  onPick("skip");
                } else {
                  // fallback: if upgradeChoice attached
                  if (it.upgradeChoice) onPick(it.upgradeChoice);
                }
              } else {
                // fallback: use tags
                if ((it.tags || []).includes && (it.tags || []).includes("upgradeCard")) {
                  onPick(it.upgradeChoice);
                } else {
                  onPick("skip");
                }
              }
            } catch (e) {
              // best-effort: attempt to call onPick with attached choice
              try { onPick(it.upgradeChoice ?? "skip"); } catch (err) {}
            }
            return;
          }
        }
      };

      // pointerdown covers mouse + touch on modern browsers. add touchstart for extra compatibility.
      _canvasEl.addEventListener("pointerdown", _pointerHandler, { passive: false });
      _canvasEl.addEventListener("touchstart", _pointerHandler, { passive: false });
    } catch (e) {
      // graceful failure, UI remains but interactions may not work
    }
  }
}

/**
 * Destroys all UI elements and cancels the global input listener.
 */
export function cleanupUpgradeUI(k) {
  try {
    if (_canvasEl && _pointerHandler) {
      _canvasEl.removeEventListener("pointerdown", _pointerHandler, { passive: false });
      _canvasEl.removeEventListener("touchstart", _pointerHandler, { passive: false });
    }
  } catch (e) {}
  _pointerHandler = null;
  _canvasEl = null;

  try {
    if (typeof k.destroyAll === "function") {
      k.destroyAll("upgradeUI");
      return;
    }
  } catch (e) {}
  // fallback: attempt to remove by tag
  try {
    const items = k.every ? k.every("upgradeUI") : [];
    for (const it of items) {
      try { k.destroy(it); } catch (err) {}
    }
  } catch (e) {}
}
