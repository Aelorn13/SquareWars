// components/player/mobile/aimJoystick.js
// createAimJoystick(options) -> { getAim(), isFiring(), destroy() }
// getAim() returns a normalized direction vector { x: -1..1, y: -1..1 }
// isFiring() returns boolean (true while pointer is down)

export function createAimJoystick({
  container = document.body,
  size = 120,
  marginX = 24,
  marginY = 40,      // lower than movement joystick by default
   align = 'left',
  deadZone = 0.10,
  sticky = true,
} = {}) {
  let pointerId = null;
  let origin = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  const radius = size / 2;
  const maxDist = radius * 0.9;
  let firing = false;

  const base = document.createElement("div");
  const handle = document.createElement("div");

  const baseStyle = {
    position: "fixed",
    bottom: `${marginY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    touchAction: "none",
    display: sticky ? "block" : "none",
    zIndex: 9999,
    pointerEvents: "auto",
  };

  // Conditionally set left or right based on the 'align' property
  if (align === 'right') {
    baseStyle.right = `${marginX}px`;
  } else {
    baseStyle.left = `${marginX}px`;
  }

  Object.assign(base.style, baseStyle);
  // --- End of Corrected Block ---
  Object.assign(handle.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${size * 0.42}px`,
    height: `${size * 0.42}px`,
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
  });

  base.appendChild(handle);
  container.appendChild(base);

  function updateHandleFromDelta(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxDist ? (maxDist / dist) : 1;
    const hx = dx * clamped;
    const hy = dy * clamped;
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
    current.x = hx;
    current.y = hy;
  }

  function onPointerDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    base.setPointerCapture(pointerId);
    firing = true;
    const rect = base.getBoundingClientRect();
    origin.x = rect.left + rect.width / 2;
    origin.y = rect.top + rect.height / 2;
    updateHandleFromDelta(e.clientX - origin.x, e.clientY - origin.y);
    if (!sticky) base.style.display = "block";
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    updateHandleFromDelta(e.clientX - origin.x, e.clientY - origin.y);
  }

  function onPointerUp(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    try { base.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
    firing = false;
    current.x = 0; current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  base.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  base.addEventListener("pointercancel", onPointerUp);
  base.addEventListener("lostpointercapture", onPointerUp);

  return {
    getAim() {
      const nx = current.x / maxDist;
      const ny = current.y / maxDist;
      const len = Math.hypot(nx, ny);
      if (len < deadZone) return { x: 0, y: 0 };
      return { x: nx / len, y: ny / len };
    },
    isFiring() {
      return !!firing;
    },
    destroy() {
      base.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      base.removeEventListener("lostpointercapture", onPointerUp);
      container.removeChild(base);
    },
  };
}
