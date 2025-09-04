// components/ui/pause.js
/**
 * Creates and returns a hidden "PAUSE" label centered on the screen.
 * @param {object} k - The Kaboom.js context object.
 * @returns {object} The Kaboom.js game object representing the pause label.
 */
export function createPauseLabel(k) {
  const PAUSE_TEXT = "PAUSE";       // The text content for the pause label
  const FONT_SIZE = 48;             // The font size for the pause label
  const Z_INDEX = 200;              // Z-index to ensure the label is on top

  const pauseLabel = k.add([
    k.text(PAUSE_TEXT, { size: FONT_SIZE }), // Display "PAUSE" text
    k.anchor("center"),                      // Center the text's origin
    k.pos(k.width() / 2, k.height() / 2),    // Position at the screen center
    k.color(255, 255, 255),                  // Set text color to white
    k.z(Z_INDEX),                            // Ensure it renders above other elements
    k.fixed(),                               // Keep it fixed relative to the camera
    "pauseLabel",                            // Tag for easy reference and manipulation
  ]);

  pauseLabel.hidden = true; // Initialize the label as hidden
  return pauseLabel;
}