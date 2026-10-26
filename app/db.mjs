/* ============================================================
   Database — PostgreSQL.

   The prototype ran on SQLite until Postgres was available; the
   schema was written to port, and this is that port. Two things
   the move actually buys, both named in docs/architecture.md:

     pg_trgm  — real substring search with an index behind it,
                and it works on Chinese, which a naive tsvector
                does not. Replaces the LIKE '%q%' stopgap.
     citext   — case-insensitive email as a column type rather
                than a convention every query has to remember.

   Connection: DATABASE_URL, else postgres://localhost/listings_dev
   ============================================================ */
import pg from 'pg';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { BOARDS } from './content/boards.mjs';

const DEFAULT_DB = 'listings_dev';
export const DATABASE_URL =
  process.env.DATABASE_URL || `postgres://localhost/${DEFAULT_DB}`;

/* Money is integer cents — make sure the driver never hands us a float,
   and that BIGINT counts arrive as numbers rather than strings. */
pg.types.setTypeParser(20, (v) => parseInt(v, 10));   // int8 / COUNT(*)

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,                      // pooling matters: see docs/infrastructure.md 3.4
  idle_in_transaction_session_timeout: 10_000,
  statement_timeout: 5_000,     // one bad query must not hold the site
});

/* A dropped idle connection emits 'error' on the pool; unhandled that is an
   uncaught exception and the process dies. Log it; the pool reconnects. */
pool.on('error', (err) => console.error('[pg] idle client error:', err.message));

export const uid = () => randomUUID();
export const now = () => new Date().toISOString();
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export const daysFromNow = (n) => new Date(Date.now() + n * 864e5).toISOString();

/* Query helpers. Parameterised only — no string-built SQL anywhere. */
export const q   = async (sql, params = []) => (await pool.query(sql, params)).rows;
export const one = async (sql, params = []) => (await pool.query(sql, params)).rows[0];
export const run = async (sql, params = []) => (await pool.query(sql, params)).rowCount;

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/* Create the database on first run rather than making the reader do it. */
export async function ensureDatabase() {
  const name = new URL(DATABASE_URL).pathname.slice(1) || DEFAULT_DB;
  const admin = new pg.Client({ connectionString: DATABASE_URL.replace(/\/[^/]*$/, '/postgres') });
  /* A managed host (Render, Fly, Heroku) hands you one database that already
     exists and a user who may not be allowed into the maintenance database at
     all. Failing to get in is not failing to have a database: carry on, and
     let the first real query say so if it is actually missing. */
  try { await admin.connect(); } catch { return null; }
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${name}"`);   // identifier, not user input
      return `created database ${name}`;
    }
    return null;
  } finally { await admin.end(); }
}

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS campus (
  code TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_zh TEXT NOT NULL, sort_order INT NOT NULL
);
CREATE TABLE IF NOT EXISTS language (
  code TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_zh TEXT NOT NULL, sort_order INT NOT NULL
);
CREATE TABLE IF NOT EXISTS category (
  id UUID PRIMARY KEY, slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL, name_zh TEXT NOT NULL, icon TEXT, sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
  id                UUID PRIMARY KEY,
  email             CITEXT NOT NULL UNIQUE,
  email_verified_at TIMESTAMPTZ,
  is_zju_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  display_name      TEXT NOT NULL,
  home_campus       TEXT REFERENCES campus(code),
  wechat_id         TEXT,
  locale            TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en','zh')),
  role              TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at        TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_language (
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL REFERENCES language(code),
  PRIMARY KEY (user_id, language_code)
);

CREATE TABLE IF NOT EXISTS listing (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES category(id),
  title        TEXT NOT NULL CHECK (char_length(title) <= 80),
  description  TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  price_type   TEXT NOT NULL CHECK (price_type IN ('fixed','negotiable','free')),
  price_cents  INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  condition    TEXT NOT NULL CHECK (condition IN ('new','like_new','good','fair','parts')),
  campus       TEXT NOT NULL REFERENCES campus(code),
  meetup_note  TEXT,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('draft','active','sold','expired','removed')),
  published_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, bumped_at TIMESTAMPTZ,
  view_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, deleted_at TIMESTAMPTZ,
  CONSTRAINT price_shape CHECK (
    (price_type = 'fixed' AND price_cents IS NOT NULL) OR
    (price_type <> 'fixed' AND price_cents IS NULL))
);

CREATE TABLE IF NOT EXISTS listing_image (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, data TEXT NOT NULL,
  width INT, height INT, sort_order INT NOT NULL DEFAULT 0,
  credit TEXT, credit_url TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS favorite (
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS conversation (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  buyer_id  UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  buyer_wechat_shared  BOOLEAN NOT NULL DEFAULT FALSE,
  seller_wechat_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL, last_message_at TIMESTAMPTZ NOT NULL,
  UNIQUE (listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 2000),
  created_at TIMESTAMPTZ NOT NULL, read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS session (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS login_code (
  id UUID PRIMARY KEY, email CITEXT NOT NULL,
  code_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0, consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS report (
  id UUID PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing','user','message')),
  target_id UUID NOT NULL, reason TEXT NOT NULL, note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  created_at TIMESTAMPTZ NOT NULL
);

/* The three that carry almost every query on the site. */
CREATE INDEX IF NOT EXISTS ix_listing_feed     ON listing(status, bumped_at DESC);
CREATE INDEX IF NOT EXISTS ix_listing_category ON listing(status, category_id, bumped_at DESC);
CREATE INDEX IF NOT EXISTS ix_listing_campus   ON listing(status, campus, bumped_at DESC);
CREATE INDEX IF NOT EXISTS ix_listing_owner    ON listing(user_id, status);
CREATE INDEX IF NOT EXISTS ix_image_listing    ON listing_image(listing_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_conv_buyer       ON conversation(buyer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS ix_conv_seller      ON conversation(seller_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS ix_msg_conv         ON message(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS ix_session_token    ON session(token_hash);

/* Trigram indexes: what makes ILIKE '%query%' fast, and what makes search
   work in Chinese without a segmenter. This is the real thing, not the
   LIKE-scan stopgap the SQLite build shipped with. */
CREATE INDEX IF NOT EXISTS ix_listing_title_trgm ON listing USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_listing_desc_trgm  ON listing USING GIN (description gin_trgm_ops);
`;

export async function migrate() {
  const created = await ensureDatabase();
  await pool.query(SCHEMA);
  /* Services have no condition — "like new" is meaningless for tutoring — so
     the column is optional. The CHECK still constrains any value that IS set:
     a NULL makes it evaluate to UNKNOWN, which passes. */
  await pool.query('ALTER TABLE listing ALTER COLUMN condition DROP NOT NULL');
  /* Hotlinked photos (Unsplash) carry a URL and no bytes; uploads carry bytes. */
  await pool.query(`
    ALTER TABLE listing_image ALTER COLUMN data DROP NOT NULL;
    ALTER TABLE listing_image ADD COLUMN IF NOT EXISTS url TEXT;
    ALTER TABLE listing_image ADD COLUMN IF NOT EXISTS source_id TEXT;
    ALTER TABLE listing_image ADD COLUMN IF NOT EXISTS download_tracked_at TIMESTAMPTZ;
    DO $$ BEGIN
      ALTER TABLE listing_image ADD CONSTRAINT image_has_source CHECK (data IS NOT NULL OR url IS NOT NULL);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await pool.query(COMMUNITY_SCHEMA);
  await pool.query(EVENT_SCHEMA);
  await syncBoards();
  return created;
}

/* Boards are reference data (content/boards.mjs), upserted by slug on every
   boot: the file is the source of truth and the table is a cache of it. A new
   board therefore appears on an existing database without touching a single
   post, and a renamed one renames in place. Nothing is deleted here — see the
   note in that file. */
async function syncBoards() {
  for (const [i, [slug, en, zh, dEn, dZh, icon]] of BOARDS.entries()) {
    await pool.query(
      `INSERT INTO board (slug, name_en, name_zh, desc_en, desc_zh, icon, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (slug) DO UPDATE SET
         name_en = EXCLUDED.name_en, name_zh = EXCLUDED.name_zh,
         desc_en = EXCLUDED.desc_en, desc_zh = EXCLUDED.desc_zh,
         icon    = EXCLUDED.icon,    sort_order = EXCLUDED.sort_order`,
      [slug, en, zh, dEn, dZh, icon, i]);
  }
}

/* ---------- Community (forum prototype) ----------
   Boards hold posts; posts hold a comment tree (parent_id). Votes are
   upvote-only — see docs/community.md for why. `score` and `comment_count` are
   denormalised onto the row so the feed never counts per card; the vote and
   comment writes keep them in step inside one transaction. */
const COMMUNITY_SCHEMA = `
CREATE TABLE IF NOT EXISTS board (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL, name_zh TEXT NOT NULL,
  desc_en TEXT NOT NULL, desc_zh TEXT NOT NULL,
  icon TEXT, sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post (
  id UUID PRIMARY KEY,
  board_id INT NOT NULL REFERENCES board(id),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'discussion' CHECK (kind IN ('question','discussion','tip','event')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 10000),
  campus TEXT REFERENCES campus(code),
  listing_id UUID REFERENCES listing(id) ON DELETE SET NULL,
  score INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS comment (
  id UUID PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  score INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_vote (
  post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS comment_vote (
  comment_id UUID NOT NULL REFERENCES comment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_post_board_new ON post(board_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_post_new       ON post(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_comment_post   ON comment(post_id, created_at);
CREATE INDEX IF NOT EXISTS ix_post_title_trgm ON post USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_post_body_trgm  ON post USING GIN (body gin_trgm_ops);

/* Reports now cover posts and comments too. */
DO $$ BEGIN
  ALTER TABLE report DROP CONSTRAINT IF EXISTS report_target_type_check;
  ALTER TABLE report ADD CONSTRAINT report_target_type_check
    CHECK (target_type IN ('listing','user','message','post','comment','event'));
END $$;

/* The price a listing carried before its owner last lowered it. One column,
   not a price history: the only question a buyer asks is "has this come
   down?", and the listing page answers it by striking the old figure. NULL
   means the price has never been reduced. */
ALTER TABLE listing ADD COLUMN IF NOT EXISTS previous_price_cents INTEGER;

/* Per listing, not per account: a seller may be happy to take WeChat for a
   desk they want gone this week and not for the next thing they post. The
   handle itself still lives on "user" — it is the same handle either way —
   and this only records that the seller offered it on this listing. */
ALTER TABLE listing ADD COLUMN IF NOT EXISTS wechat_ok BOOLEAN NOT NULL DEFAULT FALSE;

/* Bug reports. Always stored here first and forwarded to the spreadsheet
   second, so a slow or unreachable Google loses nothing: forwarded_at stays
   NULL and the hourly sweep tries again. */
CREATE TABLE IF NOT EXISTS bug_report (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  expected TEXT,
  page TEXT,
  email TEXT,
  locale TEXT,
  user_agent TEXT,
  signed_in TEXT,
  forwarded_at TIMESTAMPTZ,
  forward_attempts INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_bug_unforwarded ON bug_report(created_at) WHERE forwarded_at IS NULL;
`;

/* ---------- Events ----------
   Free to join, posted by vetted organisers, open attendance. Three decisions
   are baked into this shape:

   `organizer_id` is the account that posted; `org_name` is the body it posted
   on behalf of ("ZJU International Student Union"). One person often runs
   events for several groups, and the group outlives the student, so the name
   is a field rather than a second account to maintain.

   `team_size` NULL means you sign up as yourself. Any number above 1 turns the
   join form into a team entry — a football tournament wants a squad, not
   eleven separate signups — and `event_signup.teammates` holds the names the
   captain types. Those teammates are plain text, not accounts: a squad usually
   includes someone who has never opened the site.

   `signup_count` is denormalised like post.comment_count, kept in step inside
   the same transaction as the join, so a list of twenty events is one query.  */
const EVENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS event (
  id           UUID PRIMARY KEY,
  organizer_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  org_name     TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('party','sports','club','cooking','culture','talk','other')),
  title        TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  body         TEXT,
  campus       TEXT REFERENCES campus(code),
  venue        TEXT,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ,
  capacity     INT CHECK (capacity IS NULL OR capacity > 0),
  team_size    INT CHECK (team_size IS NULL OR team_size > 1),
  signup_count INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS event_signup (
  event_id   UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  team_name  TEXT,
  teammates  TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_event_when ON event(starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_event_cat  ON event(category, starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_signup_user ON event_signup(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_event_title_trgm ON event USING GIN (title gin_trgm_ops);

/* A community post can point at an event, the same way it can point at a
   listing — the organiser announces it in a board and the post carries the
   button through to the event page. */
ALTER TABLE post ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES event(id) ON DELETE SET NULL;

/* Posting an event is gated: see docs/events.md. 'organizer' is granted by
   hand, which is the whole point — the feed says these are official. */
DO $$ BEGIN
  ALTER TABLE "user" DROP CONSTRAINT IF EXISTS user_role_check;
  ALTER TABLE "user" ADD CONSTRAINT user_role_check
    CHECK (role IN ('user','organizer','admin'));
END $$;

/* Names are stored in parts so the site can render either form: the formal
   "NOGUEIRA, Gabriel" to a signed-in student, and the short display_name to
   anyone not signed in. Nulls are fine — accounts created before this fall
   back to display_name everywhere. */
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS family_name TEXT;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS given_name  TEXT;
`;

export const expireOverdue = () => run(
  `UPDATE listing SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now()`);
