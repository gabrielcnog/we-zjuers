# Interface foundations

Three cross-cutting requirements that touch every screen, so they are decided
once here rather than per-page: **bilingual**, **light/dark**, **responsive**.

---

## 1. Language switch — EN / 中文

### Routing: path prefix, not a cookie

Locale lives in the URL: `/en/listing/abc123` and `/zh/listing/abc123`.

This matters more here than on most sites. Listings will be shared into WeChat
group chats, and a cookie-only switch means the same link opens in whatever
language each recipient last used — half the group lands on a page they can't
read. A path prefix makes a shared link carry its language with it, and gives
each locale a real URL for search engines.

### Which language loads first

Precedence, highest first:

1. **The URL.** An explicit `/zh/` always wins.
2. **Saved choice**, in `localStorage` — someone who used the switcher has
   decided, and the browser doesn't get to overrule them.
3. **`navigator.languages`**, walked in order, first supported match wins. Only
   the primary subtag counts: `zh-CN`, `zh-TW`, `zh-Hans-CN` all resolve to `zh`.
4. **English**, as the fallback.

Walking the whole `navigator.languages` list rather than just the first entry is
deliberate: a student with `['fr-FR', 'zh-CN']` should get Chinese, not English.
Traditional-script visitors (`zh-TW`, `zh-HK`) resolve to simplified — a
decision, not an accident.

> The same precedence rule is implemented and documented in
> `../../Gab Costa/Site/` — reuse the reasoning, and the mistakes already found.

### What is *not* translated

**Listing content stays in whatever language its author wrote it.** The interface
is bilingual; user-generated text isn't. So a Chinese-only student browsing sees
English titles, and vice versa — the interface switch solves half the problem and
the visible half is the other one.

Leave it in v1. But this — an on-demand **"translate this listing"** button, one
API call, result cached on the listing — is the highest-value feature on the
later list, because it addresses the actual barrier the product exists to remove.

### Mechanics

- Message catalogues per locale, human-written. Never machine-translate the UI.
- Every enum ships bilingual at the data layer: categories, campuses, condition,
  languages (`name_en` / `name_zh`), so the switch doesn't need a lookup table
  bolted on later.
- Set `<html lang>` correctly — it drives font fallback and screen readers.
- The switcher sits in the header, next to the theme toggle, labelled
  **EN / 中文** in both states so it's recognisable either way.
- Emails use `user.locale` from the database, which is why that column exists
  separately from the URL.

---

## 2. Light and dark — *dark is parked*

> **Current decision: the product is light-only.** No toggle, and no
> `prefers-color-scheme` switch, so a viewer whose system is dark still gets the
> light theme. Everything below stays because the analysis was done and measured
> — it is what re-enabling dark would rest on, not a description of what ships.

### This is an extension beyond the brand guidelines

The ZJU deck specifies a light palette only. A dark theme carries the same status
as the type scale and grid: **a proposed extension, not an official ZJU
specification.** Say so wherever the guidelines are cited.

### The problem, measured

Truth-Seeking Blue is very dark, which is exactly why it works so well on white.
Measured against a dark surface (`#0E1319`):

| Brand value, used as-is in dark | Contrast | Verdict |
|---|---|---|
| `#003F88` blue as a button fill | **1.84:1** | Invisible. The button vanishes into the page. |
| `#0A6BD1` as link text | **3.59:1** | Fails AA for body text. |
| `#B01F24` red as text | **2.72:1** | Fails badly. |

So dark mode cannot be "the same colours on a dark background". It needs lifted
variants, and the roles shift: **in dark mode the brand blue stops being the
accent and becomes a surface colour**, while a lighter blue carries links and
focus.

### The dark palette (all ratios measured, not estimated)

| Token | Value | Against `#0E1319` |
|---|---|---|
| text | `#E8ECF1` | 15.72:1 |
| text muted | `#A2ADBA` | 8.19:1 |
| text subtle | `#6F7B8A` | 4.33:1 — captions only |
| link / focus | `#6FA8F5` | 7.63:1 |
| primary fill | `#0A6BD1` + white text | 5.20:1 on the fill |
| danger text | `#EF7C81` | 6.99:1 |
| danger fill | `#B01F24` + white text | 6.85:1 on the fill |
| success | `#4ADE80` | 10.70:1 |
| warning | `#E0A94A` | 8.83:1 |

Borders (`#263140`) sit below 3:1 deliberately — they are decorative separators
between surfaces that already differ, not the sole indicator of any control.
**Focus rings are the exception** and use the 7.63:1 link blue: a focus indicator
is the only thing telling a keyboard user where they are.

### Mechanics

- **Three states: system, light, dark.** Default is system.
- Tokens defined on bare `:root`; overridden under
  `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])`,
  and again under `:root[data-theme="dark"]` so an explicit choice wins both ways.
- **Applied by an inline script in `<head>`, before first paint.** Otherwise
  someone who chose dark gets a white flash on every navigation. Same technique
  as `../../Gab Costa/Site/`.
- Stored in `localStorage`, **not in the database** — it is a per-device
  preference (dark on the phone at night, light on a laptop in a bright library),
  and a database round-trip cannot happen before first paint anyway.
- Set `color-scheme` so form controls and scrollbars follow, and update
  `<meta name="theme-color">` per theme.
- **User photos don't get a dark variant.** Keep image containers on a neutral
  surface rather than pure black so bright product photos don't glare.

---

## 3. Responsive and fast

Assume the median session is **a phone, on campus mobile data, one-handed**.
Desktop is the secondary case, not the design starting point.

### The CJK font trap — read before touching typography

The brand guidelines specify Noto Serif SC and Noto Sans SC. Taken literally on
the web, that pairing is the single worst performance decision available here,
for two reasons:

1. **CJK fonts are enormous.** A full Chinese face runs to several megabytes per
   weight — thousands of glyphs, not the ~200 a Latin font ships.
2. **Google Fonts is unreliable from the Chinese mainland.** Loading
   `fonts.googleapis.com` risks a hung request and text that never renders — for
   the exact users this product is built for.

**What to do instead:**

- **Chinese: system fonts, no download.** `PingFang SC` (iOS/macOS),
  `Microsoft YaHei` (Windows), `Noto Sans CJK SC` (Android). Every one of these
  is already on the device, renders instantly, and looks native.
- **Latin: self-host Inter**, Latin subset only, woff2, ~20–30 KB. Self-hosted,
  not from Google's CDN.
- **Headings:** serif for Latin only. Chinese headings use the sans at a heavier
  weight — which is also the idiomatic choice, since serif (宋体) headings read
  as formal or dated in Chinese web UI, not as elegant.
- `font-display: swap` everywhere.

This deviates from the guidelines' type spec. It is the right call, and it
belongs in the decision log rather than being quietly done.

### Performance budget

Numbers, so it can be tested rather than argued about:

| Metric | Budget |
|---|---|
| LCP, home feed, 4G | < 2.5s |
| Initial JS, gzipped | < 150 KB |
| Listing card image | < 40 KB |
| Web font bytes | < 40 KB total |
| CLS | < 0.1 |

Images are the entire budget. The measures that matter:

- **Resize client-side before upload** — longest edge 1600px. A 5 MB phone photo
  becomes ~250 KB before it touches the network.
- `srcset` per card size; never ship a detail-size image to a grid card.
- Lazy-load everything below the fold; eager-load the first row only.
- Blurhash or dominant-colour placeholder at the correct aspect ratio, so the
  feed doesn't reflow as photos arrive (this is the whole of the CLS budget).
- Server-render listing pages. The feed is content, not an application.

### Layout

Grid from the guidelines: 12 columns, 1200px container, 24px gutter, base-8
spacing.

| Breakpoint | Feed columns | Notes |
|---|---|---|
| < 640px | 2 | 16px page margins; filters collapse into a bottom sheet |
| 640–1024px | 3 | |
| 1024–1440px | 4 | Filters become a persistent left rail |
| > 1440px | 4 | Content stays capped at 1200px |

- Cards are 4:3 image + title + price + campus badge. Nothing else — a card that
  tries to say everything says nothing at 2-up on a phone.
- **Touch targets ≥ 44px.** The category chips and campus filter are the most
  tapped things on the site.
- Filters are a bottom sheet on mobile, not a modal — reachable with a thumb.
- Installable as a PWA. No app store, no native build.

### Accessibility

Inherited from the guidelines and non-negotiable: links always underlined, colour
never the sole signal, focus visible at ≥3:1, `prefers-reduced-motion` respected,
and every measured pair in the tables above holds in both themes.
