/* ============================================================
   Community (forum prototype) — data access.
   Same rules as queries.mjs: parameterised SQL only, and every write that
   belongs to a user is scoped by that user in the query itself.
   ============================================================ */
import { q, one, run, tx, uid, now } from '../db.mjs';

export const KINDS = ['question', 'discussion', 'tip', 'event'];
export const SORTS = ['hot', 'new', 'top'];

/* Boards change only when seeded, so they are cached like the marketplace's
   reference data. */
let _boards = null;
export async function loadBoards() {
  _boards = await q('SELECT * FROM board ORDER BY sort_order, id');
  return _boards;
}
export const boards = () => _boards || [];
export const boardBySlug = (slug) => boards().find((b) => b.slug === slug) || null;

/* "Hot": votes and replies, decaying with age. The +2h offset keeps a brand
   new post from dividing by ~0 and rocketing to the top on its first vote. */
/* GREATEST(…, 0): a post dated a moment in the future — clock skew between the
   app and the database is enough — made the base of the power negative, and
   Postgres refuses a negative number to a fractional power. The whole front
   page returned a 500 over one post's timestamp. */
const HOT = `((p.score + p.comment_count * 0.5 + 1) / power(GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600, 0) + 2, 1.5))`;
const ORDER = {
  hot: `${HOT} DESC, p.created_at DESC`,
  new: 'p.created_at DESC',
  top: 'p.score DESC, p.created_at DESC',
};

const POST_COLS = (voterParam) => `
  p.id, p.kind, p.title, p.body, p.campus, p.score, p.comment_count, p.created_at, p.user_id,
  b.slug AS board_slug, b.name_en AS board_en, b.name_zh AS board_zh, b.icon AS board_icon,
  u.display_name AS author, u.family_name AS author_family, u.given_name AS author_given,
  u.is_zju_verified,
  l.id AS listing_id, l.title AS listing_title, l.price_type AS listing_price_type,
  l.price_cents AS listing_price_cents, l.status AS listing_status,
  ev.id AS event_id, ev.title AS event_title, ev.category AS event_category,
  ev.starts_at AS event_starts, ev.status AS event_status,
  (SELECT COALESCE(i.url, '/img/' || i.id) FROM listing_image i
    WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS listing_cover,
  ${voterParam ? `EXISTS (SELECT 1 FROM post_vote v WHERE v.post_id = p.id AND v.user_id = ${voterParam})` : 'FALSE'} AS voted`;

const POST_FROM = `
  FROM post p
  JOIN board b ON b.id = p.board_id
  JOIN "user" u ON u.id = p.user_id
  LEFT JOIN listing l ON l.id = p.listing_id AND l.deleted_at IS NULL
  LEFT JOIN event ev ON ev.id = p.event_id AND ev.deleted_at IS NULL`;

export async function feed({ board = null, sort = 'hot', campus = null, query = '', userId = null, limit = 20 }) {
  const where = ['p.deleted_at IS NULL'], args = [];
  const add = (v) => { args.push(v); return '$' + args.length; };
  if (board) where.push(`p.board_id = ${add(board.id)}`);
  // A campus scope shows that campus's posts plus the ones meant for everyone.
  if (campus) where.push(`(p.campus IS NULL OR p.campus = ${add(campus)})`);
  if (query) {
    const like = add('%' + query.replace(/[\\%_]/g, (c) => '\\' + c) + '%');
    where.push(`(p.title ILIKE ${like} OR p.body ILIKE ${like})`);
  }
  // Count first, with only the filter params; the voter param is feed-only.
  const whereSql = where.join(' AND ');
  const countArgs = [...args];
  const voter = userId ? add(userId) : null;
  const [rows, total] = await Promise.all([
    q(`SELECT ${POST_COLS(voter)} ${POST_FROM} WHERE ${whereSql}
        ORDER BY ${ORDER[sort] || ORDER.hot} LIMIT ${Math.max(1, Math.min(100, Number(limit) | 0))}`, args),
    one(`SELECT COUNT(*)::int AS n FROM post p WHERE ${whereSql}`, countArgs),
  ]);
  return { rows, total: total.n };
}

export const getPost = (id, userId = null) => one(
  `SELECT ${POST_COLS(userId ? '$2' : null)} ${POST_FROM}
    WHERE p.id = $1 AND p.deleted_at IS NULL`, userId ? [id, userId] : [id]);

/* Flat list, oldest first; the view assembles the tree. Deleted comments stay
   in the list (as "[deleted]") so their replies keep a parent to hang from. */
export const commentsFor = (postId, userId = null) => q(
  `SELECT c.id, c.parent_id, c.body, c.score, c.created_at, c.deleted_at, c.user_id,
          u.display_name AS author, u.family_name AS author_family,
          u.given_name AS author_given, u.is_zju_verified,
          ${userId ? 'EXISTS (SELECT 1 FROM comment_vote v WHERE v.comment_id = c.id AND v.user_id = $2)' : 'FALSE'} AS voted
     FROM comment c JOIN "user" u ON u.id = c.user_id
    WHERE c.post_id = $1
    ORDER BY c.created_at`, userId ? [postId, userId] : [postId]);

export async function createPost(d) {
  const id = uid();
  await run(`INSERT INTO post (id, board_id, user_id, kind, title, body, campus, listing_id, event_id, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [id, d.board_id, d.user_id, d.kind, d.title, d.body, d.campus, d.listing_id, d.event_id || null, now()]);
  return id;
}

/* The parent must belong to the same post — otherwise a crafted form could
   graft a reply onto a thread somewhere else. */
export const createComment = ({ postId, userId, parentId, body }) => tx(async (c) => {
  if (parentId) {
    const ok = await c.query('SELECT 1 FROM comment WHERE id = $1 AND post_id = $2', [parentId, postId]);
    if (!ok.rowCount) parentId = null;
  }
  const id = uid();
  await c.query(`INSERT INTO comment (id, post_id, parent_id, user_id, body, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6)`, [id, postId, parentId, userId, body, now()]);
  await c.query('UPDATE post SET comment_count = comment_count + 1 WHERE id = $1', [postId]);
  return id;
});

/* Toggle an upvote. Insert-or-delete decides the direction, and the score
   moves in the same transaction, so a double click cannot count twice. */
function toggler(voteTable, fk, target) {
  return (targetId, userId) => tx(async (c) => {
    const exists = await c.query(`SELECT 1 FROM ${target} WHERE id = $1 AND deleted_at IS NULL`, [targetId]);
    if (!exists.rowCount) return null;
    const ins = await c.query(
      `INSERT INTO ${voteTable} (${fk}, user_id, created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [targetId, userId, now()]);
    let on = true;
    if (!ins.rowCount) {
      await c.query(`DELETE FROM ${voteTable} WHERE ${fk} = $1 AND user_id = $2`, [targetId, userId]);
      on = false;
    }
    const r = await c.query(`UPDATE ${target} SET score = score + $2 WHERE id = $1 RETURNING score`,
      [targetId, on ? 1 : -1]);
    return { on, score: r.rows[0].score };
  });
}
export const togglePostVote = toggler('post_vote', 'post_id', 'post');
export const toggleCommentVote = toggler('comment_vote', 'comment_id', 'comment');

export function suggestPosts(term, campus = null, limit = 6) {
  const args = ['%' + term.replace(/[\\%_]/g, (c) => '\\' + c) + '%', term];
  if (campus) args.push(campus);
  return q(`SELECT p.id, p.title, b.slug AS board_slug, b.name_en AS board_en, b.name_zh AS board_zh
              FROM post p JOIN board b ON b.id = p.board_id
             WHERE p.deleted_at IS NULL AND p.title ILIKE $1
               ${campus ? 'AND (p.campus IS NULL OR p.campus = $3)' : ''}
             ORDER BY strpos(lower(p.title), lower($2)), p.score DESC
             LIMIT ${Math.max(1, Math.min(10, limit | 0))}`, args);
}

export const communityStats = () => one(
  `SELECT (SELECT COUNT(*)::int FROM post WHERE deleted_at IS NULL) AS posts,
          (SELECT COUNT(*)::int FROM comment WHERE deleted_at IS NULL) AS comments,
          (SELECT COUNT(DISTINCT user_id)::int FROM (
             SELECT user_id FROM post UNION SELECT user_id FROM comment) x) AS members`);

export const boardCounts = async () => Object.fromEntries(
  (await q(`SELECT board_id, COUNT(*)::int AS n FROM post WHERE deleted_at IS NULL GROUP BY board_id`))
    .map((r) => [r.board_id, r.n]));
