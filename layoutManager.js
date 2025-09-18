// layoutManager.js
import { isMobileDevice, registerMobileController, unregisterMobileController } from "./components/player/controls.js";
import { makeMobileController } from "./components/player/mobile/index.js";

// Module state
let k = null; // kaplay instance
let gameContainer = null; // #game-container element (fallback to body)
let resizeDebounceTimer = null;
let gameShell = null; // { shell, left, center, right, canvasOriginalParent }

const LOGICAL_WIDTH = 1024;
const LOGICAL_HEIGHT = 820;

// Compute side column width so center stays usable on narrow phones
function computeSideColumnWidth({ preferred = 220, minCenter = 420, minSide = 60, maxSide = 320 } = {}) {
  const viewWidth = Math.max(320, window.innerWidth || 360);
  let sideWidth = Math.floor((viewWidth - minCenter) / 2);

  if (sideWidth < minSide) sideWidth = Math.max(minSide, Math.floor(viewWidth * 0.12));
  sideWidth = Math.max(sideWidth, 40);
  sideWidth = Math.min(sideWidth, maxSide);

  if (sideWidth * 2 + 120 > viewWidth) {
    sideWidth = Math.floor((viewWidth - 120) / 2);
  }
  return sideWidth;
}

/**
 * Create the three-column shell and move the canvas into the center.
 * IMPORTANT: this function does NOT register/unregister controllers.
 */
function createGameShell() {
  if (gameShell) return;

  // Clear any portrait padding so shell isn't pushed down
  if (gameContainer) {
    gameContainer.style.paddingTop = "";
  }

  const sideWidth = computeSideColumnWidth();
  const shell = document.createElement("div");
  shell.id = "game-shell";
  Object.assign(shell.style, {
    position: "fixed",
    inset: "0",
    display: "grid",
    gridTemplateColumns: `${sideWidth}px minmax(0, 1fr) ${sideWidth}px`,
    zIndex: "9998",
    pointerEvents: "none",
    background: "transparent",
  });

  const left = document.createElement("div");
  const center = document.createElement("div");
  const right = document.createElement("div");

  Object.assign(left.style, { position: "relative", pointerEvents: "none", overflow: "hidden" });
  Object.assign(center.style, {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "auto",
    overflow: "hidden",
  });
  Object.assign(right.style, { position: "relative", pointerEvents: "none", overflow: "hidden" });

  shell.appendChild(left);
  shell.appendChild(center);
  shell.appendChild(right);
  document.body.appendChild(shell);

  // Move canvas into center column and remember original parent
  const canvasOriginalParent = (k && k.canvas && k.canvas.parentElement) ? k.canvas.parentElement : gameContainer;
  if (k && k.canvas) {
    center.appendChild(k.canvas);
    Object.assign(k.canvas.style, {
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      pointerEvents: "auto",
      display: "block",
      margin: "0 auto",
      transform: "none", // clear any transforms
    });
  }

  gameShell = { shell, left, center, right, canvasOriginalParent };
}


/**
 * Destroy the shell and restore canvas to original parent.
 * IMPORTANT: does NOT register/unregister controllers.
 */
function destroyGameShell() {
  if (!gameShell) return;

  try {
    if (k && k.canvas && gameShell.center && gameShell.center.contains(k.canvas)) {
      const prev = gameShell.canvasOriginalParent || gameContainer || document.body;
      prev.appendChild(k.canvas);

      // Reset canvas CSS so it lays out predictably in the parent container
      Object.assign(k.canvas.style, {
        width: "100%",         // scale to container width
        height: "auto",        // preserve aspect ratio
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
        display: "block",
        margin: "0 auto",
        transform: "none",
        pointerEvents: "auto",
      });

      // ensure container has no residual transform/offset and bring viewport to top
      if (gameContainer) {
        gameContainer.style.transform = "";
      }
      // mobile sometimes retains scroll offset — snap to top so canvas is visible
      try { window.scrollTo(0, 0); } catch (e) {}
    }

    // remove the shell element entirely
    gameShell.shell.remove();
  } catch (e) {
    console.warn("Failed to clean up game shell:", e);
  }

  gameShell = null;
}


/**
 * Adjust canvas layout and notify engine/game about new size.
 * Only applies mobile portrait padding to `gameContainer` (cleared for other layouts).
 */
function adjustCanvasLayout() {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;

  if (gameShell) {
    // In shell (landscape), center the canvas and ensure no extra top padding on container
    gameShell.center.style.alignItems = "center";
    gameShell.center.style.paddingTop = "0";
    if (gameContainer) gameContainer.style.paddingTop = ""; // clear if previously set
  } else {
    // Portrait or desktop: apply top offset only on mobile portrait (set by handleLayoutChange)
    // ensure shell-specific paddings are cleared
    if (gameContainer && !isLandscape) {
      // top offset should already be set by handleLayoutChange when in mobile portrait,
      // but clear it here if we are not in mobile portrait context:
      // (we only clear it when not in mobile portrait - keep it otherwise)
    }
  }

  // Temporarily remove our resize listener to avoid recursion when dispatching the native resize
  window.removeEventListener("resize", debouncedLayoutChange);
  window.dispatchEvent(new Event("resize"));
  window.addEventListener("resize", debouncedLayoutChange);

  // Notify game logic about canvas size
  if (k && k.canvas) {
    const rect = k.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
    window.dispatchEvent(new CustomEvent("game-canvas-resized", { detail: { scale, rect, isLandscape } }));
  }
}

/**
 * Orchestrates layout and controller registration.
 * Lifecyle order is important:
 *   1) unregister existing mobile controller
 *   2) create/destroy shell (so DOM parents are correct)
 *   3) register mobile controller for the new layout (if mobile)
 *   4) adjust canvas layout (Kaplay will receive resize event)
 */
function handleLayoutChange() {
  // 1) Remove previous mobile controller (if any)
  try { unregisterMobileController(); } catch (e) { /* ignore */ }

  // 2) Desktop: remove shell and DO NOT register mobile controls
  if (!isMobileDevice()) {
    if (gameShell) destroyGameShell();
    // Clear any portrait padding that might have been applied
    if (gameContainer) gameContainer.style.paddingTop = "";
    // Ask engine & canvas to recompute layout
    requestAnimationFrame(adjustCanvasLayout);
    return;
  }

  // Mobile device path
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;

  if (isLandscape) {
    // Ensure shell exists (recreate to update sizes)
    if (gameShell) destroyGameShell();
    createGameShell();

    // 3) Register mobile controller *after* shell exists so joysticks attach into columns
    if (gameShell) {
      registerMobileController(() =>
        makeMobileController(k, { containers: { left: gameShell.left, right: gameShell.right, center: gameShell.center } })
      );
    }
  } else {
  // Portrait mobile:
  // Destroy shell so canvas returns to original parent (gameContainer)
  if (gameShell) destroyGameShell();

  // Ensure canvas is placed into gameContainer (fallback) and reset styles
  if (k && k.canvas) {
    const desiredParent = gameContainer || document.body;
    if (k.canvas.parentElement !== desiredParent) {
      desiredParent.appendChild(k.canvas);
    }
    // small safe reset (in case destroyGameShell didn't run)
    Object.assign(k.canvas.style, {
      width: "100%",
      height: "auto",
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
      display: "block",
      margin: "0 auto",
      transform: "none",
      pointerEvents: "auto",
    });

    // Snap to top to ensure canvas is visible on mobile after reparent
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // Apply a small top offset so UI above the canvas remains visible in portrait
  if (gameContainer) {
    const topOffset = Math.max(window.innerHeight * 0.06, 36);
    gameContainer.style.paddingTop = `${topOffset}px`;
  }

  // Register portrait mobile controls (only for real mobile devices)
  registerMobileController(() => makeMobileController(k));
}
}

// Debounced resize handler wrapper
function debouncedLayoutChange() {
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(handleLayoutChange, 140);
}

/**
 * Initialize the manager (call once from main.js)
 */
export function initLayoutManager(kaplayInstance) {
  k = kaplayInstance;
  gameContainer = document.getElementById("game-container") || document.body;

  // Hook orientation changes and resize
  try {
    window.matchMedia("(orientation: landscape)").addEventListener("change", handleLayoutChange);
  } catch (e) {
    try { window.matchMedia("(orientation: landscape)").addListener(handleLayoutChange); } catch (e2) {}
  }
  window.addEventListener("resize", debouncedLayoutChange);

  // initial run
  handleLayoutChange();
}
