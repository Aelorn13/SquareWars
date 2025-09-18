// components/player/controls.js
export const keysPressed = {}; // kept for backwards-compatibility

export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  _dash: false,
  isMobile: false,
};

let mobileController = null; // current active controller instance
let mobileControllerFactory = null; // optional factory function that creates a controller
let mobileControllerMql = null; // MediaQueryList for orientation listening
let dashHeld = false; // internal state to detect edge presses

export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const mobileUa = /Mobi|Android|iPhone|iPad|Tablet/i.test(ua);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  // treat as mobile only when touch AND small screen (helps avoid laptops with touch)
  const smallScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) <= 900;
  return mobileUa || (hasTouch && smallScreen);
}

export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space") {
      if (!dashHeld) inputState._dash = true;
      dashHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
  });

  if (k && typeof k.mousePos === "function") {
    const m = k.mousePos();
    inputState.aim.x = m.x;
    inputState.aim.y = m.y;
  }
}

/* -------------------------
   Mobile controller lifecycle
   - registerMobileController accepts:
     * an instance: registerMobileController(controller)
     * OR a factory: registerMobileController(() => makeMobileController(k))
   - If a factory is provided, controls are auto-recreated on orientation change.
   ------------------------- */

function _destroyCurrentController() {
  if (mobileController) {
    try {
      mobileController.destroy?.();
    } catch (e) {
      console.warn("mobileController.destroy failed", e);
    }
    mobileController = null;
  }
}

function _createControllerFromFactory() {
  if (!mobileControllerFactory) return null;
  try {
    return mobileControllerFactory();
  } catch (e) {
    console.warn("mobile controller factory threw", e);
    return null;
  }
}

function _onMqlChange() {
  // Recreate controller from factory (if set) whenever orientation changes
  if (!mobileControllerFactory) return;
  _destroyCurrentController();
  const ctrl = _createControllerFromFactory();
  if (ctrl) {
    mobileController = ctrl;
    inputState.isMobile = true;
  }
}

export function registerMobileController(ctrlOrFactory) {
  // If caller passed a factory function, store it and create initial controller
  if (typeof ctrlOrFactory === "function") {
    mobileControllerFactory = ctrlOrFactory;

    // create initial controller instance
    const created = _createControllerFromFactory();
    if (created) {
      // destroy old instance if different
      if (mobileController && mobileController !== created) _destroyCurrentController();
      mobileController = created;
      inputState.isMobile = true;
    }

    // Ensure we have an orientation listener to auto-recreate on change
    if (window.matchMedia && !mobileControllerMql) {
      try {
        mobileControllerMql = window.matchMedia("(orientation: landscape)");
        // modern API
        mobileControllerMql.addEventListener("change", _onMqlChange);
      } catch (e) {
        // fallback for older browsers
        try { mobileControllerMql.addListener(_onMqlChange); } catch {}
      }
    }

    return;
  }

  // Otherwise caller passed a controller instance
  if (mobileController && mobileController !== ctrlOrFactory) {
    try { mobileController.destroy?.(); } catch (e) { console.warn("previous controller destroy failed", e); }
  }
  mobileController = ctrlOrFactory;
  inputState.isMobile = true;
}

export function unregisterMobileController() {
  // Remove orientation listener
  if (mobileControllerMql) {
    try {
      mobileControllerMql.removeEventListener("change", _onMqlChange);
    } catch (e) {
      try { mobileControllerMql.removeListener(_onMqlChange); } catch {}
    }
    mobileControllerMql = null;
  }
  // Clear factory
  mobileControllerFactory = null;
  // Destroy active controller
  _destroyCurrentController();
  // recompute isMobile from device detection (useful if you toggle mobile state)
  inputState.isMobile = isMobileDevice();
}


export function updateInput(k, playerPos) {
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

    inputState.aimActive = aimActive;
    inputState.firing = !!aimActive;

    const dashNow = !!mobileController.getDash?.();
    if (dashNow && !dashHeld) inputState._dash = true;
    dashHeld = dashNow;
    return;
  } else {
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

export function consumeDash() {
  if (inputState._dash) {
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
    const scale = 200;
    const ax = inputState.aim.x || 0;
    const ay = inputState.aim.y || 0;
    return k.vec2(
      (playerPos.x || 0) + ax * scale,
      (playerPos.y || 0) + ay * scale
    );
  } else {
    return k.vec2(
      inputState.aim.x || playerPos?.x || 0,
      inputState.aim.y || playerPos?.y || 0
    );
  }
}
