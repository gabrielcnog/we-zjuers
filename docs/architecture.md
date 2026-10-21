# Architecture

> Every regulatory claim below carries a knowledge cutoff and Chinese platform
> rules move fast. **Verify each one before it becomes load-bearing.** They are
> written down here so they get checked, not so they get trusted.

## Hosting — a three-phase path

Hosting is the decision that cascades into auth, cost, and legality. The plan is
staged, and only phase 0 is committed.

### Phase 0 — prototype on existing Brazilian hosting *(current)*

Free, already owned, nothing to procure, no filing, no entity. For proving that
students will post and browse at all, that is the right trade. Two things about
it are worth being precise on, though, because one of them is probably a
misconception and the other is a real cost.

**It is almost certainly not blocked — it is far away.** A Brazilian host is not
on any block list; nothing about this site attracts one. So the framing should
not be "users need a VPN". It should be **"test it from a Chinese network before
assuming anything"** — a `curl -w` timing run and a page load from a phone on
campus data settles it in ten minutes. The likely finding is that it works
without a VPN and feels sluggish.

**The real cost is distance.** São Paulo to Hangzhou is roughly 17,700 km, routed
through North America or Europe: expect somewhere around **300–400 ms round
trip** — measure it, don't trust that number. On a cold connection, DNS + TCP +
TLS is three round trips *before the request is sent*, so ~1s elapses before the
first byte moves. Then every image pays the same tax. China's international links
also congest in the evening — 20:00–24:00 local, which is exactly when students
browse.

**Also worth knowing: a VPN usually makes this worse, not better.** It adds a hop
and a second encryption layer. It helps only when the direct route is being
throttled and the VPN happens to have better peering. Don't design around it.

**The mitigation is a CDN with Asian edge nodes, and it is close to free.** Put
Cloudflare (free tier) in front of the Brazilian origin:

- **TLS terminates at a Hong Kong / Japan / Singapore edge node**, so the
  handshake costs ~2 round trips to Asia instead of ~2 round trips to Brazil.
  That alone is most of the perceived slowness, and it applies to *every*
  request, cached or not.
- **Images and static assets serve from the edge.** They are the overwhelming
  majority of bytes, and after the first fetch they never cross the Pacific again.
- **Cache the home feed HTML at the edge** for 60 seconds. The feed is the most
  requested page and the least personal; a minute of staleness is invisible on a
  board where listings last 30 days.

With that in place, only uncached API calls pay the full Brazil round trip — and
those are actions (post, message, favourite), where a user already expects a
pause. This is the difference between "slow but usable" and "needs a VPN".

**One consequence to accept deliberately:** if it *does* end up needing a VPN,
the product becomes international-students-only in practice. Chinese students
generally don't run one, and for Chinese nationals the legal position is grey.
That is survivable for a prototype whose primary audience is international
students — but it should be a known trade, not a surprise discovered at launch.

### Phase 1 — offshore Asia (Hong Kong / Singapore), if it gains traction

40–80 ms from Hangzhou instead of 350. Still **no ICP filing**, because the
filing requirement applies to mainland hosting only. This is a hosting change and
nothing more — no re-architecture, no legal work, roughly one afternoon. Trigger
it the moment real usage makes latency the thing people complain about.

### Phase 2 — mainland, only alongside institutional adoption

**Hosting on the Chinese mainland requires an ICP filing (ICP 备案)**, tied to a
legal entity or an individual with Chinese ID, and a site carrying user listings
may attract extra review as an information-publishing service. A foreign student
can sometimes file individually with a residence permit, but it is slow and
uncertain. Don't attempt it alone — it arrives free with phase 2 below.

## Institutional adoption is the real unlock

**Agreed sequence: build the prototype first, approach the international office
once there is traction to show.** That is the right order — a working site with
real listings and real users is a fundamentally different conversation from a
proposal, and it costs the university nothing to say yes to something already
working.

If ZJU's international student office or a recognised student union then adopts
this as an official service, four hard problems dissolve at once:

1. An institutional entity can hold the **ICP filing**, opening mainland hosting.
2. Official status makes **WeChat Open Platform** registration realistic.
3. The university can **verify students** directly, which is stronger than any
   email check.
4. **Distribution** — one announcement to incoming students beats a year of
   organic growth on a marketplace that is worthless while empty.

Until that happens the site must not look like an official ZJU platform — see the
branding decision in `docs/decisions.md`, now settled.

**What to have ready for that meeting:** usage numbers, a screenshot of a busy
feed, the prohibited-items rules page, the report queue, and a one-page answer to
"who runs this after Gabriel graduates". The last one is what an institution will
actually worry about.

## Stack

Nothing exotic. The interesting problems here are product problems.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router), TypeScript** | Server-rendered listing pages index well and load fast on campus mobile data; one codebase for pages and API. |
| Database | **PostgreSQL**, co-located with the app | Relational data with a clear shape. Full-text search built in. Co-location matters more than region: an app in Brazil querying a database in Singapore pays the ocean crossing on every query. |
| Images | **Cloudflare R2** + Cloudflare CDN | S3-compatible, no egress fees, edge nodes in Asia. Images are the entire bandwidth bill, and this is the one component worth putting outside Brazil from day one. |
| Hosting | **Existing Brazilian host** for the prototype, behind a CDN with Asian edge nodes. HK/Singapore in phase 1. | See the phased plan above. Keep the app portable — no host-specific primitives — so phase 1 is a redeploy, not a rewrite. |
| Email | **Resend** or **Amazon SES** | Sign-in codes and expiry reminders. Nothing else. |
| i18n | `next-intl` or equivalent, EN + zh-CN | Message catalogues, not machine translation. |

Running cost at student scale should land **under US$10/month**, and can be zero
on free tiers until the image bucket grows.

## Authentication

### v1: email + 6-digit code

No passwords. The user types their email, receives a six-digit code, types it in.

**Codes, not magic links.** Links break when the mail app opens them in its own
in-app browser (losing the session it was meant to establish), and they fare
worse in Chinese providers' spam filtering. A code survives being read on a phone
and typed on a laptop.

**ZJU-verified badge.** Any email may register, but addresses ending in
`zju.edu.cn` (and its student subdomains) get a *ZJU verified* badge on their
listings. Consider going further and requiring a verified address to **post**,
while letting anyone **browse** — that single rule is most of your spam defence,
for free.

*Open question: confirm which domains ZJU actually issues to international
students, and whether they are issued on arrival or later. If a meaningful number
of students never receive one, restricting posting would gut the supply side.*

### WeChat login: deferred, and here's why

WeChat OAuth for a **website** goes through the WeChat Open Platform (微信开放平台),
whose *website application* (网站应用) type has historically required a **verified
company** — individual developers cannot register one. A **Mini Program** is the
more accessible route, but Mini Programs now require their own ICP filing, and
individual-entity Mini Programs are restricted in the categories they may serve;
a trading or UGC-heavy category will likely demand a company.

So: **WeChat ID is a profile field, not a login method.** Revisit when an entity
exists. The data model already carries `wechat_id`, so nothing has to be rebuilt.

### Real-name registration

Chinese regulation expects real-name verification for platforms carrying user
content, generally via a mainland phone number. An offshore-hosted campus board
for a few hundred students is not where that is enforced first — but it is a real
obligation the moment the project moves onshore or becomes official. **Do not
design as if it will never apply.** Email-verified identity plus a report queue
is the right posture for v1; phone binding is the migration path.

## Messaging

### Recommendation: async in-app threads. Not realtime, not WeChat-only.

Three options were on the table. The middle one wins:

**WeChat-only contact reveal** — cheapest, and wrong as the only option. Every
conversation leaves the platform on first contact, so you can never moderate a
dispute, and you learn nothing about whether the product works. Worse for users:
it forces someone to hand a personal WeChat ID to a stranger *before* finding out
whether the item is even still available.

**Realtime chat (websockets)** — unnecessary. Listings move over days. Realtime
buys presence indicators and typing dots, and costs you connection management,
scaling, and a much larger abuse surface.

**Async threads** — a message table, one thread per (listing, buyer) pair, an
unread badge, and an email notification when someone replies. A day or two of
work. Users experience it as chat because they check it like email.

Then let WeChat do what it's good at: once both sides want to meet, a
**"share my WeChat ID"** button in the thread reveals it to that one person.
Contact detail is exchanged in context, by choice, after intent is established.

**Abuse controls from the start:** rate-limit new threads per user per day, block
a user, report a message, and never expose an email address to another user.

## Images

Images are the cost, the performance ceiling, and the abuse vector.

- **Resize client-side before upload** — longest edge 1600px, JPEG/WebP q80.
  A phone photo goes from ~5 MB to ~250 KB before it ever touches the network.
  This one step matters more than any server-side optimisation.
- Max **6 images**, first is the cover.
- Store the original key only; serve resized variants through the CDN
  (`?w=400` for cards, `?w=1200` for detail).
- Strip EXIF on upload — **GPS coordinates in a dorm photo are a safety problem**,
  not a privacy nicety.
- Generate a blurhash or dominant colour for placeholder rendering.

## Search

Postgres full-text is enough — with one catch worth knowing before you build it:
**Postgres does not tokenise Chinese out of the box.** `to_tsvector` splits on
whitespace, and Chinese doesn't have any, so a whole phrase becomes one token and
search silently fails.

Two ways through:

- **v1:** `pg_trgm` trigram indexes with `ILIKE`/similarity. Works acceptably for
  both scripts at this scale, ships today, no extensions to negotiate with a
  managed host.
- **Later:** `pg_jieba` or `zhparser` for proper Chinese segmentation, if the host
  allows the extension. Otherwise Meilisearch, which handles CJK natively.

Search by title + description. Filters (category, campus, price, condition) are
plain indexed columns — keep them out of the text index.

## Moderation

One admin page, one report button, and a written rules page. That is the whole
system, and it is enough at this scale.

**Prohibited items must be listed explicitly** and enforced. At minimum: ID
documents and SIM cards, prescription medication, weapons, alcohol and tobacco,
adult material, gambling, live animals, counterfeit goods, pirated textbooks and
software, academic services (essay writing, exam sitting), sublets and visa
services. Several of these carry consequences in China well beyond a takedown —
this list is a legal shield for the operator, not decoration.

**Safety guidance on every listing page:** meet in a public campus location in
daylight, inspect before paying, no advance transfers, no deposits.
