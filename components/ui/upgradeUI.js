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
    k.add([
        k.rect(k.width(), k.height()),
        k.color(0, 0, 0),
        k.opacity(0.6),
        k.pos(0, 0),
        k.fixed(),
        k.z(499),
        "upgradeUI",
    ]);
}

/**
 * Creates the "Choose an upgrade" title.
 * @param {object} k - The Kaboom context.
 * @param {number} centerX - The horizontal center of the screen.
 * @param {number} centerY - The vertical center of the screen.
 */
function createTitle(k, centerX, centerY) {
    const titleY = centerY - 220;
    // Shadow
    k.add([
        k.text("Choose an upgrade", { size: 36, align: "center" }),
        k.pos(centerX + 2, titleY + 2), k.anchor("center"), k.color(0, 0, 0), k.fixed(), k.z(504), "upgradeUI",
    ]);
    // Main text
    k.add([
        k.text("Choose an upgrade", { size: 36, align: "center" }),
        k.pos(centerX, titleY), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(505), "upgradeUI",
    ]);
}

/**
 * Creates a single upgrade card with robust hover effects and conditional tooltips.
 * @param {object} k - The Kaboom context.
 * @param {number} x - The x-coordinate of the card.
 * @param {number} y - The y-coordinate of the card.
 * @param {object} upgradeChoice - The upgrade data.
 * @param {function} onPick - The callback function when a card is picked.
 * @param {boolean} isMobile - Flag for mobile-specific UI adjustments.
 */
function createUpgradeCard(k, x, y, upgradeChoice, onPick, isMobile) {
    const colorArr = upgradeChoice?.color ?? [200, 200, 200];
    const outlineColor = k.rgb(...colorArr);

    const cardBox = k.add([
        k.rect(220, 140, { radius: 10 }),
        k.color(40, 40, 40),
        k.outline(4, outlineColor),
        k.pos(x, y),
        k.anchor("center"),
        k.area(),
        k.scale(1),
        k.fixed(),
        k.z(500),
        "upgradeUI",
        "upgradeCard",
    ]);

    cardBox.upgradeChoice = upgradeChoice;

    // --- Add all text elements ---
    const cardText = [
        k.add([k.text(upgradeChoice.rarity?.name ?? "Unknown Tier", { size: 16, align: "center" }), k.pos(x, y - 55), k.anchor("center"), k.color(...colorArr), k.fixed(), k.z(501), "upgradeUI"]),
        k.add([k.text(`${upgradeChoice.icon ?? ""} ${upgradeChoice.name ?? "Upgrade"}`, { size: 18, align: "center" }), k.pos(x, y - 25), k.anchor("center"), k.fixed(), k.z(501), "upgradeUI"]),
        k.add([k.text(upgradeChoice.bonusText ?? "", { size: 18, align: "center" }), k.pos(x, y), k.anchor("center"), k.color(...colorArr), k.fixed(), k.z(501), "upgradeUI"]),
        k.add([k.text(upgradeChoice.description ?? "", { size: 14, align: "center", width: 200 }), k.pos(x, y + 40), k.anchor("center"), k.color(200, 200, 200), k.fixed(), k.z(501), "upgradeUI"]),
    ];

    // --- Unique indicator and tooltip ---
    let tooltip = null;
    let tooltipText = null;
    if (upgradeChoice.isUnique) {
        const star = k.add([k.text("⭐", { size: 24 }), k.pos(x + 90, y - 55), k.anchor("center"), k.rotate(0), k.fixed(), k.z(502), "upgradeUI"]);
        star.onUpdate(() => { star.angle += 60 * k.dt(); });

        tooltip = k.add([k.rect(180, 40, { radius: 5 }), k.color(10, 10, 10), k.outline(2, k.rgb(220, 220, 220)), k.pos(x, y - 115), k.anchor("center"), k.opacity(0), k.fixed(), k.z(510), "upgradeUI"]);
        tooltipText = k.add([k.text("Once selected, this type of upgrade will no longer appear", { size: 12, width: 170, align: "center" }), k.pos(x, y - 115), k.anchor("center"), k.color(255, 255, 255), k.opacity(0), k.fixed(), k.z(511), "upgradeUI"]);

        if (isMobile) {
            tooltip.opacity = 1;
            tooltipText.opacity = 1;
        }
    }

    // --- PC-only hover effects managed every frame for reliability ---
    if (!isMobile) {
        cardBox.onUpdate(() => {
            const targetScale = cardBox.isHovering() ? 1.05 : 1;
            cardBox.scale = cardBox.scale.lerp(k.vec2(targetScale), k.dt() * 8);

            if (tooltip) {
                const targetOpacity = cardBox.isHovering() ? 1 : 0;
                tooltip.opacity = k.lerp(tooltip.opacity, targetOpacity, k.dt() * 10);
                tooltipText.opacity = k.lerp(tooltipText.opacity, targetOpacity, k.dt() * 10);
            }
        });
    }

    if (typeof cardBox.onClick === "function") {
        cardBox.onClick(() => onPick(cardBox.upgradeChoice));
    }
}

/**
 * Creates the skip button with hover effects.
 * @param {object} k - The Kaboom context.
 * @param {number} centerX - The horizontal center of the screen.
 * @param {number} centerY - The vertical center of the screen.
 * @param {function} onPick - The callback function.
 * @param {boolean} isMobile - Flag for mobile-specific UI adjustments.
 */
function createSkipButton(k, centerX, centerY, onPick, isMobile) {
    const skipButtonX = centerX;
    const skipButtonY = centerY + 200;
    const skipButton = k.add([
        k.rect(180, 40, { radius: 8 }), k.color(90, 90, 90), k.outline(2, k.rgb(220, 220, 220)),
        k.pos(skipButtonX, skipButtonY), k.anchor("center"), k.area(), k.scale(1), k.fixed(), k.z(502), "upgradeUI", "skipButton",
    ]);
    k.add([k.text("Skip (+10 score)", { size: 16 }), k.pos(skipButtonX, skipButtonY), k.anchor("center"), k.color(255, 255, 255), k.fixed(), k.z(503), "upgradeUI"]);

    if (!isMobile) {
        skipButton.onUpdate(() => {
            const targetScale = skipButton.isHovering() ? 1.05 : 1;
            skipButton.scale = skipButton.scale.lerp(k.vec2(targetScale), k.dt() * 8);
        });
    }

    if (typeof skipButton.onClick === "function") {
        skipButton.onClick(() => onPick("skip"));
    }
}

/**
 * showUpgradeUI(k, chosenUpgrades, onPick, isMobile)
 * cleanupUpgradeUI(k)
 *
 * chosenUpgrades: array of objects with upgrade data.
 * onPick: callback that receives the chosen upgrade object or "skip".
 * isMobile: boolean flag indicating if the user is on a mobile device.
 */
export function showUpgradeUI(k, chosenUpgrades = [], onPick = () => {}, isMobile = false) {
    // Sanitize input
    chosenUpgrades = Array.isArray(chosenUpgrades) ? chosenUpgrades.slice(0, 3) : [];
    while (chosenUpgrades.length < 3) {
        chosenUpgrades.push({ stat: "__empty__" });
    }

    const centerX = k.width() / 2;
    const centerY = k.height() / 2;

    createOverlay(k);
    createTitle(k, centerX, centerY);

    const cardSpacing = 240;
    const cardY = centerY;
    const cardXs = [centerX - cardSpacing, centerX, centerX + cardSpacing];

    chosenUpgrades.forEach((upgrade, index) => {
        if (upgrade.stat !== "__empty__") {
            createUpgradeCard(k, cardXs[index], cardY, upgrade, onPick, isMobile);
        }
    });

    createSkipButton(k, centerX, centerY, onPick, isMobile);

    // Central cursor manager for PC
    if (!isMobile) {
        k.add(["upgradeUI", {
            update() {
                const isHoveringAny = k.get("upgradeCard").some(c => c.isHovering()) || k.get("skipButton").some(b => b.isHovering());
                k.setCursor(isHoveringAny ? "pointer" : "default");
            }
        }]);
    }

    // Fallback pointer handler for older Kaboom versions
    if (k.get("upgradeCard").length > 0 && typeof k.get("upgradeCard")[0].onClick !== 'function') {
        _canvasEl = document.querySelector("canvas");
        if (!_canvasEl) return;

        _pointerHandler = (ev) => {
            ev.preventDefault();
            const rect = _canvasEl.getBoundingClientRect();
            const touch = ev.changedTouches ? ev.changedTouches[0] : ev;
            const pos = k.vec2((touch.clientX - rect.left) * (k.width() / rect.width), (touch.clientY - rect.top) * (k.height() / rect.height));

            const clickable = [...k.get("upgradeCard"), ...k.get("skipButton")].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
            for (const it of clickable) {
                if (it.hasPoint(pos)) {
                    onPick(it.is("upgradeCard") ? it.upgradeChoice : "skip");
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
        _canvasEl.removeEventListener("pointerdown", _pointerHandler);
        _canvasEl.removeEventListener("touchstart", _pointerHandler);
    }
    _pointerHandler = null;
    _canvasEl = null;

    k.destroyAll("upgradeUI");
    k.setCursor("default"); // Reset cursor on cleanup
}