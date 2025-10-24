// components/player/controls.js

const MOBILE_AIM_DISTANCE = 200;
const MAX_MOBILE_DIMENSION = 1400;
const MANUAL_AIM_PRIORITY_MS = 5000;

export const keysPressed = {};
export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  dashTriggered: false,
  skillTriggered: false, // Skill trigger now follows the same pattern
  isMobile: false,
  firing: false,
};

let mobileController = null;
let controllerFactory = null;
let orientationListener = null;
let orientationHandler = null;
let dashHeld = false;
let skillHeld = false;
let lastManualAimTime = 0;

export function isManualAimPriority() {
  return Date.now() - lastManualAimTime < MANUAL_AIM_PRIORITY_MS;
}

export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const isIPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const smallScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) <= MAX_MOBILE_DIMENSION;

  return /Mobi|Android|iPhone|iPad|Tablet/i.test(ua) || isIPadOS || (hasTouch && smallScreen);
}

export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  window.addEventListener("mousemove", () => {
    if (!inputState.isMobile) {
      lastManualAimTime = Date.now();
    }
  });

  // Keyboard handlers
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space" && !dashHeld) {
      inputState.dashTriggered = true;
      dashHeld = true;
    }
    if (e.code === "KeyE" && !skillHeld) {
      inputState.skillTriggered = true;
      skillHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
    if (e.code === "KeyE") skillHeld = false;
  });

  window.addEventListener("blur", () => {
    for (const kcode in keysPressed) keysPressed[kcode] = false;
    dashHeld = false;
    skillHeld = false;
    inputState.move.x = 0;
    inputState.move.y = 0;
    inputState.dashTriggered = false;
    inputState.skillTriggered = false;
  });

  if (k?.mousePos) {
    const m = k.mousePos();
    inputState.aim.x = m.x;
    inputState.aim.y = m.y;
    lastManualAimTime = Date.now();
  }
}

function destroyController() {
  mobileController?.destroy?.();
  mobileController = null;
}

function recreateController() {
  if (!controllerFactory) return;
  destroyController();
  try {
    mobileController = factoryOrInstance();
    inputState.isMobile = true;
  } catch (e) {
    console.warn("Controller creation failed:", e);
  }
}

export function registerMobileController(factoryOrInstance) {
  destroyController();

  if (typeof factoryOrInstance === "function") {
    controllerFactory = factoryOrInstance;
    mobileController = factoryOrInstance();

    if (window.matchMedia && !orientationListener) {
      try {
        orientationListener = window.matchMedia("(orientation: landscape)");
        orientationHandler = () => recreateController();
        if (orientationListener.addEventListener) {
          orientationListener.addEventListener("change", orientationHandler);
        } else {
          orientationListener.addListener(orientationHandler);
        }
      } catch (e) {
        console.warn("Orientation listener setup failed:", e);
      }
    }
  } else {
    controllerFactory = null;
    mobileController = factoryOrInstance;
  }

  inputState.isMobile = !!mobileController;
}

export function unregisterMobileController() {
  if (orientationListener && orientationHandler) {
    try {
      if (orientationListener.removeEventListener) {
        orientationListener.removeEventListener("change", orientationHandler);
      } else {
        orientationListener.removeListener(orientationHandler);
      }
    } catch (e) {
      console.warn("Listener removal failed:", e);
    }
    orientationListener = null;
    orientationHandler = null;
  }

  controllerFactory = null;
  destroyController();
  inputState.isMobile = isMobileDevice();
}

export function updateInput(k) {
  // This function is now ONLY responsible for CONTINUOUS state (movement, aim)
  // and checking the state of mobile buttons.
  if (inputState.isMobile && mobileController) {
    // --- Mobile Input ---
    const rawMove = mobileController.getMove?.() || { x: 0, y: 0 };
    let mx = Math.max(-1, Math.min(1, rawMove.x || 0));
    let my = Math.max(-1, Math.min(1, rawMove.y || 0));
    const mlen = Math.hypot(mx, my);
    if (mlen > 1) {
      mx /= mlen;
      my /= mlen;
    }
    inputState.move.x = mx;
    inputState.move.y = my;

    const aimActive = mobileController.isAiming?.() || mobileController.isFiring?.();
    const aimCurrent = mobileController.getAim?.() || { x: 0, y: 0 };
    const aimLast = mobileController.getAimLast?.() || { x: 0, y: 0 };

    if (aimActive && (aimCurrent.x || aimCurrent.y)) {
      let ax = aimCurrent.x || 0;
      let ay = aimCurrent.y || 0;
      const alen = Math.hypot(ax, ay);
      if (alen > 1) {
        ax /= alen;
        ay /= alen;
      }
      inputState.aim.x = ax;
      inputState.aim.y = ay;
    } else {
      inputState.aim.x = aimLast.x || 0;
      inputState.aim.y = aimLast.y || 0;
    }

    inputState.firing = aimActive;
    try {
      inputState.autoShoot = !!mobileController.getAutoShoot?.();
    } catch (e) {
      inputState.autoShoot = false;
    }

    // Check mobile buttons and set trigger flags
    const dashNow = mobileController.getDash?.();
    if (dashNow && !dashHeld) {
      inputState.dashTriggered = true;
    }
    dashHeld = !!dashNow;

    const skillNow = mobileController.getSkill?.();
    if (skillNow && !skillHeld) {
      inputState.skillTriggered = true;
    }
    skillHeld = !!skillNow;
  } else {
    // --- Desktop Input (Movement only) ---
    const dx = (keysPressed["KeyD"] ? 1 : 0) - (keysPressed["KeyA"] ? 1 : 0);
    const dy = (keysPressed["KeyS"] ? 1 : 0) - (keysPressed["KeyW"] ? 1 : 0);
    const len = Math.hypot(dx, dy);
    inputState.move.x = len > 0 ? dx / len : 0;
    inputState.move.y = len > 0 ? dy / len : 0;

    if (k?.mousePos) {
      const m = k.mousePos();
      inputState.aim.x = m.x;
      inputState.aim.y = m.y;
    }
  }
}

/**
 * Checks if dash was triggered and then resets the flag.
 * This is the "consumer" pattern.
 */
export function consumeDash() {
  if (inputState.dashTriggered) {
    inputState.dashTriggered = false;
    return true;
  }
  return false;
}

/**
 * Checks if skill was triggered and then resets the flag.
 */
export function consumeSkill() {
  if (inputState.skillTriggered) {
    inputState.skillTriggered = false;
    return true;
  }
  return false;
}

export function moveVec(k) {
  const mx = inputState.move.x || 0;
  const my = inputState.move.y || 0;
  const len = Math.hypot(mx, my);
  if (k?.vec2) {
    const v = k.vec2(mx, my);
    if (len > 1) return v.scale(1 / len);
    return v;
  }
  if (len > 1) return { x: mx / len, y: my / len };
  return { x: mx, y: my };
}

export function updateMobileUIMode(isActive) {
  if (inputState.isMobile && mobileController) {
    mobileController.setAutoShootUIMode?.(isActive);
  }
}

export function aimWorldTarget(k, playerPos) {
  if (!k) return inputState.aim;

  if (inputState.isMobile) {
    const ax = inputState.aim.x || 0;
    const ay = inputState.aim.y || 0;
    const alen = Math.hypot(ax, ay);
    const nx = alen > 0 ? ax / alen : 0;
    const ny = alen > 0 ? ay / alen : 0;
    const offset = k.vec2(nx * MOBILE_AIM_DISTANCE, ny * MOBILE_AIM_DISTANCE);
    return playerPos.add(offset);
  }

  return k.vec2(inputState.aim.x, inputState.aim.y);
}
