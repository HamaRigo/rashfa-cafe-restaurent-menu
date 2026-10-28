# The single-file bundle format

A field-by-field description of the format `dist/rashfa-cafe-menu.html` is written in,
reverse-engineered from the delivered artifact in order to build
[`tools/unpack.py`](../tools/unpack.py) and [`tools/bundle.py`](../tools/bundle.py).

## Why the format exists

A normal static site is a folder. Folders break when you email them, get flattened by chat apps,
lose their relative paths on a USB stick, or get opened from a download directory where the
subfolder was never extracted. A single `.html` file survives all of that: double-click it and the
site works.

The cost is that the file is not source — it is a container. Nothing in it is editable or diffable
by a human, which is exactly why this repo keeps `site/` as the real source and treats `dist/` as
a build output.

## Container structure

The document is an ordinary HTML page whose `<head>` carries only a loading shell, and whose
`<body>` carries four things:

```html
<body>
  <div id="__bundler_thumbnail">…inline SVG…</div>
  <div id="__bundler_loading">Unpacking…</div>

  <script>            /* the loader — see below */ </script>

  <script type="__bundler/manifest">
    { "<uuid>": {"mime":"image/jpeg","compressed":false,"data":"<base64>"}, … }
  </script>

  <script type="__bundler/ext_resources"> [] </script>

  <script type="__bundler/template">
    "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">…"
  </script>
</body>
```

The custom `type` attributes are what make this safe: browsers ignore `<script>` blocks whose type
they do not recognise, so the payloads are never executed, and `text/html` inside them is never
parsed as markup. They are effectively typed data islands.

### `__bundler/manifest`

A JSON object keyed by UUID. One entry per binary asset:

| Field | Meaning |
|---|---|
| `mime` | Becomes the `Blob` type, so the browser decodes the image correctly |
| `compressed` | `true` means the bytes are gzip'd *before* base64 |
| `data` | base64 of the (possibly gzipped) bytes |

In the delivered file, images are stored uncompressed (`image/jpeg` is already entropy-coded, so
gzip buys nothing) while both JavaScript assets are gzipped — they are text, and gzip plus base64
cuts their payload by about 55% (10.2 KB → 4.5 KB, 12.1 KB → 5.5 KB).

### `__bundler/template`

A JSON **string** containing the entire page: doctype, `<html>`, CSS inline in `<style>` blocks,
and — critically — **UUID placeholders where every asset reference will go**:

```html
<img src="567082d9-191c-4879-9f51-b3ad02ec30b4" alt="Warm daylight inside the cafe">
<script src="b66dbd92-0414-4231-8d82-50ab14bdc554"></script>
```

Because it is JSON-encoded, the whole page is one escaped string. This is what makes the file
unreadable and ungreppable, and what `unpack.py` exists to undo.

### `__bundler/ext_resources`

A list of `{id, uuid}` entries mapping a stable logical name onto a bundled asset, exposed to the
page as `window.__resources`. In this build it is empty — nothing needs an indirection layer — but
the loader handles it, and `bundle.py` writes `[]` to stay format-compatible.

## The loader

Embedded in the shell (`tools/loader-head.html`), running on `DOMContentLoaded`:

1. **Decode every manifest entry** — `atob` → byte array → optional `DecompressionStream('gzip')`
   → `Blob` → `URL.createObjectURL()`.
2. **Substitute placeholders** — for each UUID, `template.split(uuid).join(blobUrl)`. Split/join
   rather than `replace()` so no `$`-pattern substitution can occur inside asset payloads.
3. **Strip `integrity` and `crossorigin`** from any remaining tags. These blob URLs are issued from
   a `file://` document, so they have a `null` origin; `crossorigin` forces a CORS preflight that
   SRI then rejects. The bytes are the bundle's own, so SRI has nothing to protect here.
4. **Inject `window.__resources`** after `<head>` rather than before it — prepending would push the
   parser into quirks mode by putting content before the doctype.
5. **Swap the document** with `DOMParser.parseFromString(template, 'text/html')` and
   `documentElement.replaceWith()`.
6. **Resurrect the scripts.** This is the subtle part: `<script>` elements inserted by
   `replaceWith` are **inert per spec** and never execute. The loader therefore walks the new
   `document.scripts`, recreates each one with `createElement`, copies its attributes and text, and
   replaces the inert node — awaiting `onload` for `src` scripts so execution order is preserved.
7. **Re-inline JSX if present.** A `text/babel` script with a `src` would make Babel issue an XHR
   against `blob:null/…`, which a `file://` origin silently drops. The loader fetches it and inlines
   the body, turning it into a plain inline script that Babel transforms unconditionally.
8. **Call `Babel.transformScriptTags()` manually**, because the automatic pass runs on
   `DOMContentLoaded` — which already fired before the document was swapped.

Throughout, `setStatus()` writes into `#__bundler_loading`, and a `window`-level `error` listener
mirrors anything thrown into a visible red panel (`#__bundler_err`) that survives the DOM swap
because it lives on `window`, not in the replaced tree.

## Known weaknesses of the format

- **A missing manifest entry fails silently.** Any placeholder not present in the manifest stays as
  literal UUID text in the page. For an `<img>` that is a broken image you can see; inside a CSS
  `url()` it is invisible and just falls back. This is exactly the bug behind
  [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #1 — 74 `@font-face` rules were left dangling.
- **Nothing renders until every asset decodes**, since substitution is one pass over the whole
  template. The loader is all-or-nothing by design.
- **`blob:` URLs leak.** `URL.createObjectURL` results are never revoked; harmless for a page that
  loads once, wrong for an SPA that re-mounts.
- **No code signing story at all.** The format is a container, not a trust boundary.

## Reproducibility

`bundle.py` assigns UUIDs with `uuid5(NAMESPACE_URL, "rashfa://" + rel_path)` instead of
`uuid4()`. Two builds of an unchanged `site/` are therefore byte-identical, which lets `dist/` be
committed and reviewed as a normal build artefact rather than a file that churns on every rebuild.
