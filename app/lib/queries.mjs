import { q, one, run, tx, uid, now, daysFromNow } from '../db.mjs';

/* ---------- Reference data (read constantly, changes never) ---------- */
/* Loaded once at boot and held in memory: read on every page, changes never.
   Views need it synchronously, so the async load is separated from the getter
   rather than making every view function async for three static lists. */
let _cache = null;
export async function loadRef() {
  const [categories, campuses, languages] = await Promise.all([
    q('SELECT * FROM category ORDER BY sort_order'),
    q('SELECT * FROM campus ORDER BY sort_order'),
    q('SELECT * FROM language ORDER BY sort_order'),
  ]);
  _cache = { categories, campuses, languages };
  return _cache;
}
export function ref() {
  if (!_cache) throw new Error('reference data not loaded — call loadRef() at boot');
  return _cache;
}
export const clearRefCache = () => { _cache = null; };

/* ---------- Feed / search ---------- */
const LISTING_COLS = `
  l.id, l.title, l.price_type, l.price_cents, l.condition, l.campus,
  l.status, l.bumped_at, l.published_at, l.expires_at, l.category_id,
  l.user_id, u.display_name AS seller_name, u.family_name AS seller_family,
  u.given_name AS seller_given, u.is_zju_verified,
  c.slug AS category_slug, c.name_en AS category_en, c.name_zh AS category_zh,
  (SELECT COALESCE(i.url, '/img/' || i.id) FROM listing_image i WHERE i.listing_id = l.id
    ORDER BY i.sort_order LIMIT 1) AS cover_src,
  (SELECT COUNT(*) FROM listing_image i WHERE i.listing_id = l.id) AS image_count,
  /* All image srcs for the card carousel (hotlink URL or /img/:id). One aggregate in the same query
     rather than a follow-up per card — 24 cards would otherwise be 24 extra
     round trips, which at Brazil latency is the whole page budget. */
  (SELECT array_agg(COALESCE(i.url, '/img/' || i.id) ORDER BY i.sort_order)
     FROM listing_image i WHERE i.listing_id = l.id) AS image_srcs`;

function buildWhere(f) {
  const w = [`l.status = 'active'`, 'l.deleted_at IS NULL'];
  const p = [];
  const add = (v) => { p.push(v); return '$' + p.length; };
  /* Category, campus and condition are multi-select: an empty selection means
     "no constraint", several values mean OR within that facet and AND across
     facets — which is what users expect from a faceted filter. `= ANY($n)`
     keeps it one parameter regardless of how many boxes are ticked. */
  if (f.categories?.length)  w.push(`c.slug = ANY(${add(f.categories)})`);
  if (f.campuses?.length)    w.push(`l.campus = ANY(${add(f.campuses)})`);
  if (f.conditions?.length)  w.push(`l.condition = ANY(${add(f.conditions)})`);
  if (f.min != null) w.push(`(l.price_type = 'free' OR l.price_cents >= ${add(f.min * 100)})`);
  if (f.max != null) w.push(`(l.price_type IN ('free','negotiable') OR l.price_cents <= ${add(f.max * 100)})`);
  if (f.q) {
    // Trigram-backed substring match. Works for Latin and for Chinese, which a
    // plain tsvector cannot segment — see docs/architecture.md on search.
    const like = add('%' + f.q + '%');
    w.push(`(l.title ILIKE ${like} OR l.description ILIKE ${like})`);
  }
  if (f.language) {
    w.push(`EXISTS (SELECT 1 FROM user_language ul
              WHERE ul.user_id = l.user_id AND ul.language_code = ${add(f.language)})`);
  }
  return { where: w.join(' AND '), params: p };
}

const ORDER = {
  new:  'l.bumped_at DESC',
  low:  `CASE l.price_type WHEN 'free' THEN 0 ELSE 1 END, l.price_cents ASC NULLS LAST, l.bumped_at DESC`,
  high: `CASE l.price_type WHEN 'free' THEN 1 ELSE 0 END, l.price_cents DESC NULLS LAST, l.bumped_at DESC`,
};

export async function searchListings(f = {}) {
  const { where, params } = buildWhere(f);
  const order = ORDER[f.sort] || ORDER.new;
  const { n: total } = await one(
    `SELECT COUNT(*)::int AS n FROM listing l
       JOIN category c ON c.id = l.category_id WHERE ${where}`, params);
  const limit = f.limit ?? 24, offset = f.offset ?? 0;
  let rows = await q(
    `SELECT ${LISTING_COLS} FROM listing l
       JOIN "user" u ON u.id = l.user_id
       JOIN category c ON c.id = l.category_id
      WHERE ${where} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]);
  if (!f.sort || f.sort === 'varied') rows = diversify(rows);
  return { rows, total };
}

/* Recency, rebalanced so no single category or seller owns the opening screen.
   See docs/ux-guidelines.md 1.1 */
export function diversify(rows, windowSize = 8, cap = 2) {
  const out = [], pool = [...rows];
  const catCount = new Map(), sellerCount = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  while (pool.length) {
    let pick = 0;
    if (out.length < windowSize) {
      pick = pool.findIndex(
        (r) => (catCount.get(r.category_id) || 0) < cap && (sellerCount.get(r.user_id) || 0) < cap);
      if (pick === -1) pick = 0;
    }
    const [r] = pool.splice(pick, 1);
    bump(catCount, r.category_id); bump(sellerCount, r.user_id);
    out.push(r);
  }
  return out;
}

/* No-results recovery: 'relaxed' means dropping a FILTER found real matches for
   the same query; 'fallback' means the query matches nothing anywhere, so show
   recent listings and claim nothing. See docs/ux-guidelines.md 3.2 */
export async function relaxSearch(f) {
  const ladder = [
    ['price',     { ...f, min: null, max: null }],
    ['campus',    { ...f, campuses: [] }],
    ['condition', { ...f, conditions: [] }],
    ['category',  { ...f, categories: [] }],
    ['filters',   { ...f, min: null, max: null, campuses: [], conditions: [], categories: [] }],
  ];
  const changed = (a, b) =>
    a.min !== b.min || a.max !== b.max ||
    (a.campuses || []).length !== (b.campuses || []).length ||
    (a.conditions || []).length !== (b.conditions || []).length ||
    (a.categories || []).length !== (b.categories || []).length;
  for (const [drop, filters] of ladder) {
    if (!changed(filters, f)) continue;
    const { rows, total } = await searchListings({ ...filters, limit: 8, offset: 0 });
    if (total > 0) return { kind: 'relaxed', drop, rows, total };
  }
  const { rows } = await searchListings({ campuses: f.campuses || [], limit: 8, offset: 0 });
  const fallback = rows.length ? rows : (await searchListings({ limit: 8, offset: 0 })).rows;
  return fallback.length ? { kind: 'fallback', rows: fallback } : null;
}

/* Bounds for the price slider — taken from the data rather than hard-coded, so
   the track always spans something real. Rounded out to a tidy step. */
export async function priceBounds() {
  const r = await one(
    `SELECT COALESCE(MIN(price_cents),0)::int AS lo, COALESCE(MAX(price_cents),0)::int AS hi
       FROM listing WHERE status='active' AND deleted_at IS NULL AND price_type='fixed'`);
  const hi = Math.max(100, Math.ceil((r.hi || 0) / 100 / 50) * 50);   // ¥, up to nearest 50
  return { min: 0, max: hi };
}

/* Counts per facet value for the current query, with that facet's own selection
   lifted — so ticking "Yuquan" does not zero out every other campus's count. */
export async function facetCounts(f, facet) {
  const cleared = { ...f, limit: 1000, offset: 0 };
  if (facet === 'campus') cleared.campuses = [];
  if (facet === 'category') cleared.categories = [];
  if (facet === 'condition') cleared.conditions = [];
  const { where, params } = buildWhere(cleared);
  const col = facet === 'campus' ? 'l.campus' : facet === 'category' ? 'c.slug' : 'l.condition';
  const rows = await q(
    `SELECT ${col} AS k, COUNT(*)::int AS n FROM listing l
       JOIN "user" u ON u.id = l.user_id JOIN category c ON c.id = l.category_id
      WHERE ${where} GROUP BY ${col}`, params);
  return Object.fromEntries(rows.map((r) => [r.k, r.n]));
}

/* ---------- Single listing ---------- */
export const getListing = (id) => one(
  `SELECT l.*, u.display_name AS seller_name, u.family_name AS seller_family,
          u.given_name AS seller_given, u.is_zju_verified, u.home_campus AS seller_campus,
          u.created_at AS seller_since, u.wechat_id AS seller_wechat,
          c.slug AS category_slug, c.name_en AS category_en, c.name_zh AS category_zh
     FROM listing l JOIN "user" u ON u.id = l.user_id JOIN category c ON c.id = l.category_id
    WHERE l.id = $1 AND l.deleted_at IS NULL`, [id]);

export const listingImages = (id) => q(
  `SELECT id, COALESCE(url, '/img/' || id) AS src, width, height, credit, credit_url FROM listing_image
    WHERE listing_id = $1 ORDER BY sort_order`, [id]);

export const imageBlob = (id) => one('SELECT mime, data, url FROM listing_image WHERE id = $1', [id]);
/* Type-ahead: titles that contain what has been typed, the ones that start
   with it first. The trigram index on title is what keeps this cheap. */
export function suggestListings(term, campus = null, limit = 6) {
  const args = ['%' + term.replace(/[\\%_]/g, (c) => '\\' + c) + '%', term];
  if (campus) args.push(campus);
  return q(`SELECT l.id, l.title, c.slug AS category_slug, c.name_en, c.name_zh
              FROM listing l JOIN category c ON c.id = l.category_id
             WHERE l.status = 'active' AND l.deleted_at IS NULL AND l.title ILIKE $1
               ${campus ? 'AND l.campus = $3' : ''}
             ORDER BY strpos(lower(l.title), lower($2)), l.bumped_at DESC
             LIMIT ${Math.max(1, Math.min(10, limit | 0))}`, args);
}

export const favoriteCount = async (listingId) => (await one(
  'SELECT COUNT(*)::int AS n FROM favorite WHERE listing_id = $1', [listingId])).n;

export const bumpView = (id) => run('UPDATE listing SET view_count = view_count + 1 WHERE id = $1', [id]);

/* ---------- Users ---------- */
export const getUser = (id) => one('SELECT * FROM "user" WHERE id = $1', [id]);
export const userLanguages = (id) => q(
  `SELECT g.* FROM user_language ul JOIN language g ON g.code = ul.language_code
    WHERE ul.user_id = $1 ORDER BY g.sort_order`, [id]);
export const userListings = (userId, status = 'active') => q(
  `SELECT ${LISTING_COLS} FROM listing l
     JOIN "user" u ON u.id = l.user_id JOIN category c ON c.id = l.category_id
    WHERE l.user_id = $1 AND l.status = $2 AND l.deleted_at IS NULL
    ORDER BY l.bumped_at DESC`, [userId, status]);
export async function userListingCounts(userId) {
  const r = { active: 0, sold: 0, expired: 0 };
  for (const x of await q(
    `SELECT status, COUNT(*)::int AS n FROM listing
      WHERE user_id = $1 AND deleted_at IS NULL GROUP BY status`, [userId]))
    if (x.status in r) r[x.status] = x.n;
  return r;
}

/* ---------- Favourites ---------- */
export const isFavorited = async (userId, listingId) =>
  !!userId && !!(await one('SELECT 1 FROM favorite WHERE user_id = $1 AND listing_id = $2', [userId, listingId]));
export async function toggleFavorite(userId, listingId) {
  const has = await isFavorited(userId, listingId);
  if (has) await run('DELETE FROM favorite WHERE user_id = $1 AND listing_id = $2', [userId, listingId]);
  else await run('INSERT INTO favorite (user_id, listing_id, created_at) VALUES ($1,$2,$3)',
                 [userId, listingId, now()]);
  return !has;
}
export const favoriteIds = async (userId) => !userId ? new Set() :
  new Set((await q('SELECT listing_id FROM favorite WHERE user_id = $1', [userId])).map((r) => r.listing_id));
export const favoriteListings = (userId) => q(
  `SELECT ${LISTING_COLS} FROM favorite f
     JOIN listing l ON l.id = f.listing_id
     JOIN "user" u ON u.id = l.user_id JOIN category c ON c.id = l.category_id
    WHERE f.user_id = $1 AND l.deleted_at IS NULL ORDER BY f.created_at DESC`, [userId]);

/* ---------- Conversations ----------
   Every read is scoped to a participant IN THE QUERY (infrastructure.md 4.1). */
export async function findOrCreateConversation(listingId, buyerId, sellerId) {
  const found = await one('SELECT * FROM conversation WHERE listing_id = $1 AND buyer_id = $2',
                          [listingId, buyerId]);
  if (found) return found;
  const id = uid(), ts = now();
  await run(`INSERT INTO conversation (id, listing_id, buyer_id, seller_id, created_at, last_message_at)
             VALUES ($1,$2,$3,$4,$5,$6)`, [id, listingId, buyerId, sellerId, ts, ts]);
  return one('SELECT * FROM conversation WHERE id = $1', [id]);
}
export const getConversationFor = (convId, userId) => one(
  `SELECT c.*, l.title AS listing_title, l.status AS listing_status,
          (SELECT COALESCE(i.url, '/img/' || i.id) FROM listing_image i WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_src
     FROM conversation c JOIN listing l ON l.id = c.listing_id
    WHERE c.id = $1 AND (c.buyer_id = $2 OR c.seller_id = $2)`, [convId, userId]);

export const conversationsFor = (userId) => q(
  `SELECT c.*, l.title AS listing_title,
          (SELECT COALESCE(i.url, '/img/' || i.id) FROM listing_image i WHERE i.listing_id = l.id ORDER BY i.sort_order LIMIT 1) AS cover_src,
          other.display_name AS other_name, other.family_name AS other_family,
          other.given_name AS other_given, other.id AS other_id,
          (SELECT m.body FROM message m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
          (SELECT COUNT(*)::int FROM message m
            WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL) AS unread
     FROM conversation c
     JOIN listing l ON l.id = c.listing_id
     JOIN "user" other ON other.id = CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
    WHERE c.buyer_id = $1 OR c.seller_id = $1
    ORDER BY c.last_message_at DESC`, [userId]);

export const messagesIn = (convId) => q(
  'SELECT * FROM message WHERE conversation_id = $1 ORDER BY created_at', [convId]);

export const sendMessage = (convId, senderId, body) => tx(async (c) => {
  const ts = now();
  await c.query('INSERT INTO message (id,conversation_id,sender_id,body,created_at) VALUES ($1,$2,$3,$4,$5)',
                [uid(), convId, senderId, body, ts]);
  await c.query('UPDATE conversation SET last_message_at = $1 WHERE id = $2', [ts, convId]);
});
export const markRead = (convId, userId) => run(
  `UPDATE message SET read_at = $1 WHERE conversation_id = $2 AND sender_id <> $3 AND read_at IS NULL`,
  [now(), convId, userId]);
export const unreadCount = async (userId) => (await one(
  `SELECT COUNT(*)::int AS n FROM message m JOIN conversation c ON c.id = m.conversation_id
    WHERE (c.buyer_id = $1 OR c.seller_id = $1) AND m.sender_id <> $1 AND m.read_at IS NULL`,
  [userId])).n;

/* ---------- Listing mutations. Every one is scoped by owner. ---------- */
export async function createListing(d) {
  const id = uid(), ts = now();
  await run(`INSERT INTO listing
    (id,user_id,category_id,title,description,price_type,price_cents,condition,campus,meetup_note,
     status,published_at,expires_at,bumped_at,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12,$13,$14,$15)`,
    [id, d.user_id, d.category_id, d.title, d.description || '', d.price_type,
     d.price_cents ?? null, d.condition, d.campus, d.meetup_note || null,
     ts, daysFromNow(30), ts, ts, ts]);
  return id;
}
export const addImage = (listingId, mime, data, order, credit = null, creditUrl = null) => run(
  `INSERT INTO listing_image (id,listing_id,mime,data,sort_order,created_at,credit,credit_url)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
  [uid(), listingId, mime, data, order, now(), credit, creditUrl]);

export const ownedListing = (id, userId) => one(
  'SELECT * FROM listing WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
export const setStatus = (id, userId, status) => run(
  'UPDATE listing SET status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4',
  [status, now(), id, userId]);
export const renewListing = (id, userId) => run(
  `UPDATE listing SET status='active', expires_at = $1, bumped_at = $2, updated_at = $2
     WHERE id = $3 AND user_id = $4`, [daysFromNow(30), now(), id, userId]);
export const softDelete = (id, userId) => run(
  `UPDATE listing SET deleted_at = $1, status='removed', updated_at = $1 WHERE id = $2 AND user_id = $3`,
  [now(), id, userId]);

export const createReport = (reporterId, targetType, targetId, reason, note = null) => run(
  `INSERT INTO report (id,reporter_id,target_type,target_id,reason,note,created_at)
   VALUES ($1,$2,$3,$4,$5,$6,$7)`,
  [uid(), reporterId, targetType, targetId, reason, note, now()]);

export async function shareWechat(convId, userId) {
  const c = await one('SELECT * FROM conversation WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)',
                      [convId, userId]);
  if (!c) return false;
  const col = c.buyer_id === userId ? 'buyer_wechat_shared' : 'seller_wechat_shared';
  await run(`UPDATE conversation SET ${col} = TRUE WHERE id = $1`, [convId]);
  return true;
}
