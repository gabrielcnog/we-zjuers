/* ============================================================
   Give the seeded dummy listings real photographs from Unsplash,
   following the API guidelines:
   https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines

   - Hotlink: we store photo.urls.raw (with its ixid) and the browser
     loads from images.unsplash.com. No bytes are downloaded or re-hosted.
   - Trigger downloads: each photo put on a listing hits its
     links.download_location once (tracked in download_tracked_at).
   - Attribute: photographer name + profile URL are stored; the
     listing page renders "Photo by X on Unsplash" with utm params.
   - Keys: Access Key only, read from app/.env (gitignored). The Secret
     Key is not used by this app and must not be put anywhere in it.

   PROTOTYPE ONLY. Stock photos stand in for dummy data. Real listings
   must show the seller's own photos — never stock imagery.

   Rate limits: a demo app gets 50 API requests/hour. One search per item
   type plus one download trigger per photo is ~140 requests, so this
   script stops cleanly when the budget runs low and picks up where it
   left off next run. `--wait` keeps it going, pausing between hours.

     node fetch-photos.mjs          # do what fits in the current hour
     node fetch-photos.mjs --wait   # run to completion, pausing as needed
   ============================================================ */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
if (existsSync(join(HERE, '.env'))) process.loadEnvFile(join(HERE, '.env'));

const { pool, q, tx, migrate, uid, now } = await import('./db.mjs');
const { artKindFor } = await import('./seed.mjs');

const KEY = process.env.UNSPLASH_ACCESS_KEY;
const WAIT = process.argv.includes('--wait');
const RESERVE = 1;                                   // never spend the last request
const CACHE = join(HERE, 'data', 'unsplash-search.json');

if (!KEY) {
  console.error(`
  Missing UNSPLASH_ACCESS_KEY.
  Put your Unsplash *Access Key* (not the Secret Key) in:

    ${join(HERE, '.env')}

  as a single line:  UNSPLASH_ACCESS_KEY=...
  (.env is gitignored.)
`);
  process.exit(1);
}

/* One search term per item type. Concrete on purpose — "desk lamp" returns
   lamps; "lamp" returns mood lighting. */
const QUERIES = {
  lamp: 'desk lamp', desk: 'wooden desk furniture', bike: 'bicycle bike',
  monitor: 'computer monitor screen', books: 'stack of books textbooks',
  kettle: 'electric kettle', pots: 'cooking pots pans set', coat: 'winter coat jacket',
  racket: 'badminton racket', cooker: 'rice cooker appliance', chair: 'office desk chair',
  stationery: 'stationery notebooks pens', suitcase: 'suitcase luggage',
  keyboard: 'mechanical keyboard', fan: 'electric fan', yoga: 'yoga mat',
  shelf: 'bookshelf shelving unit', dryer: 'hair dryer', helmet: 'bicycle helmet',
  bedding: 'duvet bedding pillow', pot: 'pressure cooker instant pot',
  shoes: 'running shoes sneakers', hob: 'induction cooktop stove',
  dumbbell: 'dumbbells weights', camera: 'dslr camera', scooter: 'electric scooter',
  gift: 'cardboard moving boxes', box: 'cardboard box',
  translate: 'dictionary language study', tutoring: 'student tutoring study desk',
  webdev: 'laptop code programming', cvdesign: 'resume document desk',
  repair: 'laptop repair tools',
};

/* ---------- API with rate-limit bookkeeping ---------- */
let remaining = null;
class OutOfBudget extends Error {}

async function api(path) {
  if (remaining !== null && remaining <= RESERVE) throw new OutOfBudget();
  const url = path.startsWith('https://') ? path : 'https://api.unsplash.com' + path;
  const r = await fetch(url, { headers: { Authorization: 'Client-ID ' + KEY, 'Accept-Version': 'v1' } });
  const rem = r.headers.get('x-ratelimit-remaining');
  if (rem !== null) remaining = Number(rem);
  if (r.status === 401) throw new Error('Unsplash rejected the key (401). Use the Access Key, not the Secret Key.');
  if (r.status === 403 || r.status === 429) { remaining = 0; throw new OutOfBudget(); }
  if (!r.ok) throw new Error(`Unsplash ${r.status} on ${new URL(url).pathname}`);
  return r.json();
}

/* Search results are cached so a resumed run doesn't pay for them twice.
   The cache holds metadata only (URLs, names) — no image bytes. */
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
async function searchKind(kind) {
  if (cache[kind]) return cache[kind];
  const query = QUERIES[kind] || QUERIES.box;
  const data = await api(`/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape&content_filter=high`);
  cache[kind] = (data.results || []).map((p) => ({
    id: p.id,
    raw: p.urls.raw,                                  // contains ixid — keep it
    width: p.width, height: p.height,
    credit: p.user?.name || p.user?.username,
    credit_url: p.user?.links?.html,                  // photographer profile
    download_location: p.links?.download_location,
  })).filter((p) => p.raw && p.credit && p.credit_url && p.download_location);
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  return cache[kind];
}

/* ---------- Work ---------- */
async function pass() {
  // 1. Finish any download triggers a previous run couldn't send.
  const pending = await q(`SELECT i.id, i.source_id FROM listing_image i
                            WHERE i.url IS NOT NULL AND i.download_tracked_at IS NULL`);
  const byId = new Map(Object.values(cache).flat().map((p) => [p.id, p]));
  for (const im of pending) {
    const p = byId.get(im.source_id);
    if (!p) continue;
    await api(p.download_location);
    await q('UPDATE listing_image SET download_tracked_at = $1 WHERE id = $2', [now(), im.id]);
  }

  // 2. Listings still on their seeded illustrations.
  const todo = await q(
    `SELECT l.id, l.title, c.slug,
            (SELECT COUNT(*)::int FROM listing_image i WHERE i.listing_id = l.id) AS n
       FROM listing l JOIN category c ON c.id = l.category_id
      WHERE l.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM listing_image i WHERE i.listing_id = l.id AND i.url IS NOT NULL)
      ORDER BY l.created_at DESC`);
  const used = new Set((await q('SELECT source_id FROM listing_image WHERE source_id IS NOT NULL')).map((r) => r.source_id));

  let done = 0;
  for (const l of todo) {
    const kind = artKindFor(l.title, l.slug);
    const wanted = Math.max(1, l.n);
    // Need the search (if uncached) plus one trigger per photo, before touching the listing.
    const cost = (cache[kind] ? 0 : 1) + wanted;
    if (remaining !== null && remaining - RESERVE < cost) throw new OutOfBudget();

    const results = await searchKind(kind);
    const fresh = results.filter((p) => !used.has(p.id));
    const picked = (fresh.length >= wanted ? fresh : results).slice(0, wanted);
    if (!picked.length) { console.error(`  ✗ ${kind}: no results for "${l.title}"`); continue; }

    // Swap first (atomically — a listing never sits with zero images), then
    // trigger downloads. Unsent triggers are retried by step 1 next run.
    const rows = picked.map((p, i) => ({ id: uid(), p, i }));
    await tx(async (c) => {
      await c.query('DELETE FROM listing_image WHERE listing_id = $1', [l.id]);
      for (const { id, p, i } of rows)
        await c.query(`INSERT INTO listing_image
          (id, listing_id, mime, data, url, source_id, width, height, sort_order, created_at, credit, credit_url)
          VALUES ($1,$2,'image/jpeg',NULL,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [id, l.id, p.raw, p.id, p.width, p.height, i, now(), p.credit, p.credit_url]);
    });
    picked.forEach((p) => used.add(p.id));
    for (const { id, p } of rows) {
      await api(p.download_location);
      await q('UPDATE listing_image SET download_tracked_at = $1 WHERE id = $2', [now(), id]);
    }
    done++;
    console.log(`  ✓ ${kind.padEnd(11)} ${l.title.slice(0, 40).padEnd(42)} ${picked.length} photo${picked.length > 1 ? 's' : ''}  (budget left: ${remaining})`);
  }
  return { done, left: todo.length - done };
}

async function main() {
  await migrate();
  for (;;) {
    try {
      const { done } = await pass();
      console.log(`\nAll listings have photos (${done} updated this run). No restart needed.`);
      break;
    } catch (e) {
      if (!(e instanceof OutOfBudget)) throw e;
      const [{ n }] = await q(`SELECT COUNT(*)::int AS n FROM listing l WHERE l.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM listing_image i WHERE i.listing_id = l.id AND i.url IS NOT NULL)`);
      if (!WAIT) { console.log(`\nHourly API budget used up. ${n} listings left — run again in an hour (or use --wait).`); break; }
      console.log(`\nHourly API budget used up, ${n} listings left. Waiting 15 min…`);
      await new Promise((r) => setTimeout(r, 15 * 60 * 1000));
      remaining = null;
    }
  }
  await pool.end();
}

main().catch(async (e) => { console.error('\n' + e.message); await pool.end().catch(() => {}); process.exit(1); });
