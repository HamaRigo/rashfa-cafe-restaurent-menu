# Content editor guide

How to change what customers see. Written for the cafe owner, but nothing here needs more than a
text editor.

**Always finish with the same two commands:**

```bash
python3 tools/verify.py    # did you break anything?
python3 tools/bundle.py    # rebuild the single file you hand out
```

---

## Prices

Open [`site/js/menu-data.js`](../site/js/menu-data.js). Find the item, change the number:

```js
{ ar:"كابتشينو", en:"Cappuccino", metaAr:"إسبرسو + حليب مبخر",
  metaEn:"espresso · steamed milk", price:14, hot:true },
```

Write `price:15`, not `"15"`, not `15 QAR`, not `15.00`.

The `.00` is added for you by `priceMarkup()` in `menu-app.js`, which splits the price into three
styled pieces — the `QAR` label, the amount, the decimals. Fractional prices work too: `price:14.5`
renders as `QAR 14.50`.

## Adding an item

Copy any line inside the `items: [...]` list of the right category and edit it. The fields:

| Field | Required | Notes |
|---|---|---|
| `ar` | yes | Arabic name — **the default view** |
| `en` | yes | English name |
| `metaAr` | yes | Arabic description |
| `metaEn` | yes | English description |
| `price` | yes | number, QAR |
| `hot` | no | adds the gold star; 8 items currently use it |

Leave the trailing comma patterns as they are and the file will stay valid.

## Removing an item

Delete its line. Nothing else references individual items, so there is nothing to clean up.

## Adding or renaming a category

Two files are involved, and this is the one edit that can leave a dead link:

1. Add the object to `MENU` in `menu-data.js` with a lowercase, space-free `id` — e.g. `desserts`.
2. Add a matching `<a href="#desserts">` to the hero jump bar in `index.html`.

The `id` is what the jump bar scrolls to. `num` is only the printed index (`06 /`), and the `sub*`
fields are the small line under the heading.

`tools/verify.py` checks that every jump-bar link points at a category that exists, so a mismatch
fails the build rather than showing a link that does nothing.

**A category with three items or fewer** is rendered single-column automatically — the `single`
class is applied from `cat.items.length`, so you do not need to touch CSS.

## Photos

Drop the file into [`site/img/`](../site/img) and change the `src` on the matching `<img>` in
`index.html`.

Keep the aspect ratio close to the image it replaces (portrait tiles in the gallery, roughly square
for the three signature cards), and **resize before you add it**:

```bash
sips --resampleWidth 900 -s format webp -s formatQuality 80 photo.jpg --out site/img/new.webp
```

This matters more than it sounds. The delivered file is 4 MB, and 2.4 MB of that is a single
unresized phone photograph — see [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #2. A correctly sized image is
60–90 KB.

Every `<img>` needs descriptive `alt` text in the language a customer would search in.

## Cropping without touching CSS

Open the served page and run this in devtools. The panel appears in the corner with a slider per
photograph:

```js
window.postMessage({ type: "__activate_edit_mode" }, "*")
```

That is the only way in. `photo-focal.js` is wrapped in an IIFE, so `showPanel()` is private and
cannot be called from the console — the message listener is the public surface. The original editor
used the same channel, and the script also announces `__edit_mode_available` to `window.parent` on
load so a host can discover that the page supports editing. To close it:
`{ type: "__deactivate_edit_mode" }`.

Each slider moves that image's `object-position` from 0% to 100% on one axis, so you can push the
subject back into frame without re-exporting the photo. **Reset all** restores the defaults.

Two limitations to know about:

- Adjustments are saved to `localStorage`, which means **they live on that device and browser only**.
  They do not travel to a phone, and they are not baked in by `tools/bundle.py`. See
  [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #4.
- The six sliders for the signature cards currently do nothing, because they target `.sig-mojito`,
  `.sig-turkish` and `.sig-avocado` and those classes are not in the markup. The six gallery sliders
  work. See [KNOWN-ISSUES.md](KNOWN-ISSUES.md) #9.

## Text outside the menu

Headings, the hero line, value cards, story block and footer are plain HTML in
[`site/index.html`](../site/index.html). Search for the Arabic or English text you want; it will be
inside a `<span class="t-ar">` / `<span class="t-en">` pair. Change both, or the other language
shows a blank.

## Contact details

The number appears four times in `index.html`, in two different forms, and it is easy to change
only half of them:

| Where | Form |
|---|---|
| call button, `href` | `tel:+97477689633` |
| call button, visible text | `+974 7768 9633` |
| WhatsApp button, `href` | `https://wa.me/97477689633` |
| footer, visible text | `+974 7768 9633` |

The links are unformatted (`97477689633`), the visible text is spaced (`+974 7768 9633`). Update all
four or the page will offer to call the old number while showing the new one.

## Language and currency

Arabic is the default and the page ships `dir="rtl"`. The toggle choice is remembered per device
under `localStorage` key `rashfa-lang`.

Currency is hard-coded as the string `QAR` in `priceMarkup()`. Changing it means editing that one
function — and the `QAR` occurrences in the three signature cards, which are written directly in
`index.html` rather than generated.
