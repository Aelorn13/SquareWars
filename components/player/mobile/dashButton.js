// dashButton.js
// createDashButton({ container, size, marginX, marginY, align, sticky })
// size -> percent of vmin (like others). marginX -> vw% / marginY -> vh%

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

export function createDashButton({
  container = document.body,
  size = 10,
  marginX = 5,
  marginY = 20,
  align = "right",
  sticky = true,
} = {}) {
  if (container !== document.body) {
    const cs = getComputedStyle(container);
    if (cs.position === "static") container.style.position = "relative";
  }

  const btn = document.createElement("div");
  const label = document.createElement("div");
  label.textContent = "⇢";

  btn.style.position = container === document.body ? "fixed" : "absolute";
  btn.style.borderRadius = "50%";
  btn.style.background = "rgba(255,255,255,0.14)";
  btn.style.touchAction = "none";
  btn.style.zIndex = 9999;
  btn.style.pointerEvents = "auto";
  btn.style.display = sticky ? "block" : "none";
  btn.style.boxSizing = "border-box";
  btn.style.border = "2px solid rgba(255,255,255,0.06)";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.display = sticky ? "flex" : "none";

  label.style.lineHeight = "1";
  label.style.textAlign = "center";
  label.style.userSelect = "none";
  label.style.pointerEvents = "none";
  btn.appendChild(label);
  container.appendChild(btn);

  let pressed = false;
  const supportsPointer = typeof window.PointerEvent !== "undefined";

  function applyStyles() {
    const sizePx = Math.max(18, Math.round(_toPx(size, "vmin")));
    const marginXPx = Math.round(_toPx(marginX, "x"));
    const marginYPx = Math.round(_toPx(marginY, "y"));

    btn.style.width = `${sizePx}px`;
    btn.style.height = `${sizePx}px`;

    if (align === "right") {
      btn.style.right = `${marginXPx}px`;
      btn.style.left = "auto";
    } else {
      btn.style.left = `${marginXPx}px`;
      btn.style.right = "auto";
    }
    btn.style.bottom = `${marginYPx}px`;

    label.style.fontSize = `${Math.round(sizePx * 0.45)}px`;
  }

  function onPointerDown(e) {
    pressed = true;
    btn.style.background = "rgba(255,255,255,0.26)";
    try { btn.setPointerCapture?.(e.pointerId); } catch {}
    e.preventDefault();
  }
  function onPointerUp(e) {
    pressed = false;
    btn.style.background = "rgba(255,255,255,0.14)";
    try { btn.releasePointerCapture?.(e.pointerId); } catch {}
  }

  // touch fallback
  function onTouchStart(e) {
    pressed = true;
    btn.style.background = "rgba(255,255,255,0.26)";
    e.preventDefault();
  }
  function onTouchEnd() {
    pressed = false;
    btn.style.background = "rgba(255,255,255,0.14)";
  }

  function onResize() {
    applyStyles();
  }

  applyStyles();
  window.addEventListener("resize", onResize);

  if (supportsPointer) {
    btn.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    btn.addEventListener("pointercancel", onPointerUp);
  } else {
    btn.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
  }

  return {
    getDash() {
      return !!pressed;
    },
    destroy() {
      window.removeEventListener("resize", onResize);
      if (supportsPointer) {
        btn.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        btn.removeEventListener("pointercancel", onPointerUp);
      } else {
        btn.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      }
      if (container && container.contains(btn)) container.removeChild(btn);
    },
  };
}
