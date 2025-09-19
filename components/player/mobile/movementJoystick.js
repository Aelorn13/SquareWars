// movementJoystick.js
// createMovementJoystick({ container, size, marginX, marginY, deadZone, sticky, align })
// size: number|string -> percent of vmin (e.g. 15 or "15%" or 0.15 for 15%)
// marginX: percent of viewport width (e.g. 5 or "5%" or "5vw" or 0.05)
// marginY: percent of viewport height (e.g. 10 or "10%" or 0.10)

function _getContainerRect(container) {
  if (container === document.body) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  return container.getBoundingClientRect();
}

function _toPx(val, axis = "vmin") {
  // axis: "vmin" | "x" | "y"
  if (val == null) return 0;
  if (typeof val === "number") {
    if (val > 0 && val <= 1) {
      // fraction -> 0..1
      if (axis === "vmin") return val * Math.min(window.innerWidth, window.innerHeight);
      if (axis === "x") return val * window.innerWidth;
      return val * window.innerHeight;
    }
    // number > 1 treated as percent (e.g. 15 => 15%)
    const pct = val / 100;
    if (axis === "vmin") return pct * Math.min(window.innerWidth, window.innerHeight);
    if (axis === "x") return pct * window.innerWidth;
    return pct * window.innerHeight;
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (s.endsWith("%")) {
      const pct = parseFloat(s) / 100;
      if (axis === "vmin") return pct * Math.min(window.innerWidth, window.innerHeight);
      if (axis === "x") return pct * window.innerWidth;
      return pct * window.innerHeight;
    }
    if (s.endsWith("vw")) return (parseFloat(s) / 100) * window.innerWidth;
    if (s.endsWith("vh")) return (parseFloat(s) / 100) * window.innerHeight;
    // fallback: treat as px number string
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function createMovementJoystick({
  container = document.body,
  size = 15, // percent of vmin
  marginX = 5, // percent of vw
  marginY = 10, // percent of vh
  deadZone = 0.12,
  sticky = true,
  align = "left", // "left" or "right"
} = {}) {
  // ensure container has positioning so absolute children behave
  if (container !== document.body) {
    const cs = getComputedStyle(container);
    if (cs.position === "static") container.style.position = "relative";
  }

  const base = document.createElement("div");
  const handle = document.createElement("div");

  // visuals
  base.style.position = container === document.body ? "fixed" : "absolute";
  base.style.borderRadius = "50%";
  base.style.background = "rgba(255,255,255,0.08)";
  base.style.touchAction = "none";
  base.style.zIndex = 9999;
  base.style.pointerEvents = "auto";
  base.style.display = sticky ? "block" : "none";
  base.style.boxSizing = "border-box";

  handle.style.position = "absolute";
  handle.style.left = "50%";
  handle.style.top = "50%";
  handle.style.transform = "translate(-50%,-50%)";
  handle.style.borderRadius = "50%";
  handle.style.background = "rgba(255,255,255,0.18)";
  handle.style.pointerEvents = "none";

  base.appendChild(handle);
  container.appendChild(base);

  // internal geometry/state
  let sizePx = 0;
  let maxDist = 0;
  let current = { x: 0, y: 0 }; // px relative to center
  let pointerId = null;
  let supportsPointer = typeof window.PointerEvent !== "undefined";
  let oldMaxDist = null;

  function applyStyles() {
    const crect = _getContainerRect(container);
    const newSizePx = Math.max(24, Math.round(_toPx(size, "vmin")));
    const marginXPx = Math.round(_toPx(marginX, "x"));
    const marginYPx = Math.round(_toPx(marginY, "y"));

    const newMaxDist = (newSizePx / 2) * 0.9;

    // scale current so handle remains consistent across resizes
    if (oldMaxDist && oldMaxDist > 0) {
      const scale = newMaxDist / oldMaxDist;
      current.x *= scale;
      current.y *= scale;
    }

    sizePx = newSizePx;
    maxDist = newMaxDist;
    oldMaxDist = newMaxDist;

    base.style.width = `${sizePx}px`;
    base.style.height = `${sizePx}px`;

    // horizontal anchor
    if (align === "right") {
      base.style.right = `${marginXPx}px`;
      base.style.left = "auto";
    } else {
      base.style.left = `${marginXPx}px`;
      base.style.right = "auto";
    }

    base.style.bottom = `${marginYPx}px`;

    // handle size (relative to base)
    handle.style.width = `${Math.round(sizePx * 0.45)}px`;
    handle.style.height = `${Math.round(sizePx * 0.45)}px`;

    // reposition handle according to current px values (clamped to newMaxDist)
    const hx = Math.max(-newMaxDist, Math.min(newMaxDist, current.x));
    const hy = Math.max(-newMaxDist, Math.min(newMaxDist, current.y));
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
  }

  function _getBaseCenter() {
    const r = base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function positionBaseAt(clientX, clientY) {
    const crect = _getContainerRect(container);
    // left px relative to container
    const leftPx = Math.round(clientX - (container === document.body ? 0 : crect.left) - sizePx / 2);
    const bottomPx = Math.round((container === document.body ? window.innerHeight : crect.height) - ((clientY - (container === document.body ? 0 : crect.top)) + sizePx / 2));
    base.style.left = `${leftPx}px`;
    base.style.right = "auto";
    base.style.bottom = `${bottomPx}px`;
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

  // pointer event handlers
  function onPointerDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    try { base.setPointerCapture(pointerId); } catch {}
    if (!sticky) {
      base.style.display = "block";
      positionBaseAt(e.clientX, e.clientY);
    }
    const center = _getBaseCenter();
    updateHandleFromDelta(e.clientX - center.x, e.clientY - center.y);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const center = _getBaseCenter();
    updateHandleFromDelta(e.clientX - center.x, e.clientY - center.y);
  }
  function onPointerUp(e) {
    if (pointerId === null || (e.pointerId && e.pointerId !== pointerId)) return;
    try { base.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
    current.x = 0;
    current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  // touch fallback (single-finger)
  let touchActive = false;
  function onTouchStart(e) {
    if (touchActive) return;
    touchActive = true;
    const t = e.changedTouches[0];
    if (!t) return;
    if (!sticky) {
      base.style.display = "block";
      positionBaseAt(t.clientX, t.clientY);
    }
    const center = _getBaseCenter();
    updateHandleFromDelta(t.clientX - center.x, t.clientY - center.y);
    e.preventDefault();
  }
  function onTouchMove(e) {
    if (!touchActive) return;
    const t = e.touches[0];
    if (!t) return;
    const center = _getBaseCenter();
    updateHandleFromDelta(t.clientX - center.x, t.clientY - center.y);
  }
  function onTouchEnd() {
    if (!touchActive) return;
    touchActive = false;
    current.x = 0;
    current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  // resize handling (scale current)
  function onResize() {
    applyStyles();
  }

  // attach listeners
  applyStyles();
  window.addEventListener("resize", onResize);

  if (supportsPointer) {
    base.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    base.addEventListener("pointercancel", onPointerUp);
    base.addEventListener("lostpointercapture", onPointerUp);
  } else {
    base.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  }

  return {
    getMove() {
      // normalized -1..1
      const nx = current.x / maxDist;
      const ny = current.y / maxDist;
      return {
        x: Math.abs(nx) < deadZone ? 0 : nx,
        y: Math.abs(ny) < deadZone ? 0 : ny,
      };
    },
    destroy() {
      // remove listeners
      window.removeEventListener("resize", onResize);
      if (supportsPointer) {
        base.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        base.removeEventListener("pointercancel", onPointerUp);
        base.removeEventListener("lostpointercapture", onPointerUp);
      } else {
        base.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      }
      if (container && container.contains(base)) container.removeChild(base);
    },
  };
}
