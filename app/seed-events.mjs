/* ============================================================
   Events seed — and the name split that the Events section needs.

   Two jobs in one script because they are one change: attendance lists show
   NOGUEIRA, Gabriel, which the ten demo accounts could not do while their
   names were single strings like "Gabriel N.".

   Safe to re-run. It replaces events and signups, fills in any missing name
   parts, and leaves listings, posts and comments alone.
   ============================================================ */
import { pathToFileURL } from 'node:url';
import { pool, q, tx, migrate, uid, now } from './db.mjs';

/* [display_name, family, given] — the seeded accounts, split. The family
   name is what the formal form upper-cases; the given name is what the short
   public form keeps. */
const NAMES = [
  ['Gabriel N.', 'Nogueira', 'Gabriel'],
  ['Mei L.',     'Li',       'Mei'],
  ['Aisha R.',   'Rahman',   'Aisha'],
  ['Kenji T.',   'Tanaka',   'Kenji'],
  ['Sofia M.',   'Moreno',   'Sofia'],
  ['Wang Hao',   'Wang',     'Hao'],
  ['Dmitri K.',  'Kuznetsov','Dmitri'],
  ['Ji-woo P.',  'Park',     'Ji-woo'],
  ['Nadia B.',   'Benali',   'Nadia'],
  ['Chen Yu',    'Chen',     'Yu'],
];

/* Accounts that may post events. Kept to two so the gate is visible in the
   demo: sign in as anyone else and /events/new explains the rule. */
const ORGANISERS = ['Mei L.', 'Chen Yu'];

const at = (days, hour, mins = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, mins, 0, 0);
  return d.toISOString();
};

/* [orgName, category, title, body, campus, venue, startsAt, endsAt, capacity,
    teamSize, organiserDisplayName, signupDisplayNames] */
const EVENTS = [
  ['ZJU International Student Union', 'party',
   'Autumn welcome party — all nationalities',
   'Music, food from a dozen countries, and a room full of people who also arrived this year.\n\nBring nothing but yourself. There is a cloakroom.',
   'zijingang', 'Student Centre, Zijingang', at(4, 19), at(4, 23), 200, null, 'Mei L.',
   ['Gabriel N.', 'Aisha R.', 'Kenji T.', 'Sofia M.', 'Dmitri K.', 'Nadia B.']],

  ['ZJU Football Association', 'sports',
   'Inter-college 5-a-side tournament',
   'Teams of five plus one substitute. Group stage in the morning, knockouts after lunch.\n\nEnter your squad when you join — one team per captain.',
   'zijingang', 'West pitches, Zijingang', at(11, 9), at(11, 17), 16, 5, 'Chen Yu',
   ['Gabriel N.', 'Dmitri K.']],

  ['Student Societies Council', 'club',
   'Autumn club fair — 40 societies, one afternoon',
   'Every society with a stall: sports, music, debate, photography, volunteering, tech. Most will sign you up on the spot.',
   'zijingang', 'Main square, Zijingang', at(2, 13), at(2, 17), null, null, 'Mei L.',
   ['Sofia M.', 'Ji-woo P.', 'Nadia B.', 'Aisha R.']],

  ['International Kitchen', 'cooking',
   'Dumpling night — learn to fold properly',
   'Wang Hao and two classmates teach three folds. Ingredients provided; bring a container for leftovers.',
   'yuquan', 'Dormitory 12 common kitchen', at(6, 18, 30), at(6, 21), 24, null, 'Chen Yu',
   ['Gabriel N.', 'Sofia M.', 'Kenji T.']],

  ['ZJU Language Exchange', 'talk',
   'Language corner — Chinese, English, everything else',
   'Forty-five minutes in one language, then everyone switches. Beginners especially welcome; nobody is here to judge your tones.',
   'yuquan', 'Library café, Yuquan', at(3, 19), at(3, 21), 60, null, 'Mei L.',
   ['Dmitri K.', 'Nadia B.', 'Ji-woo P.']],

  ['Hangzhou Walks', 'culture',
   'Saturday hike — Longjing tea fields',
   'Metro to the edge of the city, then about three hours of walking with a long stop for tea. Wear shoes you can climb in.',
   'off_campus', 'Meet at Longjing Road metro exit B', at(9, 8, 30), at(9, 15), 30, null, 'Chen Yu',
   ['Aisha R.', 'Kenji T.', 'Gabriel N.', 'Sofia M.']],

  ['ZJU Basketball Club', 'sports',
   'Three-on-three ladder, week one',
   'Rolling ladder through the semester. Teams of three, winners stay on.',
   'yuquan', 'Outdoor courts, Yuquan', at(14, 18), at(14, 21), 12, 3, 'Chen Yu', ['Ji-woo P.']],

  ['ZJU International Student Union', 'culture',
   'Film night — Chinese cinema with subtitles',
   'A different film each month, always with English subtitles, always followed by an argument about it in the corridor.',
   'zijingang', 'Lecture hall 2, Zijingang', at(-5, 19), at(-5, 22), 80, null, 'Mei L.',
   ['Gabriel N.', 'Nadia B.']],
];

const TEAMS = {
  'Inter-college 5-a-side tournament': {
    'Gabriel N.': ['Medicine United', 'Rafael S.\nTomás P.\nLiu Wei\nMarco B.'],
    'Dmitri K.':  ['Zijingang Rovers', 'Ivan P.\nSasha M.\nChen Long\nYusuf A.'],
  },
  'Three-on-three ladder, week one': {
    'Ji-woo P.': ['Dorm 12', 'Min-jun K.\nHaruto S.'],
  },
};

const ANNOUNCE = {
  by: 'Mei L.',
  title: 'Autumn welcome party — everyone is invited, nothing to pay',
  body: 'Friday from seven at the Student Centre. Music, food from a dozen '
      + 'countries, and a room full of people who also arrived this year.\n\n'
      + 'Put your name down on the event page so we know how much food to order.',
};

async function main() {
  await migrate();
  const users = await q('SELECT id, display_name FROM "user"');
  if (users.length < 10) { console.error('Run `npm run seed` first (needs the 10 demo users).'); process.exit(1); }
  const byName = Object.fromEntries(users.map((u) => [u.display_name, u.id]));

  await tx(async (c) => {
    /* 1. Split the names. Only fills blanks, so a real account that already
          has its parts set is never overwritten. */
    for (const [display, family, given] of NAMES) {
      await c.query(
        `UPDATE "user" SET family_name = COALESCE(family_name, $2),
                           given_name  = COALESCE(given_name,  $3)
          WHERE display_name = $1`, [display, family, given]);
    }
    /* 2. Grant the organiser role. 'admin' is left alone — an admin can
          already post, and demoting one here would be a surprise. */
    await c.query(`UPDATE "user" SET role = 'user' WHERE role = 'organizer'`);
    await c.query(`UPDATE "user" SET role = 'organizer'
                    WHERE display_name = ANY($1) AND role <> 'admin'`, [ORGANISERS]);

    /* 3. Events. Posts that linked an event keep working: the column is ON
          DELETE SET NULL, so the link drops rather than the post. */
    await c.query('DELETE FROM event_signup');
    await c.query('DELETE FROM event');
    for (const [org, cat, title, body, campus, venue, starts, ends, cap, team, who, goers] of EVENTS) {
      const id = uid();
      await c.query(
        `INSERT INTO event (id, organizer_id, org_name, category, title, body, campus, venue,
                            starts_at, ends_at, capacity, team_size, signup_count, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
        [id, byName[who], org, cat, title, body, campus, venue, starts, ends, cap, team, goers.length, now()]);
      for (const g of goers) {
        const t = TEAMS[title]?.[g] || [null, null];
        await c.query(
          `INSERT INTO event_signup (event_id, user_id, team_name, teammates, created_at)
           VALUES ($1,$2,$3,$4,$5)`, [id, byName[g], t[0], t[1], now()]);
      }
    }

    /* 4. One announcement post, so the Community -> Events bridge is visible
          out of the box rather than only after somebody posts by hand. The
          post is replaced on each run so the link never dangles. */
    const [board] = (await c.query(`SELECT id FROM board WHERE slug = 'events'`)).rows;
    const [ev] = (await c.query(
      `SELECT id FROM event WHERE category = 'party' ORDER BY starts_at LIMIT 1`)).rows;
    if (board && ev) {
      await c.query(`DELETE FROM post WHERE title = $1`, [ANNOUNCE.title]);
      await c.query(
        `INSERT INTO post (id, board_id, user_id, kind, title, body, campus, event_id, score, created_at)
         VALUES ($1,$2,$3,'event',$4,$5,'zijingang',$6,$7,$8)`,
        [uid(), board.id, byName[ANNOUNCE.by], ANNOUNCE.title, ANNOUNCE.body, ev.id, 31,
         new Date(Date.now() - 6 * 36e5).toISOString()]);
    }
  });

  const [{ n }] = await q('SELECT COUNT(*)::int AS n FROM event');
  const [{ s }] = await q('SELECT COUNT(*)::int AS s FROM event_signup');
  const orgs = await q(`SELECT display_name FROM "user" WHERE role = 'organizer' ORDER BY display_name`);
  console.log(`Seeded ${n} events, ${s} signups. Names split for ${NAMES.length} accounts.`);
  console.log(`Organisers: ${orgs.map((o) => o.display_name).join(', ')}`);
  await pool.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
