// components/player/skillManager.js

// Default skill is 'none', which will grant passive bonuses.
let selectedSkill = "none";

// Defines the properties of each skill available for selection.
export const skillSettings = {
  none: {
    name: "Passive",
    description: "Overall stat upgrades.",
  },
  strongShoot: {
    name: "Strong Shot",
    description: "A powerful, single shot.",
  },
  teleport: {
    name: "Teleport",
    description: "Instantly move to the cursor.",
  },
  grenade: {
    name: "Grenade",
    description: "Launch an explosive projectile.",
  },
};

/**
 * Sets the skill that the player will use in the game.
 * @param {string} skillKey - The key of the skill to set (e.g., 'strongShoot').
 */
export function setSelectedSkill(skillKey) {
  if (skillSettings[skillKey]) {
    selectedSkill = skillKey;
  } else {
    console.warn(`Attempted to set invalid skill: ${skillKey}`);
  }
}

/**
 * Gets the currently selected skill key.
 * @returns {string} The key of the selected skill.
 */
export function getSelectedSkill() {
  return selectedSkill;
}
