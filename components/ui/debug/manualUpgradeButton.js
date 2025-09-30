import { UPGRADE_CONFIG, RARITY_CONFIG, formatUpgradeForUI } from "../../upgrade/upgradeConfig.js";
import { applyUpgrade } from "../../upgrade/applyUpgrade.js";

/**
 * createManualUpgradeButton(k, { y, right, width, player, gameState, isDebugUIVisible })
 *
 * DOM-based debug control that lists every upgrade. Clicking a stat opens a
 * per-tier selector. Clicking a tier applies that specific tier (rarity).
 *
 * Changes in this variant:
 *  - Panel is open by default on creation.
 *  - Choosing a tier no longer closes the panel.
 *  - The expanded stat (tier list) is preserved after applying an upgrade,
 *    unless the chosen upgrade becomes disabled (unique effects).
 *
 * Returns { destroy(), element }
 */
export function createManualUpgradeButton(k, opts = {}) {
  const {
    y = 12,
    right = 12,
    width = 260,
    player,
    gameState,
    isDebugUIVisible = () => true,
  } = opts;

  const STYLE_ID = "kb-debug-upgrade-style-v2";
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #kb-debug-upgrade-container { user-select: none; }
      .kb-up-btn { display:inline-block; padding:6px 10px; border-radius:6px; background:rgba(40,40,40,0.9); color:#fff; border:1px solid rgba(255,255,255,0.08); cursor:pointer; margin-bottom:6px; font-family: monospace; }
      .kb-up-panel { display:none; margin-top:6px; max-height:420px; overflow:auto; background:rgba(20,20,20,0.95); border:1px solid rgba(255,255,255,0.06); padding:6px; border-radius:6px; min-width: ${width}px; }
      .kb-up-entry{ display:flex; flex-direction:column; gap:6px; padding:6px; border-radius:6px; cursor:pointer; color:#ddd; }
      .kb-up-entry.row{ flex-direction:row; align-items:center; }
      .kb-up-entry.disabled{ opacity:0.35; pointer-events:none; }
      .kb-up-entry:hover{ background:rgba(255,255,255,0.02); }
      .kb-up-top{ display:flex; gap:8px; align-items:center; }
      .kb-up-icon { width:28px; text-align:center; font-size:16px; }
      .kb-up-meta { font-size:12px; color:#ddd; }
      .kb-up-meta strong{ display:block; font-size:13px; color:#fff; }
      .kb-up-tierlist { display:flex; gap:6px; flex-wrap:wrap; }
      .kb-up-tier{ display:flex; gap:8px; align-items:center; padding:6px; border-radius:6px; cursor:pointer; color:#ddd; border:1px solid rgba(255,255,255,0.04); font-size:12px; min-width:88px; }
      .kb-up-tier.disabled{ opacity:0.35; pointer-events:none; }
      .kb-up-tier .tier-label{ font-weight:600; color:#fff; }
      .kb-up-tier .tier-desc{ font-size:11px; opacity:0.8; }
      .kb-up-toast { position:fixed; right:${right + 4}px; top:${y + 44}px; z-index:10000; font-family:monospace; background:rgba(0,0,0,0.7); color:#fff; padding:6px 8px; border-radius:6px; }
    `;
    document.head.appendChild(s);
  }

  // container
  const container = document.createElement("div");
  container.id = "kb-debug-upgrade-container";
  container.style.position = "fixed";
  container.style.right = `${right}px`;
  container.style.top = `${y}px`;
  container.style.zIndex = 9999;
  container.style.pointerEvents = "auto";

  const btn = document.createElement("button");
  btn.className = "kb-up-btn";
  btn.textContent = "Choose upgrade";
  container.appendChild(btn);

  const panel = document.createElement("div");
  panel.className = "kb-up-panel";
  container.appendChild(panel);

  // keep track of which stat's tier list should be expanded
  let openStatName = null;

  function showToast(text) {
    const t = document.createElement("div");
    t.className = "kb-up-toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1100);
  }

  function isOwned(cfg, stat) {
    if (!cfg) return false;
    if (cfg.isUnique && cfg.isEffect && cfg.effectType) {
      if ((player._projectileEffects ?? []).some((e) => e.type === cfg.effectType)) return true;
    }
    if (stat === "ghost" && player.hasGhost) return true;
    return false;
  }

  function getAllowedTiers(cfg) {
    if (cfg?.allowedTiers && Array.isArray(cfg.allowedTiers) && cfg.allowedTiers.length > 0) {
      return [...cfg.allowedTiers].sort((a, b) => a - b);
    }
    return RARITY_CONFIG.map((r) => r.tier).sort((a, b) => a - b);
  }

  function getRarityObjectForTier(tier) {
    const r = RARITY_CONFIG.find((x) => x.tier === tier);
    return r ? { ...r } : { tier, name: `Tier ${tier}`, multiplier: 0, color: [255, 255, 255] };
  }

  function makeTierButton(stat, cfg, tier) {
    const rarityObj = getRarityObjectForTier(tier);
    const ui = formatUpgradeForUI(stat, rarityObj);

    const b = document.createElement("div");
    b.className = "kb-up-tier";

    if (ui.color && Array.isArray(ui.color)) {
      try {
        const [r, g, bcol] = ui.color;
        b.style.boxShadow = `inset 4px 0 0 0 rgba(${r}, ${g}, ${bcol}, 0.12)`;
      } catch (e) {}
    }

    b.innerHTML = `<div style="display:flex;flex-direction:column;align-items:flex-start;">
        <div class="tier-label">${ui.rarity?.name ?? `Tier ${tier}`} ${ui.bonusText ? ` ${ui.bonusText}` : ""}</div>
        <div class="tier-desc">${ui.description ?? ""}</div>
      </div>`;

    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      try {
        applyUpgrade(k, player, { stat, rarity: rarityObj });
        showToast(`${(cfg.name ?? stat)} ${rarityObj.name ?? `Tier ${tier}`} applied`);
      } catch (err) {
        console.error("manualUpgrade apply error", err);
        showToast("apply failed");
      }

      // preserve expansion for this stat unless it became disabled by the apply
      if (cfg.isUnique && isOwned(cfg, stat)) openStatName = null;
      else openStatName = stat;

      rebuildPanel();
    });

    return b;
  }

  function rebuildPanel() {
    panel.innerHTML = "";

    Object.keys(UPGRADE_CONFIG).forEach((stat) => {
      const cfg = UPGRADE_CONFIG[stat] ?? {};

      const entry = document.createElement("div");
      entry.className = "kb-up-entry";

      const top = document.createElement("div");
      top.className = "kb-up-top";

      const icon = document.createElement("div");
      icon.className = "kb-up-icon";
      icon.textContent = cfg.icon ?? stat[0] ?? "?";

      const meta = document.createElement("div");
      meta.className = "kb-up-meta";
      meta.innerHTML = `<strong>${cfg.name ?? stat}</strong><div style="opacity:.8">${stat}</div>`;

      top.appendChild(icon);
      top.appendChild(meta);

      entry.appendChild(top);

      // tiers container
      const tiersContainer = document.createElement("div");
      tiersContainer.className = "kb-up-tierlist";
      tiersContainer.style.display = "none";

      // disabled if unique and already owned
      const disabled = cfg.isUnique && isOwned(cfg, stat);
      if (disabled) {
        entry.classList.add("disabled");
        tiersContainer.style.display = "none";
      }

      // toggle behavior for the top row
      top.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (entry.classList.contains("disabled")) return;
        const isOpen = tiersContainer.style.display === "flex";
        // close other open tier lists
        Array.from(panel.querySelectorAll('.kb-up-tierlist')).forEach((c) => (c.style.display = "none"));
        if (!isOpen) {
          tiersContainer.innerHTML = "";
          const allowed = getAllowedTiers(cfg);
          allowed.forEach((t) => {
            const tb = makeTierButton(stat, cfg, t);
            tiersContainer.appendChild(tb);
          });
          tiersContainer.style.display = "flex";
          openStatName = stat;
        } else {
          tiersContainer.style.display = "none";
          openStatName = null;
        }
      });

      // if this stat should be expanded (preserve state)
      if (!disabled && stat === openStatName) {
        tiersContainer.innerHTML = "";
        const allowed = getAllowedTiers(cfg);
        allowed.forEach((t) => tiersContainer.appendChild(makeTierButton(stat, cfg, t)));
        tiersContainer.style.display = "flex";
      }

      entry.appendChild(tiersContainer);
      panel.appendChild(entry);
    });
  }

  // default: panel open
  panel.style.display = "block";
  rebuildPanel();

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!isDebugUIVisible()) return;
    const isShown = panel.style.display === "block";
    panel.style.display = isShown ? "none" : "block";
    if (!isShown) rebuildPanel();
  });

  document.body.appendChild(container);

  return {
    destroy() {
      container.remove();
    },
    element: container,
  };
}
