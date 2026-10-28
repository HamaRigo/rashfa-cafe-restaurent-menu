#!/usr/bin/env python3
"""
verify.py -- checks that site/ is self-consistent and that the bundle round-trips.

Run after any edit:

    python3 tools/verify.py            # static checks only (no browser needed)
    python3 tools/verify.py --browser  # also renders dist/ in headless Chrome

Static checks:
  * every local src/href in site/index.html points at a file that exists
  * no unresolved UUID placeholders survive in the source
  * the CSS referenced by <link> exists, and the JS referenced by <script> exists
  * menu-data.js declares every category id the jump bar links to
  * the JS files parse

With --browser it additionally rebuilds dist/ and asserts the rendered DOM has the
same category and item counts as the source, and that no @font-face placeholder is
left dangling (the bug the originally shipped bundle had -- see docs/KNOWN-ISSUES.md).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = REPO_ROOT / "site"
DIST = REPO_ROOT / "dist" / "rashfa-cafe-menu.html"

UUID_RE = re.compile(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
]

failures: list[str] = []
notes: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{f' -- {detail}' if detail else ''}")
    if not ok:
        failures.append(label)


def find_chrome() -> str | None:
    for c in CHROME_CANDIDATES:
        p = Path(c)
        if p.exists() or subprocess.run(["which", c], capture_output=True).returncode == 0:
            return str(c)
    return None


def static_checks() -> None:
    print("static checks")
    index = (SITE_DIR / "index.html").read_text(encoding="utf-8")

    refs = re.findall(r'(?:src|href)="([^"]+)"', index)
    local = [r for r in refs if not r.startswith(("http", "#", "tel:", "mailto:", "data:"))]
    missing = [r for r in local if not (SITE_DIR / r).exists()]
    check("all local references resolve", not missing, ", ".join(missing) or f"{len(local)} refs")

    stray = set(UUID_RE.findall(index))
    check("no unresolved UUID placeholders", not stray, ", ".join(list(stray)[:3]) or "clean")

    # The page is JS-rendered: #menu is an empty container until menu-app.js runs,
    # so category ids live in the data file, not the markup.
    data = (SITE_DIR / "js" / "menu-data.js").read_text(encoding="utf-8")
    cat_ids = set(re.findall(r'id:\s*"([a-z0-9-]+)"', data))

    jumpbar = re.search(r'class="hero-jumpbar"(.*?)</div>', index, re.S)
    jump_targets = set(re.findall(r'href="#([a-z0-9-]+)"', jumpbar.group(1))) if jumpbar else set()
    dead = jump_targets - cat_ids
    check("jump bar links resolve to real categories", not dead,
          f"{len(jump_targets)} links -> {len(cat_ids)} categories" if not dead
          else f"dead links: {sorted(dead)}")

    items = len(re.findall(r"price:\s*\d+", data))
    check("menu items present", items > 0, f"{items} priced items across {len(cat_ids)} categories")

    for js in sorted((SITE_DIR / "js").glob("*.js")):
        r = subprocess.run(["node", "--check", str(js)], capture_output=True, text=True)
        check(f"{js.name} parses", r.returncode == 0, r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "ok")

    css = (SITE_DIR / "css" / "main.css").read_text(encoding="utf-8")
    check("main.css defines the gold palette", "--gold:#e2b340" in css)

    if not find_chrome():
        notes.append("no Chrome found -- skipped --browser checks")


def browser_checks() -> None:
    chrome = find_chrome()
    if not chrome:
        print("\nbrowser checks\n  SKIP  no headless Chrome available")
        return

    print("\nbrowser checks")
    subprocess.run([sys.executable, str(REPO_ROOT / "tools" / "bundle.py")], check=True,
                   stdout=subprocess.DEVNULL)

    with tempfile.TemporaryDirectory() as td:
        dom = Path(td) / "dom.html"
        subprocess.run(
            [chrome, "--headless=new", "--disable-gpu", "--no-sandbox",
             "--virtual-time-budget=9000", "--dump-dom", f"file://{DIST}"],
            stdout=open(dom, "w", encoding="utf-8"), stderr=subprocess.DEVNULL, check=False,
        )
        rendered = dom.read_text(encoding="utf-8", errors="replace")

        cats = len(re.findall(r'class="cat"', rendered))
        items = len(re.findall(r'class="item[ "]', rendered))
        check("bundle renders all 5 categories", cats == 5, f"got {cats}")
        check("bundle renders all menu items", items == 43, f"got {items}")
        check("bundle loads images as blob URLs", len(re.findall(r'src="blob:', rendered)) >= 10)
        dangling = len(re.findall(r'url\("[0-9a-f]{8}-', rendered))
        check("no dangling @font-face placeholders", dangling == 0,
              f"{dangling} found" if dangling else "fonts resolve")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--browser", action="store_true", help="also render dist/ in headless Chrome")
    args = ap.parse_args()

    static_checks()
    if args.browser:
        browser_checks()

    for n in notes:
        print(f"\n  NOTE  {n}")
    print()
    if failures:
        print(f"FAILED {len(failures)} check(s): {', '.join(failures)}")
        sys.exit(1)
    print("all checks passed")


if __name__ == "__main__":
    main()
