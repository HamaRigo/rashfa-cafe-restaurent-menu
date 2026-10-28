# Architecture

How the page is put together, and why the boundaries sit where they do.

## The shape of it

`site/` is a static, framework-free single page. Three files do the structural work and are
loaded in a fixed order:

```
index.html          structure + the pre-rendered sections
   ├─ css/photo-integration.css   (2 KB)  photo-aware overrides, with !important on the crops
   ├─ css/main.css               (43 KB)  design system + all 14 page sections
   ├─ Google Fonts sheet                  Cairo · Tajawal · Inter · Cormorant Garamond · Cinzel
   └─ js/photo-focal.js          (10 KB)  owner-facing crop tool   — independent of the menu
      js/menu-data.js             (9 KB)  MENU: 5 categories, 43 items   — no DOM access
      js/menu-app.js              (4 KB)  render + interactions          — reads MENU
```

The two stylesheets keep the order they had as inline blocks in the delivered file, which is why
the small photo-override sheet comes first and `main.css` — with the real design system — last.

Load order matters in exactly one place: `menu-app.js` reads the global `MENU` declared by
`menu-data.js`, so data must be parsed first. Both are plain end-of-`<body>` scripts (no `defer`,
no modules) so they execute in document order, which is the simplest thing that can be correct —
and the reason `bundle.py` emits them as separate manifest entries instead of merging them.

## The one real boundary: data vs. behaviour

`MENU` is an array of five category objects:

```js
{
  id: "coffee", num: "01",
  titleAr: "القهوة", titleEn: "Coffee",
  subAr: "حبوب مختارة، تحميص يومي", subEn: "Hand-picked beans · roasted daily",
  items: [
    { ar: "كابتشينو", en: "Cappuccino",
      metaAr: "إسبرسو + حليب مبخر", metaEn: "espresso · steamed milk",
      price: 14, hot: true },
    …
  ]
}
```

`id` drives the anchor target for the jump bar; `num` is the typographic index; `hot` marks the
eight chef-favourite items that get a star. Prices are plain integers in QAR — no `14.00`, no
`"14 QAR"` — because formatting is a presentation concern and belongs in `priceMarkup()`, not in
the data.

Splitting data from behaviour is what makes a price change a one-file, zero-risk edit. It is also
what lets `verify.py` assert structural invariants (every jump-bar link resolves to a real
category id) by reading the data file rather than a rendered DOM.

## Rendering

`renderMenu()` maps `MENU` to a string of HTML and assigns it to `#menu` in one shot. There is no
virtual DOM, no incremental update, and no need for either: the menu is written once at load and
never mutated afterwards. 43 items is a few milliseconds of string building.

Each item is emitted as name + meta + a dotted leader + a price:

```html
<div class="item hot">
  <div class="item-text">
    <div class="item-name"><span class="t-ar">كابتشينو</span><span class="t-en">Cappuccino</span></div>
    <div class="item-meta"><span class="t-ar">…</span><span class="t-en">…</span></div>
  </div>
  <div class="item-lead"></div>
  <div class="item-price"><span class="cur">QAR</span><span class="num">14</span><span class="cents">.00</span></div>
</div>
```

The three-part price split exists so the currency word, the integer and the decimals can each be
styled differently — `QAR` small and letterspaced, the amount large in Cinzel, the cents dimmed.
`cat-grid` gains a `single` class when a category has three or fewer items (Tea, Cold Drinks), so
short sections go to one column instead of stranding an awkward last row.

## Language

`setLang(lang)` does four things and no re-render:

```js
documentElement.setAttribute("lang", lang);
documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
langToggle.dataset.active = lang;          // CSS hooks the buttons off this
localStorage.setItem("rashfa-lang", lang); // survives reload
```

Because both translations are already in the DOM as `.t-ar` / `.t-en` sibling spans, flipping the
language is a pure CSS visibility change — 62 of each in the static markup, plus the pairs
`renderMenu()` emits per item. Setting `dir` on the root is what makes the browser mirror the
entire flow: flex directions, text alignment and the marquee all reverse without a line of
JavaScript knowing about it. Only 11 `[dir="…"]` rules in `main.css` override that default
mirroring, for cases where a physical direction was hard-coded.

`initLangToggle()` restores the saved preference and defaults to Arabic. The document itself
ships as `<html lang="ar" dir="rtl">`, so the first paint is already correct RTL and there is no
flash of the wrong direction.

## Interaction

| Concern | Mechanism |
|---|---|
| Jump bar | `preventDefault` + `window.scrollTo({behavior:"smooth"})` with a `-80px` offset to clear the sticky top bar |
| Scroll reveals | one `IntersectionObserver` (`threshold 0.05`, `rootMargin "0px 0px -80px"`) adds `.in` and immediately `unobserve`s |
| Reveal targets | `.fcard`, `.value` — get `.rv` applied by JS, not in markup |
| Photo crops | `photo-focal.js` sets `element.style.objectPosition` from a slider, persisted to `localStorage` |

Two details worth calling out. The reveal class is added by JavaScript rather than being written
into the HTML, so if the script fails the content is simply visible instead of invisible — a
failing dependency degrades to "no animation" rather than "blank page". And the observer
unobserves after firing, so reveals never replay on scroll-up, which for a menu you scan up and
down would be actively annoying.

`photo-focal.js` is entirely self-contained: it builds its own panel, injects its own stylesheet,
and registers a `window.message` listener so a host frame can toggle it with
`__activate_edit_mode` / `__deactivate_edit_mode`, replying `__edit_mode_available` once its own
listener is live. It touches nothing the menu depends on.

## Sections

`main.css` is organised into 14 banner-commented sections that map 1:1 to the markup:

```
PRELOADER / SPLASH · AMBIENT BEANS · TOP BAR · HERO · RIBBON MARQUEE · VALUE PROPS
ORNAMENTAL DIVIDER · MENU · STORY · GALLERY · CTA STRIP · FOOTER · REVEAL · RESPONSIVE
```

Only `MENU` is generated. Everything else is static HTML, which keeps the JS small and means the
page's visual identity is present in the markup before any script runs.

## Build pipeline

`site/` is source; `dist/rashfa-cafe-menu.html` is a build output. Both directions are
implemented, which is what makes the split maintainable:

```
tools/unpack.py    delivered single file  →  site/     (one-off, to recover the source)
tools/bundle.py    site/                  →  dist/     (repeatable, byte-deterministic)
tools/verify.py    consistency + headless render assertions
```

`bundle.py` inlines the two linked stylesheets back into `<style>` blocks (the shipped format keeps
CSS inline, not as manifest assets), assigns each remaining local reference a `uuid5` derived from
its path, gzips the text assets, base64s everything into the manifest, and wraps the result in the
loader shell kept at `tools/loader-head.html`.

Because the UUIDs are derived rather than random, rebuilding an unchanged `site/` reproduces the
identical file — so `dist/` can be committed and a diff of it means something.

See [BUNDLE-FORMAT.md](BUNDLE-FORMAT.md) for the container itself.

## What I would change

- **Pre-render the menu into the HTML** and let the JS take over progressively, so prices are in
  the source for SEO and for no-JS contexts. See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #3.
- **Resize `gallery-3-warm-light.jpg`** — 2.4 MB for one tile, and 78% of the whole payload.
- **Self-host the fonts** if the file is genuinely meant to work offline; the current source
  version depends on the network for typography.
- **Add `prefers-reduced-motion`** — there are seven infinite animations and no opt-out anywhere
  in the CSS today. The decorative layers do carry `aria-hidden="true"` (17 instances) and every
  photograph has descriptive `alt` text, so the static accessibility story is fine; it is the
  motion that needs the escape hatch.
