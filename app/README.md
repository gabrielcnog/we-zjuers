# WeZJUers — prototype

A running, seeded prototype of the platform. **PostgreSQL** and one npm
dependency (`pg`, 828 KB) — no build step, no framework.

```bash
brew services start postgresql@15               # once, if not already running
cd "zju-projects/Listings/app" && npm install   # once
node server.mjs                                 # → http://localhost:4400
node seed.mjs                                   # reset to fresh dummy data
```

The database (`listings_dev`) is created automatically on first run. Point it
elsewhere with `DATABASE_URL=postgres://user@host/db`.

**After re-seeding, restart the server** — seeding assigns new category UUIDs and
the server caches the reference lists at boot.

## Signing in

There is no email in the prototype. Enter any seeded address, and the 6-digit
code appears **on screen and in the terminal**. Any other address creates a new
account.

| Account | Campus | Deals in |
|---|---|---|
| `demo@we-zjuers.com` | Haining International | EN · PT · 中文 · ES |
| `meil@example.com` | Zijingang | 中文 · EN |
| `kenji@example.com` | Yuquan | 日本語 · EN · 中文 |
| `nadia@example.com` | Off-campus | FR · AR · EN — *not* ZJU-verified, so no badge |

`demo@we-zjuers.com` has listings in all three states, two conversations
and some saved items, so every screen has something on it.

## Why PostgreSQL

It started on SQLite because the machine had no database server. Once Postgres
was installed the prototype was migrated, because the schema had been written to
port and every day on a different engine than production is a day of drift.

Three things the move actually bought, all of them previously marked
"prototype-only":

| | Before (SQLite) | Now |
|---|---|---|
| Search | `LIKE '%q%'`, full table scan | `ILIKE` behind **GIN trigram indexes** — works on Chinese too, since trigrams need no word segmentation |
| Email | Lower-cased by convention in every query | **`citext`** — case-insensitivity is the column's type. `GABRIEL@…` and `gabriel@…` are one account |
| Constraints | Enforced by the app | Enforced by the **database**: a `free` listing with a price and an 81-character title are both rejected at the engine |

**PostgreSQL rather than MySQL:** `pg_trgm` (and later `pg_jieba`/`zhparser`) is
the real path to Chinese search; `citext` is a column type rather than a
convention; and Postgres is stricter by default, which is what you want holding
a marketplace's data.

The one cost is that `node:sqlite` is synchronous and `pg` is not, so every
call site became `await` — a real rewrite rather than a config swap. Worth doing
at 40 listings; much less fun at 400 files.

## Real photos (optional)

The seed ships drawn illustrations. To replace them with real, item-matched
photographs from Unsplash:

1. Put your Unsplash **Access Key** (never the Secret Key) in `app/.env`:
   `UNSPLASH_ACCESS_KEY=...` — the file is gitignored.
2. Run `node "zju-projects/Listings/app/fetch-photos.mjs"` (add `--wait` to let
   it pause and continue across hours). No server restart needed.

It follows the [Unsplash API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines):

- **Hotlinked, not re-hosted.** `listing_image.url` stores `photo.urls.raw`
  (including its `ixid`); views add imgix sizing params and the browser loads
  from `images.unsplash.com`, which the CSP allows. `/img/:id` 302s to it.
- **Download endpoint triggered** once per photo placed on a listing
  (`download_tracked_at`); unsent triggers are retried on the next run.
- **Attribution** under the listing gallery: "Photo by *name* on *Unsplash*",
  both linked with `utm_source=listings_zju&utm_medium=referral`
  (`UNSPLASH_APP_NAME` in `.env` overrides the source name).
- **Rate limit aware.** Demo apps get 50 requests/hour; one search per item type
  plus one trigger per photo is ~140. The script reads `X-Ratelimit-Remaining`,
  stops before a listing it can't finish, and resumes from where it left off.
  Search results are cached in `data/unsplash-search.json` (metadata only).

**Prototype only.** Stock photos stand in for dummy data. Real listings must
show the seller's own photos. Before launch, remove the Unsplash rows. Also
note that hotlinking means images come from Unsplash's CDN, whose speed from
mainland China should be measured (docs/decisions.md, open question 4).

**Two keyless sources were tried and rejected.** LoremFlickr returns arbitrary
Flickr photos — a search for "desk lamp" produced an identifiable child in a
private home, and "bicycle" produced a professional race with an attribution
watermark burned in. Picsum is curated and safe but has no keyword matching at
all, so a kettle listing gets a mountain road. Neither is suitable for a
marketplace.

## Community (forum prototype)

An exploratory Reddit-style section at `/en/community`: boards, posts,
threaded comments and upvotes, switched to from the header. Seed it (safe to
re-run; touches only community tables):

```bash
npm run seed:community
```

Design decisions and — importantly — what running a forum would really involve
(moderation, China's forum regulations) are in `../docs/community.md`.

## Events

A fourth section between Marketplace and Guidebook: university groups post
free events, students click once to join. Seed it (safe to re-run — it also
splits the demo accounts' names, which the attendance lists need):

```bash
npm run seed:events
```

Two things are worth knowing before you click around:

- **Posting is gated.** Only accounts with `role = 'organizer'` can post. The
  seed grants it to `meil@example.com` and `chenyu@example.com`; sign in as
  anyone else and `/events/new` explains the rule instead of 404ing.
- **Attendance is public to signed-in students only.** Signed out, an event
  page shows the headcount and a prompt; signed in, it shows the register,
  and every profile lists what that person is going to.

Names render as `NOGUEIRA, Gabriel` to signed-in students and `Gabriel N.`
to everyone else — one helper, `app/lib/names.mjs`, decides. Team events
(tournaments) ask the captain for a squad on the way in.

Decisions and what was deliberately left out are in `../docs/events.md`.

## Guidebook

`/en/guide` summarises the International College's official *2025 International
Student Freshmen Guidebook (Degree Students)* (iczu.zju.edu.cn, updated March
2026) into ten chapters, with a glossary sidebar (English, 中文, pinyin) whose
terms are linked from the text. Content lives in `content/guide.mjs`; it is a
summary in our own words that links to the official PDF on every view. Default
password formulas are deliberately left out. Dates are for the 2025 intake and
need updating each year — or, better, the International College's permission
to publish their guide directly.

## Mobile pass (measured, 375x812)

| | Before | After |
|---|---|---|
| Page HTML over the wire (marketplace) | 114 KB | 9 KB (gzip) |
| CSS over the wire | 53 KB | 13 KB (gzip) |
| Card image on a phone | 800w (~60 KB) | 400w (~15 KB) |
| Chrome pinned while scrolling | 220 px | 40 px |
| First card from the top of the page | 584 px | 424 px |

A second pass on the header: on a phone the primary action ("New post" /
"Add listing") leaves the top-right corner for a floating button in thumb
reach (docs/ux-guidelines.md 5.2), which lets the logo, campus picker and
utility links share one line — 220px of header became 112px. The footer
disclaimer stacks and centres under 640px.

What changed: gzip for text responses; `srcset`/`sizes` so phones fetch
phone-sized photos; the section bar moved out of `<header>` so it can pin on
its own while the header scrolls away; smaller vertical rhythm, hidden
marketing lede and 26px h1 under 640px; touch targets raised to 40-44px;
assets cached for an hour behind a version query that changes on restart.

## Audit pass (design · CRO · engineering)

Three audits, all changes verified in the browser:

- **Design.** Every text/background pair on five page types now passes WCAG AA
  (subtle grey was 3.74:1 on tinted panels, secondary buttons 4.42:1). Raw
  colours and off-scale font sizes moved into tokens (`--zl-scrim`,
  `--zl-on-scrim`, `--zl-ring-on-brand`, `--zl-text-title`); long-form text is
  capped at 68ch; breadcrumbs got 32px hit areas.
- **CRO.** The signed-out front page opens with a value proposition (free, no
  commission, students only); sign-in says what an account is for and what
  happens to the email; the listing page carries a safety note linking to the
  rules, "N students saved this", and a countdown in a listing's final week.
- **Engineering.** CSP no longer needs `script-src 'unsafe-inline'` (the two
  inline `onchange` handlers moved into app.js); the 500 page is a real page in
  the reader's language; the Postgres pool survives idle-client errors; expiry
  sweeps hourly instead of only at boot; favourite toggles have a failure path
  and a double-tap guard; static assets are read and gzipped once per boot;
  `preconnect` to the image CDN; every external link carries
  `rel="noopener noreferrer"`; one `<h1>` per page with no heading skips.

## Listing page pass (first fold, measured at 1024x768)

Studied against Kleinanzeigen's product page, which puts every action at the
top of its right rail and the reading matter under the gallery. Ours had the
description and the spec table stacked on top of the actions, so on a
1024x768 screen nothing you could act on was on the first screen at all.

| | before | after |
|---|---|---|
| Message seller | 824 | 435 |
| Save | 876 | 495 |
| Share | 1297 | 495 |
| Seller card | 944 | 563 |
| Report | 1297 | 725 |
| Safety note | 1140 | 667 |
| Page height | 1813 | 1600 |

What changed: the page is three grid regions (gallery, action rail, body)
instead of two, so the description and specs sit under the gallery on a
desktop and after the rail on a phone without reordering the source; Share is
a button beside Save rather than a text link at the bottom; the safety note
moved under the gallery, full width; the seller card has a compact variant for
the rail; views moved out of the spec table into the caption line by the
price; the Save button's label follows its state; and on a phone the floating
button on a listing is "Message seller", not "Add listing" — it steps aside
while the real button is on screen. Signing in from "Message seller" or
"Report" now returns to the listing instead of 404ing on the POST URL.

## What is real, and what is faked

**Real:** the schema and its constraints, session handling (tokens hashed, cookie
`HttpOnly`/`SameSite`), login codes hashed with expiry and attempt limits, rate
limits, ownership scoping on every mutation, server-side validation, the
diversity sort, no-results relaxation, browser-side image resizing, security
headers, EN/中文 in the URL, 30-day expiry with auto-expire on boot.

**Light mode only.** There is no theme toggle and no `prefers-color-scheme`
switch. The measured dark palette is kept but parked in `design/tokens.css`.

**Faked for the prototype, and marked in the code:**

| Faked | Production |
|---|---|
| Login code shown on screen | Emailed only (SES/Resend + SPF/DKIM/DMARC) |
| Images stored as bytes in the DB | Cloudflare R2, served via CDN |
| Seeded photos are generated SVGs (or Unsplash, see above) | Real uploads, re-encoded server-side to strip EXIF/GPS |
| In-memory rate limiter | Shared store (Redis) |
| CSP allows `'unsafe-inline'` for scripts | Nonce-based |
| Cookie has no `Secure` flag | Set — the prototype runs on plain `http://localhost` |
| `LIKE '%q%'` search | `pg_trgm`, then `pg_jieba` for Chinese |

## Layout

```
app/
├── server.mjs        routing, security headers, request handling
├── db.mjs            Postgres pool, schema, migrations, expiry job
├── seed.mjs          dummy sellers, listings, conversations
├── lib/
│   ├── queries.mjs   all data access — diversity sort, search, ownership scoping
│   ├── auth.mjs      sessions, login codes, rate limiting
│   ├── i18n.mjs      EN + 中文 dictionaries
│   └── html.mjs      escaping; no raw-HTML path for user content
├── views/            layout shell + page bodies
├── public/           app.css, app.js, favicon
└── node_modules/     just `pg` (gitignored)
```

CSS comes straight from `../design/tokens.css` and `../design/components.css` —
one source of truth, no copy to drift.
