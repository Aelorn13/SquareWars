// components/powerup/types.js
export const DURATION_POWERBUFF = 10;

export const POWERUP_TYPES = [
  "heal",
  "rapidFire",
  "damage",
  "speed",
  "invincibility",
  "alwaysCrit",
  "tripleProjectiles",
  "bomb",
];

export const colorMap = {
  rapidFire: [255, 255, 0],
  heal: [207, 93, 183],
  invincibility: [204, 228, 118],
  speed: [98, 218, 202],
  damage: [187, 30, 30],
  alwaysCrit: [255, 100, 0],
  tripleProjectiles: [200, 160, 255],
  bomb: [30, 30, 50],
};

export const iconMap = {
  rapidFire: "⚡",
  heal: "❤️",
  invincibility: "⭐",
  speed: "🦵",
  damage: "💪",
  alwaysCrit: "🎯",
  tripleProjectiles: "🔱",
  bomb: "💣",
};
