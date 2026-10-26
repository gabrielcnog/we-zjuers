/* The demo's sample data, shipped as a file.

   Seeding the usual way takes three scripts and an Unsplash API key, and a
   free web host gives you neither a shell nor a place to keep a key. So the
   data ships as plain INSERTs (seed/demo-data.sql, made by
   scripts/make-snapshot.sh) and an empty demo database loads it on first
   boot. Photos are stored as URLs, so no key is needed to show them.

   Dates are the other half. The sample data is dated the day it was taken;
   listings expire after 30 days and events pass. So every timestamp is moved
   forward by the same amount, which keeps all the relative times ("3 days
   ago", "in 2 days") exactly as they were, and the same move is repeated at
   boot if the demo has since gone stale. */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, tx } from '../db.mjs';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'demo-data.sql');

/* Everything the snapshot owns. TRUNCATE CASCADE also clears whatever hangs
   off these (favourites, threads), which on an empty database is nothing. */
const TABLES = ['campus', 'category', 'language', 'board', '"user"', 'user_language',
  'listing', 'listing_image', 'post', 'comment', 'event', 'event_signup'];

const STALE_AFTER_DAYS = 7;

/* What "now" should mean for the sample data: the newest thing that already
   happened. Listings, posts and comments only — events, expiries and the like
   are meant to be in the future, and last-seen times are not evidence of
   anything. Using listings alone, as an earlier version did, put the clock
   behind the community posts and shifted some of them into the future. */
const NEWEST_ACTIVITY = `SELECT EXTRACT(EPOCH FROM (now() - GREATEST(
    (SELECT MAX(published_at) FROM listing WHERE deleted_at IS NULL),
    (SELECT MAX(created_at) FROM post WHERE deleted_at IS NULL),
    (SELECT MAX(created_at) FROM comment))))::int AS secs`;

/* Columns that record something that HAPPENED, as opposed to something
   scheduled. After a shift these may never be later than now. */
const HAPPENED = ['last_seen_at', 'created_at', 'updated_at', 'published_at', 'bumped_at'];

/* Move every timestamp in the sample data forward by `secs`. Found from the
   catalogue rather than listed by hand, so a column added next month is moved
   too instead of quietly staying in the past. */
async function shiftAll(c, secs) {
  const { rows } = await c.query(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'
        AND table_name = ANY($1)`,
    [TABLES.map((t) => t.replace(/"/g, ''))]);
  const byTable = {};
  for (const r of rows) (byTable[r.table_name] ||= []).push(r.column_name);
  for (const [table, cols] of Object.entries(byTable)) {
    const set = cols.map((col) => `"${col}" = "${col}" + make_interval(secs => $1)`).join(', ');
    await c.query(`UPDATE "${table}" SET ${set}`, [secs]);
    /* Clamp. A column that was already ahead of the clock before the shift
       (the sample data's last-seen times were) would otherwise end up days in
       the future. */
    const past = cols.filter((col) => HAPPENED.includes(col));
    if (past.length) {
      await c.query(`UPDATE "${table}" SET ${past.map((col) => `"${col}" = LEAST("${col}", now())`).join(', ')}`);
    }
  }
  /* Status follows from the dates, as in refresh-demo: re-derive, don't assume. */
  await c.query(`UPDATE listing SET status = 'active', updated_at = now()
                  WHERE status = 'expired' AND expires_at > now() AND deleted_at IS NULL`);
  await c.query(`UPDATE listing SET status = 'expired', updated_at = now()
                  WHERE status = 'active' AND expires_at <= now() AND deleted_at IS NULL`);
}

/* Bring the sample data's clock up to now, if it is more than `minAgeSecs`
   behind. Returns the days moved. */
async function alignToNow(c, minAgeSecs) {
  const { rows: [{ secs }] } = await c.query(NEWEST_ACTIVITY);
  if (secs == null || secs <= minAgeSecs) return 0;
  await shiftAll(c, secs);
  return Math.round(secs / 86400);
}

/* Load the snapshot into an EMPTY database. Does nothing otherwise, so it can
   never overwrite anything real. Returns true if it loaded. */
export async function loadSnapshotIfEmpty() {
  const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM listing');
  if (n > 0 || !existsSync(FILE)) return false;
  const text = readFileSync(FILE, 'utf8');
  /* Everything from the first INSERT on. The dump's own header sets
     search_path and timeouts for the whole connection, which on a pooled
     connection would outlive this load. It is cut by position, not filtered
     line by line: a post body with a line break in it is one statement
     spread over several lines, and a line filter cuts it in half. */
  const body = text.slice(text.indexOf('INSERT INTO '))
    /* pg_dump 17+ brackets its output with psql-only \restrict lines, which a
       query cannot run. */
    .replace(/^\\(un)?restrict .*$/gm, '');
  await tx(async (c) => {
    /* The pool's 5s statement_timeout is right for a request and wrong for
       this: the body below is one multi-statement query, and a small hosted
       database can take longer than that to ingest it. Scoped to this
       transaction only. */
    await c.query('SET LOCAL statement_timeout = 0');
    await c.query(`TRUNCATE ${TABLES.join(', ')} CASCADE`);
    await c.query(body);
    await alignToNow(c, 0);
  });
  return true;
}

/* If the demo has sat for a while, bring it back to "now". More than a week
   behind and it reads as abandoned. */
export async function freshenIfStale() {
  return tx(async (c) => {
    await c.query('SET LOCAL statement_timeout = 0');
    return alignToNow(c, STALE_AFTER_DAYS * 86400);
  });
}
