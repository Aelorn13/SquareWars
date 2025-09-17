// components/player/mobile/index.js
import { createMovementJoystick } from "./joystick.js";
import { createAimJoystick } from "./aimJoystick.js";
import { createDashButton } from "./dashButton.js";

/**
 * makeMobileController(k?, opts?)
 * returns object { getMove(), getAim(), getDash(), destroy() }
 * that matches registerMobileController(controller) expectations.
 */
export function makeMobileController(k, {
  moveOpts = { size: 230, marginX: 150, marginY: 160 },
  aimOpts  = { size: 230, marginX: 150, marginY: 160, align: 'right' },
  dashOpts = { size: 78, marginX: 100, marginY: 340, align: 'right' },
} = {}) {
  // container could be k.canvas or document.body; keep default body for simplicity
  const container = (k && k.canvas) ? document.body : document.body;

  const move = createMovementJoystick({ container, ...moveOpts });
  const aim = createAimJoystick({ container, ...aimOpts });
  const dash = createDashButton({ container, ...dashOpts });

  return {
    getMove: () => move.getMove(),
    // getAim: active aim vector while touching (zero if not touching)
    getAim:  () => aim.getAim(),
    // getAimLast: last non-zero direction (normalized) remembered after touch
    getAimLast: () => aim.getLastAim(),
    // isAiming: true while aim joystick is actively touched
    isAiming: () => aim.isAiming?.() ?? false,
    getDash: () => dash.getDash(),
    isFiring: () => aim.isAiming?.() ?? false, // compatibility
    destroy: () => { move.destroy(); aim.destroy(); dash.destroy(); },
  };
}
