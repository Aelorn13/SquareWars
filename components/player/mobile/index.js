//components/player/mobile/index.js
import { createMovementJoystick } from "./movementJoystick.js";
import { createAimJoystick } from "./aimJoystick.js";
import { createDashButton } from "./dashButton.js";
import { createAutoShootButton } from "./autoShootButton.js";
/**
 * makeMobileController(k?, opts?)
 * opts.containers = { left, right, center } - DOM elements to attach controls to.
 * All sizing/spacing options must be strings with % units, relative to viewport.
 */
export function makeMobileController(
  k,
  {
    portrait = {
      moveOpts: { size: "30%", marginX: "5%", marginY: "10%" },
      aimOpts: { size: "30%", marginX: "5%", marginY: "10%", align: "right" },
      dashOpts: { size: "15%", marginX: "5%", marginY: "25%", align: "right" },
      autoShootOpts: {size: "10%", marginX: "5%", marginY: "50%", align: "right" },
    },
    landscape = {
      moveOpts: { size: "30%", marginX: "4%", marginY: "10%" },
      aimOpts: { size: "30%", marginX: "4%", marginY: "10%", align: "right" },
      dashOpts: { size: "15%", marginX: "4%", marginY: "40%", align: "right" },
      autoShootOpts: {size: "10%", marginX: "5%", marginY: "80%", align: "right" },
    },
    containers = {},
  } = {}
) {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const opts = isLandscape ? landscape : portrait;
  const { moveOpts = {}, aimOpts = {}, dashOpts = {},autoShootOpts={} } = opts;

  const leftContainer = containers.left ?? document.body;
  const rightContainer = containers.right ?? document.body;

  const move = createMovementJoystick({ container: leftContainer, ...moveOpts });
  const aim = createAimJoystick({ container: rightContainer, ...aimOpts });
  const dash = createDashButton({ container: rightContainer, ...dashOpts });
  const auto = createAutoShootButton({ container: rightContainer, ...autoShootOpts});
  return {
    getMove: () => move.getMove(),
    getAim: () => aim.getAim(),
    getAimLast: () => aim.getLastAim(),
    isAiming: () => aim.isAiming?.() ?? false,
    getDash: () => dash.getDash(),
    getAutoShoot: () => auto.getPressed(),
    isFiring: () => aim.isAiming?.() ?? false,
    destroy: () => {
      move?.destroy?.();
      aim?.destroy?.();
      dash?.destroy?.();
      auto?.destroy?.();
    },
  };
}
