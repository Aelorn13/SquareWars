// components/player/mobile/index.js
import { createMovementJoystick } from "./joystick.js";
import { createAimJoystick } from "./aimJoystick.js";
import { createDashButton } from "./dashButton.js";

/**
 * makeMobileController(k?, opts?)
 * opts.containers = { left, right, center } - DOM elements to attach controls to.
 */
export function makeMobileController(
  k,
  {
    portrait = {
      moveOpts: { size: 300, marginX: 30, marginY: 140 },
      aimOpts: { size: 300, marginX: 30, marginY: 140, align: "right" },
      dashOpts: { size: 85, marginX: 30, marginY: 370, align: "right" },
    },
    landscape = {
      moveOpts: { size: 220, marginX: 20, marginY: 40 },
      aimOpts: { size: 220, marginX: 20, marginY: 40, align: "right" },
      dashOpts: { size: 70, marginX: 20, marginY: 120, align: "right" },
    },
    containers = {}, // optional: { left: HTMLElement, right: HTMLElement, center: HTMLElement }
  } = {}
) {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const opts = isLandscape ? landscape : portrait;
  const { moveOpts = {}, aimOpts = {}, dashOpts = {} } = opts;

  // decide which DOM container to attach each control to
  const leftContainer = containers.left ?? document.body;
  const rightContainer = containers.right ?? document.body;
  const centerContainer = containers.center ?? document.body;

  // Movement joystick goes to left container
  const move = createMovementJoystick({ container: leftContainer, ...moveOpts });
  // Aim joystick and dash button go to right container
  const aim = createAimJoystick({ container: rightContainer, ...aimOpts });
  const dash = createDashButton({ container: rightContainer, ...dashOpts });

  return {
    getMove: () => move.getMove(),
    getAim: () => aim.getAim(),
    getAimLast: () => aim.getLastAim(),
    isAiming: () => aim.isAiming?.() ?? false,
    getDash: () => dash.getDash(),
    isFiring: () => aim.isAiming?.() ?? false,
    destroy: () => {
      try { move?.destroy?.(); } catch (e) { console.warn("move.destroy failed", e); }
      try { aim?.destroy?.(); } catch (e) { console.warn("aim.destroy failed", e); }
      try { dash?.destroy?.(); } catch (e) { console.warn("dash.destroy failed", e); }
    },
  };
}
