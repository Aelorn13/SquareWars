// aimJoystick.js
// createAimJoystick({ container, size, marginX, marginY, align, deadZone, sticky, preserveLast })
// same sizing semantics as movementJoystick (size => vmin %)

function _getContainerRect(container) {
  if (container === document.body) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }
  return container.getBoundingClientRect();
}
function _toPx(val, axis = "vmin") {
  if (val == null) return 0;
  if (typeof val === "number") {
    if (val > 0 && val <= 1) {
      if (axis === "vmin") return val * Math.min(window.innerWidth, window.innerHeight);
      if (axis === "x") return val * window.innerWidth;
      return val * window.innerHeight;
    }
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
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function createAimJoystick({
  container = document.body,
  size = 15,
  marginX = 5,
  marginY = 10,
  align = "left",
  deadZone = 0.10,
  sticky = true,
  preserveLast = true,
} = {}) {
  if (container !== document.body) {
    const cs = getComputedStyle(container);
    if (cs.position === "static") container.style.position = "relative";
  }

  const base = document.createElement("div");
  const handle = document.createElement("div");

  base.style.position = container === document.body ? "fixed" : "absolute";
  base.style.borderRadius = "50%";
  base.style.background = "rgba(255,255,255,0.06)";
  base.style.touchAction = "none";
  base.style.zIndex = 9999;
  base.style.pointerEvents = "auto";
  base.style.display = sticky ? "block" : "none";

  handle.style.position = "absolute";
  handle.style.left = "50%";
  handle.style.top = "50%";
  handle.style.transform = "translate(-50%,-50%)";
  handle.style.borderRadius = "50%";
  handle.style.background = "rgba(255,255,255,0.2)";
  handle.style.pointerEvents = "none";

  base.appendChild(handle);
  container.appendChild(base);

  let sizePx = 0;
  let maxDist = 0;
  let oldMaxDist = null;
  let current = { x: 0, y: 0 }; // px
  let pointerId = null;
  let firing = false;
  let lastAim = { x: 1, y: 0 };
  const supportsPointer = typeof window.PointerEvent !== "undefined";

  function applyStyles() {
    const newSizePx = Math.max(28, Math.round(_toPx(size, "vmin")));
    const marginXPx = Math.round(_toPx(marginX, "x"));
    const marginYPx = Math.round(_toPx(marginY, "y"));
    const newMaxDist = (newSizePx / 2) * 0.9;

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

    if (align === "right") {
      base.style.right = `${marginXPx}px`;
      base.style.left = "auto";
    } else {
      base.style.left = `${marginXPx}px`;
      base.style.right = "auto";
    }
    base.style.bottom = `${marginYPx}px`;

    handle.style.width = `${Math.round(sizePx * 0.42)}px`;
    handle.style.height = `${Math.round(sizePx * 0.42)}px`;

    // update visual handle
    const hx = Math.max(-maxDist, Math.min(maxDist, current.x));
    const hy = Math.max(-maxDist, Math.min(maxDist, current.y));
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
  }

  function _getBaseCenter() {
    const r = base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function positionBaseAt(clientX, clientY) {
    const crect = _getContainerRect(container);
    const leftPx = Math.round(clientX - (container === document.body ? 0 : crect.left) - sizePx / 2);
    const bottomPx = Math.round((container === document.body ? window.innerHeight : crect.height) - ((clientY - (container === document.body ? 0 : crect.top)) + sizePx / 2));
    base.style.left = `${leftPx}px`;
    base.style.right = "auto";
    base.style.bottom = `${bottomPx}px`;
  }

  function updateFromDelta(dx, dy) {
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxDist ? maxDist / dist : 1;
    const hx = dx * clamped;
    const hy = dy * clamped;
    handle.style.transform = `translate(calc(-50% + ${hx}px), calc(-50% + ${hy}px))`;
    current.x = hx;
    current.y = hy;

    const nx = hx / maxDist;
    const ny = hy / maxDist;
    const len = Math.hypot(nx, ny);
    if (len >= deadZone) lastAim = { x: nx / len, y: ny / len };
  }

  // pointer handlers
  function onPointerDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    try { base.setPointerCapture(pointerId); } catch {}
    firing = true;
    if (!sticky) {
      base.style.display = "block";
      positionBaseAt(e.clientX, e.clientY);
    }
    const center = _getBaseCenter();
    updateFromDelta(e.clientX - center.x, e.clientY - center.y);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const center = _getBaseCenter();
    updateFromDelta(e.clientX - center.x, e.clientY - center.y);
  }
  function onPointerUp(e) {
    if (pointerId === null || (e.pointerId && e.pointerId !== pointerId)) return;
    try { base.releasePointerCapture(pointerId); } catch {}
    pointerId = null;
    firing = false;
    current.x = 0;
    current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  // touch fallback
  let touchActive = false;
  function onTouchStart(e) {
    if (touchActive) return;
    touchActive = true;
    const t = e.changedTouches[0];
    if (!t) return;
    firing = true;
    if (!sticky) {
      base.style.display = "block";
      positionBaseAt(t.clientX, t.clientY);
    }
    const center = _getBaseCenter();
    updateFromDelta(t.clientX - center.x, t.clientY - center.y);
    e.preventDefault();
  }
  function onTouchMove(e) {
    if (!touchActive) return;
    const t = e.touches[0];
    if (!t) return;
    const center = _getBaseCenter();
    updateFromDelta(t.clientX - center.x, t.clientY - center.y);
  }
  function onTouchEnd() {
    if (!touchActive) return;
    touchActive = false;
    firing = false;
    current.x = 0;
    current.y = 0;
    handle.style.transform = `translate(-50%,-50%)`;
    if (!sticky) base.style.display = "none";
  }

  function onResize() {
    applyStyles();
  }

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
    getAim() {
      const nx = current.x / maxDist;
      const ny = current.y / maxDist;
      const len = Math.hypot(nx, ny);
      if (len < deadZone) return { x: 0, y: 0 };
      return { x: nx / len, y: ny / len };
    },
    getLastAim() {
      return { x: lastAim.x, y: lastAim.y };
    },
    isAiming() {
      return !!firing;
    },
    destroy() {
            if (supportsPointer && pointerId !== null) {
        try { base.releasePointerCapture(pointerId); } catch(e) {}
        pointerId = null;
      }
      
      window.removeEventListener("resize", onResize);
      if (supportsPointer) {
        base.removeEventListener("pointerdown", onPointerDown);
        base.removeEventListener("pointercancel", onPointerUp);
        base.removeEventListener("lostpointercapture", onPointerUp);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        
      } else {
        base.removeEventListener("touchstart", onTouchStart, { passive: false });
        window.removeEventListener("touchmove", onTouchMove, { passive: false });
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      }
      if (container && container.contains(base)) container.removeChild(base);
    },
  };
}
