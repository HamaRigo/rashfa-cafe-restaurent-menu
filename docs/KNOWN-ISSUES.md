# Known issues

Everything here was found by reading and rendering the delivered artifact, and each item is
measured rather than felt. Nothing has been silently patched into the source: where a fix is
applied it is applied in `site/` and marked, so the divergence from what the client received stays
visible.

---

## 1. The delivered bundle lost its typography · fixed in source

**Severity:** visual, silent · **Status:** fixed in `site/`, still present in the client's file

The shipped single-file HTML contains 74 `@font-face` `src:` rules that point at UUID placeholders
which were **never added to the manifest**. The loader only substitutes placeholders it has an entry
for, so those strings survive into the live CSS as literal text:

```css
@font-face{
  font-family:'Cairo'; font-weight:900;
  src: url("4a31692f-dfe9-4cde-9ee8-d04caefee7e2") format('woff2');
}
```

`4a31692f-…` is not a key in `__bundler/manifest`. The browser resolves it as a relative URL, gets a
404 or a `file://` miss, and discards the face. Every font on the page then falls through to
`system-ui` — on macOS that means Geeza Pro for Arabic and the system sans for Latin.

**How it was found:** rendering the delivered file headlessly and dumping the DOM, then diffing
against the unpacked source. The count is exact — 74 dangling `url("<uuid>")` references in the
rendered document, 0 in the rebuilt one.

**Why it is silent:** the page looks *fine*. The font stacks all end in `system-ui, sans-serif`, so
the fallback is competent, correctly-directed Arabic rather than a broken box. Nothing throws; the
`window` error handler in the loader never fires. A typography regression on a premium restaurant
menu that nobody notices until someone compares it against the design on a different OS.

**Fix applied:** `site/index.html` links a live Google Fonts sheet carrying exactly the five families
and the weights the original `@font-face` rules asked for (Cairo 400/700/900, Tajawal 400/500/700/900,
Inter 400/500/600/700, Cormorant Garamond 500/600/700, Cinzel 500/700). That sheet is generated from
the parsed `@font-face` rules by `tools/unpack.py`, not hand-written.

The original rules are kept, unlinked, at [`site/css/fonts.embedded.css`](../site/css/fonts.embedded.css)
so the defect remains inspectable. `tools/verify.py --browser` asserts the count is zero.

**Trade-off accepted:** the source version needs the network for type, so it is no longer fully
offline. For a QR-code menu scanned in the venue that is the right call, and the images — the bulk
of the payload — still resolve offline. Self-hosting the five families would restore both; see #7.

---

## 2. One photograph is 78% of the payload · not fixed

**Severity:** performance · **Status:** open, deliberately

```
site/img/gallery-3-warm-light.jpg   2268 × 4032   2.4 MB
site/img/signature-turkish.jpg       736 ×  935    90 KB
site/img/gallery-4-seats.jpg         ~            89 KB
site/img/logo-rashfa.jpg           1024 × 1024     67 KB
site/img/gallery-2-foam.jpg          ~             7 KB
```

Every other image on the page is 7–92 KB. This one is a raw phone export, unresized and
unconverted, displayed inside a gallery tile that is at most a few hundred pixels wide. It is
**2.4 MB of the 3.0 MB asset payload**, and it is inlined as base64 in the single-file build — which
inflates it by another ~33%, so that one photograph is what pushes the deliverable over 4 MB.

The fix is one command and would cut the deliverable roughly in half:

```bash
sips --resampleWidth 900 -s format webp -s formatQuality 80 \
     site/img/gallery-3-warm-light.jpg --out site/img/gallery-3-warm-light.webp
```

**Why it is not fixed here:** this is the client's delivered artifact and the photograph is their
brand asset. Silently re-encoding a photo in a portfolio reproduction would misrepresent what was
actually shipped. It is recorded as a measured finding instead.

---

## 3. The menu is JS-rendered, so it is invisible to crawlers and to no-JS

**Severity:** functional, context-dependent · **Status:** open by design

`#menu` is an empty container in the HTML. All 43 items and all their prices are built by
`renderMenu()` at `DOMContentLoaded`. In the rendered DOM they are present (verified: 43 items,
5 categories); in the source they are absent.

For the actual use case — a QR code on a table, opened by a customer in a cafe — this costs nothing.
Prices are not something anyone searches for, and the JS is 13 KB with no network dependency.

It is wrong in three other contexts:
- **SEO / rich snippets** — a Google crawler indexing the page sees a menu-shaped hole.
- **JS disabled or blocked** — the page renders every section *except* the menu, which is the point
  of the page. There is no `<noscript>` fallback.
- **Accessibility tooling and read-out modes** that parse source rather than live DOM.

The fix is to pre-render the menu into `index.html` and let the script take over from there — the
markup it generates is deterministic, so the static HTML and the JS output can be kept identical.
That is the highest-value change on this list.

---

## 4. Focal-point adjustments do not survive a rebuild · documentation gap

**Severity:** minor, expectation-setting · **Status:** open

`photo-focal.js` writes the owner's crop adjustments to `localStorage` under `rashfa-photo-focal`,
so they persist across reloads **on that device**. The script's own header comment claims positions
"bake into bundles".

They do not bake into a bundle produced by `tools/bundle.py`. That tool packs the source files; it
does not read a live DOM or a browser's storage. An adjustment made on the owner's phone will not
appear in a file rebuilt from `site/`, and will not transfer to any other device.

Two honest options: treat the sliders as an on-device preview tool and correct the comment, or make
the focal values serialise into a data attribute that `bundle.py` folds back into the source. The
second is the more useful product and is not hard — the values are already a flat key/number map.

---

## 5. No `prefers-reduced-motion` · open

**Severity:** accessibility · **Status:** open

Seven `@keyframes` animations run infinitely: the bean field, bubbles, two counter-rotating ring
pairs, a preloader spin, steam, and a 40-second marquee. There is no `prefers-reduced-motion` query
anywhere in the CSS, and no manual way to stop them.

For a page a customer stares at for two minutes while deciding, this is a real vestibular concern
and a real battery cost on phones. The fix is small and standard:

```css
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
  }
  .beans{display:none}
}
```

The static accessibility story is otherwise reasonable — 17 `aria-hidden="true"` attributes on the
decorative layers, descriptive `alt` text on every photograph, and the language toggle is real
`<button>` elements. Motion is the gap.

---

## 6. Six dead design tokens · open

**Severity:** maintainability · **Status:** open

Declared in `:root`, never referenced: `--bg-2`, `--panel-2`, `--panel-3`, `--line`, `--espresso`,
`--shadow`. The values they name are hard-coded at their call sites instead — `background:#070503`
appears literally inside `.item-name`, for instance, duplicating `--bg`.

Six of fifteen tokens unused is a signal that the token layer was set up and then not enforced.
Either fold the literals back into the tokens or delete the unused ones; the current state is the
worst option, because it looks like a system that cannot be trusted.

---

## 7. Font requests are render-blocking

**Severity:** performance · **Status:** accepted

`index.html` ships `<link rel="preconnect">` for `fonts.googleapis.com` and `fonts.gstatic.com`,
plus the stylesheet link. `font-display: swap` is set in the original `@font-face` rules, so text
paints immediately in the fallback and re-renders when the faces arrive — no invisible text. The
cost is a visible reflow of the Arabic display type on a slow connection, which on a hero headline
is noticeable.

Subsetting to the two scripts actually used (Arabic + Latin) and self-hosting woff2 would fix #1 and
this at the same time.

---

## 8. Bundle fails soft per asset, hard on structure

**Severity:** robustness · **Status:** inherent to the format

The loader has two very different failure modes, and only one of them is visible:

- **A single asset that will not decode fails soft.** The per-asset `try/catch` logs to the console
  and substitutes an empty `Blob` of the right MIME type, so the page still renders with that one
  image blank. Good — a corrupt photo should not take down a menu.
- **A malformed `manifest` or `template` fails hard.** Those are read with `JSON.parse` inside the
  outer `try`, so a single bad character means nothing is ever substituted: the loader stops at
  `setStatus('Error unpacking: …')` and the viewer sees the shell's loading pill and nothing else.
  The whole page is hostage to one JSON string.
- **A placeholder with no manifest entry fails silently** — the UUID survives into the output as
  literal text. Visible for an `<img>`, invisible inside a CSS `url()`. That is issue #1.

The substitution itself is also one pass over the entire template, so there is no progressive
render: nothing appears until every asset has decoded.

This is a property of the format rather than of this page, and it is why `tools/verify.py --browser`
exists: a build that does not render is the failure mode the format hides worst, and a static check
cannot see it.

See [BUNDLE-FORMAT.md](BUNDLE-FORMAT.md#known-weaknesses-of-the-format).

---

## Priority if this were picked up again

| # | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Pre-render the menu into HTML (#3) | small | high |
| 2 | Resize `gallery-3-warm-light.jpg` (#2) | trivial | high |
| 3 | Add `prefers-reduced-motion` (#5) | trivial | medium |
| 4 | Self-host subset fonts (#1, #7) | medium | medium |
| 5 | Reconcile dead tokens (#6) | small | low |
| 6 | Make focal tweaks survive rebuilds (#4) | medium | low |
