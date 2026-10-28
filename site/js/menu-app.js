/* =========================================================
   RASHFA CAFE · render + interactions
   Reads MENU from menu-data.js, then wires up language,
   the jump bar and scroll reveals.

   Loaded at the end of <body>, after menu-data.js. Everything is
   global by design — there is no module system in a file that has
   to run from a double-clicked HTML page — so MENU is read straight
   off the window and the four init* functions are called once, from
   init() at the bottom.

   The page is Arabic-first: it ships lang="ar" dir="rtl" in the HTML
   and setLang() only ever moves it away from that. Do not assume the
   DOM is in the language the file was written in.
   ========================================================= */

/**
 * Split a price into the three pieces the design styles separately:
 * the currency label, the amount, and the decimals.
 *
 * Prices in menu-data.js are bare numbers (14, or 14.5) so the currency
 * and the typography live here and nowhere else. Changing "QAR" changes
 * every generated row — but not the three hand-written prices in the
 * signature cards in index.html, which are literal text.
 *
 * @param {number} qar price in Qatari Riyals
 * @returns {string} markup for .item-price, e.g. <span class="cur">QAR</span>…
 */

function priceMarkup(qar){
  const whole = Math.trunc(qar);
  const cents = (qar % 1) === 0 ? ".00" : ("." + String(Math.round((qar - whole) * 100)).padStart(2,"0"));
  return `<span class="cur">QAR</span><span class="num">${whole}</span><span class="cents">${cents}</span>`;
}

// ---------- render ----------
/**
 * Build all five menu sections into #menu from the MENU array.
 *
 * The whole menu is generated, so nothing in it exists for a crawler or a
 * no-JS visitor (KNOWN-ISSUES #3). Category ids emitted here are the scroll
 * targets of the hero jump bar in index.html; renaming one breaks that link
 * silently, which is what tools/verify.py checks for.
 *
 * Two behaviours worth knowing before editing the template:
 *  - `cat.items.length <= 3` adds the `single` class, so short categories
 *    become one column without any CSS being touched.
 *  - `it.hot` is the only optional flag; it adds the gold star.
 *
 * Side effect: replaces #menu's innerHTML, discarding any placeholder.
 */
function renderMenu(){
  const root = document.getElementById("menu");
  const html = MENU.map(cat => {
    const items = cat.items.map(it => `
      <div class="item ${it.hot ? 'hot' : ''}">
        <div class="item-text">
          <div class="item-name">
            <span class="t-ar">${it.ar}</span>
            <span class="t-en">${it.en}</span>
          </div>
          <div class="item-meta">
            <span class="t-ar">${it.metaAr}</span>
            <span class="t-en">${it.metaEn}</span>
          </div>
        </div>
        <div class="item-lead"></div>
        <div class="item-price">${priceMarkup(it.price)}</div>
      </div>
    `).join("");

    return `
      <section id="${cat.id}" class="cat">
        <header class="cat-head">
          <div class="cat-head-l">
            <span class="cat-num">${cat.num} /</span>
            <h2 class="cat-title">
              <span class="t-ar">${cat.titleAr}</span>
              <span class="t-en">${cat.titleEn}</span>
            </h2>
          </div>
          <div class="cat-sub">
            <span class="t-ar">${cat.subAr}</span>
            <span class="t-en">${cat.subEn}</span>
          </div>
        </header>
        <div class="cat-grid ${cat.items.length <= 3 ? 'single' : ''}">${items}</div>
      </section>
    `;
  }).join("");
  root.innerHTML = html;
}

// ---------- language toggle ----------
/**
 * Switch the page between Arabic and English.
 *
 * Two things happen and they must stay coupled: the documentElement's
 * lang/dir attributes are rewritten — which reactivates the ~37
 * `html[lang="ar"]` typography rules and the `[dir="rtl"]` mirrored
 * geometry — and `.t-ar` / `.t-en` spans are swapped by CSS visibility
 * rather than by this function touching text.
 *
 * Remembers the choice in localStorage under `rashfa-lang`. That key is
 * write-only across reloads: it is applied on load, so a visitor returns
 * to the page in the language they left it in.
 *
 * @param {"ar"|"en"} lang
 */
function setLang(lang){
  const html = document.documentElement;
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  const wrap = document.querySelector(".lang-toggle");
  wrap.setAttribute("data-active", lang);
  wrap.querySelectorAll("button").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  try { localStorage.setItem("rashfa-lang", lang); } catch(e){}
}

/**
 * Wire the two toggle buttons and restore the saved language.
 *
 * Defaults to "ar" when localStorage is empty or unavailable — private
 * mode and file:// contexts can throw on access, hence the try/catch
 * rather than a direct read.
 */
function initLangToggle(){
  const wrap = document.querySelector(".lang-toggle");
  wrap.setAttribute("data-active", "ar");
  wrap.querySelectorAll("button").forEach(b => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });
  let saved = "ar";
  try { saved = localStorage.getItem("rashfa-lang") || "ar"; } catch(e){}
  setLang(saved);
}

// ---------- smooth-scroll jump bar ----------
/**
 * Make the hero's category links scroll instead of jump.
 *
 * Offsets by 80px so the section heading clears the sticky topbar; that
 * magic number is the topbar's height and needs to change with it.
 * Unknown ids return early without preventDefault, so a typo degrades to
 * the browser's own anchor behaviour instead of doing nothing at all.
 */
function initJumpbar(){
  document.querySelectorAll('.hero-jumpbar a').forEach(a => {
    a.addEventListener("click", e => {
      const id = a.getAttribute("href").slice(1);
      const tgt = document.getElementById(id);
      if (!tgt) return;
      e.preventDefault();
      window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    });
  });
}

// ---------- reveal on scroll ----------
/**
 * Fade and lift feature cards and value rows in as they enter view.
 *
 * Adds the `rv` class at runtime rather than leaving it in the HTML, so
 * content is visible by default and only animates when this script
 * actually runs. Bails out entirely without IntersectionObserver, which
 * leaves every element in its plain visible state — the correct
 * degradation, not a broken one.
 *
 * Each element is unobserved after revealing, so the class is not
 * re-applied when a card scrolls back out and in.
 *
 * Note there is no `prefers-reduced-motion` check anywhere on this page
 * (KNOWN-ISSUES #5).
 */
function initReveal(){
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting){
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: "0px 0px -80px 0px" });
  document.querySelectorAll(".fcard, .value").forEach(el => {
    el.classList.add("rv");
    io.observe(el);
  });
}

/**
 * Entry point.
 *
 * renderMenu() leads because it is the only step that creates DOM. The other
 * three do not strictly depend on it — the jump bar links, the toggle buttons
 * and everything initReveal() observes (.fcard, .value) are static markup in
 * index.html — and language switching is document-level CSS rather than
 * per-element wiring, so it would apply to generated rows either way. The
 * order is kept as render-then-bind because that is the direction a reader
 * expects, not because a reordering would break something.
 */
function init(){
  renderMenu();
  initLangToggle();
  initJumpbar();
  initReveal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
