# Contributing

Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the build model is unusual and
explains why the repo has both a `site/` folder and a 4 MB file in `dist/`.

## Setup

There is nothing to install. Python 3.9+ and a browser.

```bash
python3 -m http.server 8000 --directory site   # → http://localhost:8000
```

Do not open `site/index.html` with `file://`. Relative paths resolve, but the page loads its
typefaces from Google Fonts and a `file://` origin makes some browsers stricter about the
`document.fonts` handshake. Serve it.

## The rule that matters

**`site/` is the source. `dist/` is a build output. Never edit `dist/`.**

`dist/rashfa-cafe-menu.html` is a container: the page stored as one escaped JSON string with every
asset base64'd beside it. Editing it by hand is not possible in practice, and any edit would be
erased by the next build.

```bash
python3 tools/bundle.py          # regenerate dist/ from site/
```

The build is byte-deterministic, so committing `dist/` is meaningful and CI can tell you when it has
drifted from `site/`.

## Workflow

1. Branch from `main`.
2. Edit `site/`. For prices and menu items, that means `site/js/menu-data.js` only.
3. `python3 tools/verify.py` — fast, no browser.
4. `python3 tools/verify.py --browser` — rebuilds `dist/` and renders it in headless Chrome.
   Needs Google Chrome or Chromium at the default macOS/Linux location.
5. If you changed anything under `site/`, run `python3 tools/bundle.py` and **commit `dist/` in the
   same commit**. CI fails on a stale `dist/`.
6. Open a pull request.

## What the checks cover

`tools/verify.py` asserts:

| Check | Catches |
|---|---|
| all local references resolve | a renamed or deleted asset still referenced from `index.html` |
| no unresolved UUID placeholders | the exact bug that broke typography in the delivered file |
| jump bar links resolve to real categories | a category `id` renamed in data but not in the hero links |
| menu items present | the data file being emptied or truncated |
| `*.js` parses | syntax errors, via `node --check` |
| main.css defines the gold palette | the design tokens being clobbered |
| every crop slider targets a real element | a `TARGETS` selector pointing at a class that does not exist, which fails silently at runtime |
| build is byte-reproducible | a timestamp creeping into the gzip header |
| bundle renders 5 categories / 43 items | the page existing but not working (`--browser`) |
| images resolve as blob URLs | the manifest and the template disagreeing (`--browser`) |
| no dangling `@font-face` placeholders | the original defect returning (`--browser`) |

Add a check here when you find a class of mistake that CI did not catch.

## Conventions

**Arabic strings are content, not decoration.** Never reformat, re-wrap or "tidy" `index.html` or
`menu-data.js` — an editor that normalises whitespace inside an Arabic text node changes what
customers read. The same goes for diacritics: `يُعدّ` and `يعد` are different strings.

**Both languages, always.** Every translatable string is a `.t-ar` / `.t-en` pair in the same
element. Adding one without the other leaves a blank in the alternate view.

**Do not hard-code LTR geometry.** If a rule needs `left`/`right`/`padding-left`, add the mirrored
`[dir="rtl"]` partner next to it rather than rewriting the original.

**Prices are integers in QAR.** `price: 14`, not `"14 QAR"` or `14.00`. Formatting lives in
`priceMarkup()` — see [`docs/CONTENT-EDITOR.md`](docs/CONTENT-EDITOR.md).

**No dependencies.** The zero-dependency property is deliberate and is the reason the single-file
deliverable is only 4 MB. Adding a framework would make the packaging tools obsolete.

## Commit messages

Conventional Commits, lowercase, imperative: `fix(build): pin the gzip mtime`, `docs: add content
editor guide`. The body explains *why*, and states what was measured rather than assumed — see
`git log` for the house style.

## What not to commit

`.gitignore` blocks invoices, quotations, the project plan, PDFs and credentials. Client commercial
material does not belong in a public repository even if it lands in this folder.

The brand assets, photography and menu content are **not** under the MIT licence — see
[`LICENSE`](LICENSE).
