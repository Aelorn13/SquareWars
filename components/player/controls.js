// components/player/controls.js

const MOBILE_AIM_DISTANCE = 200;
const MAX_MOBILE_SCREEN_DIMENSION = 900;

export const keysPressed = {};

// Keep both names for compatibility: old code may read `_dash`, new code uses `dashTriggered`
export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  dashTriggered: false,
  isMobile: false,
};

let mobileController = null;
let mobileControllerFactory = null;
let mobileControllerMql = null;
let dashHeld = false;

/* -----------------------
   Device detection
   ----------------------- */
export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const mobileUa = /Mobi|Android|iPhone|iPad|Tablet/i.test(ua);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  const smallScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) <= MAX_MOBILE_SCREEN_DIMENSION;
  return mobileUa || (hasTouch && smallScreen);
}

/* -----------------------
   Initialization
   ----------------------- */
export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space") {
      if (!dashHeld) {
        inputState.dashTriggered = true;
        inputState._dash = true;
      }
      dashHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
  });

  // Init aim if kaboom (or Kaplay) context provided
  if (k && typeof k.mousePos === "function") {
    const m = k.mousePos();
    inputState.aim.x = m.x;
    inputState.aim.y = m.y;
  }
}

/* -----------------------
   Mobile controller lifecycle
   ----------------------- */
function _destroyCurrentController() {
  if (!mobileController) return;
  try {
    mobileController.destroy?.();
  } catch (e) {
    console.warn("mobileController.destroy threw", e);
  }
  mobileController = null;
}

function _createControllerFromFactory() {
  if (!mobileControllerFactory) return null;
  try {
    return mobileControllerFactory();
  } catch (e) {
    console.warn("Mobile controller factory failed.", e);
    return null;
  }
}

function _onOrientationChange() {
  if (!mobileControllerFactory) return;
  _destroyCurrentController();
  const newController = _createControllerFromFactory();
  if (newController) {
    mobileController = newController;
    inputState.isMobile = true;
  }
}

/**
 * Register a controller instance or factory:
 * - If function: treat as factory and recreate on orientation changes.
 * - If instance: just use it (no auto-recreate).
 */
export function registerMobileController(ctrlOrFactory) {
  // Always destroy existing controller first (we'll create a new one below).
  _destroyCurrentController();

  if (typeof ctrlOrFactory === "function") {
    mobileControllerFactory = ctrlOrFactory;
    mobileController = _createControllerFromFactory();

    // Attach orientation/listener to re-create controller on orientation change
    if (window.matchMedia && !mobileControllerMql) {
      try {
        mobileControllerMql = window.matchMedia("(orientation: landscape)");
        // modern browsers
        if (mobileControllerMql.addEventListener) {
          mobileControllerMql.addEventListener("change", _onOrientationChange);
        } else if (mobileControllerMql.addListener) {
          // legacy
          mobileControllerMql.addListener(_onOrientationChange);
        }
      } catch (e) {
        console.warn("Failed to attach orientation listener", e);
      }
    }
  } else {
    // direct instance
    mobileControllerFactory = null;
    mobileController = ctrlOrFactory;
  }

  inputState.isMobile = !!mobileController;
}

/**
 * Unregister + destroy mobile controller and cleanup listeners.
 */
export function unregisterMobileController() {
  if (mobileControllerMql) {
    try {
      if (mobileControllerMql.removeEventListener) {
        mobileControllerMql.removeEventListener("change", _onOrientationChange);
      } else if (mobileControllerMql.removeListener) {
        mobileControllerMql.removeListener(_onOrientationChange);
      }
    } catch (e) {
      console.warn("Failed to remove orientation listener", e);
    }
    mobileControllerMql = null;
  }

  mobileControllerFactory = null;
  _destroyCurrentController();

  // keep inputState.isMobile accurate
  inputState.isMobile = isMobileDevice();
}

/* -----------------------
   Per-frame input update
   ----------------------- */
export function updateInput(k) {
  if (inputState.isMobile && mobileController) {
    const mv = mobileController.getMove?.() || { x: 0, y: 0 };
    inputState.move.x = Math.max(-1, Math.min(1, mv.x || 0));
    inputState.move.y = Math.max(-1, Math.min(1, mv.y || 0));

    const aimActive = !!(mobileController.isAiming?.() || mobileController.isFiring?.());
    const aimCurr = mobileController.getAim?.() || { x: 0, y: 0 };
    const aimLast = mobileController.getAimLast?.() || { x: 0, y: 0 };

    if (aimActive && (Math.abs(aimCurr.x) > 0 || Math.abs(aimCurr.y) > 0)) {
      inputState.aim.x = aimCurr.x;
      inputState.aim.y = aimCurr.y;
    } else {
      inputState.aim.x = aimLast.x;
      inputState.aim.y = aimLast.y;
    }

    inputState.firing = aimActive;

    const dashNow = !!mobileController.getDash?.();
    if (dashNow && !dashHeld) {
      inputState.dashTriggered = true;
      inputState._dash = true;
    }
    dashHeld = dashNow;
    return;
  }

  // Desktop keyboard/mouse
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
  if (dashNow && !dashHeld) {
    inputState.dashTriggered = true;
    inputState._dash = true;
  }
  dashHeld = dashNow;
}

/* -----------------------
   Dash consumption + helper APIs
   ----------------------- */
export function consumeDash() {
  if (inputState.dashTriggered || inputState._dash) {
    inputState.dashTriggered = false;
    inputState._dash = false;
    return true;
  }
  return false;
}

export function moveVec(k) {
  return k && typeof k.vec2 === "function"
    ? k.vec2(inputState.move.x, inputState.move.y)
    : { x: inputState.move.x, y: inputState.move.y };
}

export function aimWorldTarget(k, playerPos) {
  if (!k) return inputState.aim;
  if (inputState.isMobile) {
    const ax = inputState.aim.x || 0;
    const ay = inputState.aim.y || 0;
    return k.vec2((playerPos.x || 0) + ax * MOBILE_AIM_DISTANCE, (playerPos.y || 0) + ay * MOBILE_AIM_DISTANCE);
  } else {
    return k.vec2(inputState.aim.x || playerPos?.x || 0, inputState.aim.y || playerPos?.y || 0);
  }
}
