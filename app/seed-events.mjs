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

  /* ---- Soon: the next two or three weeks ---- */
  ['ZJU Photography Society', 'club',
   'Campus photo walk — golden hour at Zijingang',
   'Ninety minutes around the lake and the old library, with a short tip for each stop. Any camera is fine, a phone included.\n\nWe share the favourites in a group chat afterwards.',
   'zijingang', 'Library steps, Zijingang', at(5, 16, 30), at(5, 19), 25, null, 'Chen Yu',
   ['Aisha R.', 'Ji-woo P.', 'Nadia B.']],

  ['ZJU Badminton Club', 'sports',
   'Doubles evening — all levels, pairs sign up together',
   'Round-robin doubles, short games so everyone plays a lot. Rackets can be borrowed at the desk.\n\nEnter as a pair: your partner goes in the squad box.',
   'xixi', 'Sports hall 2, Xixi', at(7, 19), at(7, 21, 30), 6, 2, 'Chen Yu',
   ['Kenji T.', 'Sofia M.', 'Dmitri K.', 'Wang Hao', 'Ji-woo P.', 'Mei L.']],

  ['ZJU Music Society', 'culture',
   'Open mic night — bring a song, or just listen',
   'Three minutes each, any language, any instrument. The piano is tuned this time.\n\nListeners are as welcome as performers; the front rows fill up first.',
   'yuquan', 'Student activity hall, Yuquan', at(8, 19), at(8, 21, 30), 80, null, 'Mei L.',
   ['Gabriel N.', 'Aisha R.', 'Nadia B.', 'Ji-woo P.', 'Sofia M.']],

  ['ZJU Board Game Society', 'club',
   'Board game café night — learn something new',
   'Two tables of easy games for first-timers and two for people who already own too many. Snacks on the house.',
   'yuquan', 'Club room 3, Yuquan', at(10, 19), at(10, 22), 10, null, 'Mei L.',
   ['Gabriel N.', 'Kenji T.', 'Sofia M.', 'Wang Hao', 'Dmitri K.', 'Ji-woo P.', 'Nadia B.', 'Chen Yu', 'Aisha R.']],

  ['ZJU Debate Club', 'talk',
   'Beginner debate workshop — no experience needed',
   'We give you a motion, ten minutes to prepare, and a friendly room. The point is to find out that you can do this, not to win.\n\nRun in English, with a Chinese round at the end.',
   'zijingang', 'Teaching building B, room 204', at(12, 18, 30), at(12, 20, 30), 30, null, 'Mei L.',
   ['Dmitri K.', 'Nadia B.']],

  ['ZJU Volunteer Association', 'club',
   'Weekend volunteering — English corner at a community school',
   'Half a day with primary school children who want to practise their English. No teaching experience needed; we send a short plan beforehand.\n\nA minibus leaves from the east gate.',
   'off_campus', 'East gate bus stop', at(16, 8, 30), at(16, 13), 20, null, 'Chen Yu',
   ['Aisha R.', 'Sofia M.', 'Kenji T.']],

  ['ZJU International Student Union', 'party',
   'International food market — twelve countries, one square',
   'Stalls run by student groups: bring cash or WeChat Pay, and an appetite. Each stall has an ingredients card for anyone with allergies.',
   'zijingang', 'Main square, Zijingang', at(20, 17), at(20, 21), null, null, 'Mei L.',
   ['Gabriel N.', 'Aisha R.', 'Dmitri K.']],

  /* ---- Later: weeks and months out, so there is always something to join ---- */
  ['Hangzhou Walks', 'culture',
   'West Lake sunrise walk',
   'Up early for the quietest hour at the lake. Easy flat walking, about two hours, with breakfast at the end.\n\nWe meet by the metro because the first buses are unreliable.',
   'off_campus', 'Longxiangqiao metro exit, 05:30', at(24, 5, 30), at(24, 9), 40, null, 'Chen Yu',
   ['Kenji T.', 'Sofia M.']],

  ['ZJU Career Centre', 'talk',
   'Working in China after graduation — a panel for international students',
   'Three alumni talk about finding a first job, what employers ask, and what they wish they had known. Questions from the room at the end.\n\nThe session is in English; slides are shared afterwards.',
   'zijingang', 'Lecture hall 1, Zijingang', at(30, 15), at(30, 17), 120, null, 'Mei L.',
   ['Gabriel N.', 'Nadia B.', 'Ji-woo P.', 'Dmitri K.']],

  ['ZJU Football Association', 'sports',
   'Winter five-a-side league — registration and first matches',
   'Eight weeks, one match a week, teams of six. Captains register the squad here; free agents are matched into teams on the day.',
   'yuquan', 'Astro pitch, Yuquan', at(38, 14), at(38, 18), 24, 6, 'Chen Yu',
   ['Wang Hao']],

  ['ZJU Language Exchange', 'talk',
   'Language exchange weekend — Anji bamboo forest',
   'Two days outside the city, speaking only the language you are learning. Beds in shared rooms, meals included.\n\nCar share from the east gate on Saturday morning.',
   'off_campus', 'Anji county, minibus from the east gate', at(45, 8), at(46, 17), 35, null, 'Mei L.',
   ['Aisha R.', 'Dmitri K.']],

  ['ZJU International Student Union', 'party',
   'Semester-end potluck — bring a dish from home',
   'The last big gathering before the break. Bring something that tastes like where you are from; we provide plates, rice and tea.\n\nPut your dish in the comments on the announcement so we do not end up with nine salads.',
   'zijingang', 'Student Centre, Zijingang', at(58, 18), at(58, 22), 150, null, 'Mei L.',
   ['Gabriel N.']],

  ['International Kitchen', 'cooking',
   'Hotpot masterclass — and how not to order it wrong',
   'Broths, dipping sauces, what goes in first and what to leave alone. Then we eat all of it.',
   'yuquan', 'Dormitory 12 common kitchen', at(65, 18, 30), at(65, 21), 24, null, 'Chen Yu',
   []],

  ['ZJU Music Society', 'culture',
   'Winter concert — student orchestra and choir',
   'Two hours of music from students across every college, from film themes to a Chinese folk suite. Free, but seats are limited, so add yourself here.',
   'zijingang', 'Grand hall, Zijingang', at(80, 19), at(80, 21, 30), 600, null, 'Mei L.',
   ['Sofia M.']],

  ['Student Societies Council', 'club',
   'Spring club fair — new societies, new stalls',
   'The second round: every society recruits again, and the ones that did not exist last semester introduce themselves. Good moment to try something you missed.',
   'zijingang', 'Main square, Zijingang', at(100, 13), at(100, 17), null, null, 'Mei L.',
   []],

  /* ---- Already over: shows the finished state ---- */
  ['ZJU International Student Union', 'culture',
   'Welcome-week campus tour in English',
   'A walking tour of Zijingang led by second-year students: canteens, the library, where the post office actually is.',
   'zijingang', 'Gate 1, Zijingang', at(-12, 10), at(-12, 12), 40, null, 'Mei L.',
   ['Aisha R.', 'Kenji T.', 'Sofia M.', 'Dmitri K.', 'Nadia B.', 'Gabriel N.', 'Ji-woo P.']],
];

const TEAMS = {
  'Doubles evening — all levels, pairs sign up together': {
    'Kenji T.':  ['Kenji and Mei', 'Mei Chen'],
    'Sofia M.':  ['Net Gains', 'Camila R.'],
    'Dmitri K.': ['The Shuttlecocks', 'Ivan P.'],
    'Wang Hao':  ['Hao and Hao', 'Hao Lin'],
    'Ji-woo P.': ['Dorm 12 B', 'Min-jun K.'],
    'Mei L.':    ['Club committee', 'Yu Chen'],
  },
  'Winter five-a-side league — registration and first matches': {
    'Wang Hao': ['Canteen 2 FC', 'Lin Feng\nZhao Kai\nYusuf A.\nTomás P.\nMarco B.'],
  },
  'Inter-college 5-a-side tournament': {
    'Gabriel N.': ['Medicine United', 'Rafael S.\nTomás P.\nLiu Wei\nMarco B.'],
    'Dmitri K.':  ['Zijingang Rovers', 'Ivan P.\nSasha M.\nChen Long\nYusuf A.'],
  },
  'Three-on-three ladder, week one': {
    'Ji-woo P.': ['Dorm 12', 'Min-jun K.\nHaruto S.'],
  },
};

const ANNOUNCE = [
  { by: 'Mei L.', event: 'Autumn welcome party — all nationalities', campus: 'zijingang', score: 31, hoursAgo: 6,
    title: 'Autumn welcome party — everyone is invited, nothing to pay',
    body: 'Friday from seven at the Student Centre. Music, food from a dozen '
        + 'countries, and a room full of people who also arrived this year.\n\n'
        + 'Put your name down on the event page so we know how much food to order.' },
  { by: 'Chen Yu', event: 'Saturday hike — Longjing tea fields', campus: 'off_campus', score: 18, hoursAgo: 30,
    title: 'Longjing hike: what to bring and where we meet',
    body: 'Comfortable shoes, water, and a layer for the top. We meet at the metro exit '
        + 'and walk about three hours, with a long tea stop halfway.\n\n'
        + 'If it rains hard the night before we move it a week and tell everyone on the event page.' },
  { by: 'Mei L.', event: 'International food market — twelve countries, one square', campus: 'zijingang', score: 24, hoursAgo: 14,
    title: 'Running a stall at the international food market? Read this first',
    body: 'Student groups can still take a table. Tell us what you are cooking, '
        + 'and put an ingredients card on the front for anyone with allergies.\n\n'
        + 'We provide the table, power and a cashier QR code; you bring the food.' },
  { by: 'Mei L.', event: 'Semester-end potluck — bring a dish from home', campus: 'zijingang', score: 12, hoursAgo: 52,
    title: 'Potluck sign-up: what are you bringing?',
    body: 'Reply here with your dish so we can keep the table varied. Rice, plates '
        + 'and tea are on us. Vegetarian and halal dishes are especially welcome.' },
];

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

    /* 4. Announcement posts, so the Community -> Events bridge is visible out
          of the box rather than only after somebody posts by hand. Each is
          replaced on every run so the link never dangles. */
    const [board] = (await c.query(`SELECT id FROM board WHERE slug = 'events'`)).rows;
    if (board) {
      for (const a of ANNOUNCE) {
        const [ev] = (await c.query(`SELECT id FROM event WHERE title = $1 LIMIT 1`, [a.event])).rows;
        if (!ev) continue;
        await c.query(`DELETE FROM post WHERE title = $1`, [a.title]);
        await c.query(
          `INSERT INTO post (id, board_id, user_id, kind, title, body, campus, event_id, score, created_at)
           VALUES ($1,$2,$3,'event',$4,$5,$6,$7,$8,$9)`,
          [uid(), board.id, byName[a.by], a.title, a.body, a.campus, ev.id, a.score,
           new Date(Date.now() - a.hoursAgo * 36e5).toISOString()]);
      }
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
