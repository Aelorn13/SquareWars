// controls.js
export const keysPressed = {};

export function initControls() {
  // Prevent double-adding listeners
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
  });
}
