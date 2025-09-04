export function drawHealthBar(k, currentHp) {
  // Destroy all existing health bar UI elements to prepare for redraw
  k.get("hp-ui").forEach(k.destroy);

  const SQUARE_SIZE = 20; // Define the size of each health square
  const MARGIN = 8;       // Define the margin around each health square
  const Z_INDEX = 200;    // Z-index to ensure the label is on top
  // Draw health squares based on current HP
  for (let i = 0; i < currentHp; i++) {
    k.add([
      k.rect(SQUARE_SIZE, SQUARE_SIZE), // Create a square rectangle
      k.color(0, 255, 0),              // Set the color to green
      // Position each square from right to left
      k.pos(k.width() - (SQUARE_SIZE + MARGIN) * (i + 1), MARGIN),
      k.fixed(),                       // Keep the health bar fixed on screen
      k.z(Z_INDEX),                        // Ensure the health bar is on top
      "hp-ui",                         // Tag for easy selection and destruction
    ]);
  }
}