/* =========================================================
   RASHFA · Photo focal-point tweaker
   Lets the user shift each baked photo up/down/left/right
   without touching CSS. Persists to localStorage so
   positions survive reload on this device.

   They do NOT bake into bundles: tools/bundle.py reads the values
   out of index.html and CSS, and localStorage belongs to whichever
   browser last used the panel. A tweak made here is invisible on a
   phone and is not carried into the file handed to the client —
   see docs/KNOWN-ISSUES.md #4.

   Wrapped in an IIFE, so nothing here is reachable from the console
   or from a host page. The only public surface is the message
   listener in init(): postMessage {type:"__activate_edit_mode"} to
   open the panel, "__deactivate_edit_mode" to close it. The script
   announces "__edit_mode_available" to window.parent on load, which
   is how the editor host discovers that this page can be edited.

   Two facts to hold before editing TARGETS:
    - every `sel` must match an element in index.html, or its slider
      silently does nothing (applyAll skips nulls). tools/verify.py
      asserts this, because six rows shipped pointing at classes that
      did not exist — docs/KNOWN-ISSUES.md #9.
    - one axis per row, so a photo that needs both X and Y control has
      two rows sharing the same `sel` (see mojito_x / mojito_y).
   ========================================================= */

(() => {
  /**
   * Focal points as percentages, one entry per axis in TARGETS.
   * `*_x` and `*_y` become object-position on that image; 50 is centred.
   * Overridden wholesale by anything stored under STORAGE_KEY, and
   * restored per-key by the panel's "Reset all".
   */
  const DEFAULTS = {
    "beans_y": 45,
    "foam_y": 35,
    "light_y": 65,
    "seats_y": 30,
    "juice_y": 40,
    "night_y": 72,
    "mojito_x": 38,
    "mojito_y": 50,
    "turkish_x": 50,
    "turkish_y": 50,
    "avocado_x": 50,
    "avocado_y": 50
  };

  const STORAGE_KEY = "rashfa-photo-focal";

  // map: slider key → element selector + axis + label
  const TARGETS = [
    { key:"beans_y",    sel:".gtile-1 > img",        axis:"y", label:"Fresh beans ↕",      labelAr:"حبوب طازجة ↕"    },
    { key:"foam_y",     sel:".gtile-2 > img",        axis:"y", label:"Silky foam ↕",       labelAr:"رغوة حريرية ↕"   },
    { key:"light_y",    sel:".gtile-3 > img",        axis:"y", label:"Warm light ↕",       labelAr:"ضوء دافئ ↕"      },
    { key:"seats_y",    sel:".gtile-4 > img",        axis:"y", label:"Slow seats ↕",       labelAr:"جلسة ممتدة ↕"    },
    { key:"juice_y",    sel:".gtile-5 > img",        axis:"y", label:"Cold pressed ↕",     labelAr:"عصير طبيعي ↕"   },
    { key:"night_y",    sel:".gtile-6 > img",        axis:"y", label:"Late nights ↕",      labelAr:"ليلة طويلة ↕"    },
    { key:"mojito_x",   sel:".sig-mojito > img",     axis:"x", label:"Mojito ←→",          labelAr:"موهيتو ←→"       },
    { key:"mojito_y",   sel:".sig-mojito > img",     axis:"y", label:"Mojito ↕",           labelAr:"موهيتو ↕"        },
    { key:"turkish_x",  sel:".sig-turkish > img",    axis:"x", label:"Turkish coffee ←→",  labelAr:"قهوة تركية ←→"   },
    { key:"turkish_y",  sel:".sig-turkish > img",    axis:"y", label:"Turkish coffee ↕",   labelAr:"قهوة تركية ↕"    },
    { key:"avocado_x",  sel:".sig-avocado > img",    axis:"x", label:"Avocado ←→",         labelAr:"أفوكاتو ←→"      },
    { key:"avocado_y",  sel:".sig-avocado > img",    axis:"y", label:"Avocado ↕",          labelAr:"أفوكاتو ↕"       },
  ];

  let FOCAL = {...DEFAULTS};

  // ---------- localStorage persistence ----------
  function loadFocal(){
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(FOCAL, parsed);
      }
    } catch(e){}
  }

  function saveFocal(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(FOCAL));
    } catch(e){}
  }

  // ---------- apply object-position from current FOCAL ----------
  /**
   * Paint the current FOCAL onto the images.
   *
   * Rows are grouped by resolved element first, because `object-position`
   * is a single declaration: setting X and Y in two passes would let the
   * second overwrite the first. An element missing from the page is
   * skipped without a word — the reason a dead selector is undetectable
   * from the UI.
   *
   * Writes inline styles only; the CSS defaults in main.css stay intact so
   * "Reset all" can fall back to DEFAULTS without needing to know them.
   */
  function applyAll(){
    // group axes per element so we set both X and Y in one shot
    const byEl = new Map();
    TARGETS.forEach(t => {
      const el = document.querySelector(t.sel);
      if (!el) return;
      const cur = byEl.get(el) || { x: 50, y: 50 };
      if (t.axis === "x") cur.x = FOCAL[t.key];
      else cur.y = FOCAL[t.key];
      byEl.set(el, cur);
    });
    byEl.forEach((pos, el) => {
      el.style.objectPosition = pos.x + "% " + pos.y + "%";
    });
  }

  // ---------- panel ----------
  // Built on first open, then reused: sliders are the only route to these
  // values, so there is no point paying for the DOM before it is shown.
  let panel = null;
  let isDragging = false;
  let dragOffset = {x:0, y:0};

  /**
   * Construct the panel: one range row per TARGETS entry, a reset button,
   * and a drag-by-header affordance so it can be moved out of the way on
   * small screens.
   *
   * Each row writes FOCAL on `input` (live, so the image tracks the thumb)
   * and persists on `change` (on release), which keeps localStorage writes
   * to one per drag rather than one per pixel.
   */
  function buildPanel(){
    panel = document.createElement("div");
    panel.id = "photo-tweaks-panel";
    panel.innerHTML = `
      <header class="ptk-header">
        <span class="ptk-drag-handle">⋮⋮</span>
        <span class="ptk-title">Photo positions</span>
        <button class="ptk-close" aria-label="Close">×</button>
      </header>
      <div class="ptk-rows"></div>
      <footer class="ptk-footer">
        <button class="ptk-reset">Reset all</button>
      </footer>
    `;
    const rows = panel.querySelector(".ptk-rows");
    TARGETS.forEach(t => {
      const row = document.createElement("label");
      row.className = "ptk-row";
      row.innerHTML = `
        <span class="ptk-lab">${t.label}</span>
        <input type="range" min="0" max="100" step="1" value="${FOCAL[t.key]}" data-key="${t.key}" />
        <output>${FOCAL[t.key]}%</output>
      `;
      const input = row.querySelector("input");
      const out = row.querySelector("output");
      input.addEventListener("input", () => {
        const v = parseInt(input.value, 10);
        FOCAL[t.key] = v;
        out.textContent = v + "%";
        applyAll();
      });
      input.addEventListener("change", () => {
        saveFocal();
      });
      rows.appendChild(row);
    });

    panel.querySelector(".ptk-close").addEventListener("click", () => {
      hidePanel();
      try { window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); } catch(e){}
    });

    panel.querySelector(".ptk-reset").addEventListener("click", () => {
      if (!confirm("Reset all photo positions to defaults?")) return;
      Object.assign(FOCAL, DEFAULTS);
      saveFocal();
      panel.querySelectorAll("input[type=range]").forEach(inp => {
        const k = inp.dataset.key;
        inp.value = FOCAL[k];
        inp.nextElementSibling.textContent = FOCAL[k] + "%";
      });
      applyAll();
    });

    // Dragging
    const handle = panel.querySelector(".ptk-header");
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".ptk-close")) return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      panel.style.transition = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        panel.style.transition = "";
      }
    });

    document.body.appendChild(panel);
  }

  function showPanel(){
    if (!panel) buildPanel();
    panel.classList.add("open");
  }
  function hidePanel(){
    if (panel) panel.classList.remove("open");
  }

  // ---------- styles ----------
  /**
   * Panel CSS, injected rather than kept in main.css.
   *
   * Deliberate: this script is a self-contained tool bolted onto the page,
   * and shipping its styles in the same file means deleting one file
   * removes the whole feature cleanly. Costs a <style> element at runtime
   * and puts 200 lines of CSS where a designer would not look for it.
   */
  function injectStyles(){
    const css = `
      #photo-tweaks-panel{
        position:fixed;
        right:20px;bottom:20px;
        width:360px;max-width:calc(100vw - 40px);
        background:rgba(12,8,5,.97);
        color:#f5e9cf;
        border:1px solid rgba(226,179,64,.4);
        border-radius:16px;
        box-shadow:0 40px 100px -30px rgba(0,0,0,.9), 0 0 0 1px rgba(226,179,64,.2);
        font-family:'Inter',system-ui,sans-serif;
        font-size:13px;
        z-index:99999;
        opacity:0;transform:translateY(16px);pointer-events:none;
        transition:opacity .3s, transform .3s;
        backdrop-filter:blur(16px);
      }
      #photo-tweaks-panel.open{opacity:1;transform:translateY(0);pointer-events:auto}
      [dir="rtl"] #photo-tweaks-panel{right:auto;left:20px}
      .ptk-header{
        display:flex;align-items:center;gap:10px;
        padding:14px 16px 12px;
        border-bottom:1px solid rgba(226,179,64,.2);
        cursor:move;user-select:none;
      }
      .ptk-drag-handle{
        color:rgba(226,179,64,.4);
        font-size:14px;line-height:1;letter-spacing:-2px;
      }
      .ptk-title{
        font-family:'Cinzel',serif;
        font-size:11px;letter-spacing:.26em;text-transform:uppercase;
        color:#e2b340;font-weight:600;flex:1;
      }
      .ptk-close{
        background:transparent;border:0;color:#f5e9cf;
        font-size:24px;line-height:1;cursor:pointer;
        width:28px;height:28px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        transition:background .2s;
      }
      .ptk-close:hover{background:rgba(226,179,64,.2)}
      .ptk-rows{
        padding:10px 4px 12px;
        max-height:50vh;overflow-y:auto;
      }
      .ptk-row{
        display:grid;
        grid-template-columns:130px 1fr 44px;
        align-items:center;
        gap:10px;
        padding:9px 16px;
        cursor:pointer;
      }
      .ptk-row:hover{background:rgba(226,179,64,.06)}
      .ptk-lab{
        font-size:12px;color:#f5e9cf;font-weight:500;line-height:1.3;
      }
      .ptk-row input[type="range"]{
        width:100%;accent-color:#e2b340;cursor:pointer;
      }
      .ptk-row output{
        font-family:'Cinzel',serif;
        font-size:11px;color:#e2b340;
        text-align:right;font-variant-numeric:tabular-nums;
      }
      .ptk-footer{
        padding:10px 16px 14px;
        border-top:1px solid rgba(226,179,64,.15);
        display:flex;justify-content:center;
      }
      .ptk-reset{
        background:transparent;
        border:1px solid rgba(226,179,64,.3);
        color:#e2b340;
        padding:7px 18px;border-radius:8px;
        font-size:11px;letter-spacing:.08em;text-transform:uppercase;
        cursor:pointer;transition:all .2s;
        font-family:'Cinzel',serif;font-weight:600;
      }
      .ptk-reset:hover{
        background:rgba(226,179,64,.12);
        border-color:rgba(226,179,64,.5);
      }
    `;
    const s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ---------- edit-mode bridge ----------
  /**
   * Apply saved positions, then listen for the host's edit-mode signals.
   *
   * applyAll() runs unconditionally on load, before any panel exists:
   * positions saved on this device are applied to every visit, which is the
   * only way the tool's effect is ever visible to a normal visitor.
   */
  function init(){
    loadFocal();
    injectStyles();
    applyAll();

    window.addEventListener("message", (e) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "__activate_edit_mode") showPanel();
      if (d.type === "__deactivate_edit_mode") hidePanel();
    });

    // announce the toggle to the host AFTER the listener is live
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch(e){}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
