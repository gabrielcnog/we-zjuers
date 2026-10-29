# Decisions and open questions

## Decided

| # | Decision | Reasoning |
|---|---|---|
| 1 | **No payments, ever** | Keeps the product out of payment licensing entirely, removes escrow disputes, and matches how campus trades already happen — cash or a personal transfer, in person. |
| 2 | **Phase 0: prototype on existing Brazilian hosting. Phase 1: HK/Singapore if it gains traction. Phase 2: mainland, only alongside institutional adoption** | Free and already owned beats fast-but-unbuilt. ~350 ms from China is a real cost, mitigated by a CDN with Asian edge nodes; moving to Asia later is a redeploy, not a rewrite. Mainland needs an ICP filing a foreign student cannot reliably obtain alone. |
| 3 | **Email + 6-digit code for auth; WeChat ID as a profile field** | WeChat website login requires a verified company. Codes beat magic links on mobile mail clients and spam filtering. |
| 4 | **Async in-app messaging, with opt-in WeChat reveal inside the thread** | Keeps first contact on-platform (moderation, signal) without building realtime infrastructure. Users still end up in WeChat — by choice, once they've decided to meet. |
| 5 | **Campus as the primary location filter** | ZJU spans seven campuses. Distance across Hangzhou decides whether a deal happens; a city-wide feed is noise. |
| 6 | **30-day auto-expiry with a renew email** | Stale listings are how small classified sites die. Nobody will prune manually. |
| 7 | **Ten flat categories, no subcategories** | More categories means emptier categories at this volume. |
| 8 | **Bilingual EN/中文 from the first commit** | Retrofitting i18n costs several times what building with it costs, and the bilingual audience *is* the product. |
| 9 | **No ratings in v1** | Reputation needs volume to mean anything and creates disputes nobody is staffed to arbitrate. |
| 10 | **Campus on both listing and profile, and they can differ** | Profile campus is where the seller is based; listing campus is where the item is, pre-filled but always editable. Locking them together produces confidently wrong pickup locations. |
| 11 | **Languages spoken, curated list, no proficiency levels** | "Can we complete a deal?" is a binary question. Free text fragments the filter; CEFR grades are self-reported noise. Framed as *"languages I can do a deal in"*, which self-selects for fluency. |
| 12 | **No nationality or country field** | The legitimate need — will we understand each other — is met by languages. A nationality field adds nothing beyond a sorting axis nobody should be given. |
| 13 | **Language in the URL path (`/en/`, `/zh/`), not a cookie** | Listings get shared into WeChat groups. A cookie-only switch opens shared links in the wrong language for half the recipients. |
| 14 | **UGC is not translated in v1** | Interface i18n solves half the barrier; listing text is the visible half. An on-demand translate button is the highest-value item on the later list, not a v1 shortcut. |
| 15 | ~~Theme in `localStorage`, three states~~ → **Light mode only** | Superseded. The product ships light-only: no toggle, no `prefers-color-scheme` switch, so a viewer whose system is dark still gets the light theme. The measured dark palette is kept but parked in `design/tokens.css` (opt-in via `[data-theme="dark"]` only) — restoring it is uncommenting one media query plus the toggle. |
| 16 | **No CJK webfont; system Chinese faces, self-hosted Inter for Latin** | Overrides the guidelines' Noto SC spec. CJK faces are multi-megabyte, and Google Fonts is unreliable from the mainland — for precisely this product's users. See interface.md. |
| 17 | **Dark theme shifts the brand blue from accent to surface** *(parked with #15)* | `#003F88` measures **1.84:1** against a dark background — it disappears. Links and focus move to a lifted `#6FA8F5` (7.63:1). Every substitute is measured, not eyeballed. Kept documented so re-enabling dark does not repeat the analysis. |
| 18 | **Palette, type scale and grid from the ZJU guidelines. No seal, no wordmark, no eagle.** | Visual coherence with the campus is legitimate and desirable; the marks are not ours to use. Needs an own wordmark and favicon — see open questions. |
| 19 | **A persistent, bilingual "not official" banner above the header** | Settled below. |
| 20 | **Approach the international office only once there is traction** | A working site with real listings is a different conversation from a proposal, and costs the university nothing to say yes to. |
| 21 | **Default feed sort is recency *with category diversity*, not pure newest-first** | Users judge the whole catalogue from the first few items. One person posting eight textbooks would make this look like a textbook site to every first-time visitor. ~20 lines of query logic; highest-leverage UX rule in the project. |
| 22 | **The zero-result page is a first-class page, not an edge case** | On a board with a few hundred listings most specific searches return nothing — that is the normal experience. It auto-relaxes the narrowest filter, says so, offers one-tap widening, and always shows browsable listings underneath. |
| 23 | **"Load more" button — not infinite scroll, not pagination** | Tested better than both, provided the URL keeps up so Back returns you to the item you were reading. The `Showing 24 of 42` count tells users whether widening a filter is worth it. |
| 24 | **One unified hit area per listing card, with the link as a stretched overlay** | 76% of sites leave users unsure what is clickable in a list item. Wrapping the card in an `<a>` is also invalid HTML once it contains a favourite button — which it does. |
| 25 | **Price filter is mandatory and always visible** | 80% of users in mobile testing applied a price filter regardless of category. On a student market it is the whole question. |
| 26 | **Permission tests are written before the features they protect** | IDOR — forgetting to check that the thing you're editing is yours — is the most likely serious vulnerability in an app shaped like this, and it is invisible in normal use. See infrastructure.md 4.1. |
| 27 | **The prototype runs on PostgreSQL, not SQLite** | It began on SQLite only because no database server was installed. Migrating once Postgres was available turned three "prototype-only" compromises into the real thing: trigram-indexed search that works in Chinese, `citext` emails, and constraints enforced by the engine rather than the app. Cost: one npm dependency and an async rewrite of every call site. |
| 28 | **Every uploaded image is re-encoded server-side** | One operation strips hidden payloads, normalises size, and removes EXIF GPS. A dorm-room photo carries the dorm's coordinates; publishing that next to a "message me" button is a safety problem. |

## Branding — settled

**Decided:** use the ZJU **palette, type scale, and grid**. Do **not** use the
seal, the eagle, or the 浙江大学 wordmark. Carry a persistent notice that this is
an independent student project. The reasoning is kept below because it is the
part that has to survive the temptation to add the seal "just in the footer".

### The disclaimer banner

**Placement:** a slim strip directly above the header, on every page. Persistent,
not dismissible — a notice that can be clicked away is worth much less as a
disclaimer, and this one exists to be seen by someone who lands on a single
listing from a WeChat link and never visits the homepage.

**Draft wording, both locales shown in full — this line is never machine
translated:**

> **EN** — An independent project built by students, for students. Not an
> official Zhejiang University platform, and not affiliated with or endorsed by
> the university.
>
> **中文** — 本站为学生自发开发的独立项目，非浙江大学官方系统，与浙江大学无隶属或
> 认可关系。

Short form for the strip itself, with the full sentence in the footer and on the
About page:

> **EN** — An independent student project · Not an official ZJU platform
> **中文** — 学生独立开发项目 · 非浙江大学官方平台

**Styling — settled on Navy 900.** The strip is **Navy 900 `#002451` with white
text**, 15.32:1, one line, around 32px tall.

It went neutral → Innovation Red (client) → Navy 900 (client). The concern raised
against red was that red is reserved for one primary action per view (guideline
rule 3) and that an alarm-styled banner on every page trains users to ignore the
top of the site, which is where the search bar lives. **Navy resolves that
without argument:** the notice reads as institutional rather than as an alert,
legibility roughly doubles, and Innovation Red returns to marking exactly one
thing.

One property to preserve: Navy on the Blue 800 header measures **1.51:1** as
adjacent bands and shares its hue, so the two would merge into a single dark mass
without the hairline seam on the strip's lower edge. Keep it.

On mobile it costs viewport on every page, so keep it to one line at
`--zl-text-caption` size and let it scroll away with the page rather than sticking.

### Why this is the right call

Unless the university sanctions the project, using the official seal or
presenting the site as a ZJU service claims an affiliation you do not have. That
is a trademark problem and, more practically, the fastest way to get the project
shut down by the university rather than adopted by it.

The guidelines deck says as much itself: colour values and the seal come from
ZJU's published identity, while type, grid, and components are proposed
extensions, and a true vector master should be requested from ZJU's brand office.

Also: avoid a domain containing `zju`.

If the university does adopt it, all of this reverses and the guidelines apply in
full — which is a good reason to ask, once there is something to show. See
*Institutional adoption* in `architecture.md`.

<details>
<summary>Original warning, kept for the record</summary>

## ⚠️ Branding: do not imply ZJU endorsement

`../Branding Guidelines/` is a strong, well-built spec — and it is for **ZJU's own
identity**. Unless the university sanctions this project, using the official seal
or presenting the site as a ZJU service claims an affiliation you do not have.
That is a trademark problem and, more practically, the fastest way to get the
project shut down by the university rather than adopted by it.

The deck says so itself: colour values and the seal come from ZJU's published
identity, while type, grid, and components are proposed extensions, and a true
vector master should be requested from ZJU's brand office.

**Until there is written permission:**

- Use the **palette, type scale, grid, and spacing** — visual coherence with the
  campus is fine and desirable. That is what `design/tokens.css` holds.
- Do **not** use the seal, the eagle, or the 浙江大学 wordmark as the site's logo.
  Commission or draw a distinct wordmark.
- Carry a footer line on every page: *An independent student project. Not
  affiliated with or endorsed by Zhejiang University.*
- Avoid a domain containing `zju`.

If the university does adopt it, all of this reverses and the guidelines apply in
full — which is a good reason to ask early. See *Institutional adoption* in
`architecture.md`.

</details>

| 29 | **Adopt OLX's listing-page information architecture, not its homepage or business model** | A labelled Details table, seller "last active", a visible report control and a sticky contact column. Rejected: the directory homepage (empty at our scale), list-row search results (ours is photo-led and mobile-first), promoted listings and ads (no paid tier — #1), payments/instalments (out of scope — #1), ratings (#9). See ux-guidelines.md 7. |

| 30 | **Campus is a persistent scope in the header; search results are the one exception** | Modelled on OLX's region picker, down to the map pin and two-line label. The header scope filters every page *except* search, which it only *seeds*; from the first rail interaction the rail wins — including an empty campus selection, which means "all". The rail stamps `f=1` and that marker, not the presence of a value, is the signal. Changing the header while on search strips the rail's campus state so the new scope applies. The trade: campus is not in the URL, so a shared search link shows the recipient's own scope. |
| 31 | **Search uses a left rail; the home feed keeps chips** | Baymard is cautious about horizontal filter toolbars past 6–8 types and prefers a rail, because a rail shows the options without opening anything. Search has campus + category + price + condition; the home feed keeps one category chip row, being a browse surface rather than a refine surface. Below 900px the rail collapses behind a Filter pill. |

| 32 | **Search facets are multi-select: OR within a facet, AND across facets** | Price (range slider) first, condition (multi-select dropdown) second, then campus and category as checkbox lists. Repeated URL params (`?campus=a&campus=b`) carry the state, matched with `= ANY($n)` so any number of ticks stays one parameter. Facet counts are computed with that facet's own selection lifted, or ticking one value would zero every sibling. |
| 33 | **One `selQuery()` maps selection state to URL names** | State is plural (`campuses`), the URL is singular-repeated (`campus`). Every link built from a selection goes through the mapper — chips, load-more, sort, no-results widening. Skipping it silently drops filters, which is exactly what happened on the first pass. |

## Confirmed by the client

- 30-day auto-expiry with a day-27 renew email (#6).
- A **Free / Giveaway** category.
- Palette / type scale / grid yes, seal and wordmark no (#18).
- Persistent "not an official ZJU system, by students for students" banner (#19).
- Prototype on existing Brazilian hosting (#2).
- International office approached later, if it gains traction (#20).

## Open questions

Ordered by how much they block. The first three change the build; the rest can be
answered while building.

1. **ZJU email domains.** Which addresses are actually issued to international
   students, and when? If many students don't have one on arrival, "verified
   address required to post" would cut off the supply side. Decides the entire
   anti-spam posture.
2. ~~**Official or independent?**~~ **Settled: independent for now**, university
   approached once there is traction. Everything below assumes that.
3. ~~**Product name and wordmark.**~~ **Settled: `WeZJUers`.** A name the
   community already uses for itself, so it reads as students speaking rather
   than the university speaking — which is the distinction this whole section
   turns on. The wordmark is set in the body typeface as planned: "We" in the
   tint, the name in the weight, the full stop in the accent. The app mark is a
   rounded tile with a stroked W and that same full stop — not the circular
   blue seal, which is the shape being avoided. **Still open: the domain.** The
   name now carries `zju`, which this entry originally argued against, so the
   domain has to carry the distance the name no longer does (`wezjuers.com`
   over anything resembling `zju.edu.cn`), and the disclaimer strip stays on
   every page. 求是 is still out: the motto reads as institutional voice. If the
   university ever objects, the name is the thing that changes and the product
   is not — it lives in one i18n key and one SVG.
   **Update: the header now uses the PNG wordmark** (`app/public/logo-white.png`)
   instead of real text. This supersedes the real-text wordmark described above.
   The trade-off: a rename now needs new PNGs, not just a new string. The `alt`
   text still comes from the brand name in the i18n dictionary (`t('brand')`),
   so screen readers and the rename rule hold.
4. **Measure the real latency from campus before building around it.** A timing
   run from a Chinese network against the Brazilian host, at ~21:00 China time
   when the links are busiest. It decides whether the CDN work is urgent or
   merely sensible, and whether "needs a VPN" is even true.
5. **Who operates it after you graduate?** A campus service with one maintainer
   dies at graduation. A student organisation as steward, or a documented handover,
   is the difference between a portfolio piece and something ZJU still uses in
   three years.
6. **Launch timing.** The product is worthless while empty, and supply is
   seasonal. Aim at a **June graduation wave** — hundreds of students clearing
   rooms in the same fortnight — and seed it with a few dozen real listings before
   opening the doors.
7. **Campus list.** Confirm the seven campuses and their current names against
   ZJU's own site — the list in `product-spec.md` is written from general
   knowledge and campuses do get reorganised.
8. **Language list.** The starting list of twenty is a guess at ZJU's
   international intake. If the international student office will share
   enrolment by nationality, the list should be cut to what students actually
   speak — a picker with fifteen dead options is worse than one with eight live
   ones.
9. **Moderation load.** Who reads the report queue, and how fast do they promise
   to respond? Write the answer on the rules page.
10. **Cross-border data transfer.** Hosting in Brazil means Chinese users' data
    leaves China, which PIPL regulates; LGPD applies where it lands. Minimising
    what is collected is the strongest mitigation and is already the design. Take
    actual legal advice before any of: a few hundred users, official university
    association, or mainland hosting. See infrastructure.md 7.2.
