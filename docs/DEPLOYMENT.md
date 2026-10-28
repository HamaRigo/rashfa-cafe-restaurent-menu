# Deployment

Three ways to ship this, in the order you probably want them.

All of them start the same way — make sure the artefact matches the source:

```bash
python3 tools/verify.py     # must be all PASS
python3 tools/bundle.py     # regenerate dist/rashfa-cafe-menu.html
```

---

## 1. The single file (how it was delivered)

`dist/rashfa-cafe-menu.html` is the whole product: markup, three stylesheets, two scripts and every
photograph, in one self-contained file.

Send it, double-click it, drop it on a USB stick, put it in a WhatsApp thread. **It needs no server,
no build step and no network** — except for the typefaces, which load from Google Fonts, so a truly
offline page falls back to system fonts.

The trade-off is size: ~4 MB, of which 2.4 MB is one over-large photograph
([KNOWN-ISSUES.md](KNOWN-ISSUES.md) #2).

## 2. GitHub Pages (this repository)

Pushing to `main` runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

1. **Check source and rebuild the bundle** — static checks, rebuild `dist/` from `site/`, then fail
   if the committed `dist/` differs from the one CI just produced. A stale build cannot ship.
2. **Publish `site/` to GitHub Pages** — uploads the folder via `actions/deploy-pages`.

Pages is configured with `build_type: workflow`, so the workflow is the deployment mechanism and
there is no "deploy from branch" setting to keep in sync:

```bash
gh api repos/<owner>/<repo>/pages -X POST -f build_type=workflow
```

The site is served from `site/`, so **`dist/` is not published** — the Pages URL is the readable
multi-file build, which is what you want on the open web. Use the single file for offline handoffs.

## 3. Any static host

`site/` is already a finished static site. Copy it and it works:

```bash
rsync -a --delete site/ user@host:/var/www/rashfa/
```

No rewrite rules, no runtime, no database. The only requirement is that the server send
`.webp` with a usable content type — it will, with any default config.

**Sub-path installs work too.** Everything is referenced relatively (`css/main.css`, `img/logo.jpg`),
so hosting under `/menus/rashfa/` needs no changes. Absolute `/css/...` paths would; do not introduce
them.

---

## Caching

Prices change and customers must see them. `index.html` should not be cached aggressively:

```
Cache-Control: no-cache          # index.html
Cache-Control: public, max-age=31536000, immutable   # css/, js/, img/
```

Static hosts without per-path control (GitHub Pages, S3 with one rule) can skip this — but then
append a version query to the asset links when content changes, or accept up to `max-age` of staleness.

For the single-file deliverable there is no caching story at all: it *is* the file, so ship a new one
and rename it. Keep the version in the filename (`rashfa-menu-v5.html`) rather than overwriting, so
whoever has the old copy can tell.

## Print

`@media print` in `site/css/main.css` is short and aggressive:

```css
@media print{
  .splash,.beans,.ribbon,.lang-toggle,.topnav,.hero-jumpbar,.fcard-art,.story-art,
  .gallery,.cta-strip,.values{display:none}
  body{background:#fff;color:#000}
  .menu,.foot,.hero{padding:8px 14px}
}
```

Everything decorative is dropped — including the signature-card photographs (`.fcard-art`) and the
whole gallery — leaving black text on white with tightened padding, so the menu itself is what lands
on paper.

The consequence for editing: **this is an allow-list of what to hide, not of what to keep.** Any new
section you add will print unless you add it to that `display:none` selector, and a new decorative
element will cost ink. Check `Cmd-P` before shipping a change to the page structure.

## Rollback

With Pages, every deployment is a workflow run, so roll back to any previous commit and re-run it:

```bash
gh run rerun <run-id>
```

With the single file, keep every shipped `dist/` in history — that is one reason `dist/` is committed
rather than ignored.
