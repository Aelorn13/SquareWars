import kaplay from "https://unpkg.com/kaplay@3001.0.19/dist/kaplay.mjs";
import { defineGameScene } from "./scenes/game.js";
import { defineGameOverScene } from "./scenes/gameover.js";
import { TutorialScene } from "./scenes/tutorial.js";
import { initControls, registerMobileController, unregisterMobileController, isMobileDevice } from "./components/player/controls.js";
import { defineVictoryScene } from "./scenes/victory.js";
import { defineDebugScene } from "./scenes/debug.js";
import { makeMobileController } from "./components/player/mobile/index.js";

const k = kaplay({
  width: 1024,
  height: 820,
  letterBox: true,
  debug: true,
  global: false,
  background: [0, 0, 0],
  touchToMouse: true,
  debugKey: "f4",
});
// Compute side column widths so center remains usable on narrow phones
function computeSideWidth({ preferred = 220, minCenter = 420, minSide = 60, maxSide = 320 } = {}) {
  const vw = Math.max(320, window.innerWidth || 360); // guard
  // Try to give center at least minCenter px. Compute side = (vw - minCenter)/2
  let side = Math.floor((vw - minCenter) / 2);

  // If viewport is too narrow, fall back to a percentage of vw
  if (side < minSide) {
    side = Math.max(minSide, Math.floor(vw * 0.12)); // at least ~12% of width
  }

  // Clamp to sane values
  if (side > maxSide) side = maxSide;
  // Ensure we don't steal too much space (leave center at least 120px)
  if (side * 2 + 120 > vw) {
    side = Math.max(40, Math.floor((vw - 120) / 2));
  }

  return side;
}

let _resizeDebounce = null;

// at top (after kaplay init), find the intended game container
const gameContainer = document.getElementById("game-container") || document.body;

// keep _shell as before, but also remember canvasPrevParent
let _shell = null;

function createGameShell(leftWidth = 220, rightWidth = 220) {
  destroyGameShell();

  const shell = document.createElement("div");
  shell.id = "game-shell";
  Object.assign(shell.style, {
    position: "fixed",
    inset: "0",
    display: "grid",
    gridTemplateColumns: `${leftWidth}px minmax(0, 1fr) ${rightWidth}px`,
    zIndex: 9998,
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

  // Move existing canvas into center column (but remember previous parent)
  let canvasPrevParent = null;
  if (k && k.canvas) {
    canvasPrevParent = k.canvas.parentElement || gameContainer || document.body;
    center.appendChild(k.canvas);
    k.canvas.style.maxWidth = "100%";
    k.canvas.style.maxHeight = "100%";
    k.canvas.style.display = "block";
    k.canvas.style.pointerEvents = "auto";
    k.canvas.style.objectFit = "contain";
  }

  _shell = { shell, left, center, right, canvasPrevParent };
  return _shell;
}

function destroyGameShell() {
  if (!_shell) return;
  try {
    // move canvas back to its previous parent (or fallback to gameContainer)
    if (k && k.canvas && _shell.center && _shell.center.contains(k.canvas)) {
      const prev = _shell.canvasPrevParent || gameContainer || document.body;
      prev.appendChild(k.canvas);
      k.canvas.style.pointerEvents = "auto";
    }
    _shell.shell.remove();
  } catch (e) {
    console.warn("destroyGameShell failed", e);
  }
  _shell = null;
}
const LOGICAL_W = 1024;
const LOGICAL_H = 820;

/**
 * adjustCanvasLayout()
 * - tunes center column CSS depending on orientation (move up on portrait)
 * - constrains canvas size
 * - computes recommended "scale" (how much the canvas is scaled compared to logical resolution)
 * - dispatches window event "game-canvas-resized" with { scale, rect, isLandscape }
 */
function adjustCanvasLayout() {
  if (!_shell) return;
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;

  if (isLandscape) {
    // Landscape: keep arena centered vertically and allow max space, but ensure left/right remain interactive
    _shell.center.style.alignItems = "center";
    _shell.center.style.paddingTop = "0px";
    _shell.center.style.paddingBottom = "0px";

    if (k && k.canvas) {
      k.canvas.style.maxWidth = "100%";
      k.canvas.style.maxHeight = "100%";
      // ensure the canvas is contained and not stretched
      k.canvas.style.objectFit = "contain";
      k.canvas.style.display = "block";
    }
  } else  {
  _shell.center.style.alignItems = "flex-start";
  const topOffset = Math.max(window.innerHeight * 0.06, 36);
  _shell.center.style.paddingTop = `${topOffset}px`;
  _shell.center.style.paddingBottom = "0px";

  if (k && k.canvas) {
    k.canvas.style.maxWidth = "100%";   // fill width
    k.canvas.style.maxHeight = "calc(100vh - 36px)"; // leave small top offset
    k.canvas.style.objectFit = "contain";
    k.canvas.style.display = "block";
  }
}

  // compute scale relative to logical resolution and notify game code
  if (k && k.canvas) {
    const rect = k.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / LOGICAL_W, rect.height / LOGICAL_H);
    window.dispatchEvent(
      new CustomEvent("game-canvas-resized", {
        detail: { scale, rect, isLandscape },
      })
    );
  }
}

// Call it when building the shell and when layout changes:
function applyMobileLayoutAndRegisterControls() {
  try { unregisterMobileController(); } catch {}

  if (!isMobileDevice()) {
    destroyGameShell();
    unregisterMobileController(); // ensure cleaned up
    return;
  }

  const isLandscape = window.matchMedia("(orientation: landscape)").matches;

  if (isLandscape) {
    const side = computeSideWidth({ preferred: 220, minCenter: 420, minSide: 60, maxSide: 320 });
    const s = createGameShell(side, side);
    registerMobileController(() =>
      makeMobileController(k, { containers: { left: s.left, right: s.right, center: s.center } })
    );
    requestAnimationFrame(adjustCanvasLayout);
  } else {
    destroyGameShell();
  if (k.canvas.parentElement !== gameContainer) {
    gameContainer.appendChild(k.canvas);
  }

    registerMobileController(() => makeMobileController(k));

    requestAnimationFrame(adjustCanvasLayout);
  }
}


// Resize handler: debounce and recompute layout when size changes significantly
window.addEventListener("resize", () => {
  // Recompute side widths on resize only if we're on mobile/landscape or shell exists
  if (!isMobileDevice()) return;
  clearTimeout(_resizeDebounce);
  _resizeDebounce = setTimeout(() => {
    // If currently in landscape, rebuild shell (so side widths update)
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (isLandscape) {
      applyMobileLayoutAndRegisterControls();
    } else {
      // portrait - just adjust canvas layout
      requestAnimationFrame(adjustCanvasLayout);
    }
  }, 120);
});
// also call adjustCanvasLayout whenever orientation or resize happens:
try {
  const mql = window.matchMedia("(orientation: landscape)");
  mql.addEventListener?.("change", () => { applyMobileLayoutAndRegisterControls(); adjustCanvasLayout(); });
  window.addEventListener("resize", () => { requestAnimationFrame(adjustCanvasLayout); });
} catch (e) {
  // ignore older browsers
}
// create scenes, etc
defineGameScene(k, /*scoreRef*/ {});
defineGameOverScene(k, () => 0);
defineVictoryScene(k, () => 0);
TutorialScene(k);
initControls(k);

// on mobile: make shell when in landscape and register controller factory that uses left/right containers

// initial setup
applyMobileLayoutAndRegisterControls();

// listen for orientation changes and re-apply layout
try {
  const mql = window.matchMedia("(orientation: landscape)");
  mql.addEventListener?.("change", applyMobileLayoutAndRegisterControls);
  mql.addListener?.(applyMobileLayoutAndRegisterControls);
} catch (e) {
  // ignore
}

k.go("tutorial");
defineDebugScene(k);
