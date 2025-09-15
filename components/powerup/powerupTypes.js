//components/powerup/powerupTypes.js
/**
 * @file Defines the configurations for all power-ups in the game.
 */

// Default duration for power-ups that grant temporary buffs.
export const DEFAULT_POWERUP_DURATION = 10; // in seconds

/**
 * A centralized configuration object for all power-up types.
 * Each key represents a power-up and holds all its associated properties.
 */
export const POWERUP_CONFIG = {
  // --- STAT-BASED BUFFS ---
  RAPID_FIRE: {
    color: [255, 255, 0],
    icon: "⚡",
    effects: [
      { type: 'statBuff', stat: 'attackSpeed', value: 0.4, mode: 'multiplicative' }
    ]
  },
  DAMAGE: {
    color: [187, 30, 30],
    icon: "💪",
    effects: [
      { type: 'statBuff', stat: 'damage', value: 1, mode: 'additive' }
    ]
  },
  SPEED: {
    color: [98, 218, 202],
    icon: "🦵",
    effects: [
      { type: 'statBuff', stat: 'speed', value: 2, mode: 'multiplicative' },
      { type: 'statBuff', stat: 'dashCooldown', value: 0.3, mode: 'multiplicative' },
    ]
  },
  ALWAYS_CRIT: {
    color: [255, 100, 0],
    icon: "🎯",
    effects: [
      { type: 'statBuff', stat: 'critChance', value: 1, mode: 'absolute' }
    ]
  },
  TRIPLE_PROJECTILES: {
    color: [200, 160, 255],
    icon: "🔱",
    effects: [
      { type: 'statBuff', stat: 'projectiles', value: 2, mode: 'additive' }
    ]
  },

  // --- IMMEDIATE OR UNIQUE EFFECTS ---
  HEAL: {
    color: [207, 93, 183],
    icon: "❤️",
    effects: [{ type: 'heal', amount: 2 }]
  },
  INVINCIBILITY: {
    color: [204, 228, 118],
    icon: "⭐",
    effects: [{ type: 'invincibility' }]
  },
  BOMB: {
    color: [30, 30, 50],
    icon: "💣",
    effects: [{ type: 'shockwave', damage: 15, maxRadius: 400 }]
  },
};

// For convenience, export an object containing just the power-up type keys.
export const POWERUP_TYPES = Object.fromEntries(
  Object.keys(POWERUP_CONFIG).map(key => [key, key])
);