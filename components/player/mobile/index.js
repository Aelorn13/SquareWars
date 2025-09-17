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
  moveOpts = { size: 140, marginX: 18, marginY: 160 },
  aimOpts  = { size: 120, marginX: 18, marginY: 160, align: 'right' },
  dashOpts = { size: 78, marginX: 18, marginY: 56, align: 'right' },
} = {}) {
  // container could be k.canvas or document.body; keep default body for simplicity
  const container = (k && k.canvas) ? document.body : document.body;

  const move = createMovementJoystick({ container, ...moveOpts });
  const aim = createAimJoystick({ container, ...aimOpts });
  const dash = createDashButton({ container, ...dashOpts });

  return {
    getMove: () => move.getMove(),
    getAim:  () => aim.getAim(),
    getDash: () => dash.getDash(),
    isFiring: () => aim.isFiring?.() ?? false,
    destroy: () => { move.destroy(); aim.destroy(); dash.destroy(); },
  };
}
