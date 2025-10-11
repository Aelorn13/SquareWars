export function drawHealthBar(k, currentHp) {
  // Destroy all existing health bar UI elements to prepare for redraw
  k.get("hp-ui").forEach(k.destroy);

  const SQUARE_SIZE = 24; // Define the size of each health heart
  const MARGIN = 8;       // Define the margin around each health heart
  const Z_INDEX = 200;    // Z-index to ensure the label is on top
  // Draw health hearts based on current HP
  for (let i = 0; i < currentHp; i++) {
    k.add([
      k.text("❤️", { size: SQUARE_SIZE }), // Create a heart emoji text object
      // Position each heart from right to left
      k.pos(k.width() - (SQUARE_SIZE + MARGIN) * (i + 1), MARGIN),
      k.fixed(),                       // Keep the health bar fixed on screen
      k.z(Z_INDEX),                        // Ensure the health bar is on top
      "hp-ui",                         // Tag for easy selection and destruction
    ]);
  }
}