# Design system

The visual language of the menu: a dark espresso-brown ground, a single gold accent, and a
five-face type system split by script and by role.

## Palette

Everything is defined once in `:root` in [`site/css/main.css`](../site/css/main.css).

### Core

| Token | Value | Role |
|---|---|---|
| `--bg` | `#070503` | page ground — near-black with warm bias, never pure black |
| `--panel` | `#15100a` | card and tile surface |
| `--gold` | `#e2b340` | **the** accent — borders, rules, active states, price numerals |
| `--gold-2` | `#d4a017` | deeper gold for hovers and secondary emphasis |
| `--gold-3` | `#b8861a` | darkest gold, used where the accent sits on a light ground |
| `--gold-soft` | `#f0cc6a` | highlight gold, for text that must read as lit |
| `--cream` | `#f5e9cf` | primary text — off-white, deliberately not white |
| `--cream-dim` | `#cdbf9c` | secondary text, captions, metadata |
| `--muted` | `#897556` | tertiary: labels, footnote-scale Latin glosses |

Two decisions carry the whole thing. First, **text is cream, not white** — `#f5e9cf` against
`#070503` keeps the page reading as warm paper rather than a screen, and stops the gold from
looking like a neon sign next to pure white. Second, **the background is not `#000`** — a brown-
shifted near-black lets the photographs sit in the page instead of floating on a void.

The gold is used sparingly and structurally: hairline borders, ornamental rules, the price
column, and the active state of the language toggle. There are 45 references to `--gold` in
`main.css` and no second accent colour anywhere. A single accent is what keeps a dark, ornate
layout from reading as busy.

### Ambient washes

The ground is never flat. Two large radial gradients are layered on `body` — a gold wash at the
top-right (`rgba(226,179,64,.10)`) and a deeper one at the bottom-left — so the page has a light
source. Section surfaces step up from `--bg` (`#070503`) to `--panel` (`#15100a`), with borders
used only for hairline rules rather than as the primary separator.

### Dead tokens

Six of the fifteen declared tokens are never referenced: `--bg-2`, `--panel-2`, `--panel-3`,
`--line`, `--espresso`, `--shadow`. They are the skeleton of a more systematic version that was
never finished — the values they name are hard-coded at their call sites instead. Worth
consolidating; listed in [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #6.

## Typography

Five faces, assigned by script and role — not by size alone.

| Face | Weight(s) | Role |
|---|---|---|
| **Cairo** | 400, 700, 900 | Arabic display — the hero line, category titles |
| **Tajawal** | 400, 500, 700, 900 | Arabic body — the `body` default, item names, descriptions |
| **Cormorant Garamond** | 500, 600, 700 | Latin display and editorial text — the italic English subtitles |
| **Cinzel** | 500, 700 | Latin small-caps accents — `QAR`, numerals, section indices, uppercase buttons |
| **Inter** | 400, 500, 600, 700 | Latin UI — the EN toggle, jump bar, fallback body |

The Arabic/Latin split is the important one. A single Latin face cannot render Arabic at all, and
forcing Arabic through a Latin serif produces the ugly mixed-script fallback where digits and
diacritics come from a different family than the letters around them. Declaring `font-family:
'Tajawal','Inter',system-ui,sans-serif` means each script is served by a face designed for it, from
the same page load.

Body stacks always end in `system-ui, sans-serif`. That is not decoration — it is the reason the
delivered bundle stayed legible while carrying a font bug (see [KNOWN-ISSUES.md](KNOWN-ISSUES.md)
#1): when the `@font-face` sources failed to resolve, the browser fell back to the system Arabic
face rather than to a generic one.

### Scale

Display sizes are fluid with `clamp()`, so the hero holds its proportion from a phone to a
projector without a breakpoint:

```css
font-size: clamp(40px, 6.5vw, 92px);   /* hero line */
font-size: clamp(34px, 5.6vw, 76px);   /* story heading */
font-size: clamp(46px, 6vw, 80px);     /* category title */
font-size: clamp(36px, 5vw, 56px);     /* section heading */
```

Body text is fixed — 16px base, 19px item names, 11–13px metadata — because the fluid values are
only for display type. Letting body text scale with viewport width is how menus end up unreadable
on a phone.

### Script-aware typography — the interesting part

Latin and Arabic are not styled with one scale and a different font. `main.css` carries **37
`html[lang="ar"]` rules** against only 4 for `html[lang="en"]`, because Arabic needs corrections
that a Latin-first scale never produces:

```css
.item-name{ font-size:19px; font-weight:500 }
html[lang="ar"] .item-name{ font-size:22px; font-weight:700 }

.item-meta{
  font-size:11px; letter-spacing:.2em; text-transform:uppercase;
  font-family:'Cinzel',serif;
}
html[lang="ar"] .item-meta{
  font-family:'Tajawal',sans-serif; font-size:13px;
  letter-spacing:0; text-transform:none;
}
```

Three separate things are being fixed at once:

1. **Optical size and weight.** In this page Arabic runs 15–18% larger than the Latin it replaces
   (19px → 22px item names, 11px → 13px metadata) and a step heavier in weight, because the script
   has more vertical movement and less x-height contrast, so it reads lighter at equal size.
2. **`letter-spacing: 0`.** Seven of the overrides kill tracking outright. Letterspacing is the
   default decorative device in Latin design, and in Arabic it breaks the cursive joins between
   letters — the script stops being Arabic. The wide-tracked `.2em` labels are a Latin-only
   flourish here.
3. **`text-transform: none`.** Arabic has no case, so `uppercase` is meaningless on it. It is a
   harmless no-op in the renderer, but leaving it in would encode a Latin-only assumption in every
   label, so the overrides clear it explicitly.

The same overrides also swap the *face*, not just the metrics: `Cinzel` and `Cormorant` are Latin
display faces, so Arabic labels move to `Tajawal` and Arabic headings to `Cairo`. A display face
applied to a script it was never drawn for produces the worst kind of typographic error — it
renders, but looks wrong to every native reader.

## Motion

Seven `@keyframes`, all infinite, all decorative:

| Animation | Duration | What it does |
|---|---|---|
| `beanFall` | `var(--d, 20s)` | the ambient coffee-bean field drifting down |
| `bubble` | 4s | bubbles rising in the story ring |
| `splashSpin` | 18s | preloader ring rotation |
| `hmSpin` | 30s / 60s reverse | counter-rotating rings around the logo |
| `storySpin` | 30s / 60s reverse | the same counter-rotation in the story block |
| `steam` | 3.4s ease-in-out | steam rising from the cup |
| `ribbonScroll` | 40s linear | the marquee band |

The ambient field is data-driven rather than hard-coded. Each bean is an empty `<span>` carrying
its own parameters inline:

```html
<span style="--x:32%;--d:28s;--s:14px;--o:.6"></span>
```

so position, duration, size and opacity are per-instance, and adding or removing beans is a markup
edit with no CSS change. Two elements sharing a keyframe desynchronise naturally because their
durations differ.

Counter-rotation is the one genuinely nice touch: pairing `hmSpin 30s` with
`hmSpin 60s linear reverse` on two nested rings gives a slow mechanical movement that reads as
craft rather than as a screensaver.

Reveals are handled separately by a single `IntersectionObserver` — see
[ARCHITECTURE.md](ARCHITECTURE.md#interaction).

**Gap:** there is no `prefers-reduced-motion` query anywhere in the CSS. Seven infinite
animations on a page a customer stares at for two minutes is a real vestibular and battery
problem. Known issue #5.

## Layout and RTL

The page ships as `<html lang="ar" dir="rtl">` and is written RTL-first — English is the alternate
view, not the default. Sections are CSS grid throughout, with the menu in a two-column
`.cat-grid` that collapses to `.single` for categories of three items or fewer.

Mirroring is delegated to the browser: setting `dir` reverses flex and grid flow, text alignment
and table order automatically. Only 11 selectors in `main.css` are `[dir="rtl"]` / `[dir="ltr"]`
scoped, and they exist for the places a physical direction was unavoidable — asymmetric paddings
on the price leader, the marquee's travel direction, and the dotted rule under each item name:

```css
.item-name{ background:#070503; padding-right:10px }
[dir="rtl"] .item-name{ padding-right:0; padding-left:10px }
```

That pair is the pattern to follow: write the LTR rule, then mirror the one physical property that
actually needs it, rather than maintaining two full stylesheets.

### Breakpoints

Three, all max-width:

| Breakpoint | Behaviour |
|---|---|
| `1100px` | top nav collapses; value cards to 2-up; feature grid, story and CTA to one column; gallery tiles re-span |
| `880px` | hero to one column and centred; **menu grid to a single column**; item names down to 17px (Arabic 20px); gallery to 2-up; footer to 2-up |
| `480px` | hero title 38px, gallery and footer to one column |

The menu going single-column at 880px rather than 480px is deliberate: two columns of dotted-leader
menu rows get unreadable well before the viewport gets narrow, because the leader is what ties the
name to its price and it collapses when the column is short.

Worth noticing that the script relationship **inverts** at `480px`:

```css
.hero-title{ font-size:38px }
html[lang="ar"] .hero-title{ font-size:34px; line-height:1.5 }
```

On desktop Arabic is the larger of the pair; on a phone it becomes the smaller, with extra leading.
The Arabic hero line is longer in characters than its English counterpart, so at a shared size it
would wrap to more tight lines — scaling it down and adding leading keeps it to two. A single fluid
`clamp()` cannot express that, because the two scripts want different things at the same width.

Plus `@media print`, which hides the splash, the bean field, the ribbon, the language toggle, the
nav, the jump bar, the gallery, the story art, the CTA strip and the value cards, then flips to a
white ground with black text and tight padding. What is left is the menu list alone — the page
prints as a paper sheet, which a cafe genuinely needs since the same URL is used at the counter.

## Iconography and ornament

Fourteen inline SVGs carry the icons and ornaments. They are stroke-drawn with
`stroke="currentColor"` and `fill="none"`, so they inherit the gold from the parent's `color` and
need no duplicate light/dark assets. Stroke weights vary by size — from `.8` on fine ornamental
rules up to `2.5` on small icons that would otherwise disappear — which is the correct instinct:
stroke weight should track optical weight, not be a single global number.

The brand logo itself is a raster (`img/logo-rashfa.jpg`, 1024×1024) reused at four places on the
page rather than a redrawn vector, and the corner brackets, ornamental dividers and section index
numerals (`01 /`, `02 /`) are CSS and text rather than images.
