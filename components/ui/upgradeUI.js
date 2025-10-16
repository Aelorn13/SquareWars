// components/ui/upgradeUI.js
// Mobile+desktop robust upgrade UI with "Choose an upgrade" title.

// Module-level refs for cleanup
let _pointerHandler = null;
let _canvasEl = null;

/**
 * Creates a dark overlay.
 * @param {object} k - The Kaboom context.
 */
function createOverlay(k) {
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
        // Fallback for older Kaboom versions or different environments
        try {
            k.add([k.rect(800, 600), k.color(0, 0, 0), k.opacity(0.6), k.pos(0, 0), k.fixed(), k.z(499), "upgradeUI"]);
        } catch (err) {}
    }
}

/**
 * Creates the "Choose an upgrade" title.
 * @param {object} k - The Kaboom context.
 * @param {number} centerX - The horizontal center of the screen.
 * @param {number} centerY - The vertical center of the screen.
 */
function createTitle(k, centerX, centerY) {
    try {
        const titleY = centerY - 220;
        // Shadow
        k.add([
            k.text("Choose an upgrade", { size: 36, align: "center" }),
            k.pos(centerX + 2, titleY + 2),
            k.anchor("center"),
            k.color(0, 0, 0),
            k.fixed(),
            k.z(504),
            "upgradeUI",
        ]);
        // Main text
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
}

/**
 * Creates a single upgrade card.
 * @param {object} k - The Kaboom context.
 * @param {number} x - The x-coordinate of the card.
 * @param {number} y - The y-coordinate of the card.
 * @param {object} upgradeChoice - The upgrade data.
 * @param {function} onPick - The callback function when a card is picked.
 */
function createUpgradeCard(k, x, y, upgradeChoice, onPick) {
    const colorArr = Array.isArray(upgradeChoice?.color) && upgradeChoice.color.length >= 3
        ? upgradeChoice.color
        : [200, 200, 200];

    const outlineColor = (typeof k.rgb === "function") ? k.rgb(...colorArr) : k.color(...colorArr);

    const cardBox = k.add([
        k.rect(220, 140, { radius: 10 }),
        k.color(40, 40, 40),
        (typeof k.outline === "function") ? k.outline(4, outlineColor) : k.pos(0, 0),
        k.pos(x, y),
        k.anchor("center"),
        k.area(),
        k.fixed(),
        k.z(500),
        "upgradeUI",
        "upgradeCard",
    ]);

    cardBox.upgradeChoice = upgradeChoice;

    // Tier Name
    k.add([
        k.text(upgradeChoice.rarity?.name ?? "Unknown Tier", { size: 16, align: "center" }),
        k.pos(x, y - 55),
        k.anchor("center"),
        k.color(...colorArr),
        k.fixed(),
        k.z(501),
        "upgradeUI"
    ]);

    // Texts
    k.add([k.text(`${upgradeChoice.icon ?? ""} ${upgradeChoice.name ?? "Upgrade"}`, { size: 18, align: "center" }), k.pos(x, y - 25), k.anchor("center"), k.fixed(), k.z(501), "upgradeUI"]);
    k.add([k.text(upgradeChoice.bonusText ?? "", { size: 18, align: "center" }), k.pos(x, y), k.anchor("center"), k.color(...colorArr), k.fixed(), k.z(501), "upgradeUI"]);
    k.add([k.text(upgradeChoice.description ?? "", { size: 14, align: "center", width: 200 }), k.pos(x, y + 40), k.anchor("center"), k.color(200, 200, 200), k.fixed(), k.z(501), "upgradeUI"]);

    // Unique indicator
    if (upgradeChoice.isUnique) {
        const star = k.add([
            k.text("⭐", { size: 24 }),
            k.pos(x + 90, y - 55),
            k.anchor("center"),
            k.rotate(0),
            k.fixed(),
            k.z(502),
            "upgradeUI",
        ]);

        star.onUpdate(() => {
            star.angle += 60 * k.dt();
        });

        const tooltip = k.add([
            k.rect(180, 40, { radius: 5 }),
            k.color(0, 0, 0),
            k.outline(2, k.rgb(255, 255, 255)),
            k.pos(x + 90, y - 100),
            k.anchor("center"),
            k.opacity(0),
            k.fixed(),
            k.z(510),
            "upgradeUI",
        ]);

        const tooltipText = k.add([
            k.text("Once selected, this type of upgrade will no longer appear", { size: 12, width: 170, align: "center" }),
            k.pos(x + 90, y - 100),
            k.anchor("center"),
            k.color(255, 255, 255),
            k.opacity(0),
            k.fixed(),
            k.z(511),
            "upgradeUI",
        ]);

        cardBox.onHover(() => {
            tooltip.opacity = 1;
            tooltipText.opacity = 1;
        }, () => {
            tooltip.opacity = 0;
            tooltipText.opacity = 0;
        });
    }

    if (typeof cardBox.onClick === "function") {
        cardBox.onClick(() => onPick(cardBox.upgradeChoice));
    }
}

/**
 * Creates the skip button.
 * @param {object} k - The Kaboom context.
 * @param {number} centerX - The horizontal center of the screen.
 * @param {number} centerY - The vertical center of the screen.
 * @param {function} onPick - The callback function when the button is picked.
 */
function createSkipButton(k, centerX, centerY, onPick) {
    const skipButtonX = centerX;
    const skipButtonY = centerY + 200;
    const skipButton = k.add([
        k.rect(180, 40, { radius: 8 }),
        k.color(90, 90, 90),
        (typeof k.outline === "function") ? k.outline(2, k.rgb(220, 220, 220)) : k.pos(0, 0),
        k.pos(skipButtonX, skipButtonY),
        k.anchor("center"),
        k.area(),
        k.fixed(),
        k.z(502),
        "upgradeUI",
        "skipButton",
    ]);
    k.add([k.text("Skip (+10 score)", { size: 16 }), k.pos(skipButtonX, skipButtonY), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(503), "upgradeUI"]);

    if (typeof skipButton.onClick === "function") {
        skipButton.onClick(() => onPick("skip"));
    }
}


/**
 * showUpgradeUI(k, chosenUpgrades, onPick)
 * cleanupUpgradeUI(k)
 *
 * chosenUpgrades: array of objects (recommended length 3) with:
 *   { stat, name, icon, bonusText, description, color: [r,g,b], rarity, isUnique, ... }
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

    const centerX = k.width() / 2;
    const centerY = k.height() / 2;

    createOverlay(k);
    createTitle(k, centerX, centerY);

    const cardSpacing = 240;
    const cardY = centerY;
    const cardXs = [centerX - cardSpacing, centerX, centerX + cardSpacing];

    chosenUpgrades.forEach((upgrade, index) => {
        createUpgradeCard(k, cardXs[index], cardY, upgrade, onPick);
    });

    createSkipButton(k, centerX, centerY, onPick);

    // Fallback pointer handler for environments without reliable onClick
    if (typeof k.get("upgradeCard")[0]?.onClick !== 'function') {
        _canvasEl = document.querySelector("canvas");
        if (!_canvasEl) return;

        _pointerHandler = (ev) => {
            ev.preventDefault();

            const rect = _canvasEl.getBoundingClientRect();
            const clientX = (ev.changedTouches?.[0] ?? ev).clientX;
            const clientY = (ev.changedTouches?.[0] ?? ev).clientY;

            const scaleX = k.width() / rect.width;
            const scaleY = k.height() / rect.height;

            const pos = k.vec2((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);

            const cards = k.get("upgradeCard").sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
            const skipButtons = k.get("skipButton").sort((a, b) => (b.z ?? 0) - (a.z ?? 0));

            for (const card of cards) {
                if (card.hasPoint(pos)) {
                    onPick(card.upgradeChoice);
                    cleanupUpgradeUI(k);
                    return;
                }
            }

            for (const btn of skipButtons) {
                if (btn.hasPoint(pos)) {
                    onPick("skip");
                    cleanupUpgradeUI(k);
                    return;
                }
            }
        };

        _canvasEl.addEventListener("pointerdown", _pointerHandler, { passive: false });
        _canvasEl.addEventListener("touchstart", _pointerHandler, { passive: false });
    }
}

/**
 * Destroys all UI elements and cancels the global input listener.
 */
export function cleanupUpgradeUI(k) {
    if (_canvasEl && _pointerHandler) {
        _canvasEl.removeEventListener("pointerdown", _pointerHandler, { passive: false });
        _canvasEl.removeEventListener("touchstart", _pointerHandler, { passive: false });
    }
    _pointerHandler = null;
    _canvasEl = null;

    k.destroyAll("upgradeUI");
}