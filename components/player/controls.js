const MOBILE_AIM_DISTANCE = 200;
const MAX_MOBILE_DIMENSION = 1400;

export const keysPressed = {};
export const inputState = {
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  dashTriggered: false,
  isMobile: false,
  firing: false
};

let mobileController = null;
let controllerFactory = null;
let orientationListener = null;
let dashHeld = false;

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
  
  // Desktop keyboard handlers
  window.addEventListener("keydown", e => {
    keysPressed[e.code] = true;
    if (e.code === "Space" && !dashHeld) {
      inputState.dashTriggered = true;
      dashHeld = true;
    }
  });
  
  window.addEventListener("keyup", e => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
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
        const handler = () => recreateController();
        orientationListener.addEventListener?.("change", handler) || 
        orientationListener.addListener?.(handler);
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
  if (orientationListener) {
    const handler = () => recreateController();
    try {
      orientationListener.removeEventListener?.("change", handler) ||
      orientationListener.removeListener?.(handler);
    } catch (e) {
      console.warn("Listener removal failed:", e);
    }
    orientationListener = null;
  }
  
  controllerFactory = null;
  destroyController();
  inputState.isMobile = isMobileDevice();
}

export function updateInput(k) {
  if (inputState.isMobile && mobileController) {
    // Mobile input processing
    const move = mobileController.getMove?.() || { x: 0, y: 0 };
    inputState.move.x = Math.max(-1, Math.min(1, move.x));
    inputState.move.y = Math.max(-1, Math.min(1, move.y));
    
    const aimActive = mobileController.isAiming?.() || mobileController.isFiring?.();
    const aimCurrent = mobileController.getAim?.() || { x: 0, y: 0 };
    const aimLast = mobileController.getAimLast?.() || { x: 0, y: 0 };
    
    if (aimActive && (aimCurrent.x || aimCurrent.y)) {
      inputState.aim = aimCurrent;
    } else {
      inputState.aim = aimLast;
    }
    
    inputState.firing = aimActive;
    
    const dashNow = mobileController.getDash?.();
    if (dashNow && !dashHeld) {
      inputState.dashTriggered = true;
    }
    dashHeld = dashNow;
  } else {
    // Desktop input processing
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
    dashHeld = dashNow;
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
  return k?.vec2 
    ? k.vec2(inputState.move.x, inputState.move.y)
    : { ...inputState.move };
}

export function aimWorldTarget(k, playerPos) {
  if (!k) return inputState.aim;
  
  if (inputState.isMobile) {
    const offset = k.vec2(
      inputState.aim.x * MOBILE_AIM_DISTANCE,
      inputState.aim.y * MOBILE_AIM_DISTANCE
    );
    return playerPos.add(offset);
  }
  
  return k.vec2(inputState.aim.x, inputState.aim.y);
}