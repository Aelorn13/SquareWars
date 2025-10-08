//mainUtils/mouseFix.js
/**
 * Intercepts and corrects Kaboom's mouse position to account for the custom
 * scaling and letterboxing introduced by layoutManager.js and its CSS.
 * @param {KaboomCtx} k The Kaboom instance.
 */
export function initMouseCoordProvider(k) {
  // Store the canvas's native resolution
  const nativeWidth = k.width();
  const nativeHeight = k.height();

  // Variables to store the calculated transform
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  // This function recalculates the transform whenever the window size changes
  function recalculateTransform() {
    if (!k.canvas) return;

    const rect = k.canvas.getBoundingClientRect();

    // Because of `object-fit: contain`, the scale is determined by the most constrained dimension
    const scaleX = rect.width / nativeWidth;
    const scaleY = rect.height / nativeHeight;
    scale = Math.min(scaleX, scaleY);

    // Calculate the size of the rendered game area
    const renderedWidth = nativeWidth * scale;
    const renderedHeight = nativeHeight * scale;

    // Calculate the offset (the "black bars")
    offsetX = (rect.width - renderedWidth) / 2;
    offsetY = (rect.height - renderedHeight) / 2;
  }

  // Store the original mouse position function
  const originalMousePos = k.mousePos.bind(k);

  // MONKEY-PATCH: Replace k.mousePos with our corrected version
  k.mousePos = () => {
    // Get the raw mouse position relative to the canvas's bounding box
    const rawPos = originalMousePos();

    // Translate the raw coordinates into the game's logical coordinates
    const gameX = (rawPos.x - offsetX) / scale;
    const gameY = (rawPos.y - offsetY) / scale;

    return k.vec2(gameX, gameY);
  };
    if (k.canvas) {
    k.canvas.addEventListener("mouseleave", () => {
      // When the mouse is no longer over the canvas, force the cursor
      // back to its default state.
      k.setCursor("default");
    });
  }
  // Recalculate the transform whenever the window is resized
  window.addEventListener("resize", recalculateTransform);
  // Also recalculate whenever your custom layout manager notifies of a change
  window.addEventListener("game-canvas-resized", recalculateTransform);
  
  // Run it once initially
  // Use a small delay to ensure the initial layout has been applied
  setTimeout(recalculateTransform, 50);
}