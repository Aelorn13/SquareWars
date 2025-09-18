// components/player/mobile/joystick.js
// createMovementJoystick(options) -> { getMove(), destroy() }
// getMove() returns { x: -1..1, y: -1..1 } (y: -1 up, +1 down)

export function createMovementJoystick({
  container = document.body,
  size = 140, // diameter in px
  marginX = 24, // distance from left edge
  marginY = 140, // distance from bottom edge
  deadZone = 0.12, // ignore tiny inputs
  sticky = true, // whether base stays visible or hides until touch
} = {}) {
  let pointerId = null;
  let origin = { x: 0, y: 0 };
  let current = { x: 0, y: 0 }; // in pixels relative to origin
  const radius = size / 2;
  const maxDist = radius * 0.9; // handle stays inside base

  // DOM elements
  const base = document.createElement("div");
  const handle = document.createElement("div");

  Object.assign(base.style, {
    position: "fixed",
    left: `${marginX}px`,
    bottom: `${marginY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    touchAction: "none",
    display: sticky ? "block" : "none",
    zIndex: 9999,
    pointerEvents: "auto",
  });

  Object.assign(handle.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${size * 0.45}px`,
    height: `${size * 0.45}px`,
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
  });

  base.appendChild(handle);
  container.appendChild(base);

  function toLocal(e) {
    const rect = base.getBoundingClientRect();
    const x =
      (e.clientX ?? e.touches?.[0]?.clientX) - (rect.left + rect.width / 2);
    const y =
      (e.clientY ?? e.touches?.[0]?.clientY) - (rect.top + rect.height / 2);
    return { x, y };
  }

  function updateHandleFromDelta(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxDist ? maxDist / dist : 1;
    const hx = dx * clamped;
    const hy = dy * clamped;
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
    current.x = hx;
    current.y = hy;
  }

  function onPointerDown(e) {
    // accept only primary pointers for this joystick
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    base.setPointerCapture(pointerId);
    const rect = base.getBoundingClientRect();
    origin.x = rect.left + rect.width / 2;
    origin.y = rect.top + rect.height / 2;
    if (!sticky) base.style.display = "block";
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    updateHandleFromDelta(dx, dy);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    updateHandleFromDelta(dx, dy);
  }

  function onPointerUp(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    try {
      base.releasePointerCapture(pointerId);
    } catch {}
    pointerId = null;
    current.x = 0;
    current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  base.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  base.addEventListener("pointercancel", onPointerUp);
  base.addEventListener("lostpointercapture", onPointerUp);

  return {
    getMove() {
      // convert current px -> normalized -1..1
      const nx = current.x / maxDist;
      const ny = current.y / maxDist;
      const ax = Math.abs(nx) < deadZone ? 0 : nx;
      const ay = Math.abs(ny) < deadZone ? 0 : ny;
      // invert y so up = -1 (matches player movement code)
      return { x: ax, y: ay };
    },
    destroy() {
      base.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      base.removeEventListener("lostpointercapture", onPointerUp);
      if (container && container.contains(base)) {
        container.removeChild(base);
      }
    },
  };
}
