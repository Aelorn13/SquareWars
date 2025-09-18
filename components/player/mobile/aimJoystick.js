// components/player/mobile/aimJoystick.js
export function createAimJoystick({
  container = document.body,
  size = 120,
  marginX = 24,
  marginY = 40,
  align = "left",
  deadZone = 0.10,
  sticky = true,
  preserveLast = true, // remember last direction when pointer released
} = {}) {
  let pointerId = null;
  let origin = { x: 0, y: 0 };
  let current = { x: 0, y: 0 }; // pixel delta while active
  const radius = size / 2;
  const maxDist = radius * 0.9;
  let firing = false;
  // last non-zero normalized aim (x,y), default to facing right
  let lastAim = { x: 1, y: 0 };

  const base = document.createElement("div");
  const handle = document.createElement("div");

  const baseStyle = {
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
const useFixed = container === document.body;
base.style.position = useFixed ? "fixed" : "absolute";
  if (align === "right") {
    baseStyle.right = `${marginX}px`;
  } else {
    baseStyle.left = `${marginX}px`;
  }

  Object.assign(base.style, baseStyle);

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
    const clamped = dist > maxDist ? maxDist / dist : 1;
    const hx = dx * clamped;
    const hy = dy * clamped;
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
    current.x = hx;
    current.y = hy;

    // update lastAim from the *active* input if it exceeds deadZone
    const nx = hx / maxDist;
    const ny = hy / maxDist;
    const len = Math.hypot(nx, ny);
    if (len >= deadZone) {
      lastAim = { x: nx / len, y: ny / len };
    }
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
    // Reset handle visual but KEEP lastAim if preserveLast=true
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
    // active aim while touching (normalized, zero if tiny input)
    getAim() {
      const nx = current.x / maxDist;
      const ny = current.y / maxDist;
      const len = Math.hypot(nx, ny);
      if (len < deadZone) return { x: 0, y: 0 };
      return { x: nx / len, y: ny / len };
    },
    // last stored aim (normalized) — useful to keep facing direction after touch ends
    getLastAim() {
      return { x: lastAim.x, y: lastAim.y };
    },
    // whether joystick currently being touched
    isAiming() {
      return !!firing;
    },
    destroy() {
      base.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      base.removeEventListener("pointercancel", onPointerUp);
      base.removeEventListener("lostpointercapture", onPointerUp);
      if (container.contains(base)) container.removeChild(base);
    },
  };
}
