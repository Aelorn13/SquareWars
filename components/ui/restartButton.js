/**
 * Creates a restart button that appears when the game is paused
 * @param {Object} k - Kaboom context
 * @param {Object} gameState - Game state object containing isPaused flag
 * @returns {Object} Button object with show/hide methods
 */
export function createRestartButton(k, gameState) {
  const buttonWidth = 200;
  const buttonHeight = 60;
  const margin = 20;

  const buttonPos = k.vec2(margin + buttonWidth / 2, k.height() - margin - buttonHeight / 2);

  const btn = k.add([
    k.rect(buttonWidth, buttonHeight, { radius: 8 }),
    k.pos(buttonPos),
    k.anchor("center"),
    k.color(0, 0, 0),
    k.outline(4, k.rgb(255, 255, 255)),
    k.area(),
    k.fixed(),
    k.z(100),
    k.opacity(1),
    "restartButton",
  ]);

  const btnText = btn.add([k.text("RESTART", { size: 24 }), k.anchor("center"), k.color(255, 255, 255), k.z(101)]);

  // Initially hide the button
  btn.hidden = true;

  // Hover effects
  btn.onHover(() => {
    if (!btn.hidden) {
      k.setCursor("pointer");
      btn.color = k.rgb(255, 255, 255);
      btnText.color = k.rgb(0, 0, 0);
    }
  });

  btn.onHoverEnd(() => {
    k.setCursor("default");
    btn.color = k.rgb(0, 0, 0);
    btnText.color = k.rgb(255, 255, 255);
  });

  // Click handler
  btn.onClick(() => {
    if (!btn.hidden) {
      k.setCursor("default");
      k.go("tutorial");
    }
  });

  return {
    show: () => {
      btn.hidden = false;
    },
    hide: () => {
      btn.hidden = true;
      // Reset visual state when hiding
      btn.color = k.rgb(0, 0, 0);
      btnText.color = k.rgb(255, 255, 255);
    },
    destroy: () => {
      k.destroy(btn);
    },
  };
}
