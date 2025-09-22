const MOBILE_AIM_DISTANCE = 200;
const MAX_MOBILE_DIMENSION = 1400;

export const keysPressed = {};
export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  dashTriggered: false,
  isMobile: false,
  firing: false,
};

let mobileController = null;
let controllerFactory = null;
let orientationListener = null;
let orientationHandler = null;
let dashHeld = false;

export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const isIPadOS = ua.includes("Macintosh") && "ontouchend" in document;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const smallScreen =
    Math.max(window.innerWidth || 0, window.innerHeight || 0) <=
    MAX_MOBILE_DIMENSION;

  return (
    /Mobi|Android|iPhone|iPad|Tablet/i.test(ua) ||
    isIPadOS ||
    (hasTouch && smallScreen)
  );
}

export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  // Keyboard handlers
  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space" && !dashHeld) {
      inputState.dashTriggered = true;
      dashHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
  });

  // Reset on blur to prevent stuck keys
  window.addEventListener("blur", () => {
    for (const kcode in keysPressed) keysPressed[kcode] = false;
    dashHeld = false;
    inputState.move.x = 0;
    inputState.move.y = 0;
    inputState.dashTriggered = false;
  });

  // Initialize mouse position
  if (k?.mousePos) {
    const m = k.mousePos();
    inputState.aim.x = m.x;
    inputState.aim.y = m.y;
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
    mobileController = controllerFactory();
    inputState.isMobile = true;
  } catch (e) {
    console.warn("Controller creation failed:", e);
  }
}

export function registerMobileController(factoryOrInstance) {
  destroyController();

  if (typeof factoryOrInstance === "function") {
    controllerFactory = factoryOrInstance;
    mobileController = controllerFactory();

    // Setup orientation change listener
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
  if (inputState.isMobile && mobileController) {
    // Mobile input (clamp to unit circle)
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

    const aimActive =
      mobileController.isAiming?.() || mobileController.isFiring?.();
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

    const dashNow = mobileController.getDash?.();
    if (dashNow && !dashHeld) {
      inputState.dashTriggered = true;
    }
    dashHeld = !!dashNow;
  } else {
    // Desktop keyboard input
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

    const dashNow = keysPressed["Space"];
    if (dashNow && !dashHeld) {
      inputState.dashTriggered = true;
    }
    dashHeld = !!dashNow;
  }
}

export function consumeDash() {
  if (inputState.dashTriggered) {
    inputState.dashTriggered = false;
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
