# WeZJUers

Side project of a social platform for students at Zhejiang University, in China.
**Not an official platform**: it is not run by, or affiliated with, the university.

A free, bilingual (English / 中文) place for students to pass things on to each
other, ask questions, and find out what is on. No payments, no fees: money and
goods change hands in person, on campus.

| Section | What it does |
|---|---|
| **Community** | Boards for questions, tips and meet-ups: posts, replies, votes |
| **Marketplace** | Second-hand listings, filtered by campus and category, with an optional WeChat contact |
| **Events** | Free events run by university groups: join with one click, or enter a team for tournaments |
| **Guidebook** | Practical guidance for new international students, with a glossary |

Built for international students first, with a campus (not a city) as the unit
that matters: ZJU is spread across seven.

## Try it

Everything runs in a **read-only demo mode** with made-up sample data. Press
*Browse as a demo student* and look around. Posting, messaging, joining and
voting are switched off, and nobody can create an account, so nothing you do
there is saved.

```bash
cd app
npm install
DEMO_MODE=1 npm start        # http://localhost:4400
```

That is the whole setup. You need **Node 22+** and a local **PostgreSQL** (tested
on 15) with the `citext` and `pg_trgm` extensions, both of which ship with the
standard contrib package. The app creates its own database on first run
(`postgres://localhost/listings_dev`, or set `DATABASE_URL`) and loads the
sample data, including photos, into it.

### Without demo mode

`npm start` on its own runs the full app, with sign-in by emailed code. There is
no mail sender, so in development the code is shown on screen instead. Never
run it that way on a public server: anyone could sign in as anyone. To seed it
the long way:

```bash
npm run seed && npm run seed:community && npm run seed:events
```

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gabrielcnog/we-zjuers)

[`render.yaml`](render.yaml) describes a web service and a Postgres database,
and sets `DEMO_MODE=1`. The sample data loads itself on first boot, so there is
nothing to seed and no keys to set.

On Render's free plan the service sleeps when idle (the first request after a
quiet spell is slow) and the free database is time-limited. Check their current
terms before relying on it for anything long-lived.

| Variable | Purpose |
|---|---|
| `DEMO_MODE=1` | Read-only demo: no sign-up, no email sign-in, one shared demo account. Loads the sample data into an empty database. |
| `NODE_ENV=production` | Secure cookies, and the sign-in code is never shown on screen. |
| `DATABASE_URL` | Postgres connection string. Defaults to a local database. |
| `PORT` | Defaults to 4400. |
| `UNSPLASH_ACCESS_KEY` | Local use only, for `npm run photos`. Not needed to run or deploy. |

## How the demo stays safe

Demo mode is a single switch, enforced in one place rather than route by route
([`app/lib/demo.mjs`](app/lib/demo.mjs)):

- **No accounts.** Email sign-in and sign-up are refused outright, not merely
  hidden: a hand-written request gets the same refusal as the form.
- **Read-only.** Every write is refused unless it is on a short allowlist
  (sign out, the demo login, revealing a seller's WeChat ID). A route added later
  is read-only by default.
- **Shared, short-lived account.** One demo student, a one-day session, and a
  cap on how fast sessions can be created.
- **Nothing private in the data.** Every sample address is on `example.com` (or
  is the made-up `demo@we-zjuers.com`), and the snapshot leaves out sessions,
  sign-in codes, messages and reports.

## What is real, and what is faked

Real: the pages, the filtering and search, the forum and its ranking, events and
team sign-up, the moderation reports, the two languages. Faked: the people and
their posts, and email delivery (there is none). See
[`app/README.md`](app/README.md) for the full list and the engineering notes.

## Layout

```
app/       the server (Node, no framework), views, seed data and scripts
design/    the design system: tokens, components, living documentation
docs/      product spec, architecture, data model, decisions
scripts/   make-snapshot.sh, which regenerates the demo's sample data
```

| Document | What it settles |
|---|---|
| [docs/product-spec.md](docs/product-spec.md) | Who it is for, the pages, what ships in v1 |
| [docs/architecture.md](docs/architecture.md) | Stack, hosting, auth, images, and the China-specific constraints |
| [docs/infrastructure.md](docs/infrastructure.md) | Engineering rules: database, security, performance, privacy |
| [docs/interface.md](docs/interface.md) | Language switch, responsive behaviour, the performance budget |
| [docs/data-model.md](docs/data-model.md) | Entities, fields, relations |
| [docs/community.md](docs/community.md), [docs/events.md](docs/events.md) | The two newest sections |
| [docs/decisions.md](docs/decisions.md) | Decisions taken, with their reasoning, and what is still open |
| [design/](design/) | Design system v1.0 |

To change the sample data, edit the seed scripts, run them against a local
database, then `npm run snapshot` (from `app/`) to regenerate
`app/seed/demo-data.sql`.

## Credits

Listing photos are from [Unsplash](https://unsplash.com) and shown with their
photographers' credit, linked back to the photo, as Unsplash's guidelines ask.
