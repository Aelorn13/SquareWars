// components/player/mobile/index.js
import { createMovementJoystick } from "./joystick.js";
import { createAimJoystick } from "./aimJoystick.js";
import { createDashButton } from "./dashButton.js";

/**
 * makeMobileController(k?, opts?)
 * returns object { getMove(), getAim(), getDash(), destroy() }
 * that matches registerMobileController(controller) expectations.
 */
export function makeMobileController(
  k,
  {
    portrait = {
      moveOpts: { size: 300, marginX: 150, marginY: 160 },
      aimOpts: { size: 300, marginX: 150, marginY: 160, align: "right" },
      dashOpts: { size: 85, marginX: 90, marginY: 370, align: "right" },
    },
    landscape = {
      moveOpts: { size: 220, marginX: 120, marginY: 100 },
      aimOpts: { size: 220, marginX: 120, marginY: 100, align: "right" },
      dashOpts: { size: 70, marginX: 80, marginY: 220, align: "right" },
    },
  } = {}
) {
  // container could be k.canvas or document.body; keep default body for simplicity
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const opts = isLandscape ? landscape : portrait;
  const { moveOpts = {}, aimOpts = {}, dashOpts = {} } = opts;
  const container = k && k.canvas ? document.body : document.body;

  const move = createMovementJoystick({ container, ...moveOpts });
  const aim = createAimJoystick({ container, ...aimOpts });
  const dash = createDashButton({ container, ...dashOpts });

  return {
    getMove: () => move.getMove(),
    getAim: () => aim.getAim(),
    getAimLast: () => aim.getLastAim(),
    isAiming: () => aim.isAiming?.() ?? false,
    getDash: () => dash.getDash(),
    isFiring: () => aim.isAiming?.() ?? false,
    destroy: () => {
      try {
        move?.destroy?.();
      } catch (e) {
        console.warn("move.destroy failed", e);
      }
      try {
        aim?.destroy?.();
      } catch (e) {
        console.warn("aim.destroy failed", e);
      }
      try {
        dash?.destroy?.();
      } catch (e) {
        console.warn("dash.destroy failed", e);
      }
    },
  };
}
