// components/player/controls.js
// Unified input layer for desktop (keyboard+mouse) and mobile (virtual controls).
// - preserves keysPressed (existing code)
// - exports inputState (move/aim/dash) for game code to read
// - provides registerMobileController(), updateInput(), and consumeDash()

export const keysPressed = {}; // kept for backwards-compatibility

// inputState: canonical source of truth for movement/aim/dash.
// - move: axis -1..1 (x, y) for movement (normalized)
// - aim: on desktop -> world coords {x,y}, on mobile -> direction vector {x,y} (normalized)
// - _dash: internal edge-trigger that you must consume with consumeDash()
export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  _dash: false,
  isMobile: false,
};

let mobileController = null; // set via registerMobileController(controller)
let dashHeld = false;        // internal state to detect edge presses

export function isMobileDevice() {
  // simple heuristic - good enough for initial detection
  return /Mobi|Android|iPhone|iPad|Tablet/i.test(navigator.userAgent)
    || (window.matchMedia && window.matchMedia("(pointer:coarse)").matches);
}

/**
 * initControls(k?)
 * - call once at startup (main.js). Accepts optional kaboom context k.
 * - registers keyboard listeners and detects mobile.
 */
export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    // space: mark dash on press (edge)
    if (e.code === "Space") {
      if (!dashHeld) inputState._dash = true;
      dashHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
  });

  // Init aim if kaboom provided (helps avoid undefined)
  if (k && typeof k.mousePos === "function") {
    const m = k.mousePos();
    inputState.aim.x = m.x;
    inputState.aim.y = m.y;
  }
}

/**
 * registerMobileController(controller)
 * Controller must expose:
 *   getMove() -> {x, y}   (axes -1..1)
 *   getAim()  -> {x, y}   (direction vector -1..1 OR world coords — we'll treat as direction)
 *   getDash() -> boolean  (true while pressed)
 *
 * You will implement the actual joystick/button modules later and register them here.
 */
export function registerMobileController(controller) {
  mobileController = controller;
  inputState.isMobile = true;
}

/**
 * updateInput(k, playerPos)
 * - call once per frame (e.g. at top of player.onUpdate or a central update loop).
 * - k is optional kaboom context (used to read mouse position for desktop).
 * - playerPos is optional and used by some aim helpers later.
 */
export function updateInput(k, playerPos) {
  if (inputState.isMobile && mobileController) {
    const mv = mobileController.getMove?.() || { x: 0, y: 0 };
    // clamp axes
    inputState.move.x = Math.max(-1, Math.min(1, mv.x || 0));
    inputState.move.y = Math.max(-1, Math.min(1, mv.y || 0));

    const aimRaw = mobileController.getAim?.();
    if (aimRaw) {
      inputState.aim.x = aimRaw.x || 0;
      inputState.aim.y = aimRaw.y || 0;
    }

    const dashNow = !!mobileController.getDash?.();
    if (dashNow && !dashHeld) inputState._dash = true;
    dashHeld = dashNow;
  } else {
    // Desktop: movement from keys, aim from mouse
    const moveX = (keysPressed["KeyD"] ? 1 : 0) - (keysPressed["KeyA"] ? 1 : 0);
    const moveY = (keysPressed["KeyS"] ? 1 : 0) - (keysPressed["KeyW"] ? 1 : 0);
    const len = Math.hypot(moveX, moveY);
    if (len > 0) {
      inputState.move.x = moveX / len;
      inputState.move.y = moveY / len;
    } else {
      inputState.move.x = 0;
      inputState.move.y = 0;
    }

    if (k && typeof k.mousePos === "function") {
      const m = k.mousePos();
      inputState.aim.x = m.x;
      inputState.aim.y = m.y;
    }

    const dashNow = !!keysPressed["Space"];
    if (dashNow && !dashHeld) inputState._dash = true;
    dashHeld = dashNow;
  }
}

/**
 * consumeDash()
 * - returns true once when a dash press was detected, then clears it.
 * - recommended pattern inside your player update:
 *     if (consumeDash()) dashHandler.execute(player);
 */
export function consumeDash() {
  if (inputState._dash) {
    inputState._dash = false;
    return true;
  }
  return false;
}

/**
 * Helpers for game code:
 * - moveVec(k) -> kaboom vec2 if k given, otherwise raw {x,y}
 * - aimWorldTarget(k, playerPos) -> a kaboom vec2 target suitable for rotateTo().
 *
 * For mobile: aim is treated as a direction vector and scaled out from playerPos.
 * For desktop: aim is treated as a world coordinate (mouse position).
 */
export function moveVec(k) {
  return k && typeof k.vec2 === "function"
    ? k.vec2(inputState.move.x, inputState.move.y)
    : { x: inputState.move.x, y: inputState.move.y };
}

export function aimWorldTarget(k, playerPos) {
  if (!k) return inputState.aim;
  if (inputState.isMobile) {
    // mobile aim -> direction vector; scale out so rotateTo works with a distant target
    const scale = 200;
    const ax = inputState.aim.x || 0;
    const ay = inputState.aim.y || 0;
    return k.vec2((playerPos.x || 0) + ax * scale, (playerPos.y || 0) + ay * scale);
  } else {
    return k.vec2(inputState.aim.x || (playerPos?.x || 0), inputState.aim.y || (playerPos?.y || 0));
  }
}
