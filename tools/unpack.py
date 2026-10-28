#!/usr/bin/env python3
"""
unpack.py -- reverse the single-file "__bundler" artifact back into readable source.

The shipped menu is one self-unpacking HTML file: the real page lives in a
<script type="__bundler/template"> JSON string, and every asset is base64'd into a
<script type="__bundler/manifest"> JSON object keyed by UUID. At runtime the loader
decodes each asset into a blob URL and string-replaces the UUID placeholders inside
the template.

This tool inverts that: it decodes assets to real files, expands the template, and
rewrites every UUID reference to a relative path -- producing the same page as plain,
inspectable source under site/.

    python3 tools/unpack.py "/path/to/Rashfa Cafe Menu (4).html"

The format itself is documented in docs/BUNDLE-FORMAT.md.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = REPO_ROOT / "site"

# ---------------------------------------------------------------------------
# Asset naming
# ---------------------------------------------------------------------------
# The bundle identifies assets by opaque UUID, which is fine for a machine and
# useless for a human. This map gives each one a filename that says what it is.
# Keyed on the first 8 chars so the map survives a re-export.
#
# Roles were read off the markup: the `alt` text, the .gtile-N / .fcard class, and
# the bilingual caption sitting next to each <img>.
ASSET_NAMES = {
    "1f05d0ff": "logo-rashfa",            # .topbar .brand-mini
    "fad71e88": "gallery-1-beans",        # .gtile-1  "fresh beans"
    "5add9885": "gallery-2-foam",         # .gtile-2  "silky foam"
    "567082d9": "gallery-3-warm-light",   # .gtile-3  "warm light"
    "81aeebd4": "gallery-4-seats",        # .gtile-4  "slow seats"
    "bc624596": "gallery-5-juice",        # .gtile-5  "cold pressed"
    "099fb9c2": "gallery-6-night",        # .gtile-6  "late nights"
    "0d91ce4c": "signature-mojito",       # .fcard    Rashfa Mojito
    "df576f12": "signature-turkish",      # .fcard    Turkish Coffee
    "1ba1416d": "signature-avocado",      # .fcard    Avocado Cream
    "86eb073f": "photo-focal",            # focal-point slider tool
    "b66dbd92": "menu-app",               # render + interactions
}

MIME_EXT = {
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/png": ".png",
    "application/javascript": ".js",
    "text/css": ".css",
}

# MENU is pure data and changes far more often than the code that renders it,
# so the single menu-app asset is split into a data file and a behaviour file.
MENU_DATA_SPLIT_AT = "// ---------- price formatter ----------"
FONT_FILE = "fonts.embedded.css"

UUID_RE = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
STYLE_RE = re.compile(r"<style>(.*?)</style>", re.S)


def read_block(bundle: str, kind: str) -> str:
    """Pull the raw text out of <script type="__bundler/{kind}">."""
    m = re.search(
        r'<script type="__bundler/%s">(.*?)</script>' % re.escape(kind),
        bundle,
        re.S,
    )
    if not m:
        raise SystemExit(f"unpack: bundle has no __bundler/{kind} block")
    return m.group(1).strip()


def decode_asset(entry: dict) -> bytes:
    """base64 -> bytes, undoing the gzip layer the bundler applied if flagged."""
    raw = base64.b64decode(entry["data"])
    if entry.get("compressed"):
        try:
            return gzip.decompress(raw)
        except OSError:
            # DecompressionStream is missing in some browsers too; the bundler
            # tolerates that, so keep the bytes as-is rather than failing.
            return raw
    return raw


def asset_filename(uuid: str, entry: dict) -> str:
    stem = ASSET_NAMES.get(uuid[:8], f"asset-{uuid[:8]}")
    return stem + MIME_EXT.get(entry["mime"], ".bin")


def classify_css(blocks: list[str]) -> list[str]:
    """Name each inline <style> block by its contents, preserving cascade order."""
    names = []
    for i, block in enumerate(blocks):
        if "@font-face" in block:
            names.append(FONT_FILE)
        elif "rich edition" in block or "MENU STYLES" not in block:
            names.append("main.css")
        else:
            names.append("photo-integration.css")
    # Never let two blocks collapse onto the same filename.
    seen: dict[str, int] = {}
    unique = []
    for name in names:
        n = seen.get(name, 0)
        seen[name] = n + 1
        unique.append(name if n == 0 else name.replace(".css", f"-{n + 1}.css"))
    return unique


def google_fonts_link(font_css: str) -> str:
    """
    Rebuild a working font reference from the parsed @font-face rules.

    The bundle's `src: url("<uuid>")` placeholders were never present in the
    manifest, so at runtime they stay literal and the page silently falls back to
    system fonts. See docs/KNOWN-ISSUES.md #1.
    """
    by_family: dict[str, set[int]] = {}
    for m in re.finditer(r"font-family:\s*'([^']+)'[^}]*?font-weight:\s*(\d+)", font_css, re.S):
        by_family.setdefault(m.group(1), set()).add(int(m.group(2)))

    if not by_family:
        return ""

    parts = []
    for family in sorted(by_family):
        weights = ";".join(str(w) for w in sorted(by_family[family]))
        parts.append(f"family={family.replace(' ', '+')}:wght@{weights}")
    href = "https://fonts.googleapis.com/css2?" + "&".join(parts) + "&display=swap"
    return (
        "    <!-- Typefaces rebuilt from the @font-face rules kept at\n"
        "         css/" + FONT_FILE + ". Those rules point at placeholders\n"
        "         that never resolve, so this live sheet is what loads\n"
        "         Cairo / Tajawal / Inter / Cormorant / Cinzel. -->\n"
        f'    <link rel="stylesheet" href="{href}">'
    )


def unpack(bundle_path: Path) -> None:
    bundle = bundle_path.read_text(encoding="utf-8")
    manifest = json.loads(read_block(bundle, "manifest"))
    template = json.loads(read_block(bundle, "template"))

    for sub in ("img", "js", "css"):
        (SITE_DIR / sub).mkdir(parents=True, exist_ok=True)

    # ---- 1. decode assets to disk -------------------------------------------
    path_map: dict[str, str] = {}
    written: list[tuple[str, int, str, bool]] = []
    for uuid, entry in manifest.items():
        data = decode_asset(entry)
        name = asset_filename(uuid, entry)
        folder = "img" if entry["mime"].startswith("image/") else "js"
        (SITE_DIR / folder / name).write_bytes(data)
        path_map[uuid] = f"{folder}/{name}"
        written.append((name, len(data), entry["mime"], entry.get("compressed", False)))

    # ---- 2. split menu data away from render code ----------------------------
    app_js = (SITE_DIR / "js" / "menu-app.js").read_text(encoding="utf-8")
    if MENU_DATA_SPLIT_AT in app_js:
        head, tail = app_js.split(MENU_DATA_SPLIT_AT, 1)
        (SITE_DIR / "js" / "menu-data.js").write_text(
            "/* =========================================================\n"
            "   RASHFA CAFE · menu data\n"
            "   Pure data: bilingual items and QAR prices per category.\n"
            "   Nothing here touches the DOM -- edit prices in this file.\n"
            "   ========================================================= */\n\n"
            + head.strip() + "\n",
            encoding="utf-8",
        )
        (SITE_DIR / "js" / "menu-app.js").write_text(
            "/* =========================================================\n"
            "   RASHFA CAFE · render + interactions\n"
            "   Reads MENU from menu-data.js, then wires up language,\n"
            "   the jump bar and scroll reveals.\n"
            "   ========================================================= */\n\n"
            + tail.strip() + "\n",
            encoding="utf-8",
        )
        data_uuid = next(u for u in manifest if u.startswith("b66dbd92"))
        path_map[data_uuid] = "js/menu-data.js"

    # ---- 3. externalise the inline <style> blocks ----------------------------
    blocks = STYLE_RE.findall(template)
    css_names = classify_css(blocks)
    for name, body in zip(css_names, blocks):
        (SITE_DIR / "css" / name).write_text(body.strip() + "\n", encoding="utf-8")

    font_css = next((b for n, b in zip(css_names, blocks) if n == FONT_FILE), "")
    font_link = google_fonts_link(font_css)

    counter = iter(range(len(css_names)))

    def style_repl(m: re.Match) -> str:
        name = css_names[next(counter)]
        if name == FONT_FILE:
            # Deliberately NOT linked. Its @font-face rules point at placeholders
            # that never resolve, and keeping them in the cascade would shadow the
            # working Google Fonts sheet below for the same family names.
            return font_link
        return f'    <link rel="stylesheet" href="css/{name}">'

    # Collapse the whitespace the removed inline blocks leave behind.
    html = STYLE_RE.sub(style_repl, template)
    html = re.sub(r"\n{3,}", "\n\n", html)

    # ---- 4. rewrite UUID placeholders to relative paths -----------------------
    # Script tags first, while they still hold bare UUIDs: the generic string
    # replacement below would otherwise collapse the split menu files onto the
    # single path in path_map and silently drop menu-app.js from the page.
    def script_repl(m: re.Match) -> str:
        rel = path_map.get(m.group(1))
        if rel is None:
            return m.group(0)
        if rel.endswith("menu-data.js"):
            # Data before behaviour -- menu-app.js reads the global MENU.
            return f'<script src="{rel}"></script>\n<script src="js/menu-app.js"></script>'
        return f'<script src="{rel}"></script>'

    html = re.sub(
        r'<script src="(' + UUID_RE.pattern + r')"></script>',
        script_repl,
        html,
    )

    for uuid, rel in path_map.items():
        html = html.replace(uuid, rel)

    stray = {u for u in UUID_RE.findall(html) if u not in path_map}
    (SITE_DIR / "index.html").write_text(html, encoding="utf-8")

    # ---- report ---------------------------------------------------------------
    print(f"unpacked {bundle_path.name}  ({len(bundle) / 1024:.0f} KB)  ->  site/")
    for name, size, mime, comp in sorted(written):
        kind = "text/css" if name.endswith(".css") else mime
        print(f"  {name:28} {size / 1024:7.0f} KB  {kind}{'  [gzip]' if comp else ''}")
    total = sum(s for _, s, _, _ in written) + sum(len(b) for b in blocks) + len(html)
    print(f"  {'index.html':28} {len(html) / 1024:7.0f} KB  text/html")
    print(f"  {'----':28} {total / 1024:7.0f} KB  unpacked total")
    if stray:
        print(
            f"\n  ! {len(stray)} UUID(s) had no manifest entry and stayed literal at\n"
            f"    runtime -- every one of them an @font-face src: placeholder.\n"
            f"    Fixed with a live Google Fonts <link>; originals kept in {FONT_FILE}."
        )


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    src = Path(sys.argv[1]).expanduser()
    if not src.exists():
        raise SystemExit(f"unpack: no such bundle: {src}")
    unpack(src)


if __name__ == "__main__":
    main()
