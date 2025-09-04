// components/boss/constants.js

// Cooldown durations for various boss abilities, in seconds.
export const SUMMON_COOLDOWN = 9;
export const SHOOT_COOLDOWN = 2;
export const CHARGE_COOLDOWN = 5;

// Telegraph animation durations for different actions.
export const TELEGRAPH_SUMMON_DURATION = 0.4;
export const TELEGRAPH_SPREAD_SHOT_DURATION = 0.25;
export const TELEGRAPH_CHARGE_WINDUP = 1.0;
export const TELEGRAPH_FADE_OUT_DURATION = 0.2;

// Boss colors for telegraphing actions.
export const COLOR_SUMMON_TELEGRAPH = [0, 200, 0]; // Green for summoning minions
export const COLOR_SPREAD_SHOT_TELEGRAPH = [200, 100, 0]; // Orange for spread shot
export const COLOR_CHARGE_TELEGRAPH = [200, 0, 0]; // Red for charging

// Boss base colors for each phase (darker variations)
export const PHASE_COLORS = {
  1: [60, 20, 20],   // Dark reddish
  2: [60, 40, 20],   // Dark orange-ish
  3: [40, 20, 60]    // Dark purplish (example for phase 3)
};

// Charge ability specific constants
export const CHARGE_MOVE_DURATION = 0.6; // How long the boss moves during a charge
export const CHARGE_SPEED_MULTIPLIER = 6; // Multiplier for boss speed during charge

// New constants for vulnerability
export const VULNERABILITY_DURATION = 1.5; // Boss vulnerable for 1.5 seconds after charge
export const VULNERABILITY_DAMAGE_MULTIPLIER = 2; // Takes 2x damage when vulnerable