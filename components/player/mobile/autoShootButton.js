// components/player/autoShootButton.js
// pure UI button. returns pressed state via getPressed()

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

export function createAutoShootButton({
  container = document.body,
  size = 12,
  marginX = 5,
  marginY = 20,
  align = "right",
  sticky = true,
  labelText = "AUTOSHOOT",
} = {}) {
  if (container !== document.body) {
    const cs = getComputedStyle(container);
    if (cs.position === "static") container.style.position = "relative";
  }

  const btn = document.createElement("div");
  const label = document.createElement("div");
  label.textContent = labelText;

  btn.style.position = container === document.body ? "fixed" : "absolute";
  btn.style.borderRadius = "10px";
  btn.style.background = "rgba(255,255,255,0.12)";
  btn.style.touchAction = "none";
  btn.style.zIndex = 9999;
  btn.style.pointerEvents = "auto";
  btn.style.display = sticky ? "block" : "none";
  btn.style.boxSizing = "border-box";
  btn.style.border = "2px solid rgba(255,255,255,0.06)";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.display = sticky ? "flex" : "none";
  btn.style.padding = "6px 10px";

  label.style.lineHeight = "1";
  label.style.textAlign = "center";
  label.style.userSelect = "none";
  label.style.pointerEvents = "none";
  label.style.fontWeight = "600";
  btn.appendChild(label);
  container.appendChild(btn);

  let pressed = false;
  const supportsPointer = typeof window.PointerEvent !== "undefined";

  function applyStyles() {
    const sizePx = Math.max(20, Math.round(_toPx(size, "vmin")));
    const marginXPx = Math.round(_toPx(marginX, "x"));
    const marginYPx = Math.round(_toPx(marginY, "y"));

    btn.style.minWidth = `${Math.round(sizePx * 1.8)}px`;
    btn.style.height = `${sizePx}px`;
    label.style.fontSize = `${Math.round(sizePx * 0.35)}px`;

    if (align === "right") {
      btn.style.right = `${marginXPx}px`;
      btn.style.left = "auto";
    } else {
      btn.style.left = `${marginXPx}px`;
      btn.style.right = "auto";
    }
    btn.style.bottom = `${marginYPx}px`;
  }

  function setPressed(v) {
    pressed = !!v;
    btn.style.background = pressed ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.12)";
  }

  function onPointerDown(e) {
    setPressed(true);
    try { btn.setPointerCapture?.(e.pointerId); } catch {}
    e.preventDefault();
  }
  function onPointerUp(e) {
    setPressed(false);
    try { btn.releasePointerCapture?.(e.pointerId); } catch {}
  }
  function onTouchStart(e) {
    setPressed(true);
    e.preventDefault();
  }
  function onTouchEnd() {
    setPressed(false);
  }
  function onResize() { applyStyles(); }

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
    getPressed() { return !!pressed; },
    destroy() {
      window.removeEventListener("resize", onResize);
      if (supportsPointer) {
        btn.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        btn.removeEventListener("pointercancel", onPointerUp);
      } else {
        btn.removeEventListener("touchstart", onTouchStart, { passive: false });
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      }
      if (container && container.contains(btn)) container.removeChild(btn);
    },
  };
}
