# Changelog

Notable changes to this repository. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions are the ones the client was
actually handed, not semantic versions — there is no library here to version.

## [Unreleased]

Nothing outstanding. Open work is tracked in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md), which is
preferred over an issue tracker for a portfolio repo because the findings carry measurements.

## [4] - delivered file

`Rashfa Cafe Menu (4).html`, 4,234,339 bytes. What the client holds.

Reproduced as [`dist/rashfa-cafe-menu.html`](dist/rashfa-cafe-menu.html) at 4,208,556 bytes — 25 KB
smaller, and that gap is the fix below: the 28 KB block of dead `@font-face` rules was replaced by a
two-line Google Fonts `<link>`, so the rebuild should be marginally lighter than the original.

This is the reference point for everything below, and it contains one defect that was invisible at
delivery.

### Fixed

- **`@font-face` placeholders that were never registered** (v4). 74 font rules pointed at UUID
  placeholders absent from the bundle manifest, so the page silently rendered in system Arabic
  (Geeza Pro on macOS) instead of Cairo and Tajawal. No error, no failed request worth noticing —
  found by rendering the file in headless Chrome and diffing the DOM against a rebuild.
  Corrected in `site/`; the original rules are preserved unlinked in
  [`site/css/fonts.embedded.css`](site/css/fonts.embedded.css) for comparison.
  See [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md) #1.

### Added

- **Readable source tree** — `site/` unpacked from the single file into `index.html`, three
  stylesheets, two scripts and ten images, with the 42 UUID placeholders rewritten to real paths.
- **A bundler, inverting the delivered format** — `tools/bundle.py` repacks `site/` into one HTML
  file using the same `__bundler` container the original used, so the workflow round-trips.
- **Reproducible builds** — UUIDs derived with `uuid5` from the asset path instead of random ones,
  so an unchanged `site/` produces byte-identical output and `dist/` can be committed and diffed.
- **Verification** — `tools/verify.py`, 9 static checks and 4 browser checks against the rendered
  bundle in headless Chrome.
- **Continuous integration** — `.github/workflows/ci.yml` runs the checks, fails when `dist/` has
  drifted from `site/`, and publishes `site/` to GitHub Pages.
- **Documentation** — README, architecture, design system, bundle format, known issues, content
  editor guide, deployment, contributing.

### Changed

- `docs/` split out of the README so the architecture, the format spec and the defect list can be
  read and cited separately.

### Known issues at this point

Recorded rather than fixed, with measurements in [docs/KNOWN-ISSUES.md](docs/KNOWN-ISSUES.md):
one gallery photograph shipping at 2268×4032 (2.4 MB, 78% of the asset payload), the menu being
invisible to crawlers and no-JS visitors, no `prefers-reduced-motion` handling, six unreferenced
colour tokens, and the focal-point panel's tweaks not surviving a rebuild.

## [1–3] - earlier revisions

Superseded by v4 and not reproduced here. No archive of them is kept in this repository; the
delivered v4 is the only baseline.

---

## Undated fixes to the tooling

**2026-10-28 — gzip timestamps made builds non-reproducible**

The reproducibility claim above was false on its first attempt. `gzip.compress()` stamps the current
clock into the gzip header's MTIME field, so every build differed in a handful of base64 bytes.

It survived local testing because both builds ran inside the same second: comparing them showed
identical bytes and the check passed. CI, on a machine with a different clock, caught it on the first
run. Fixed by writing through `GzipFile(..., mtime=0)`, and `verify.py` now rebuilds twice and
compares, so the claim is enforced rather than assumed.
