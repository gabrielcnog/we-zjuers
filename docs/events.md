# Events

A fourth section, between Marketplace and Guidebook. University groups post
free events; students click once to join. No tickets, no payment, no waiting
list — the whole feature is a noticeboard with a register attached.

## Decisions

1. **Only verified organisers can post.** The feed tells students these events
   are official, so the right to post is granted per account:
   `"user".role` gained an `organizer` value beside `user` and `admin`. There
   is no admin UI for it — `npm run seed:events` grants it to two demo
   accounts, and in production it is a one-line `UPDATE`. A student who opens
   `/events/new` gets a page explaining the rule rather than a 404, because
   "why can't I post?" is a fair question with an answer.

2. **Attendance is public to signed-in students, and only to them.** Joining
   an event puts your name on a list anyone signed in can read, and on your
   profile. A signed-out visitor sees the count and a prompt — never the
   names. That line matters: a party guest list on the open web is indexable,
   and the people on it did not choose that. See `lib/names.mjs`.

3. **Names are shown formally — NOGUEIRA, Gabriel.** Attendance lists read as
   a register, and a register of "Gabriel N." is useless to an organiser
   trying to match names to a door list. The same split protects privacy: the
   formal form is for signed-in students, the short `display_name` for
   everyone else. Accounts without name parts fall back to `display_name`
   everywhere, so nothing renders blank.

4. **Teams are text, not accounts.** A football squad reliably includes
   someone who has never opened this site. The captain joins and types the
   squad into `event_signup.teammates`, one name per line. Chasing every
   teammate for a signup would mean half-entered teams and a fixture list the
   organiser cannot use.

5. **`org_name` is a field, not a second account.** One student often runs
   events for several groups, and the group outlives the student. The
   organising body is a string on the event; `organizer_id` is the person
   accountable for it. If clubs ever want their own pages, that is an
   `organization` table and a migration — deliberately not built yet.

6. **No payment, ever.** Every event is free by construction: there is no
   price column to fill in. The moment money is involved this stops being a
   noticeboard and starts being a thing that needs refunds, disputes and a
   licence.

## What is not built

- **No waiting list.** A full event is simply full. A list implies someone
  promises to work it when a place opens, and nobody has.
- **No reminders.** Joining does not email you; the site has no outbound mail
  beyond sign-in codes.
- **No recurrence.** A weekly ladder is posted weekly. Recurring events need
  an exception model (this week is cancelled, next week moved) that is more
  machinery than a term's worth of events justifies.
- **No per-event moderation queue.** Events can be reported like anything
  else (`report.target_type` includes `event`), and the organiser gate is the
  real defence.

## Shape

| File | What |
|---|---|
| `app/db.mjs` (`EVENT_SCHEMA`) | `event`, `event_signup`, `post.event_id`, the `organizer` role, `family_name` / `given_name` |
| `app/lib/events.mjs` | Feed and date windows, detail, participants, join/leave, categories |
| `app/lib/names.mjs` | Which name form a given viewer sees |
| `app/views/events.mjs` | List, detail, create form, the organiser gate |
| `app/seed-events.mjs` | 8 events, 25 signups, and the name split (`npm run seed:events`) |

Joining is a form POST and a redirect, not a fetch: it works with JavaScript
off, and the page you land on is the proof it worked. Capacity is checked
inside the same transaction as the insert, so two people cannot take the last
place.
