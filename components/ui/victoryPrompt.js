export function showVictoryPrompt(k, options) {
    const { onContinue, onEnd } = options;

    // A single, common tag for all prompt elements for easy cleanup
    const PROMPT_TAG = "victory-prompt";

    // Create a solid black overlay instead of a semi-transparent one
    k.add([
        k.rect(k.width(), k.height()),
        k.pos(0, 0),
        k.color(0, 0, 0), // Solid black background
        k.fixed(),
        k.z(1000),
        PROMPT_TAG, // All elements get the same tag
    ]);

    // Title
    k.add([
        k.text("BOSS DEFEATED!", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 150),
        k.anchor("center"),
        k.color(255, 215, 0),
        k.fixed(),
        k.z(1002),
        PROMPT_TAG,
    ]);

    // Message
    k.add([
        k.text("Continue to endless mode or claim victory?", {
            size: 24,
            width: k.width() * 0.8,
            align: "center",
        }),
        k.pos(k.width() / 2, k.height() / 2 - 50),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.fixed(),
        k.z(1002),
        PROMPT_TAG,
    ]);

    // --- Button Properties ---
    const buttonWidth = 280;
    const buttonHeight = 70;
    const buttonY = k.height() / 2 + 100;
    const buttonSpacing = 320; // Horizontal distance between button centers

    // --- Continue Button ---
    const continueBtnPos = k.vec2(k.width() / 2 - buttonSpacing / 2, buttonY);
    const continueBtn = k.add([
        k.rect(buttonWidth, buttonHeight, { radius: 8 }),
        k.pos(continueBtnPos),
        k.anchor("center"),
        k.color(0, 0, 0),
        k.outline(4, k.rgb(255, 255, 255)),
        k.area(),
        k.fixed(),
        k.z(1002),
        PROMPT_TAG,
    ]);

    const continueTxt = continueBtn.add([
        k.text("Continue", { size: 28 }),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(1003),
    ]);

    // --- Victory Button ---
    const endBtnPos = k.vec2(k.width() / 2 + buttonSpacing / 2, buttonY);
    const endBtn = k.add([
        k.rect(buttonWidth, buttonHeight, { radius: 8 }),
        k.pos(endBtnPos),
        k.anchor("center"),
        k.color(0, 0, 0),
        k.outline(4, k.rgb(255, 255, 255)),
        k.area(),
        k.fixed(),
        k.z(1002),
        PROMPT_TAG,
    ]);

    const endTxt = endBtn.add([
        k.text("Victory!", { size: 28 }),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(1003),
    ]);

    continueBtn.onClick(() => {
        k.destroyAll(PROMPT_TAG); 
        if (onContinue) onContinue();
    });

    endBtn.onClick(() => {
        k.destroyAll(PROMPT_TAG); 
        if (onEnd) onEnd();
    });

    // --- Hover Effects ---
    continueBtn.onHover(() => {
        k.setCursor("pointer");
        continueBtn.color = k.rgb(255, 255, 255);
        continueTxt.color = k.rgb(0, 0, 0);
    });

    continueBtn.onHoverEnd(() => {
        k.setCursor("default");
        continueBtn.color = k.rgb(0, 0, 0);
        continueTxt.color = k.rgb(255, 255, 255);
    });

    endBtn.onHover(() => {
        k.setCursor("pointer");
        endBtn.color = k.rgb(255, 255, 255);
        endTxt.color = k.rgb(0, 0, 0);
    });

    endBtn.onHoverEnd(() => {
        k.setCursor("default");
        endBtn.color = k.rgb(0, 0, 0);
        endTxt.color = k.rgb(255, 255, 255);
    });
}