# WeZJUers — Design System v1.0

UI kit and tokens for the campus marketplace, derived from Zhejiang University's
published visual identity.

## Files

| File | What it is |
|---|---|
| `tokens.css` | Every value: colour, type, spacing, radius, shadow, layout, motion, stacking. **The product is light-only**; the measured dark palette is kept but parked (opt-in via `[data-theme="dark"]`, never auto-activated). |
| `components.css` | The kit, prefixed `.zl-`. Buttons, forms, chips, badges, listing card, seller, messages, alerts, empty states, modal and sheet. Depends on `tokens.css`. |
| `listings-design-system.html` | Living documentation — open it in a browser. Toggle theme and language in the sidebar and every specimen follows. |

**Specimen coverage:** 95 of the 101 component classes appear in the living doc.
The six that don't are layout helpers with nothing to look at — `.zl-container`,
`.zl-section`, `.zl-muted`, `.zl-truncate`, `.zl-link` (identical to a plain `a`),
and `.zl-overlay` (a full-screen scrim). If you add a component, add its specimen
in the same commit; the audit is a five-line script and a design system whose
documentation lags its CSS stops being trusted within a month.

## Use

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">

<body class="zl-ui">
  <button class="zl-btn zl-btn--primary">Message seller</button>
</body>
```

Theme is set by an inline script in `<head>`, before first paint:

```html
<script>
  (function(){ try{ var t=localStorage.getItem('zl-theme');
    if(t==='dark'||t==='light') document.documentElement.setAttribute('data-theme',t);
  }catch(e){} })();
</script>
```

Without it, anyone who chose dark gets a white flash on every navigation.

## What is official, and what is not

**From ZJU's published identity:** Truth-Seeking Blue `#003F88`, Innovation Red
`#B01F24`, Navy 900, Blue 500, Blue 50, the neutral ramp, the 60/30/10
distribution, the desktop type scale, and the 12-column / 1200px / 24px grid.

**Proposed extensions, not ZJU specification:** the type families, the mobile end
of the fluid scale, every component, and **the entire dark theme**. The
guidelines deck flags its own limits the same way — colour and the seal are
sourced, everything else is proposed.

**Not used at all:** the seal, the eagle, and the 浙江大学 wordmark. See
[../docs/decisions.md](../docs/decisions.md) #18. The wordmark here is real text
set in the body typeface — sharp at any density, recolours with the theme,
selectable, and readable by a screen reader.

## Dependencies

**None.** No webfont is downloaded by default and no CDN is contacted — which is
deliberate, because `fonts.googleapis.com` is unreliable from the Chinese
mainland and CJK faces run to several megabytes. Chinese renders in the system
face; to add Inter for Latin, drop the woff2 files in `design/fonts/` and
uncomment the `@font-face` block at the top of `tokens.css`.

## Rules that don't bend

1. **Compose from semantic tokens** (`--zl-text`, `--zl-bg-raised`, `--zl-action`),
   never raw hex. That is what makes the dark theme cost nothing.
2. **60 / 30 / 10** — neutral surfaces, blue, red. Blue is structural: nav,
   headers, primary buttons, links, active states.
3. **Red is one action per view.** Here that is *Post an item*, and destructive
   confirmation inside a modal. Never decoration, never behind body text.
4. **Links always carry an underline.** Colour is never the only signal — status
   badges carry a word or a mark as well.
5. **Listing photos are never duotoned.** The guidelines' 15–20% blue overlay is
   for campus and editorial imagery. A buyer has to see the item's real colour.
6. **44px minimum touch target; inputs never below 16px** — below that, iOS
   Safari zooms the page on focus.
7. **Measure every colour you add, in both themes, before shipping it.**

## On rule 7

The palette in `tokens.css` carries its measured contrast ratio in a comment next
to each semantic token. Three failures were found and fixed while building it,
and they are the ones most likely to recur:

| Problem | Measured | Fix |
|---|---|---|
| Mist `#8A93A0` as text on the sunken surface | **2.87:1** | `--zl-text-subtle` is `#767F8D` (3.74:1 on sunken) |
| Blue 500 as text inside the tinted surface | **4.42:1** | Brand text on a tint uses Blue 800 (8.63:1) |
| Blue 300 as a fill with white text | **2.44:1** | Blue 300 fills take dark text (7.63:1) |

And the one that shapes the whole dark theme: **Truth-Seeking Blue measures
1.84:1 against the dark background.** It disappears. In dark mode the brand blue
stops being the accent and becomes a surface, while links, focus and the primary
fill move up the ramp. A colour that "looks fine" on dark is not evidence.

## Preview

```bash
python3 -m http.server 4324 --directory "zju-projects/Listings/design"
```
