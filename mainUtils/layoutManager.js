// layoutManager.js
import { isMobileDevice, registerMobileController, unregisterMobileController } from "../components/player/controls.js";
import { makeMobileController } from "../components/player/mobile/index.js";

/* Module state */
let k = null;
let gameContainer = null;
let resizeDebounceTimer = null;
let gameShell = null; // { shell, left, center, right, canvasOriginalParent }

const LOGICAL_WIDTH = 1024;
const LOGICAL_HEIGHT = 820;
const DEBOUNCE_MS = 140;

/* Helpers */

// Compute side column width so center remains usable on narrow phones
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

function applyCanvasBaseStyleForContainer(canvas) {
  if (!canvas) return;
  Object.assign(canvas.style, {
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
}

/* Create/destroy shell (DOM only). These DO NOT register controllers. */

function createGameShell() {
  if (gameShell) return;

  // clear any portrait padding (so shell doesn't get pushed down)
  if (gameContainer) gameContainer.style.paddingTop = "";

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

  // Move canvas into center and record original parent
  const canvasOriginalParent = (k && k.canvas && k.canvas.parentElement) ? k.canvas.parentElement : gameContainer;
  if (k && k.canvas) {
    center.appendChild(k.canvas);
    applyCanvasBaseStyleForContainer(k.canvas);
  }

  gameShell = { shell, left, center, right, canvasOriginalParent };
}

function destroyGameShell() {
  if (!gameShell) return;

  try {
    if (k && k.canvas && gameShell.center && gameShell.center.contains(k.canvas)) {
      const prev = gameShell.canvasOriginalParent || gameContainer || document.body;
      prev.appendChild(k.canvas);
      applyCanvasBaseStyleForContainer(k.canvas);
      // Snap to top to help mobile browsers show the canvas
      try { window.scrollTo(0, 0); } catch {}
    }

    gameShell.shell.remove();
  } catch (e) {
    console.warn("Failed to clean up game shell:", e);
  }

  gameShell = null;
}

/* Notify engine/game of canvas resize without faking DOM resize event */
function notifyCanvasResize() {
  if (!k || !k.canvas) return;
  const rect = k.canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
  window.dispatchEvent(new CustomEvent("game-canvas-resized", { detail: { scale, rect, isLandscape: window.matchMedia("(orientation: landscape)").matches } }));
}

/* High-level layout flows (small, isolated responsibilities) */

function applyDesktopLayout() {
  // remove mobile shell and do NOT register mobile controllers
  if (gameShell) destroyGameShell();
  if (gameContainer) gameContainer.style.paddingTop = "";
  notifyCanvasResize();
}

function applyMobileLandscapeLayout() {
  // recreate shell (ensures side widths updated) and register controller that attaches to columns
  if (gameShell) destroyGameShell();
  createGameShell();
  if (gameShell) {
    registerMobileController(() => makeMobileController(k, { containers: { left: gameShell.left, right: gameShell.right, center: gameShell.center } }));
  }
  notifyCanvasResize();
}

function applyMobilePortraitLayout() {
  // restore canvas to original parent and register default mobile controls
  if (gameShell) destroyGameShell();

  // ensure canvas is in the intended container
  if (k && k.canvas) {
    const desiredParent = gameContainer || document.body;
    if (k.canvas.parentElement !== desiredParent) desiredParent.appendChild(k.canvas);
    applyCanvasBaseStyleForContainer(k.canvas);
    try { window.scrollTo(0, 0); } catch {}
  }
  //commented out as causes some bugs on PC sometimes
  // small top offset to make room for UI above canvas on portrait phones
  // if (gameContainer) {
  //   const topOffset = Math.max(window.innerHeight * 0.06, 36);
  //   gameContainer.style.paddingTop = `${topOffset}px`;
  // }

  registerMobileController(() => makeMobileController(k));
  notifyCanvasResize();
}

/* Main orchestrator */

function handleLayoutChange() {
  // ensure previous mobile controller removed
  try { unregisterMobileController(); } catch (e) { /* ignore */ }

  if (!isMobileDevice()) {
    applyDesktopLayout();
    return;
  }

  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  if (isLandscape) {
    applyMobileLandscapeLayout();
  } else {
    applyMobilePortraitLayout();
  }
}

/* Debounced resize wrapper */
function debouncedLayoutChange() {
  clearTimeout(resizeDebounceTimer);
  resizeDebounceTimer = setTimeout(handleLayoutChange, DEBOUNCE_MS);
}

/* Public init function (call once from main) */
export function initLayoutManager(kaplayInstance) {
  k = kaplayInstance;
  gameContainer = document.getElementById("game-container") || document.body;

  // listen orientation changes
  try {
    window.matchMedia("(orientation: landscape)").addEventListener("change", handleLayoutChange);
  } catch (e) {
    try { window.matchMedia("(orientation: landscape)").addListener(handleLayoutChange); } catch (e2) {}
  }

  // listen window resize (debounced)
  window.addEventListener("resize", debouncedLayoutChange);

  // initial pass
  handleLayoutChange();
}
