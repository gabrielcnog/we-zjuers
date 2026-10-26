/* ============================================================
   WeZJUers — prototype server. Node built-ins only, no deps.
   Server-rendered HTML, as specced: the feed is content, not an
   application that fetches JSON.
   ============================================================ */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, expireOverdue, pool, now, DATABASE_URL } from './db.mjs';
import * as Q from './lib/queries.mjs';
import * as A from './lib/auth.mjs';
import { DEMO, PROD, DEMO_EMAIL, DEMO_SESSION_DAYS, refusal, ensureDemoUser } from './lib/demo.mjs';
import { loadSnapshotIfEmpty, freshenIfStale } from './lib/snapshot.mjs';
import { saveBug, forwardBug, retryUnforwarded, KINDS as BUG_KINDS, LIMITS as BUG_LIMITS } from './lib/bugs.mjs';
import { translator, LOCALES } from './lib/i18n.mjs';
import { page, L, ICONS } from './views/layout.mjs';
import * as V from './views/pages.mjs';
import * as C from './lib/community.mjs';
import * as CV from './views/community.mjs';
import * as GV from './views/guide.mjs';
import * as E from './lib/events.mjs';
import * as EV from './views/events.mjs';
import { personName } from './lib/names.mjs';
import { esc, raw } from './lib/html.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4400);
const MAX_BODY = 12 * 1024 * 1024;         // generous: images arrive as data URIs
const CAMPUS_COOKIE = 'zl_campus';
const ASSET_CACHE = new Map();
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
               '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };



/* ---------- helpers ---------- */
/* Text responses are compressed when the browser offers it. The HTML of a
   full feed is ~150KB and compresses to a fraction of that, which is the
   difference between snappy and sluggish on campus mobile data. */
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const send = (res, status, body, headers = {}) => {
  const type = headers['Content-Type'] || 'text/html; charset=utf-8';
  if (res.zlGzip && COMPRESSIBLE.test(type) && body && body.length > 1024) {
    body = gzipSync(typeof body === 'string' ? Buffer.from(body) : body);
    headers = { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' };
  }
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    /* Photos come from Unsplash; everything else is same-origin. Scripts are
       'self' with no inline escape hatch — the two onchange handlers that used
       to force 'unsafe-inline' now live in app.js. Inline STYLE attributes are
       still used in a few views, so style-src keeps its exception. */
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: https://images.unsplash.com; "
      + "style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; "
      + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    ...headers,
  });
  /* HEAD must answer exactly as GET would, headers and all, but with no body
     (RFC 9110 9.3.2). Content-Length is left as Node computed it from the
     body we are withholding, which is what a HEAD client wants to read. */
  res.end(res.zlHead ? undefined : body);
};
const redirect = (res, to, headers = {}) => { res.writeHead(302, { Location: to, ...headers }); res.end(); };
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json' });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
/* A NUL byte cannot be stored in a Postgres text value, so one in a query or a
   form field made the whole request a 500. Nothing legitimate contains one;
   strip it where input enters rather than guarding each query. */
const noNul = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v).replace(/\u0000/g, '')]));
const parseForm = (s) => noNul(Object.fromEntries(new URLSearchParams(s)));
const num = (v) => { const n = Number(v); return Number.isFinite(n) && v !== '' ? n : null; };

/* ---------- server ---------- */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const seg = url.pathname.split('/').filter(Boolean);
  res.zlGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  /* Every route is written as `req.method === 'GET'`, so a HEAD fell through
     all of them to the 404 — which meant uptime monitors, link checkers and
     link-preview bots saw a dead site. Route HEAD as GET and drop the body on
     the way out; nothing else in the file has to know. */
  if (req.method === 'HEAD') { req.method = 'GET'; res.zlHead = true; }

  try {
    /* static assets — tokens/components come straight from the design system,
       so there is exactly one source of truth for the CSS. */
    if (seg[0] === 'assets') {
      const name = seg[1] || '';
      const map = {
        'tokens.css': join(HERE, '..', 'design', 'tokens.css'),
        'components.css': join(HERE, '..', 'design', 'components.css'),
        'app.css': join(HERE, 'public', 'app.css'),
        'app.js': join(HERE, 'public', 'app.js'),
        'favicon.svg': join(HERE, 'public', 'favicon.svg'),
        /* PNG fallbacks for the browsers that do not take an SVG favicon, and
           for an iOS home screen — see the <link> tags in views/layout.mjs. */
        'icon-32.png': join(HERE, 'public', 'icon-32.png'),
        'icon-180.png': join(HERE, 'public', 'icon-180.png'),
      };
      if (!map[name]) return send(res, 404, 'Not found');
      // Read once per file per boot: these change only when the server restarts,
      // which is also when their ?v= cache key changes.
      let buf = ASSET_CACHE.get(name);
      if (!buf) { buf = await readFile(map[name]); ASSET_CACHE.set(name, buf); }
      return send(res, 200, buf, { 'Content-Type': MIME[extname(name)] || 'text/plain',
                                   'Cache-Control': 'public, max-age=3600' });
    }

    /* images */
    if (seg[0] === 'img' && seg[1]) {
      // A malformed id is a 404, not a database error.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg[1]))
        return send(res, 404, 'Not found');
      const im = await Q.imageBlob(seg[1]);
      if (!im) return send(res, 404, 'Not found');
      if (!im.data && im.url) return send(res, 302, '', { Location: im.url });   // hotlinked, never proxied
      const body = im.mime === 'image/svg+xml' ? im.data : Buffer.from(im.data, 'base64');
      return send(res, 200, body, { 'Content-Type': im.mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
    }

    /* locale prefix — language lives in the URL (docs/interface.md 1) */
    if (!LOCALES.includes(seg[0])) {
      const accept = (req.headers['accept-language'] || '').toLowerCase();
      const guess = accept.split(',').map((s) => s.split(';')[0].trim().split('-')[0])
        .find((l) => LOCALES.includes(l)) || 'en';
      return redirect(res, '/' + guess + url.pathname + url.search);
    }
    const locale = seg[0], t = translator(locale), rest = seg.slice(1);
    const cookies = A.readCookies(req);
    const user = await A.userForToken(cookies[A.COOKIE]);
    const unread = user ? await Q.unreadCount(user.id) : 0;
    /* Campus is a persistent browsing scope, not a per-page filter: one cookie,
       read here, used by the feed and the search rail alike so the header and
       the rail can never disagree. "all" (or absent) means every campus. */
    const rawCampus = cookies[CAMPUS_COOKIE];
    const campus = Q.ref().campuses.some((c) => c.code === rawCampus) ? rawCampus : null;
    const headerCampus = url.searchParams.getAll('campus');
    /* Which header section a page belongs to. Sign-in has no section of its
       own: it borrows the section of the page that sent the user there (its
       `next`), so "New post" in Community signs you in inside Community. The
       community post form opened from the Guidebook carries from=guide and
       stays in the Guidebook. */
    const MARKET = ['market', 'search', 'listing', 'post', 'my', 'saved', 'messages', 'u'];
    const sectionOf = (target) => {
      const [p, qs = ''] = String(target || '').split('?');
      const s = p.split('/').filter(Boolean)[1];
      if (s === 'guide' || new URLSearchParams(qs).get('from') === 'guide') return 'guide';
      if (s === 'events' || new URLSearchParams(qs).get('from') === 'events') return 'events';
      if (MARKET.includes(s)) return 'market';
      return 'community';                        // community, sign-in, rules, root
    };
    let sectionOverride = null;
    /* A page can claim the floating button on a phone — see page() in
       views/layout.mjs. Only the listing does, so far. */
    let fabOverride = null;
    /* A failure that looks like the site, in the reader's language. These were
       bare text ("Not found", "Slow down") on a blank page. */
    const fail = (status, key) => send(res, status, page({ locale, t, user, title: t(key), unread, path: url.pathname,
      body: raw(`<div class="app-narrow"><h1 class="zl-h2">${esc(t(key))}</h1>`
        + `<a class="zl-btn zl-btn--primary" href="${L(locale, '/community')}">${esc(t('com.title'))}</a></div>`) }));
    const render = (title, body) =>
      send(res, 200, page({ locale, t, user, title, body, unread,
        path: url.pathname, search: url.search, searchValue: params.q || '',
        fab: fabOverride,
        section: sectionOverride
          || (rest[0] === 'signin' ? sectionOf(safeNext(params.next)) : sectionOf(url.pathname + url.search)),
        campus: headerCampus.length === 1 ? headerCampus[0] : (headerCampus.length ? '__many' : campus) }));
    /* Only ever redirect to a path on this site. A `next` of "//evil.com" or
       "https://evil.com" is an open redirect — the classic bug in exactly this
       feature — so anything not starting with a single "/" is discarded. */
    const safeNext = (v) => (typeof v === 'string' && /^\/[^/\\]/.test(v) ? v : null);
    /* `next` is where sign-in sends you back to. It defaults to this URL,
       which is right for a page but wrong for a POST: "/listing/:id/contact"
       has no GET route, so a signed-out visitor pressing "Message seller"
       used to sign in and land on a 404. Actions pass the page to return to. */
    /* Posting an event is for verified organisers (docs/events.md). Read
       once here: the community new-post route needs it too, to decide
       whether to offer the "link an event" select. */
    const canPost = !!user && (user.role === 'organizer' || user.role === 'admin');
    const requireUser = (next = null) => {
      if (!user) {
        redirect(res, L(locale, '/signin') + '?next=' + encodeURIComponent(next || url.pathname + url.search));
        return false;
      }
      return true;
    };
    const params = noNul(Object.fromEntries(url.searchParams));
    const favSet = await Q.favoriteIds(user?.id);

    /* Demo mode: refuse every write that is not on the short allowlist, and
       the pages that only exist to compose one. One check, before any route,
       so nothing added later is writable by accident. See lib/demo.mjs. */
    const blocked = refusal(req.method, url.pathname);
    if (blocked) {
      /* A form post asks for HTML; the page's own fetch() calls (Save, vote)
         do not, and want something they can read rather than a whole page. */
      const fromScript = !(req.headers.accept || '').includes('text/html');
      if (req.method === 'POST' && fromScript) return json(res, 403, { error: 'demo' });
      return send(res, 403, page({ locale, t, user, title: t('demo.refused.title'), unread, path: url.pathname,
        body: raw(`<div class="app-narrow"><h1 class="zl-h2">${esc(t('demo.refused.title'))}</h1>`
          + `<p class="zl-muted">${esc(t('demo.refused.body'))}</p>`
          + `<a class="zl-btn zl-btn--primary" href="${L(locale, '/community')}">${esc(t('com.title'))}</a></div>`) }));
    }

    /* Every route whose second segment is a record id: reject anything that
       isn't a UUID here, once, as a 404 — otherwise Postgres throws on the cast
       and the visitor gets a 500 for mistyping a link. */
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (['listing', 'u', 'messages', 'fav'].includes(rest[0]) && rest[1] && !UUID_RE.test(rest[1]))
      return send(res, 404, page({ locale, t, user, title: '404', unread, path: url.pathname,
        body: raw(`<h1 class="zl-h2">Not found</h1><p class="zl-muted"><a href="${L(locale, '/community')}">${esc(t('com.title'))}</a></p>`) }));

    /* ---- GET /campus — set the browsing scope ---- */
    if (req.method === 'GET' && rest[0] === 'campus') {
      const to = params.to;
      const valid = to === 'all' || Q.ref().campuses.some((c) => c.code === to);
      let back = safeNext(params.next) || L(locale, '/community');
      if (!valid) return redirect(res, back);
      /* Changing the scope in the header should visibly change the page you are
         on — including search. Strip the rail's own campus state so the new
         header choice is what applies; ticking a box afterwards takes over
         again. */
      if (back.includes('?')) {
        const [p, qsPart] = back.split('?');
        const keep = new URLSearchParams(qsPart);
        keep.delete('campus'); keep.delete('f'); keep.delete('offset');
        const rest2 = keep.toString();
        back = rest2 ? `${p}?${rest2}` : p;
      }
      const cookie = to === 'all'
        ? `${CAMPUS_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`
        : `${CAMPUS_COOKIE}=${encodeURIComponent(to)}; Path=/; SameSite=Lax; Max-Age=${180 * 86400}`;
      return redirect(res, back, { 'Set-Cookie': cookie });
    }

    /* ---- GET / — the community is the front page now; the marketplace
       lives at /market. A root URL that still carries feed parameters (an old
       bookmark, a shared category link) goes to the marketplace with them. ---- */
    if (req.method === 'GET' && rest.length === 0)
      return redirect(res, url.search ? L(locale, '/market') + url.search : L(locale, '/community'));

    /* ---- GET /market ---- */
    if (req.method === 'GET' && rest[0] === 'market' && !rest[1]) {
      const offset = Number(params.offset || 0);
      /* buildWhere reads `campuses` (plural) since facets went multi-select —
         passing the old singular key here silently dropped the header scope. */
      const f = { categories: params.category ? [params.category] : [],
                  campuses: campus ? [campus] : [],
                  sort: params.sort, limit: 24 + offset, offset: 0 };
      /* Counts for the category rail. Scoped to the campus but not to the
         category, so each row shows what you would get by switching to it
         rather than what is left inside the current filter. */
      const [{ rows, total }, catCounts] = await Promise.all([
        Q.searchListings(f),
        Q.facetCounts({ categories: [], campuses: campus ? [campus] : [] }, 'category'),
      ]);
      return render(t('home.title'), V.home({ locale, t, rows, total, params, favSet, catCounts }));
    }

    /* ---- GET /search ---- */
    if (req.method === 'GET' && rest[0] === 'search') {
      const offset = Number(params.offset || 0);
      const ref = Q.ref();
      const many = (key, valid) =>
        url.searchParams.getAll(key).filter((v) => valid.includes(v));
      /* The URL is the authority for a search. Only when it carries no campus
         at all do we fall back to the header's scope, so arriving from the feed
         keeps your campus but unticking boxes genuinely means "all". */
      /* The rail stamps `f=1` on submit. Its presence — not the presence of a
         campus value — is what marks the rail as authoritative, so unticking
         every campus means "all campuses" instead of quietly falling back to
         the header's scope. Arriving from anywhere else carries no marker, and
         the header scope seeds the search. */
      const railUsed = params.f === '1';
      const campuses = railUsed
        ? many('campus', ref.campuses.map((c) => c.code))
        : (url.searchParams.has('campus')
            ? many('campus', ref.campuses.map((c) => c.code))
            : (campus ? [campus] : []));
      const sel = {
        q: params.q?.trim() || '',
        categories: many('category', ref.categories.map((c) => c.slug)),
        campuses,
        conditions: many('condition', ['new', 'like_new', 'good', 'fair', 'parts']),
        min: num(params.min), max: num(params.max),
        sort: params.sort,
      };
      const f = { ...sel, limit: 24 + offset, offset: 0 };
      const [{ rows, total }, bounds] = await Promise.all([
        Q.searchListings(f), Q.priceBounds(),
      ]);
      const [campusCounts, categoryCounts, conditionCounts] = await Promise.all([
        Q.facetCounts(f, 'campus'), Q.facetCounts(f, 'category'), Q.facetCounts(f, 'condition'),
      ]);
      const relaxed = total === 0 ? await Q.relaxSearch(f) : null;
      return render(sel.q || t('nav.search'), V.search({
        locale, t, rows, total, sel, favSet, relaxed, bounds,
        counts: { campus: campusCounts, category: categoryCounts, condition: conditionCounts },
      }));
    }

    /* ---- GET /listing/:id ---- */
    if (req.method === 'GET' && rest[0] === 'listing' && rest[1] && !rest[2]) {
      const l = await Q.getListing(rest[1]);
      if (!l) return send(res, 404, page({ locale, t, user, title: '404', body: raw('<h1 class="zl-h2">Not found</h1>'), unread, path: url.pathname }));
      await Q.bumpView(l.id);
      const seller = await Q.getUser(l.user_id);
      const sellerOther = (await Q.userListings(l.user_id)).filter((x) => x.id !== l.id).slice(0, 4);
      /* On a phone the thumb button is the page's own action: message this
         seller. "Add listing" would be competing with the thing you came for,
         and the real button is a scroll away. Your own listing keeps the
         default — you cannot message yourself. */
      if (!DEMO && l.status === 'active' && user?.id !== l.user_id) {
        fabOverride = { action: L(locale, '/listing/' + l.id + '/contact'), label: t('listing.contact'), icon: ICONS.message };
      }
      return render(l.title, V.listing({
        locale, t, l, images: await Q.listingImages(l.id), seller, langs: await Q.userLanguages(l.user_id),
        favorited: await Q.isFavorited(user?.id, l.id), user, sellerOther,
        saveCount: await Q.favoriteCount(l.id),
        reported: params.reported === '1',
      }));
    }

    /* ---- POST /listing/:id/contact ---- */
    if (req.method === 'POST' && rest[0] === 'listing' && rest[2] === 'contact') {
      if (!requireUser(L(locale, '/listing/' + rest[1]))) return;
      const l = await Q.getListing(rest[1]);
      if (!l || l.user_id === user.id) return redirect(res, L(locale, '/listing/' + rest[1]));
      if (!A.rateLimit('thread:' + user.id, 20, 864e5)) return fail(429, 'error.slow');
      const c = await Q.findOrCreateConversation(l.id, user.id, l.user_id);
      return redirect(res, L(locale, '/messages/' + c.id));
    }

    /* ---- POST /listing/:id/wechat — reveal the seller's handle ----
       A POST, and the handle is never in the page until one is made. The
       guidelines promise no contact details in public posts, and a WeChat ID
       is the same kind of thing as a phone number: published on an open page
       it is scrapeable by anyone, signed in or not. Requiring the press means
       the reader is a signed-in student and the seller offered it on this
       listing. Rate limited, because a determined account could otherwise
       walk the catalogue and harvest every handle on the site. */
    if (req.method === 'POST' && rest[0] === 'listing' && rest[2] === 'wechat') {
      if (!requireUser(L(locale, '/listing/' + rest[1]))) return;
      const l = await Q.getListing(rest[1]);
      if (!l) return fail(404, 'error.notfound');
      if (!l.wechat_ok || !l.seller_wechat) return redirect(res, L(locale, '/listing/' + l.id));
      if (!A.rateLimit('wechat:' + user.id, 30, 864e5)) return fail(429, 'error.slow');
      /* Rendered from the POST, not redirected to ?wechat=1. A query flag
         would have been a GET that reveals, which any signed-in account could
         walk across the catalogue without ever touching the rate limit above
         — the exact harvesting this is meant to cost something. */
      await Q.bumpView(l.id);
      return render(l.title, V.listing({
        locale, t, l, images: await Q.listingImages(l.id),
        seller: await Q.getUser(l.user_id), langs: await Q.userLanguages(l.user_id),
        favorited: await Q.isFavorited(user.id, l.id), user,
        sellerOther: (await Q.userListings(l.user_id)).filter((x) => x.id !== l.id).slice(0, 4),
        saveCount: await Q.favoriteCount(l.id),
        wechat: l.seller_wechat,
      }));
    }

    /* ---- POST /listing/:id/report ---- */
    if (req.method === 'POST' && rest[0] === 'listing' && rest[2] === 'report') {
      if (!requireUser(L(locale, '/listing/' + rest[1]))) return;
      const { reason } = parseForm(await readBody(req));
      const l = await Q.getListing(rest[1]);
      if (!l) return fail(404, 'error.notfound');
      if (!A.rateLimit('report:' + user.id, 20, 864e5)) return fail(429, 'error.slow');
      await Q.createReport(user.id, 'listing', l.id,
        ['prohibited','spam','wrong','offensive','other'].includes(reason) ? reason : 'other');
      return redirect(res, L(locale, '/listing/' + l.id) + '?reported=1');
    }

    /* ---- POST /listing/:id/action — owner only ---- */
    if (req.method === 'POST' && rest[0] === 'listing' && rest[2] === 'action') {
      if (!requireUser()) return;
      const form = parseForm(await readBody(req));
      const { op } = form;
      const id = rest[1];
      // Every one of these is scoped by user_id IN THE QUERY (infrastructure.md 4.1)
      if (op === 'sold') await Q.setStatus(id, user.id, 'sold');
      else if (op === 'renew') await Q.renewListing(id, user.id);
      else if (op === 'delete') await Q.softDelete(id, user.id);
      else if (op === 'price') {
        /* Yuan in, cents stored. Validated, not sanitised: stripping the
           characters it does not like turned "-50" into a ¥50 listing, which
           is not what anyone typing a minus sign meant. Anything that is not
           plainly a positive amount is dropped and the price stands. */
        /* Whole yuan, like the posting form, which is numeric with an "80"
           placeholder. Allowing decimals here alone produced "¥79.5" — one
           listing formatted unlike every other on the site. */
        const raw$ = String(form.price ?? '').trim();
        const n = /^\d{1,7}$/.test(raw$) ? Number(raw$) : NaN;
        if (Number.isFinite(n) && n > 0 && n <= 1e6) {
          await Q.changePrice(id, user.id, Math.round(n * 100));
        }
      }
      return redirect(res, L(locale, '/my'));
    }

    /* ---- GET /u/:id ---- */
    if (req.method === 'GET' && rest[0] === 'u' && rest[1]) {
      const u = await Q.getUser(rest[1]);
      if (!u) return fail(404, 'error.notfound');
      const [langs, rows, going, organising] = await Promise.all([
        Q.userLanguages(u.id), Q.userListings(u.id),
        E.eventsFor(u.id), E.organisedBy(u.id)]);
      return render(personName({ family: u.family_name, given: u.given_name, fallback: u.display_name }, !!user),
        V.profile({ locale, t, u, langs, rows, going, organising, me: !!user }));
    }

    /* ---- GET /my ---- */
    if (req.method === 'GET' && rest[0] === 'my') {
      if (!requireUser()) return;
      const tab = ['active', 'sold', 'expired'].includes(params.tab) ? params.tab : 'active';
      return render(t('my.title'), V.my({
        locale, t, tab, rows: await Q.userListings(user.id, tab), counts: await Q.userListingCounts(user.id) }));
    }

    /* ---- GET /saved ---- */
    if (req.method === 'GET' && rest[0] === 'saved') {
      if (!requireUser()) return;
      return render(t('saved.title'), V.saved({ locale, t, rows: await Q.favoriteListings(user.id), favSet }));
    }

    /* ---- POST /fav/:id ---- */
    if (req.method === 'POST' && rest[0] === 'fav' && rest[1]) {
      if (!user) return json(res, 401, { error: 'signin' });
      return json(res, 200, { on: await Q.toggleFavorite(user.id, rest[1]) });
    }

    /* ---- Messages ---- */
    if (req.method === 'GET' && rest[0] === 'messages' && !rest[1]) {
      if (!requireUser()) return;
      return render(t('msg.title'), V.inbox({ locale, t, convos: await Q.conversationsFor(user.id) }));
    }
    if (rest[0] === 'messages' && rest[1]) {
      if (!requireUser()) return;
      const convo = await Q.getConversationFor(rest[1], user.id);   // scoped: 404 for non-participants
      if (!convo) return fail(404, 'error.notfound');
      if (req.method === 'POST' && rest[2] === 'wechat') {
        await Q.shareWechat(convo.id, user.id);
        return redirect(res, L(locale, '/messages/' + convo.id));
      }
      if (req.method === 'POST') {
        const { body } = parseForm(await readBody(req));
        if (body?.trim()) {
          if (!A.rateLimit('msg:' + user.id, 60, 36e5)) return fail(429, 'error.slow');
          await Q.sendMessage(convo.id, user.id, body.trim().slice(0, 2000));
        }
        return redirect(res, L(locale, '/messages/' + convo.id));
      }
      await Q.markRead(convo.id, user.id);
      const isBuyer = convo.buyer_id === user.id;
      const otherUser = await Q.getUser(isBuyer ? convo.seller_id : convo.buyer_id);
      return render(convo.listing_title, V.thread({
        locale, t, convo, msgs: await Q.messagesIn(convo.id), me: user, otherUser,
        myWechat: isBuyer ? convo.buyer_wechat_shared : convo.seller_wechat_shared,
        theirWechat: (isBuyer ? convo.seller_wechat_shared : convo.buyer_wechat_shared)
          ? otherUser.wechat_id : null,
      }));
    }

    /* ---- Sign in ---- */
    if (rest[0] === 'signin') {
      if (req.method === 'GET')
        return render(t('auth.title'), V.signin({
          t, locale, demo: DEMO, step: 'email', email: '', next: safeNext(params.next) }));
      const f = parseForm(await readBody(req));
      sectionOverride = sectionOf(safeNext(f.next));
      /* Demo: the one way in. A shared read-only account, a day long, and a
         cap on how fast sessions can be minted so the button cannot be used
         to fill the session table. */
      if (DEMO && f.step === 'demo') {
        if (!A.rateLimit('demo-login', 300, 36e5))
          return fail(429, 'error.slow');
        const id = await ensureDemoUser();
        const tok = await A.createSession(id, DEMO_SESSION_DAYS);
        A.setCookie(res, tok, DEMO_SESSION_DAYS);
        return redirect(res, safeNext(f.next) || L(locale, '/community'),
          { 'Set-Cookie': res.getHeader('Set-Cookie') });
      }
      /* Demo: no email sign-in and so no sign-up. Refused, not hidden — the
         form being absent from the page does not stop a hand-written POST. */
      if (DEMO) return render(t('auth.title'), V.signin({
        t, locale, demo: true, step: 'email', email: '', next: safeNext(f.next), error: t('demo.nosignup') }));
      if (f.step === 'request') {
        const email = (f.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
          return render(t('auth.title'), V.signin({ t, locale, step: 'email', email, next: safeNext(f.next), error: 'Enter a valid email address.' }));
        if (!A.rateLimit('code:' + email, 5, 36e5))
          return render(t('auth.title'), V.signin({ t, locale, step: 'email', email, next: safeNext(f.next), error: 'Too many codes requested. Wait an hour.' }));
        const code = await A.requestCode(email);
        console.log(`\n  ✉  sign-in code for ${email}: ${code}\n`);
        return render(t('auth.title'), V.signin({
          t, locale, step: 'code', email, devCode: PROD ? undefined : code, next: safeNext(f.next) }));
      }
      if (f.step === 'verify') {
        const email = (f.email || '').trim().toLowerCase();
        if (!await A.verifyCode(email, f.code || ''))
          return render(t('auth.title'), V.signin({
            t, locale, step: 'code', email, error: t('auth.badcode'), next: safeNext(f.next) }));
        const u = await A.findOrCreateUser(email, (f.name || '').trim());
        const tok = await A.createSession(u.id);
        A.setCookie(res, tok);
        return redirect(res, safeNext(f.next) || L(locale, '/community'),
          { 'Set-Cookie': res.getHeader('Set-Cookie') });
      }
    }
    if (req.method === 'POST' && rest[0] === 'signout') {
      await A.destroySession(cookies[A.COOKIE]);
      A.clearCookie(res);
      return redirect(res, L(locale, '/community'), { 'Set-Cookie': res.getHeader('Set-Cookie') });
    }

    /* ---- Post an item ---- */
    if (rest[0] === 'post') {
      if (!requireUser()) return;
      if (req.method === 'GET') return render(t('post.title'), V.post({ t, locale, wechatId: user.wechat_id }));
      const f = parseForm(await readBody(req));
      const err = (m) => render(t('post.title'), V.post({ t, locale, error: m, wechatId: user.wechat_id }));
      const title = (f.title || '').trim();
      if (!title) return err('A title is required.');
      if (title.length > 80) return err(`Title is ${title.length} characters — the maximum is 80.`);
      const cat = Q.ref().categories.find((c) => c.slug === f.category);
      if (!cat) return err('Choose a category.');
      if (!Q.ref().campuses.some((c) => c.code === f.campus)) return err('Choose a campus.');
      if (!A.rateLimit('post:' + user.id, 10, 864e5)) return err('You have hit the daily posting limit (10).');

      let images = [];
      try { images = JSON.parse(f.images || '[]'); } catch { images = []; }
      if (!Array.isArray(images) || images.length === 0) return err('Add at least one photo.');
      images = images.slice(0, 6);

      const free = f.free === '1';
      const priceN = num(f.price);
      const price_type = free ? 'free' : priceN == null ? 'negotiable' : 'fixed';
      if (price_type === 'fixed' && priceN < 0) return err('Price cannot be negative.');

      /* The handle is validated against WeChat's own shape, so the field
         cannot be used to publish a phone number or an email instead. It is
         saved on the account; the tick records that this listing offers it. */
      const wechatIn = (f.wechat || '').trim();
      /* A handle already saved on the account is not re-checked: it is the value
         the form pre-fills, and the sample accounts carry 21-character demo
         handles that the 20-character rule (WeChat's own limit) would reject
         on every post. Only what the person newly types has to pass. */
      if (wechatIn && wechatIn !== user.wechat_id && !Q.WECHAT_RE.test(wechatIn)) return err(t('post.f.wechat.bad'));
      if (wechatIn) await Q.setWechatId(user.id, wechatIn);
      const wechatOk = f.wechat_ok === '1' && !!(wechatIn || user.wechat_id);

      const id = await Q.createListing({
        user_id: user.id, category_id: cat.id, title,
        description: (f.description || '').slice(0, 2000),
        price_type, price_cents: price_type === 'fixed' ? Math.round(priceN * 100) : null,
        condition: ['new','like_new','good','fair','parts'].includes(f.condition) ? f.condition : 'good',
        campus: f.campus, meetup_note: (f.meetup || '').slice(0, 200) || null,
        wechat_ok: wechatOk,
      });
      for (const [i, dataUri] of images.entries()) {
        // Only ever accept an image data URI, and store the decoded payload.
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || '');
        if (m) await Q.addImage(id, m[1], m[2], i);
      }
      return redirect(res, L(locale, '/listing/' + id));
    }

    /* ---- Community (forum prototype) ---- */
    if (rest[0] === 'community') {
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const notFound = () => send(res, 404, page({ locale, t, user, title: '404', section: 'community',
        body: raw(`<h1 class="zl-h2">Not found</h1><p class="zl-muted"><a href="${L(locale, '/community')}">${esc(t('com.title'))}</a></p>`),
        unread, path: url.pathname }));

      /* GET /community  ·  GET /community/b/:slug */
      if (req.method === 'GET' && (rest.length === 1 || (rest[1] === 'b' && rest[2] && !rest[3]))) {
        const board = rest[1] === 'b' ? C.boardBySlug(rest[2]) : null;
        if (rest[1] === 'b' && !board) return notFound();
        const sort = C.SORTS.includes(params.sort) ? params.sort : 'hot';
        const query = (params.q || '').trim().slice(0, 100);
        const [{ rows, total }, stats, counts] = await Promise.all([
          C.feed({ board, sort, campus, query, userId: user?.id, limit: 30 }),
          C.communityStats(), C.boardCounts(),
        ]);
        const title = query || (board ? (locale === 'zh' ? board.name_zh : board.name_en) : t('com.title'));
        return render(title, CV.communityFeed({
          locale, t, board, rows, total, sort, query, stats, counts, user, path: url.pathname }));
      }

      /* POST /community/vote/(post|comment)/:id — JSON for app.js, redirect for plain forms */
      if (req.method === 'POST' && rest[1] === 'vote' && ['post', 'comment'].includes(rest[2]) && UUID.test(rest[3] || '')) {
        const wantsJson = (req.headers.accept || '').includes('application/json');
        const f = parseForm(await readBody(req));
        const back = safeNext(f.next) || L(locale, '/community');
        if (!user) return wantsJson ? json(res, 401, { error: 'signin' })
          : redirect(res, L(locale, '/signin') + '?next=' + encodeURIComponent(back));
        if (!A.rateLimit('vote:' + user.id, 300, 36e5))
          return wantsJson ? json(res, 429, { error: 'slow down' }) : fail(429, 'error.slow');
        const r = await (rest[2] === 'post' ? C.togglePostVote : C.toggleCommentVote)(rest[3], user.id);
        if (!r) return wantsJson ? json(res, 404, { error: 'not found' }) : notFound();
        return wantsJson ? json(res, 200, r) : redirect(res, back);
      }

      /* GET /community/post/:id */
      if (req.method === 'GET' && rest[1] === 'post' && UUID.test(rest[2] || '') && !rest[3]) {
        const p = await C.getPost(rest[2], user?.id);
        if (!p) return notFound();
        const [comments] = await Promise.all([C.commentsFor(p.id, user?.id)]);
        return render(p.title, CV.postPage({
          locale, t, p, comments, user, board: C.boardBySlug(p.board_slug),
          reported: params.reported === '1', path: url.pathname }));
      }

      /* POST /community/post/:id/comment */
      if (req.method === 'POST' && rest[1] === 'post' && UUID.test(rest[2] || '') && rest[3] === 'comment') {
        if (!requireUser()) return;
        const f = parseForm(await readBody(req));
        const back = L(locale, '/community/post/' + rest[2]);
        const body = (f.body || '').trim();
        if (!body) return redirect(res, back + '#comments');
        if (!A.rateLimit('comment:' + user.id, 60, 36e5)) return fail(429, 'error.slow');
        const p = await C.getPost(rest[2]);
        if (!p) return notFound();
        const id = await C.createComment({ postId: p.id, userId: user.id,
          parentId: UUID.test(f.parent || '') ? f.parent : null, body: body.slice(0, 4000) });
        return redirect(res, back + '#c-' + id);
      }

      /* POST /community/post/:id/report */
      if (req.method === 'POST' && rest[1] === 'post' && UUID.test(rest[2] || '') && rest[3] === 'report') {
        if (!requireUser()) return;
        const { reason } = parseForm(await readBody(req));
        const p = await C.getPost(rest[2]);
        if (!p) return notFound();
        if (!A.rateLimit('report:' + user.id, 20, 864e5)) return fail(429, 'error.slow');
        await Q.createReport(user.id, 'post', p.id, ['spam', 'offensive', 'other'].includes(reason) ? reason : 'other');
        return redirect(res, L(locale, '/community/post/' + p.id) + '?reported=1');
      }

      /* GET|POST /community/new */
      if (rest[1] === 'new' && !rest[2]) {
        if (!requireUser()) return;
        const myListings = await Q.userListings(user.id);
        /* Only an organiser has events to link; for everyone else this is
           an empty list and the select never renders. */
        const myEvents = canPost ? await E.organisedBy(user.id) : [];
        if (req.method === 'GET')
          return render(t('com.new'), CV.newPost({ locale, t, myListings, myEvents, from: params.from,
            values: { board: C.boardBySlug(params.board)?.slug || '', event: params.event || '' } }));
        const f = parseForm(await readBody(req));
        if (f.from === 'guide') sectionOverride = 'guide';
        const values = { board: f.board, kind: f.kind, title: (f.title || '').trim(), body: (f.body || '').trim(),
                         campus: f.campus || '', listing: f.listing || '', event: f.event || '' };
        const err = (m) => render(t('com.new'), CV.newPost({ locale, t, myListings, myEvents, values, error: m, from: f.from }));
        const board = C.boardBySlug(f.board);
        if (!board) return err('Choose a board.');
        if (!C.KINDS.includes(f.kind)) return err('Choose a post type.');
        if (!values.title) return err('A title is required.');
        if (values.title.length > 140) return err(`Title is ${values.title.length} characters — the maximum is 140.`);
        if (values.body.length > 10000) return err('The post is too long (10,000 characters maximum).');
        const campusCode = Q.ref().campuses.some((c) => c.code === f.campus) ? f.campus : null;
        // A linked listing must be one of the poster's own — checked in the query, not trusted from the form.
        const listingId = UUID.test(f.listing || '') && await Q.ownedListing(f.listing, user.id) ? f.listing : null;
        /* Same rule for the event: it has to be one this account organises,
           so a form post cannot attach somebody else's event to a thread. */
        const eventId = UUID.test(f.event || '') && myEvents.some((e) => e.id === f.event) ? f.event : null;
        if (!A.rateLimit('compost:' + user.id, 10, 864e5)) return err('You have hit the daily posting limit (10).');
        const id = await C.createPost({ board_id: board.id, user_id: user.id, kind: f.kind,
          title: values.title, body: values.body, campus: campusCode, listing_id: listingId, event_id: eventId });
        return redirect(res, L(locale, '/community/post/' + id));
      }
      return notFound();
    }

    /* ---- GET /suggest — type-ahead for the header search (JSON) ----
       Section-aware: it suggests what the search box would actually search. */
    if (req.method === 'GET' && rest[0] === 'suggest' && !rest[1]) {
      const term = (params.q || '').trim().slice(0, 60);
      const sec = ['market', 'community', 'guide', 'events'].includes(params.s) ? params.s : 'market';
      const groups = [];
      if (term) {
        if (sec === 'guide') {
          const items = GV.guideSuggest(term, locale);
          if (items.length) groups.push({ label: t('guide.title'), items });
        } else if (sec === 'events') {
          /* Upcoming only: suggesting an event that finished last week sends
             people to a page whose only action is disabled. */
          const [evs, cats] = [await E.suggestEvents(term), E.CATEGORIES
            .filter((c) => t('ev.cat.' + c).toLowerCase().includes(term.toLowerCase()))
            .slice(0, 3)];
          if (evs.length) groups.push({ label: t('ev.title'), items: evs.map((e) => ({
            label: e.title,
            scope: new Date(e.starts_at).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB',
              { day: 'numeric', month: 'short' }),
            href: L(locale, '/events/' + e.id) })) });
          if (cats.length) groups.push({ label: t('ev.f.cat'), items: cats.map((c) => ({
            label: t('ev.cat.' + c), href: L(locale, '/events') + '?category=' + c })) });
        } else if (sec === 'community') {
          const [posts, boards] = [await C.suggestPosts(term, campus), C.boards()
            .filter((b) => (locale === 'zh' ? b.name_zh : b.name_en).toLowerCase().includes(term.toLowerCase()))
            .slice(0, 3)];
          if (posts.length) groups.push({ label: t('suggest.posts'), items: posts.map((p) => ({
            label: p.title, scope: locale === 'zh' ? p.board_zh : p.board_en,
            href: L(locale, '/community/post/' + p.id) })) });
          if (boards.length) groups.push({ label: t('com.boards'), items: boards.map((b) => ({
            label: (locale === 'zh' ? b.name_zh : b.name_en), icon: b.icon,
            href: L(locale, '/community/b/' + b.slug) })) });
        } else {
          const [rows, cats] = [await Q.suggestListings(term, campus), Q.ref().categories
            .filter((c) => (locale === 'zh' ? c.name_zh : c.name_en).toLowerCase().includes(term.toLowerCase()))
            .slice(0, 3)];
          if (rows.length) groups.push({ label: t('suggest.listings'), items: rows.map((r) => ({
            label: r.title, scope: locale === 'zh' ? r.name_zh : r.name_en,
            href: L(locale, '/listing/' + r.id) })) });
          if (cats.length) groups.push({ label: t('filter.category'), items: cats.map((c) => ({
            label: (locale === 'zh' ? c.name_zh : c.name_en), icon: c.icon,
            href: L(locale, '/search') + '?category=' + encodeURIComponent(c.slug) })) });
        }
      }
      return send(res, 200, JSON.stringify({ groups }),
        { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    }

    /* ============ Events ============
       Free to join, posted by verified organisers. Joining is a POST and a
       redirect, not a fetch: it works with no JavaScript, and the page you
       land on is the one that proves it worked. */
    /* ---- GET /events — the list, filtered by date window and category ---- */
    if (req.method === 'GET' && rest[0] === 'events' && !rest[1]) {
      const sel = {
        when: E.WHEN.includes(params.when) ? params.when : 'upcoming',
        category: E.CATEGORIES.includes(params.category) ? params.category : null,
      };
      const [rows, counts] = await Promise.all([
        E.feed({ ...sel, campus, query: params.q || '', userId: user?.id }),
        E.categoryCounts({ campus, when: sel.when }),
      ]);
      return render(t('ev.title'), EV.eventList({ locale, t, rows, sel, counts, canPost }));
    }

    /* ---- GET /events/new — organisers only, everyone else gets the why ---- */
    if (req.method === 'GET' && rest[0] === 'events' && rest[1] === 'new' && !rest[2]) {
      if (!requireUser()) return;
      if (!canPost) return render(t('ev.new'), EV.eventGate({ locale, t }));
      return render(t('ev.new'), EV.newEvent({ locale, t, campuses: Q.ref().campuses }));
    }

    /* ---- POST /events/new ---- */
    if (req.method === 'POST' && rest[0] === 'events' && rest[1] === 'new' && !rest[2]) {
      if (!requireUser()) return;
      if (!canPost) return render(t('ev.new'), EV.eventGate({ locale, t }));
      const f = parseForm(await readBody(req));
      const again = (m) => render(t('ev.new'), EV.newEvent({
        locale, t, error: m, values: f, campuses: Q.ref().campuses }));
      if (!f.title?.trim()) return again('An event name is required.');
      if (f.title.trim().length > 140) return again('The name is too long (140 characters maximum).');
      if (!f.org?.trim()) return again('Say which group is organising this.');
      if (!E.CATEGORIES.includes(f.category)) return again('Choose a category.');
      const starts = new Date(f.starts);
      if (!f.starts || Number.isNaN(starts.getTime())) return again('A start date and time are required.');
      /* An event in the past can never be joined, so it is refused at the
         door rather than published as something nobody can act on. */
      if (starts < new Date()) return again('That start time is in the past.');
      const ends = f.ends ? new Date(f.ends) : null;
      if (ends && (Number.isNaN(ends.getTime()) || ends < starts)) return again('The end time must come after the start.');
      if (!A.rateLimit('event:' + user.id, 10, 864e5)) return fail(429, 'error.slow');
      const { id } = await E.createEvent({
        organizerId: user.id, orgName: f.org.trim(), category: f.category,
        title: f.title.trim(), body: f.body?.trim() || null,
        campus: f.campus || null, venue: f.venue?.trim() || null,
        startsAt: starts.toISOString(), endsAt: ends ? ends.toISOString() : null,
        capacity: num(f.capacity), teamSize: num(f.team),
      });
      return redirect(res, L(locale, '/events/' + id));
    }

    /* ---- POST /events/:id/join | /leave | /cancel ---- */
    if (req.method === 'POST' && rest[0] === 'events' && rest[1] && rest[2]) {
      if (!requireUser(L(locale, '/events/' + rest[1]))) return;
      const back = L(locale, '/events/' + rest[1]);
      if (rest[2] === 'join') {
        const f = parseForm(await readBody(req));
        const e = await E.getEvent(rest[1], user.id);
        if (!e) return fail(404, 'error.notfound');
        if (e.organizer_id === user.id) return redirect(res, back);
        /* A team event needs a squad; without one the signup would say
           nothing to the organiser trying to build a fixture list. */
        if (e.team_size && !f.team?.trim()) return redirect(res, back + '?err=team');
        const r = await E.join({ eventId: rest[1], userId: user.id,
          teamName: e.team_size ? f.team.trim() : null,
          teammates: e.team_size ? (f.mates?.trim() || null) : null });
        return redirect(res, r.ok ? back : back + '?err=' + r.reason);
      }
      if (rest[2] === 'leave') { await E.leave({ eventId: rest[1], userId: user.id }); return redirect(res, back); }
      if (rest[2] === 'cancel') { await E.cancelEvent(rest[1], user.id); return redirect(res, back); }
      /* POST /events/:id/report — same shape as a listing or a post report:
         signed in, not your own, rate limited, reason off a fixed list. */
      if (rest[2] === 'report') {
        const { reason } = parseForm(await readBody(req));
        const e = await E.getEvent(rest[1], user.id);
        if (!e) return fail(404, 'error.notfound');
        if (e.organizer_id === user.id) return redirect(res, back);
        if (!A.rateLimit('report:' + user.id, 20, 864e5)) return fail(429, 'error.slow');
        await Q.createReport(user.id, 'event', e.id,
          ['spam', 'offensive', 'other'].includes(reason) ? reason : 'other');
        return redirect(res, back + '?reported=1');
      }
    }

    /* ---- GET /events/:id ---- */
    if (req.method === 'GET' && rest[0] === 'events' && rest[1] && !rest[2]) {
      const e = await E.getEvent(rest[1], user?.id);
      if (!e) return send(res, 404, page({ locale, t, user, title: '404', section: 'events',
        body: raw('<h1 class="zl-h2">Not found</h1>'), unread, path: url.pathname }));
      /* Who is coming is for signed-in students only — the view renders a
         prompt instead of names, and the names never leave the server. */
      /* The roster (team names plus the student IDs the captain entered for
         their teammates) is only fetched when the organiser is the one
         asking — they are the person who has to check people in. */
      const isOrganiser = !!user && user.id === e.organizer_id;
      const [parts, organiser, organiserLangs] = await Promise.all([
        user ? E.participants(e.id, { withRoster: isOrganiser }) : [],
        Q.getUser(e.organizer_id),
        Q.userLanguages(e.organizer_id),
      ]);
      const ERR = { team: t('ev.team.name'), full: t('ev.full'), past: t('ev.past'),
                    cancelled: t('ev.cancelled'), gone: t('error.title') };
      return render(e.title, EV.eventPage({ locale, t, e, parts, user, organiser, organiserLangs,
        error: ERR[params.err] || null, reported: params.reported === '1' }));
    }

    /* ---- GET /guide — static guidebook summary + glossary ---- */
    if (req.method === 'GET' && rest[0] === 'guide' && !rest[1])
      return render(t('guide.title'), GV.guide({ locale, t, q: (params.q || '').slice(0, 80) }));

    if (req.method === 'GET' && rest[0] === 'rules')
      return render(t('nav.rules'), V.rules({ t, locale }));

    /* ---- Report a bug: GET /bug, POST /bug ----
       Open to anyone, signed in or not, demo visitors included: it is the one
       write a public demo should accept. That is why it carries more defences
       than a form behind a login would. */
    if (rest[0] === 'bug' && !rest[1]) {
      /* Only ever a path on this site, as with `next`, and short. */
      const fromPage = (v) => (typeof v === 'string' && /^\/[^/\\]/.test(v) ? v.slice(0, BUG_LIMITS.page) : '');
      if (req.method === 'GET')
        return render(t('bug.title'), V.reportBug({ t, locale, sent: params.sent === '1',
          v: { page: fromPage(params.from) } }));
      if (req.method === 'POST') {
        const f = parseForm(await readBody(req));
        /* Honeypot: a person cannot see this field, so a filled one is a bot.
           It is told it worked, so it has nothing to learn from. */
        if (f.website) return redirect(res, L(locale, '/bug') + '?sent=1');
        /* Per visitor, and overall. X-Forwarded-For is only trustworthy behind
           the host's proxy, so the overall cap is what actually bounds a
           determined flood; the per-visitor one stops ordinary repeats. */
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
        if (!A.rateLimit('bug:' + ip, 5, 36e5) || !A.rateLimit('bug:all', 100, 36e5)) return fail(429, 'error.slow');
        const v = {
          kind: BUG_KINDS.includes(f.kind) ? f.kind : 'other',
          summary: (f.summary || '').trim().slice(0, BUG_LIMITS.summary),
          details: (f.details || '').trim().slice(0, BUG_LIMITS.details),
          expected: (f.expected || '').trim().slice(0, BUG_LIMITS.expected),
          page: fromPage((f.page || '').trim()) || (f.page || '').trim().slice(0, BUG_LIMITS.page),
          email: (f.email || '').trim().slice(0, BUG_LIMITS.email),
        };
        const again = (msg) => render(t('bug.title'), V.reportBug({ t, locale, v, error: msg }));
        if (v.summary.length < 3) return again(t('bug.err.summary'));
        if (v.details.length < 10) return again(t('bug.err.details'));
        if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return again(t('bug.err.email'));
        const id = await saveBug({ ...v, locale, userAgent: req.headers['user-agent'],
          signedIn: !user ? 'no' : (DEMO && user.email === DEMO_EMAIL ? 'demo' : 'yes') });
        /* After the response: the visitor is not made to wait on Google, and a
           failure is already safe in the database for the hourly retry. */
        forwardBug(id).catch((e) => console.error('[bug-sheet]', e.message));
        return redirect(res, L(locale, '/bug') + '?sent=1');
      }
    }

    /* ---- GET /contact ---- */
    if (req.method === 'GET' && rest[0] === 'contact')
      return render(t('nav.contact'), V.contact({ t, locale }));

    return send(res, 404, page({ locale, t, user, title: '404',
      body: raw(`<h1 class="zl-h2">Not found</h1><p class="zl-muted"><a href="${L(locale, '/community')}">${esc(t('com.title'))}</a></p>`),
      unread, path: url.pathname }));
  } catch (e) {
    console.error('[error]', req.method, url.pathname, e.message);
    // Never surface the exception text: it can carry query fragments.
    const loc = LOCALES.includes(seg[0]) ? seg[0] : 'en';
    const t2 = translator(loc);
    return send(res, 500, page({
      locale: loc, t: t2, user: null, title: t2('error.title'), unread: 0, path: url.pathname,
      body: raw(`<div class="app-narrow"><h1 class="zl-h2">${esc(t2('error.title'))}</h1>`
        + `<p class="zl-muted">${esc(t2('error.body'))}</p>`
        + `<a class="zl-btn zl-btn--primary" href="/${loc}/community">${esc(t2('com.title'))}</a></div>`),
    }));
  }
});

/* Boot: migrate, run the expiry sweep, warm the reference cache, then listen.
   Nothing serves traffic before the database is ready. */
const boot = async () => {
  const created = await migrate();
  if (created) console.log('  ' + created);
  /* Demo only, and before anything reads the reference data: an empty
     database gets the sample data, and a stale one is moved back to "now". */
  if (DEMO) {
    if (await loadSnapshotIfEmpty()) console.log('  DEMO_MODE: loaded the sample data');
    const moved = await freshenIfStale();
    if (moved) console.log(`  DEMO_MODE: sample data was ${moved} days old, moved to today`);
  }
  const expired = await expireOverdue();
  // Hourly sweep: a server running for weeks would otherwise keep showing
  // listings whose 30 days ran out. unref() so it never holds the process open.
  setInterval(() => expireOverdue().catch((err) => console.error('[expiry]', err.message)), 36e5).unref();
  /* Reports that could not be delivered to the sheet are tried again. */
  setInterval(() => retryUnforwarded().catch((err) => console.error('[bug-retry]', err.message)), 36e5).unref();
  if (DEMO) {
    await ensureDemoUser();
    /* Demo sessions are minted on a button press, so expired ones are swept. */
    setInterval(() => pool.query('DELETE FROM session WHERE expires_at < now()')
      .catch((err) => console.error('[sessions]', err.message)), 36e5).unref();
    console.log('  DEMO_MODE: read-only, sign-up off, one shared demo account');
  }
  await Q.loadRef();
  await C.loadBoards();
  const { n, total } = await import('./db.mjs').then((m) =>
    m.one(`SELECT (COUNT(*) FILTER (WHERE status='active'))::int AS n,
                  COUNT(*)::int AS total FROM listing WHERE deleted_at IS NULL`));
  server.listen(PORT, () => {
    console.log(`\n  WeZJUers prototype  →  http://localhost:${PORT}`);
    console.log(`  PostgreSQL: ${DATABASE_URL}`);
    console.log(`  ${n} active listings${expired ? `, ${expired} auto-expired on boot` : ''}`);
    /* Zero used to be just another number in this list, which is how the
       marketplace came up empty on 2026-10-10 with nothing to show for it:
       seeded listings live 30 days, and the day they run out the feed is
       blank and the logs say "0 active listings" in passing. Say it loudly,
       and say what to type. */
    if (!n) console.warn(total
      ? `\n  !  The marketplace will render EMPTY: all ${total} listings are expired or sold.\n`
        + `     Seeded listings live 30 days from the seed run.\n`
        + `     Fix (keeps the photos):  npm run refresh:demo\n`
      : `\n  !  The marketplace will render EMPTY: there are no listings at all.\n`
        + `     Fix:  npm run seed && npm run seed:community\n`);
    if (!DEMO) {
      console.log(`  Sign in with any seeded email, e.g. demo@we-zjuers.com`);
      console.log(`  The 6-digit code is printed here${PROD ? '.' : ' and shown on screen.'}\n`);
    }
  });
};
boot().catch((e) => { console.error('\nBoot failed:', e.message); process.exit(1); });

/* Shutdown and last-resort guards.
   SIGINT is Ctrl-C at a terminal; SIGTERM is what every process supervisor
   actually sends (Docker, systemd, Kubernetes, PM2). Handling only SIGINT
   meant a deploy killed the process mid-request and left the pool undrained.
   Both now stop accepting connections, let in-flight requests finish, and
   close the pool — with a timer so a stuck socket cannot hang the shutdown. */
let closing = false;
const shutdown = async (signal) => {
  if (closing) return;
  closing = true;
  console.log(`\n  ${signal} — closing`);
  const force = setTimeout(() => process.exit(0), 10e3);
  force.unref();
  await new Promise((done) => server.close(done));
  await pool.end().catch(() => {});
  process.exit(0);
};
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { shutdown(sig); });

/* Node terminates the process on an unhandled rejection, so without this a
   stray promise anywhere outside the request try/catch takes the whole site
   down and the log says nothing useful about which one. Log it with the
   stack and keep serving: one broken promise is not a reason to drop every
   other student's request. */
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  // A genuinely broken state: log it and leave, so the supervisor restarts us.
  console.error('[uncaughtException]', err.stack || err.message);
  shutdown('uncaughtException');
});
