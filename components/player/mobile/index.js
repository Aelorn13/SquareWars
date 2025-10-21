// components/player/mobile/index.js

import { createMovementJoystick } from "./movementJoystick.js";
import { createAimJoystick } from "./aimJoystick.js";
import { createDashButton } from "./dashButton.js";
import { createAutoShootButton } from "./autoShootButton.js";
import { createSkillButton } from "./skillButton.js";

export function makeMobileController(
  k,
  {
    portrait = {
      moveOpts: { size: "30%", marginX: "5%", marginY: "10%" },
      aimOpts: { size: "30%", marginX: "5%", marginY: "10%", align: "right" },
      dashOpts: { size: "15%", marginX: "5%", marginY: "25%", align: "right" },
      skillOpts: { size: "15%", marginX: "22%", marginY: "15%", align: "right" },
      autoShootOpts: { size: "10%", marginX: "5%", marginY: "50%", align: "right" },
    },
    landscape = {
      moveOpts: { size: "30%", marginX: "4%", marginY: "10%" },
      aimOpts: { size: "30%", marginX: "4%", marginY: "10%", align: "right" },
      dashOpts: { size: "15%", marginX: "4%", marginY: "40%", align: "right" },
      skillOpts: { size: "15%", marginX: "18%", marginY: "20%", align: "right" },
      autoShootOpts: { size: "10%", marginX: "5%", marginY: "80%", align: "right" },
    },
    portraitAutoShoot = {
      dashOpts: { size: "20%", marginX: "8%", marginY: "15%", align: "right" },
      skillOpts: { size: "20%", marginX: "30%", marginY: "15%", align: "right" }, 
    },
    landscapeAutoShoot = {
      dashOpts: { size: "22%", marginX: "6%", marginY: "20%", align: "right" },
      skillOpts: { size: "22%", marginX: "25%", marginY: "20%", align: "right" }, 
    },
    containers = {},
  } = {}
) {
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  const regularOpts = isLandscape ? landscape : portrait;
  const autoShootActiveOpts = isLandscape ? landscapeAutoShoot : portraitAutoShoot;

  const leftContainer = containers.left ?? document.body;
  const rightContainer = containers.right ?? document.body;

  const move = createMovementJoystick({ container: leftContainer, ...regularOpts.moveOpts });
  const aim = createAimJoystick({ container: rightContainer, ...regularOpts.aimOpts });
  const dash = createDashButton({ container: rightContainer, ...regularOpts.dashOpts });
  const auto = createAutoShootButton({ container: rightContainer, ...regularOpts.autoShootOpts });
  const skill = createSkillButton({ container: rightContainer, ...regularOpts.skillOpts }); // <-- CREATE the button

  return {
    getMove: () => move.getMove(),
    getAim: () => aim.getAim(),
    getAimLast: () => aim.getLastAim(),
    isAiming: () => aim.isAiming?.() ?? false,
    getDash: () => dash.getDash(),
    getSkill: () => skill.getSkill(), 
    getAutoShoot: () => auto.getPressed(),
    isFiring: () => aim.isAiming?.() ?? false,

    setAutoShootUIMode: (isActive) => {
      aim.toggle(!isActive);
      if (isActive) {
        dash.updateOpts(autoShootActiveOpts.dashOpts);
        skill.updateOpts(autoShootActiveOpts.skillOpts); 
      } else {
        dash.updateOpts(regularOpts.dashOpts);
        skill.updateOpts(regularOpts.skillOpts); 
      }
    },
    
    destroy: () => {
      move?.destroy?.();
      aim?.destroy?.();
      dash?.destroy?.();
      auto?.destroy?.();
      skill?.destroy?.(); 
    },
  };
}