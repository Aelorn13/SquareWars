// vectorUtils.js
// Robust vector utilities supporting plain {x,y} or Kaboom Vec2 objects

export function normalize(vec) {
  if (!vec || typeof vec.x !== "number" || typeof vec.y !== "number") return null;
  const mag = Math.sqrt(vec.x ** 2 + vec.y ** 2);
  return mag < 1e-6 ? { x: 0, y: 0 } : { x: vec.x / mag, y: vec.y / mag };
}

export function scale(vec, scalar) {
  if (!vec || typeof vec.x !== "number" || typeof vec.y !== "number") return null;
  return { x: vec.x * scalar, y: vec.y * scalar };
}

export function add(vecA, vecB) {
  if (!vecA || typeof vecA.x !== "number" || !vecB || typeof vecB.x !== "number") return null;
  return { x: vecA.x + vecB.x, y: vecA.y + vecB.y };
}

export function subtract(vecA, vecB) {
  if (!vecA || typeof vecA.x !== "number" || !vecB || typeof vecB.x !== "number") return null;
  return { x: vecA.x - vecB.x, y: vecA.y - vecB.y };
}
