/**
 * Draws a cooldown bar for the dash ability.
 * The bar consists of a background and a fill element that updates to show cooldown progress.
 *
 * @param {KaboomCtx} k The Kaboom.js context object.
 * @returns {KaboomComp} The fill component of the dash cooldown bar.
 */
export function drawDashCooldownBar(k) {
  const BAR_WIDTH = 76;
  const BAR_HEIGHT = 10;
  const X_OFFSET = 8; // Distance from the right edge of the screen
  const Y_POS = 36;   // Y-position of the bar
  const Z_INDEX = 100;// Z-index to ensure the label is on top
  // Calculate the x-position for both the background and the fill.
  // This ensures they are perfectly aligned.
  const barX = k.width() - BAR_WIDTH - X_OFFSET;

  // Add the background rectangle for the dash cooldown bar.
  // This visually represents the maximum cooldown state. / dash is not ready
  k.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(barX, Y_POS),
    k.color(60, 60, 60), // Dark grey for the background
    k.fixed(),           // Stays in place relative to the camera
    k.z(Z_INDEX),            // Ensures it's behind the fill, but above most other UI
    'dashCooldownBarBg', // Tag for reference 
  ]);

  // Add the fill rectangle for the dash cooldown bar.
  const dashBarFill = k.add([
    k.rect(BAR_WIDTH, BAR_HEIGHT),
    k.pos(barX, Y_POS),
    k.color(255, 255, 0), // Yellow for the fill
    k.fixed(),
    k.z(Z_INDEX+1),             // Ensures it's on top of the background
    'dashCooldownBarFill', // Tag for reference
    // Custom component property to store the initial full width.
    {
      fullWidth: BAR_WIDTH
    },
  ]);

  return dashBarFill;
}