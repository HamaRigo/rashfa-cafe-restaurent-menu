#!/usr/bin/env python3
"""
bundle.py -- pack site/ back into one self-contained, offline-friendly HTML file.

The inverse of tools/unpack.py. Produces the same "__bundler" format the menu was
shipped in: the page becomes a JSON string in a <script type="__bundler/template">
block, every asset becomes a base64 entry in a <script type="__bundler/manifest">
block keyed by UUID, and the loader in tools/loader-head.html swaps the UUIDs for
blob URLs at runtime.

    python3 tools/bundle.py                     # -> dist/rashfa-cafe-menu.html
    python3 tools/bundle.py --out /tmp/x.html

UUIDs are generated with uuid5 over the asset path, so two builds of the same
source produce byte-identical output. That makes dist/ safe to commit and diff.

Known trade-off: the repacked file references Google Fonts over the network for
the typefaces, so it is not fully offline. See docs/KNOWN-ISSUES.md #1.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import io
import json
import re
import uuid as uuidlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = REPO_ROOT / "site"
LOADER_HEAD = REPO_ROOT / "tools" / "loader-head.html"

NAMESPACE = uuidlib.NAMESPACE_URL

# Text assets compress well and are worth gzipping; images are already entropy-coded.
COMPRESSIBLE = (".js", ".css", ".html")

MIME_BY_EXT = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
}

# Local references we need to turn into bundle placeholders.
LINK_CSS_RE = re.compile(r'<link rel="stylesheet" href="(css/[^"]+)">')
ASSET_RE = re.compile(r'(?:src|href)="((?:img|js|css)/[^"]+)"')


def stable_uuid(rel_path: str) -> str:
    """A UUID that depends only on the asset path, so builds are reproducible."""
    return str(uuidlib.uuid5(NAMESPACE, "rashfa://" + rel_path))


def encode(data: bytes, compress: bool) -> tuple[str, bool]:
    """
    bytes -> (base64 text, was-compressed).

    The gzip header carries an MTIME field, and gzip.compress() stamps it with
    the current clock. That would make every build differ in a few base64 bytes
    and turn the CI "is dist/ stale?" check into permanent noise, so the header
    is pinned to mtime=0 here. GzipFile is used rather than the mtime= keyword
    of gzip.compress because that keyword only exists on Python 3.11+.
    """
    if compress:
        buf = io.BytesIO()
        with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as gz:
            gz.write(data)
        data = buf.getvalue()
    return base64.b64encode(data).decode("ascii"), compress


def json_for_script(obj) -> str:
    r"""
    Serialise for embedding inside <script>.

    `</` has to be escaped or the first closing tag inside a string literal would
    end the script element early. JSON treats `\/` as `/`, so the payload is still
    valid and decodes back to the original bytes.
    """
    return json.dumps(obj, separators=(",", ":")).replace("</", "<\\/")


def inline_css(html: str) -> tuple[str, list[str]]:
    """
    Fold linked stylesheets back into inline <style> blocks.

    The shipped format keeps CSS inline in the template rather than as manifest
    assets, which is what unpack.py undoes -- so bundling has to redo it.
    """
    used: list[str] = []

    def repl(m: re.Match) -> str:
        rel = m.group(1)
        path = SITE_DIR / rel
        if not path.exists():
            raise SystemExit(f"bundle: stylesheet referenced but missing: {rel}")
        used.append(rel)
        return "<style>\n" + path.read_text(encoding="utf-8").rstrip() + "\n</style>"

    return LINK_CSS_RE.sub(repl, html), used


def collect_assets(html: str) -> dict[str, dict]:
    """Assign every local asset a UUID and register it in the manifest."""
    manifest: dict[str, dict] = {}
    for rel in sorted(set(ASSET_RE.findall(html))):
        path = SITE_DIR / rel
        if not path.exists():
            raise SystemExit(f"bundle: referenced asset missing from site/: {rel}")
        ext = path.suffix.lower()
        mime = MIME_BY_EXT.get(ext)
        if mime is None:
            raise SystemExit(f"bundle: no mime mapping for {rel}")
        raw = path.read_bytes()
        data, compressed = encode(raw, compress=ext in COMPRESSIBLE)
        manifest[stable_uuid(rel)] = {"mime": mime, "compressed": compressed, "data": data}
    return manifest


def substitute(html: str, manifest: dict[str, dict]) -> str:
    """Replace each local path with its UUID placeholder."""
    out = html
    for rel in sorted({r for r in ASSET_RE.findall(out)}, key=len, reverse=True):
        out = out.replace(f'"{rel}"', f'"{stable_uuid(rel)}"')
    return out


def build(out_path: Path, verbose: bool = True) -> Path:
    index = SITE_DIR / "index.html"
    if not index.exists():
        raise SystemExit("bundle: site/index.html not found -- run tools/unpack.py first")
    if not LOADER_HEAD.exists():
        raise SystemExit("bundle: tools/loader-head.html missing")

    html = index.read_text(encoding="utf-8")
    html, inlined = inline_css(html)

    # Stylesheets are inline now; drop them from the asset scan.
    manifest = collect_assets(html)
    template = substitute(html, manifest)

    # Nothing here needs a runtime fetch that isn't already in the manifest.
    ext_resources: list[dict] = []

    loader = LOADER_HEAD.read_text(encoding="utf-8")
    parts = [
        loader,
        '<script type="__bundler/manifest">\n',
        json_for_script(manifest),
        "\n  </script>\n\n  <script type=\"__bundler/ext_resources\">\n",
        json_for_script(ext_resources),
        "\n  </script>\n\n  <script type=\"__bundler/template\">\n",
        json_for_script(template),
        "\n  </script>\n</body>\n</html>",
    ]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    blob = "".join(parts)
    out_path.write_text(blob, encoding="utf-8")

    if verbose:
        try:
            shown = out_path.relative_to(REPO_ROOT)
        except ValueError:
            shown = out_path
        payload = sum(len(v["data"]) for v in manifest.values())
        print(f"bundled site/ -> {shown}")
        print(f"  {len(manifest):>3} assets   ({payload / 1024:.0f} KB base64 payload)")
        print(f"  {len(inlined):>3} stylesheets inlined: {', '.join(inlined)}")
        print(f"  template {len(template) / 1024:.0f} KB   final file {len(blob) / 1024:.0f} KB")
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(REPO_ROOT / "dist" / "rashfa-cafe-menu.html"))
    args = ap.parse_args()
    build(Path(args.out).expanduser())


if __name__ == "__main__":
    main()
