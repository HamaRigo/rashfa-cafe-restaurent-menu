/* =========================================================
   RASHFA CAFE · render + interactions
   Reads MENU from menu-data.js, then wires up language,
   the jump bar and scroll reveals.
   ========================================================= */

function priceMarkup(qar){
  const whole = Math.trunc(qar);
  const cents = (qar % 1) === 0 ? ".00" : ("." + String(Math.round((qar - whole) * 100)).padStart(2,"0"));
  return `<span class="cur">QAR</span><span class="num">${whole}</span><span class="cents">${cents}</span>`;
}

// ---------- render ----------
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
