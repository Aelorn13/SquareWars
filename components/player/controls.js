// components/player/controls.js

/**
 * @file Manages all player input, abstracting keyboard, mouse, and mobile touch controls.
 * @description This module provides a unified `inputState` object that can be queried by other game components.
 * It handles desktop (WASD + Mouse) and mobile (virtual joysticks) controls, including automatic handling
 * of screen orientation changes on mobile devices.
 */

// How far the aim target is from the player on mobile, in pixels.
const MOBILE_AIM_DISTANCE = 200;
// Max screen dimension (width or height) to be considered for mobile detection.
const MAX_MOBILE_SCREEN_DIMENSION = 900;


// Kept for backwards-compatibility, prefer using `inputState`.
export const keysPressed = {};

// A centralized object representing the current state of all player inputs.
export const inputState = {
  move: { x: 0, y: 0 },       // Normalized vector for movement
  aim: { x: 0, y: 0 },        // World coordinates for aiming (mouse) or vector (mobile)
  dashTriggered: false,   // Set to true for a single frame when dash is initiated.
  isMobile: false,
};

let mobileController = null;        // The current active mobile controller instance.
let mobileControllerFactory = null; // An optional factory function to recreate the controller.
let mobileControllerMql = null;     // MediaQueryList for listening to orientation changes.
let dashHeld = false;               // Internal state to prevent dash re-triggering while held.

/**
 * Determines if the device should be treated as mobile based on user agent, touch support, and screen size.
 * @returns {boolean} True if the device is considered mobile.
 */
export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  const mobileUa = /Mobi|Android|iPhone|iPad|Tablet/i.test(ua);
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  // Helps avoid treating touch-enabled laptops as mobile.
  const smallScreen = Math.max(window.innerWidth || 0, window.innerHeight || 0) <= MAX_MOBILE_SCREEN_DIMENSION;
  return mobileUa || (hasTouch && smallScreen);
}

/**
 * Initializes the input event listeners for keyboard and mouse.
 * @param {object} k - The Kaboom.js context.
 */
export function initControls(k) {
  if (window._controlsInitialized) return;
  window._controlsInitialized = true;

  inputState.isMobile = isMobileDevice();

  window.addEventListener("keydown", (e) => {
    keysPressed[e.code] = true;
    if (e.code === "Space") {
      if (!dashHeld) inputState.dashTriggered = true;
      dashHeld = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    keysPressed[e.code] = false;
    if (e.code === "Space") dashHeld = false;
  });

  // Set initial aim position
  if (k && typeof k.mousePos === "function") {
    const mousePosition = k.mousePos();
    inputState.aim.x = mousePosition.x;
    inputState.aim.y = mousePosition.y;
  }
}

/* -------------------------------------------------------------------------- */
/*                         Mobile Controller Lifecycle                        */
/* -------------------------------------------------------------------------- */
/*
 * These functions manage the virtual controller for touch devices.
 * `registerMobileController` supports two modes:
 * 1. Passing a controller instance directly.
 * 2. Passing a factory function (e.g., `() => createJoystick()`).
 * The factory pattern is recommended as it allows the controls to be
 * automatically destroyed and recreated when the screen orientation changes.
*/

function _destroyCurrentController() {
  if (mobileController) {
    mobileController.destroy?.();
    mobileController = null;
  }
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

// Recreates the controller when screen orientation changes.
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
 * Registers a mobile controller instance or a factory function to create one.
 * @param {object|Function} ctrlOrFactory - The controller instance or a function that returns one.
 */
export function registerMobileController(ctrlOrFactory) {
  _destroyCurrentController();

  if (typeof ctrlOrFactory === "function") {
    mobileControllerFactory = ctrlOrFactory;
    mobileController = _createControllerFromFactory();

    // Listen for orientation changes to recreate the controller.
    if (window.matchMedia && !mobileControllerMql) {
        mobileControllerMql = window.matchMedia("(orientation: landscape)");
        mobileControllerMql.addEventListener("change", _onOrientationChange);
    }
  } else {
    // If a direct instance is passed, we can't auto-recreate it.
    mobileControllerFactory = null;
    mobileController = ctrlOrFactory;
  }

  inputState.isMobile = !!mobileController;
}

/**
 * Unregisters and destroys the current mobile controller and cleans up listeners.
 */
export function unregisterMobileController() {
  if (mobileControllerMql) {
    mobileControllerMql.removeEventListener("change", _onOrientationChange);
    mobileControllerMql = null;
  }
  mobileControllerFactory = null;
  _destroyCurrentController();
  // Re-evaluate device type after unregistering.
  inputState.isMobile = isMobileDevice();
}


/**
 * Updates the `inputState` object based on the current input for this frame.
 * @param {object} k - The Kaboom.js context.
 */
export function updateInput(k) {
  if (inputState.isMobile && mobileController) {
    // --- Mobile Input ---
    const moveVec = mobileController.getMove?.() || { x: 0, y: 0 };
    inputState.move.x = Math.max(-1, Math.min(1, moveVec.x || 0));
    inputState.move.y = Math.max(-1, Math.min(1, moveVec.y || 0));

    const aimActive = !!(mobileController.isAiming?.() || mobileController.isFiring?.());
    const aimCurrent = mobileController.getAim?.() || { x: 0, y: 0 };
    const aimLast = mobileController.getAimLast?.() || { x: 0, y: 0 };

    // Persist the last known aim direction when the user stops aiming.
    // This keeps the player facing the same direction.
    if (aimActive && (Math.abs(aimCurrent.x) > 0 || Math.abs(aimCurrent.y) > 0)) {
      inputState.aim.x = aimCurrent.x;
      inputState.aim.y = aimCurrent.y;
    } else {
      inputState.aim.x = aimLast.x;
      inputState.aim.y = aimLast.y;
    }

    inputState.firing = aimActive;

    const dashNow = !!mobileController.getDash?.();
    if (dashNow && !dashHeld) inputState.dashTriggered = true;
    dashHeld = dashNow;

  } else {
    // --- Desktop Input ---
    const moveX = (keysPressed["KeyD"] ? 1 : 0) - (keysPressed["KeyA"] ? 1 : 0);
    const moveY = (keysPressed["KeyS"] ? 1 : 0) - (keysPressed["KeyW"] ? 1 : 0);
    const len = Math.hypot(moveX, moveY);

    // Normalize the movement vector to prevent faster diagonal movement.
    if (len > 0) {
      inputState.move.x = moveX / len;
      inputState.move.y = moveY / len;
    } else {
      inputState.move.x = 0;
      inputState.move.y = 0;
    }

    if (k && typeof k.mousePos === "function") {
      const mousePosition = k.mousePos();
      inputState.aim.x = mousePosition.x;
      inputState.aim.y = mousePosition.y;
    }

    const dashNow = !!keysPressed["Space"];
    if (dashNow && !dashHeld) inputState.dashTriggered = true;
    dashHeld = dashNow;
  }
}

/**
 * Consumes the dash input. Should be called once per frame by the player logic.
 * @returns {boolean} True if a dash was triggered in this frame.
 */
export function consumeDash() {
  if (inputState.dashTriggered) {
    inputState.dashTriggered = false;
    return true;
  }
  return false;
}

/**
 * Returns the current movement vector.
 * @param {object} k - The Kaboom.js context.
 * @returns {Vec2} A Kaboom vector object.
 */
export function moveVec(k) {
  return k && typeof k.vec2 === "function"
    ? k.vec2(inputState.move.x, inputState.move.y)
    : { x: inputState.move.x, y: inputState.move.y };
}

/**
 * Calculates the world-space target for aiming.
 * @param {object} k - The Kaboom.js context.
 * @param {Vec2} playerPos - The player's current position.
 * @returns {Vec2} The world coordinate vector of the aim target.
 */
export function aimWorldTarget(k, playerPos) {
  if (!k) return inputState.aim;

  if (inputState.isMobile) {
    // On mobile, the aim input is a normalized vector.
    // We project it from the player's position to get a world target.
    const aimX = inputState.aim.x || 0;
    const aimY = inputState.aim.y || 0;
    return k.vec2(
      (playerPos.x || 0) + aimX * MOBILE_AIM_DISTANCE,
      (playerPos.y || 0) + aimY * MOBILE_AIM_DISTANCE
    );
  } else {
    // On desktop, the aim input is already the mouse's world coordinates.
    return k.vec2(
      inputState.aim.x || playerPos?.x || 0,
      inputState.aim.y || playerPos?.y || 0
    );
  }
}