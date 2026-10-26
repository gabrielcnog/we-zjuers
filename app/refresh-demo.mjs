/* ============================================================
   Refresh the demo's clock.

   Seeded listings carry `expires_at = seeded_at + 30 days`, so a seeded
   marketplace has a thirty-day shelf life: on day 31 the hourly sweep in
   db.mjs flips the last one to `expired`, the feed (which filters
   `status='active'`) renders empty, and nothing says why. That is how the
   marketplace came up blank on 2026-10-10.

   Re-seeding fixes it but costs the hotlinked Unsplash photos, which then
   need another API run. This shifts every demo timestamp forward by one
   interval instead — the same interval everywhere, so the narrative stays
   internally consistent (nothing is "posted today" by someone "last seen a
   month ago") — and re-derives each listing's status from its new dates.
   Photos, posts, comments and votes are untouched.
   ============================================================ */
import { pathToFileURL } from 'node:url';
import { pool, tx } from './db.mjs';

/* Every column that carries the demo's sense of "when". Community posts are
   seeded separately and keep their own coherent timeline, so they stay put. */
const SHIFTED = [
  ['listing', ['published_at', 'expires_at', 'bumped_at', 'created_at']],
  ['"user"', ['last_seen_at']],
  ['conversation', ['created_at', 'last_message_at']],
  ['message', ['created_at', 'read_at']],
  ['favorite', ['created_at']],
];

async function main() {
  /* Seconds rather than an interval object: node-postgres has no encoder for
     one, so a round-tripped interval goes back as JSON and the UPDATE fails. */
  const { rows: [{ secs, newest }] } = await pool.query(
    `SELECT EXTRACT(EPOCH FROM (now() - MAX(published_at)))::int AS secs,
            MAX(published_at) AS newest
       FROM listing WHERE deleted_at IS NULL`);
  if (!newest) { console.error('No listings — run `npm run seed` first.'); process.exit(1); }

  const days = Math.round(secs / 86400);
  if (secs <= 0) {
    console.log('Already fresh — the newest listing is dated now or later. Nothing to do.');
    return pool.end();
  }

  await tx(async (c) => {
    for (const [table, cols] of SHIFTED) {
      const set = cols.map((col) => `${col} = ${col} + make_interval(secs => $1)`).join(', ');
      await c.query(`UPDATE ${table} SET ${set} WHERE TRUE`, [secs]);
    }
    /* Status follows from the dates, so re-derive rather than assume: a
       listing the seed meant to be already-expired stays expired, and `sold`
       is a human decision the clock has no business overwriting. */
    await c.query(`UPDATE listing SET status = 'active', updated_at = now()
                    WHERE status = 'expired' AND expires_at > now() AND deleted_at IS NULL`);
    await c.query(`UPDATE listing SET status = 'expired', updated_at = now()
                    WHERE status = 'active' AND expires_at <= now() AND deleted_at IS NULL`);
  });

  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS n FROM listing WHERE deleted_at IS NULL
      GROUP BY status ORDER BY status`);
  console.log(`Shifted the demo forward ${days} days.`);
  console.table(rows);
  await pool.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
