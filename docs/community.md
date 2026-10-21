# Community — forum prototype

**Status:** exploratory prototype, built to see and feel the idea. Not a
commitment to ship. Everything here sits beside the marketplace; nothing in the
marketplace depends on it.

## What it is

A simplified Reddit for ZJU students, inside the same site:

- **Sections** — the header gains a second row: *Marketplace* / *Community*.
  Search, its rolling hint and the primary button (*Add listing* / *New post*)
  follow the section you are in. The campus picker is shared.
- **Boards** — eight fixed topics (Campus life, Housing & dorms, Visas &
  paperwork, Study & courses, Food & Hangzhou, Events & meetups, Language
  exchange, Internships & careers). Users cannot create boards.
- **Posts** — title, optional plain-text body, a type (*Question, Discussion,
  Tip, Event*), an optional campus, and optionally one of the poster's own
  listings linked in.
- **Comments** — threaded replies; indentation stops after four levels.
- **Upvotes** — up only. Sort by *Hot* (votes + replies, decaying with age),
  *New*, or *Top*.
- **Reports** on posts go into the existing report table.

## Decisions taken in the prototype

1. **Upvote-only, no downvotes.** A small campus community has nowhere near the
   volume for downvotes to mean "low quality"; in practice they mean "I
   disagree" or "stupid question", and the people asking basic questions are
   exactly the new international students the site exists for.
2. **Fixed boards, not user-created ones.** Every user-created board is a
   moderation surface with no moderator. Start with a handful; add more when a
   topic keeps overflowing. The list is reference data in
   `app/content/boards.mjs` and `migrate()` upserts it by slug on every boot, so
   adding a board is a line in that file and a restart — no re-seed, no post
   touched. Removing a line does not drop the board: posts reference it, and
   retiring one is a deliberate migration. Sports and clubs were the first
   overflow: both were listed inside *Events & meetups*, and neither is an
   event — one is four people looking for a fourth this afternoon, the other is
   a society recruiting for a year.
3. **Linking, not selling.** Posts may link a listing the poster owns (checked
   server-side), which is the bridge between the two halves. Selling in posts is
   against the guidelines — it would split the marketplace in two.
4. **Plain text only.** No images, no markdown, no link previews. Smaller attack
   surface, nothing to moderate that isn't words, fast on slow campus networks.
5. **Official-information disclaimer.** The about box and the paperwork board
   both say to confirm visa, housing and university rules with the official
   office. A forum will confidently spread outdated rules; the product should
   not look like it endorses them.
6. **Campus scope applies.** A campus selected in the header shows that
   campus's posts plus posts meant for everyone.

## What it would take to make this real — read before deciding

A marketplace and a forum are very different products to operate.

- **Moderation load changes category.** Listings are structured and mostly
  boring. Open text threads attract arguments, harassment, misinformation and
  political content. Someone must read reports daily, with a written policy and
  response time. This is the single biggest cost.
- **Regulation in China is stricter for forums than for classifieds.** Public
  discussion boards and comment sections fall under the Cyberspace
  Administration of China's rules for internet forum and comment services,
  which include real-identity verification of posters and content-management
  obligations on the operator. Combined with PIPL and hosting outside the
  mainland (docs/decisions.md, open question 10), this needs **actual legal
  advice before any public launch** — not after traction.
- **University sensitivity.** A student forum carrying the ZJU name in context
  is more likely to draw the university's attention than a second-hand market.
  The "not an official ZJU platform" framing matters even more here.
- **Cold start, twice.** An empty forum is worse than no forum. It should
  probably launch only once the marketplace has regular users, seeded with real
  questions from them.

A sensible path if the idea survives: validate with the marketplace first, then
open *one* board (e.g. Housing & dorms or Ask anything) to signed-in, verified
ZJU users only, with named volunteer moderators, and measure.

## Prototype files

| File | What |
|---|---|
| `app/content/boards.mjs` | The board list, both languages — reference data, upserted by `migrate()` |
| `app/db.mjs` (`COMMUNITY_SCHEMA`) | `board`, `post`, `comment`, `post_vote`, `comment_vote` |
| `app/lib/community.mjs` | Queries: feed/sorts, post, comments, votes, create |
| `app/views/community.mjs` | Feed, post page + comment tree, new-post form |
| `app/seed-community.mjs` | 26 posts, 79 comments across the 10 boards (`npm run seed:community`) |
| `app/server.mjs` | Routes under `/:locale/community` |

Seeded scores are synthetic (ten demo users cannot produce 60 upvotes), so the
seed writes `score` directly; real votes move it by one.
