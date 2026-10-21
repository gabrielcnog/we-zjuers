# Infrastructure guidelines

The engineering rules this project is built to. Written to be followed, and
written to be understood — where a term is jargon, it gets explained once, in
plain language, and then used.

Nothing here is exotic. A campus marketplace is a well-understood shape of
software; almost every serious risk it carries is one of a handful of known
mistakes, and this document exists so we make none of them by accident.

---

## 1. How the pieces fit together

Five parts, and it helps to hold the whole picture before the details:

| Part | What it does | Choice |
|---|---|---|
| **Web app** | Draws the pages and handles what users do | Next.js (TypeScript) |
| **Database** | Remembers everything: users, listings, messages | PostgreSQL |
| **Object storage** | Holds the photo files (databases are bad at files) | Cloudflare R2 |
| **CDN** | Copies of the site kept near users so pages load fast | Cloudflare |
| **Email** | Sends login codes and expiry reminders | Resend or Amazon SES |

> **CDN** — a network of servers around the world that keep copies of your files.
> When someone in Hangzhou loads a photo, it comes from an edge node in Hong Kong
> rather than crossing the Pacific to Brazil. For this project it is not an
> optimisation, it is what makes the site usable at all — see `architecture.md`.

**The rule that keeps options open:** the app must not depend on any one host's
special features. No proprietary database extensions, no host-specific image
functions, no serverless-only APIs. Then moving from Brazil to Hong Kong in phase
1 is a redeploy, not a rewrite.

---

## 2. Environments

Three, and they are never mixed up:

| Environment | What it is | Data |
|---|---|---|
| **local** | Your laptop | Fake seed data |
| **staging** | A private copy of the real thing | Fake seed data |
| **production** | What students use | Real |

**Rules:**

- **Never copy production data into staging or local.** It contains real
  students' emails and messages. Use a seed script that generates realistic fake
  listings — it also makes the empty-state and load-more work testable.
- Every environment gets its own database and its own credentials.
- Anything that sends email or SMS is disabled outside production, or points at a
  catcher inbox. The classic disaster is a test run emailing 400 real students.

---

## 3. Database

### 3.1 Migrations

> **Migration** — a numbered file describing a change to the database structure
> ("add a column", "create an index"). Running them in order turns an empty
> database into the current one.

- **Every schema change is a migration file, committed to git.** Nobody ever
  edits the production database by hand. This is not a purity argument: without
  it, staging and production silently diverge and a deploy that worked in testing
  breaks in production.
- Migrations run automatically as part of deployment, before the new code starts.
- **Expand, then contract.** To rename a column: add the new one, write to both,
  backfill, switch reads, *then* drop the old one — across separate deploys. A
  single destructive migration means the old code and the new database are
  incompatible for the seconds between them, and there is no way back.
- Never destructive in the same deploy as the code that stops using it.

### 3.2 Correctness rules

- **Money is integer cents. Never a float.** `0.1 + 0.2` is not `0.3` in floating
  point, and a marketplace that miscounts money loses trust it cannot buy back.
- **All timestamps are `timestamptz`, stored in UTC**, converted to
  `Asia/Shanghai` only for display. Storing local time makes every future
  question about "when" unanswerable.
- **Foreign keys are declared, with `ON DELETE` behaviour chosen deliberately.**
  Deleting a user should not leave messages pointing at nobody.
- **Constraints live in the database, not only in the app.** `NOT NULL`, unique
  indexes, check constraints. Application code has bugs; the database is the last
  line that holds.
- **Soft-delete user-visible content** (`deleted_at`), so a mistaken deletion is
  recoverable and a moderation decision is auditable. Hard-delete on a schedule.

### 3.3 Indexes

An index is a lookup structure that turns "check all 50,000 rows" into "jump
straight there". Without them the site is fine at 200 listings and unusable at
20,000, which is exactly the kind of failure that arrives the week you succeed.

The three that carry almost every query:

```
(status, bumped_at desc)
(status, category_id, bumped_at desc)
(status, campus, bumped_at desc)
```

Plus a GIN index on `spoken_languages` and the trigram index for search.

**Rule:** before adding an index, run `EXPLAIN ANALYZE` on the real query. Indexes
cost write speed and disk; adding them speculatively is how a schema rots.

### 3.4 Query rules

- **No N+1 queries.**
  > **N+1** — fetching a list of 24 listings with one query, then firing one more
  > query per listing to get its photos: 25 queries where 2 would do. It is the
  > single most common cause of a slow page, and at 350 ms to Brazil each extra
  > round trip is brutal. Fetch the listings, then fetch all their photos in one
  > query keyed by listing id.
- **Cursor pagination, never `OFFSET`.**
  > `OFFSET 10000` makes the database walk and discard 10,000 rows every time.
  > Instead, remember where you stopped (`bumped_at` + `id`) and ask for rows
  > after that point. Constant speed at any depth, and it doesn't skip or repeat
  > items when someone posts while you're scrolling.
- **Never `SELECT *`.** Name the columns. It keeps the payload small and stops a
  new column from silently appearing in an API response.
- **Use a connection pooler** (PgBouncer, or the host's). Databases allow a
  limited number of simultaneous connections; without pooling, a traffic spike
  exhausts them and the site returns errors while the database sits idle.
- **Set a statement timeout** (5s). One pathological query must not hold the site.

### 3.5 Backups

- Automated **daily backups**, plus point-in-time recovery if the host offers it.
- Retention: 30 days.
- **Restore drill every quarter.** An untested backup is not a backup — restore
  it into staging and confirm the site runs. This is the single most-skipped
  practice in small projects and the one that ends them.

---

## 4. Security

The largest section, because this is where a student project can do real harm to
real people. Ordered roughly by how likely each is to bite.

### 4.1 Authorization — the bug class that will actually happen

> **IDOR** (insecure direct object reference) — the URL `/listing/1234/edit`
> loads listing 1234 and lets you edit it. The bug is forgetting to check that
> 1234 *belongs to you*. Change the number, edit someone else's listing.

This is the most common serious vulnerability in applications shaped like this
one, and it is invisible in normal use because the UI never offers the link.

**Rules:**

- **Every query that touches user-owned data is scoped by the current user id in
  the query itself** — `WHERE id = $1 AND user_id = $2` — not checked afterwards
  in application code, and never trusted from a hidden form field.
- Write the check for *edit, delete, mark-sold, read-message-thread, and view
  contact details* first, before the feature works at all.
- One integration test per owned resource that asserts user B gets a 404 on user
  A's object. These tests are boring and they are the ones that matter.

### 4.2 Authentication

- **Login codes are hashed before storage**, exactly like passwords. A leaked
  database must not hand over live login codes.
- Codes: 6 digits, **10-minute expiry, maximum 5 attempts, then invalidate**.
  Without the attempt limit a 6-digit code is trivially brute-forced.
- **Rate limit code requests** — per email and per IP — or the login form becomes
  a free email-bombing service pointed at whoever the attacker chooses.
- **Session tokens are random (≥256 bits), hashed in the database**, delivered in
  a cookie that is `HttpOnly`, `Secure`, `SameSite=Lax`.
  > `HttpOnly` means JavaScript cannot read it, so a script injection can't steal
  > the session. `Secure` means it never travels unencrypted.
- Rotate the session token on login. Expire after 30 days, sliding.
- Let users see their active sessions and sign out everywhere.

### 4.3 Input validation

- **Validate every input at the boundary against a schema** (zod or equivalent) —
  body, query string, and route parameters. Anything not in the schema is
  rejected, not ignored.
- **Never trust the client.** The client-side check is a courtesy to the user;
  the server-side check is the actual rule. Both, always.
- Enforce lengths server-side: title 80, description 2000, message 2000. Without
  a cap, someone posts a 40 MB description and the feed stops loading.

### 4.4 Injection and output

- **Parameterised queries only.** Never build SQL by joining strings. Modern
  query builders do this by default — the rule is to never reach around them.
- **Escape all output.** React does this by default; the rule is that
  `dangerouslySetInnerHTML` is banned on user content, with no exceptions.
- If listing descriptions ever support formatting, sanitise with an allow-list
  (not a block-list) on the **server**.

### 4.5 File uploads — the highest-risk feature in this product

Photos are the one place users hand us arbitrary bytes that we then serve back to
other users.

- **Verify the file type by reading its bytes, not its extension or the
  browser-supplied MIME type.** Both are trivially faked.
- **Re-encode every image server-side.** Decode it, strip everything, write a new
  JPEG/WebP. This does three jobs at once: it removes any payload hidden in the
  file, it strips **EXIF — including GPS coordinates**, and it normalises size.
  > A photo taken in a dorm room carries the dorm's coordinates. Publishing that
  > alongside a "message me" button is a safety problem, not a privacy nicety.
- Hard limits: **6 files, 10 MB each before resize, 1600px longest edge after.**
- Store with a **random generated filename**, never the user's.
- **Serve images from a different domain** than the app (an R2 custom domain), so
  a malicious file can never execute in the app's security context.
- Set `Content-Type` explicitly on serve; never `Content-Disposition: inline` for
  anything that isn't a verified image.

### 4.6 Rate limiting

Applied per IP *and* per account:

| Action | Limit |
|---|---|
| Request a login code | 5 / hour / email, 20 / hour / IP |
| Create a listing | 10 / day |
| Start a new message thread | 20 / day |
| Send a message | 60 / hour |
| Report | 20 / day |
| Search | 60 / minute / IP |

Without these, one script fills the feed with spam overnight and the product is
dead on arrival.

### 4.7 HTTP security headers

Set once, in middleware:

- `Content-Security-Policy` — the highest-value header. Restrict scripts to your
  own origin; it turns most injection bugs into non-events. Start in
  report-only mode, then enforce.
- `Strict-Transport-Security` — HTTPS only, forever.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — switch off camera, microphone, geolocation.

### 4.8 Secrets

- **Never in git.** Environment variables only; `.env` is in `.gitignore` from
  the first commit, and `.env.example` documents the names with fake values.
- Different credentials per environment.
- If a secret is ever committed, **rotate it** — deleting the commit does not
  un-leak it.

### 4.9 Dependencies

- Commit the lockfile.
- Automated vulnerability alerts (Dependabot); patch anything critical within a
  week.
- Be conservative about adding packages. Every dependency is code you did not
  write running with your privileges.

### 4.10 Logging

- **Never log** login codes, session tokens, email addresses, or message bodies.
- Log enough to debug: request id, route, status, duration, user id.
- Admin actions (hide listing, suspend user) go to an **append-only audit log**
  with who, what, when, why. If the platform ever becomes official, this is the
  first thing the university asks about.

---

## 5. Performance

Budgets from `interface.md`, and the engineering that meets them.

### 5.1 Caching, outermost first

1. **CDN edge** — images and static assets cached for a year with a content hash
   in the filename (`logo.a3f9.css`), so a new version is a new URL and the old
   one can be cached forever without ever going stale.
2. **Edge-cached HTML** for the home feed, 60 seconds. It is the most-requested
   page and the least personal.
3. **Application cache** for things that are read constantly and change rarely:
   the category list, the campus list, per-category counts.
4. **The database's own cache**, which mostly takes care of itself if the indexes
   are right.

### 5.2 Images

The entire bandwidth bill, so this is where the effort goes:

- **Resize in the browser before upload** — 5 MB becomes ~250 KB before it
  touches the network. Biggest single win, and it also makes uploads work on bad
  campus wifi.
- Serve WebP with a JPEG fallback; generate card-size and detail-size variants.
- `srcset` per size. Never ship a detail image to a grid card.
- Lazy-load below the fold; eager-load the first row.
- A blurhash or dominant-colour placeholder at the right aspect ratio, so the
  grid never reflows. That is the whole CLS budget.

### 5.3 The app

- **Server-render the feed and listing pages.** They are content; they should
  arrive as HTML, not as a loading spinner that then fetches JSON.
- Ship as little JavaScript as possible — budget 150 KB gzipped.
- Brotli compression on all text responses.
- HTTP/2 or 3, so connections are reused rather than re-handshaked.
- **Measure on a real device on campus wifi**, not on a laptop in Hangzhou on
  fibre and certainly not in São Paulo. Lighthouse on a throttled connection is
  the minimum bar; a real phone is the real test.

---

## 6. Reliability and operations

### 6.1 Continuous integration

On every push, automatically: typecheck, lint, run tests, build. **A branch that
fails cannot be merged.** This is the cheapest quality mechanism available.

### 6.2 Deployment

- Deploys are **atomic**: the new version is built completely, then traffic
  switches. Users never see a half-updated site.
- **A rollback is one command**, and you have run it once on purpose so you know
  it works.
- Deploy small and often. A deploy containing one change has one suspect when it
  breaks.

### 6.3 Monitoring

You cannot fix what you don't know is broken, and nobody will report it — they
will just leave.

- **Error tracking** (Sentry free tier): every unhandled exception, with a stack
  trace and the route.
- **Uptime check** every 5 minutes from outside, ideally from Asia, alerting to
  your phone.
- **Structured request logs** with duration, so "the site feels slow" becomes a
  number.

**Alert only on things you would get out of bed for:** the site is down, error
rate has spiked, the database is nearly full, backups have stopped. Everything
else is a dashboard. An alert that fires often is an alert that gets ignored.

### 6.4 Email deliverability — quietly critical here

Login is an emailed code. **If the mail lands in spam, nobody can sign in**, and
this is a product for an audience largely on QQ Mail, 163, and Outlook — all
aggressive filterers.

- Configure **SPF, DKIM and DMARC** on the sending domain from day one.
- Send from a real subdomain (`mail.yourdomain`), never a free address.
- Test delivery into QQ Mail, 163, Gmail and Outlook **before launch**, and keep
  those four accounts to retest after any sending change.
- Watch the bounce rate. A rising bounce rate is the early warning that sign-ins
  are silently failing.

---

## 7. Privacy and law

Small project, real obligations. The best compliance strategy is having very
little to protect.

### 7.1 Collect almost nothing

Email, display name, campus, languages, an optional WeChat ID. **No phone number,
no student ID number, no real name requirement, no address, no date of birth, no
payment details ever.** Every field not collected is a field that cannot leak.

### 7.2 Cross-border data transfer — know this one

Hosting in Brazil means the personal data of Chinese users **leaves China**.
China's Personal Information Protection Law (PIPL) regulates cross-border
transfers of personal information, and Brazil's LGPD applies to data processed
there. A few hundred students on a free campus board is not where enforcement
starts — but the exposure is real and it grows with the project.

**Practical position for the prototype:**

- Minimise what is collected (7.1) — the strongest mitigation by far.
- Say plainly, in the privacy notice **in both languages**, where data is stored
  and that it is outside China.
- Get clear consent at sign-up, not buried in a footer.
- Provide account deletion that genuinely deletes, and data export on request.
- **Revisit properly before any of these:** more than a few hundred users, any
  official university association, or a move to mainland hosting. At that point
  take actual legal advice — this document is engineering guidance, not it.

### 7.3 Retention

- Expired listings: content kept 90 days, then images purged.
- Deleted accounts: anonymise immediately, purge within 30 days.
- Message threads: deleted with the account.
- Logs: 30 days.

---

## 8. Testing

Proportionate, not dogmatic. Three layers:

1. **Unit tests** for logic with rules: price formatting, expiry dates, the
   diversity sort, permission checks.
2. **Integration tests** for API routes, hitting a real test database. **Every
   owned resource gets the "user B cannot touch user A's thing" test** (4.1).
3. **End-to-end tests** for exactly three flows, because these are the ones whose
   breakage kills the product: *sign in* · *post a listing with a photo* ·
   *message a seller*.

Plus: run the accessibility checker (axe) in CI, and every bug that reaches
production gets a test before it gets a fix.

---

## 9. Cost

At student scale, on free tiers, roughly:

| | Monthly |
|---|---|
| Hosting (existing Brazilian server) | already paid |
| PostgreSQL (free tier, or on the same box) | 0 |
| Cloudflare CDN (free tier) | 0 |
| R2 object storage (~50 GB of photos) | ~US$1 |
| Email (3,000/month free tier) | 0 |
| Error tracking (free tier) | 0 |
| Domain | ~US$1 |

**Under US$5/month**, and the first thing to grow is image storage. Budget for
the CDN to stay free — it will, at this scale.

---

## 10. Build order

Sequenced so that each step is testable and nothing is built on sand.

**Phase A — foundations**
1. Repo, TypeScript, lint, CI running on every push.
2. Database, migration tooling, the schema from `data-model.md`, seed script.
3. Auth: email code, hashed, rate limited, sessions.
4. **The permission tests from 4.1, before the features they protect.**

**Phase B — the loop that makes it a product**
5. Post a listing, with the full image pipeline (validate, re-encode, strip EXIF,
   store, serve variants).
6. Home feed with the diversity sort, category and campus filters.
7. Listing detail page and public profile.
8. My listings: edit, mark sold, delete.

**Phase C — finding and talking**
9. Search with trigram matching, filters, applied-filters bar, sort.
10. **The no-results page**, built properly — see `ux-guidelines.md` 3.2.
11. Messaging threads, with the WeChat reveal.
12. Favourites.

**Phase D — before anyone real uses it**
13. Reports and the admin queue, plus the audit log.
14. Expiry job, the day-27 renew email, purge job.
15. Security headers, CSP enforced, rate limits verified.
16. Email deliverability tested into QQ/163/Gmail/Outlook.
17. Backups running **and a restore tested**.
18. Error tracking and uptime alerting live.
19. Privacy notice and rules page, both languages.
20. Accessibility pass and a real-device performance test on campus.

**Do not launch before 13–20 are done.** They are unglamorous and they are the
difference between a demo and something students can be asked to trust.
