/* ============================================================
   Events — free to join, posted by vetted organisers.

   Two rules shape every query here:

   1. Attendance is public to signed-in students (docs/events.md). The
      participant list is part of the page, not an organiser-only export, so
      `participants` is a first-class read rather than something bolted on.
   2. An event is over when it is over. Listings expire on a timer; events
      simply fall into the past, so "upcoming" is a date comparison and no
      sweep is needed to keep the feed honest.
   ============================================================ */
import { q, one, run, tx, uid, now } from '../db.mjs';

export const CATEGORIES = ['party', 'sports', 'club', 'cooking', 'culture', 'talk', 'other'];
export const WHEN = ['upcoming', 'week', 'month', 'past'];

const COLS = `
  e.id, e.org_name, e.category, e.title, e.body, e.campus, e.venue,
  e.starts_at, e.ends_at, e.capacity, e.team_size, e.signup_count, e.status,
  e.organizer_id, u.display_name AS organizer_name,
  u.family_name AS organizer_family, u.given_name AS organizer_given,
  u.is_zju_verified`;

/* The date filter is a window, not a sort: "this week" means starting
   between now and seven days out, and `past` flips the comparison and the
   order so the most recent finished event comes first. */
function window$(when) {
  if (when === 'past') return `e.starts_at < now()`;
  if (when === 'week') return `e.starts_at BETWEEN now() AND now() + interval '7 days'`;
  if (when === 'month') return `e.starts_at BETWEEN now() AND now() + interval '1 month'`;
  return `e.starts_at >= now()`;
}

export async function feed({ when = 'upcoming', category = null, campus = null,
                             query = '', userId = null, limit = 40 } = {}) {
  const w = [`e.deleted_at IS NULL`, `e.status = 'published'`, window$(when)];
  const p = [];
  if (category) { p.push(category); w.push(`e.category = $${p.length}`); }
  if (campus) { p.push(campus); w.push(`e.campus = $${p.length}`); }
  if (query) { p.push(`%${query}%`); w.push(`(e.title ILIKE $${p.length} OR e.org_name ILIKE $${p.length})`); }
  let joined = 'FALSE';
  if (userId) { p.push(userId); joined = `EXISTS (SELECT 1 FROM event_signup s WHERE s.event_id = e.id AND s.user_id = $${p.length})`; }
  p.push(limit);
  return q(
    `SELECT ${COLS}, ${joined} AS joined
       FROM event e JOIN "user" u ON u.id = e.organizer_id
      WHERE ${w.join(' AND ')}
      ORDER BY e.starts_at ${when === 'past' ? 'DESC' : 'ASC'}
      LIMIT $${p.length}`, p);
}

export const getEvent = (id, userId = null) => one(
  `SELECT ${COLS},
          ${userId ? `EXISTS (SELECT 1 FROM event_signup s WHERE s.event_id = e.id AND s.user_id = $2)` : 'FALSE'} AS joined
     FROM event e JOIN "user" u ON u.id = e.organizer_id
    WHERE e.id = $1 AND e.deleted_at IS NULL`, userId ? [id, userId] : [id]);

/* Who is coming. Open to signed-in students by design — the caller is the
   gate, not this query. */
export const participants = (eventId) => q(
  `SELECT s.user_id, s.team_name, s.teammates, s.created_at,
          u.display_name, u.family_name, u.given_name, u.is_zju_verified, u.home_campus
     FROM event_signup s JOIN "user" u ON u.id = s.user_id
    WHERE s.event_id = $1
    ORDER BY s.created_at`, [eventId]);

/* What a person is going to — the events half of an open profile. Past
   events are included so a profile shows a history, not just a diary. */
export const eventsFor = (userId, { upcomingOnly = false } = {}) => q(
  `SELECT ${COLS}, TRUE AS joined
     FROM event_signup s JOIN event e ON e.id = s.event_id
     JOIN "user" u ON u.id = e.organizer_id
    WHERE s.user_id = $1 AND e.deleted_at IS NULL
      ${upcomingOnly ? 'AND e.starts_at >= now()' : ''}
    ORDER BY e.starts_at DESC`, [userId]);

export const organisedBy = (userId) => q(
  `SELECT ${COLS}, FALSE AS joined
     FROM event e JOIN "user" u ON u.id = e.organizer_id
    WHERE e.organizer_id = $1 AND e.deleted_at IS NULL
    ORDER BY e.starts_at DESC`, [userId]);

export const createEvent = (d) => one(
  `INSERT INTO event (id, organizer_id, org_name, category, title, body, campus,
                      venue, starts_at, ends_at, capacity, team_size, created_at, updated_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
  [uid(), d.organizerId, d.orgName, d.category, d.title, d.body || null, d.campus || null,
   d.venue || null, d.startsAt, d.endsAt || null, d.capacity || null, d.teamSize || null, now()]);

/* Join and leave keep signup_count in step inside the transaction, the same
   way a vote keeps a post's score. The capacity check happens in here too —
   checking it in the view would let two people take the last place. */
export const join = ({ eventId, userId, teamName = null, teammates = null }) => tx(async (c) => {
  const { rows: [e] } = await c.query(
    `SELECT capacity, signup_count, starts_at, status FROM event
      WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [eventId]);
  if (!e) return { ok: false, reason: 'gone' };
  if (e.status !== 'published') return { ok: false, reason: 'cancelled' };
  if (new Date(e.starts_at) < new Date()) return { ok: false, reason: 'past' };
  if (e.capacity !== null && e.signup_count >= e.capacity) return { ok: false, reason: 'full' };
  const { rowCount } = await c.query(
    `INSERT INTO event_signup (event_id, user_id, team_name, teammates, created_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [eventId, userId, teamName, teammates, now()]);
  if (rowCount) await c.query('UPDATE event SET signup_count = signup_count + 1 WHERE id = $1', [eventId]);
  return { ok: true, added: !!rowCount };
});

export const leave = ({ eventId, userId }) => tx(async (c) => {
  const { rowCount } = await c.query(
    'DELETE FROM event_signup WHERE event_id = $1 AND user_id = $2', [eventId, userId]);
  if (rowCount) await c.query(
    'UPDATE event SET signup_count = GREATEST(signup_count - 1, 0) WHERE id = $1', [eventId]);
  return { ok: true, removed: !!rowCount };
});

export const cancelEvent = (id, organizerId) => run(
  `UPDATE event SET status = 'cancelled', updated_at = now()
    WHERE id = $1 AND organizer_id = $2`, [id, organizerId]);

/* Counts for the category rail. They have to answer the same question the
   feed answers — "what will I see if I click this?" — so they carry every
   filter that is on except the category itself: the campus from the header
   and the date window from the rail above. Counting all upcoming events
   regardless said "Cooking 1" while the campus was Zijingang and the one
   cooking event was at Yuquan, so the category opened onto an empty page. */
export const categoryCounts = async ({ campus = null, when = 'upcoming' } = {}) => {
  const w = [`e.deleted_at IS NULL`, `e.status = 'published'`, window$(when)];
  const p = [];
  if (campus) { p.push(campus); w.push(`e.campus = $${p.length}`); }
  const rows = await q(
    `SELECT e.category, COUNT(*)::int AS n FROM event e
      WHERE ${w.join(' AND ')} GROUP BY e.category`, p);
  return Object.fromEntries(rows.map((r) => [r.category, r.n]));
};

export const suggestEvents = (term, limit = 6) => q(
  `SELECT e.id, e.title, e.starts_at FROM event e
    WHERE e.deleted_at IS NULL AND e.status = 'published' AND e.starts_at >= now()
      AND (e.title ILIKE $1 OR e.org_name ILIKE $1)
    ORDER BY e.starts_at LIMIT $2`, [`%${term}%`, limit]);
