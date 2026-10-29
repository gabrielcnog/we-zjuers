import { h, raw, esc, html as unwrap, money, ago, qs } from '../lib/html.mjs';
import { ref } from '../lib/queries.mjs';
import { sized, srcset } from '../lib/unsplash.mjs';
import { DEMO, DEMO_EMAIL } from '../lib/demo.mjs';

export const other = (l) => (l === 'en' ? 'zh' : 'en');

export function campusLabel(code, locale, t) {
  if (!code) return t('campus.all');
  if (code === '__many') return t('campus.many');
  const c = ref().campuses.find((x) => x.code === code);
  return c ? (locale === 'zh' ? c.name_zh : c.name_en) : t('campus.all');
}

/* Inline SVG rather than text glyphs: ▤ was a table character standing in for a
   photo icon, and ♡ has no weight control — its thickness is whatever the font
   decides. Both are drawn here so they scale and take stroke-width. */
/* Icons are inline SVG in one stroke style (24px grid, 2px stroke, round caps)
   so they scale with the text around them. Unicode stand-ins (＋ ‹ › ✓ ↗ →)
   rendered differently on every font and platform — the full-width ＋ in the
   floating button is what gave it away. Size comes from the context (.zl-btn,
   .zl-icon-ring, .zl-ico) — the SVG itself carries none, so one icon fits all. */
/* width/height are ATTRIBUTES, not CSS: a presentational attribute loses to
   every stylesheet rule, so .zl-btn > svg and friends still decide the real
   size and "one icon fits all" still holds. What they buy is a floor. An SVG
   with a viewBox and no intrinsic size stretches to fill its container, so a
   context that forgets to size it does not render a slightly-wrong icon, it
   renders a 112px one — which is exactly what the organiser's Cancel button
   and the "You are going" tick were doing, both of them only reachable while
   signed in, which is why they sat there unseen. */
const svg = (d, extra = '') => raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${d}</svg>`);
export const ICONS = {
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  alert: svg('<path d="M12 8v5M12 16.5v.01"/><circle cx="12" cy="12" r="9"/>'),
  info: svg('<path d="M12 11v5.5M12 7.5v.01"/><circle cx="12" cy="12" r="9"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  mapPin: svg('<path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>'),
  details: svg('<path d="M5 6h14M5 11h14M5 16h9"/>'),
  chevronLeft: svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: svg('<path d="m9 18 6-6-6-6"/>'),
  arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  external: svg('<path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>'),
  message: svg('<path d="M20 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v4l5-4h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
};

export const ICON = {
  photos: raw(`<svg viewBox="0 0 20 20" width="13" height="13" fill="none" aria-hidden="true">
    <rect x="5.5" y="2.5" width="12" height="9.5" rx="1.6" stroke="currentColor" stroke-width="1.7"/>
    <path d="M14.5 15.5H4a1.5 1.5 0 0 1-1.5-1.5V5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <circle cx="9.2" cy="6" r="1.15" fill="currentColor"/>
    <path d="M6 11.4l3.1-3a1 1 0 0 1 1.4 0l3.4 3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`),
  /* Kleinanzeigen puts a calendar beside the posting date and an eye beside
     the view count; both read faster than the words did. Same 24-grid and
     stroke weight as the rest of the set. */
  /* WeChat's own mark: solid shapes, not the 2px stroke the rest of this set
     is drawn in, so it is written out rather than passed through svg(). It
     keeps currentColor so the button decides whether it is white or green. */
  wechat: raw(`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" aria-hidden="true" focusable="false"><path d="M21.502 19.525c1.524-1.105 2.498-2.738 2.498-4.554 0-3.326-3.237-6.023-7.229-6.023s-7.229 2.697-7.229 6.023c0 3.327 3.237 6.024 7.229 6.024.825 0 1.621-.117 2.36-.33l.212-.032c.139 0 .265.043.384.111l1.583.914.139.045c.133 0 .241-.108.241-.241l-.039-.176-.326-1.215-.025-.154c0-.162.08-.305.202-.392zm-12.827-17.228c-4.791 0-8.675 3.236-8.675 7.229 0 2.178 1.168 4.139 2.997 5.464.147.104.243.276.243.471l-.03.184-.391 1.458-.047.211c0 .16.13.29.289.29l.168-.054 1.899-1.097c.142-.082.293-.133.46-.133l.255.038c.886.255 1.842.397 2.832.397l.476-.012c-.188-.564-.291-1.158-.291-1.771 0-3.641 3.542-6.593 7.911-6.593l.471.012c-.653-3.453-4.24-6.094-8.567-6.094zm5.686 11.711c-.532 0-.963-.432-.963-.964 0-.533.431-.964.963-.964.533 0 .964.431.964.964 0 .532-.431.964-.964.964zm4.82 0c-.533 0-.964-.432-.964-.964 0-.533.431-.964.964-.964.532 0 .963.431.963.964 0 .532-.431.964-.963.964zm-13.398-5.639c-.639 0-1.156-.518-1.156-1.156 0-.639.517-1.157 1.156-1.157.639 0 1.157.518 1.157 1.157 0 .638-.518 1.156-1.157 1.156zm5.783 0c-.639 0-1.156-.518-1.156-1.156 0-.639.517-1.157 1.156-1.157.639 0 1.157.518 1.157 1.157 0 .638-.518 1.156-1.157 1.156z"/></svg>`),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  eye: svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>'),
  flag: raw(`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M6 21V4.5m0 0 5.2 1.8a4 4 0 0 0 2.9-.1l4-1.7v9l-4 1.7a4 4 0 0 1-2.9.1L6 13.5"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`),
  share: raw(`<svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M12 15.5V4.2m0 0L8.3 7.9M12 4.2l3.7 3.7" stroke="currentColor" stroke-width="1.9"
      stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.5 13v5.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V13"
      stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
  </svg>`),
  search: raw(`<svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
    <circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" stroke-width="2.1"/>
    <path d="m15.7 15.7 4.1 4.1" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
  </svg>`),
  pin: raw(`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
    <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"
      stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="12" cy="10.2" r="2.6" stroke="currentColor" stroke-width="1.8"/>
  </svg>`),
  chevron: raw(`<svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
    <path d="M4 6.2 8 10l4-3.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`),
  heart: raw(`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path d="M12 20.3s-7.2-4.4-7.2-9.4A4.1 4.1 0 0 1 12 8.1a4.1 4.1 0 0 1 7.2 2.8c0 5-7.2 9.4-7.2 9.4Z"
      fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
  </svg>`),
};
export const L = (locale, path = '') => `/${locale}${path}`;

/* ---------- Shared building blocks ----------
   Views compose these instead of hand-writing markup, so every page gets the
   same structure, spacing and icons. Each returns escaped h`` output. */

/* Page header: <header> with the page's single <h1>, an optional description
   and an optional meta line. Spacing comes from .zl-page-header, not margins. */
export function pageHeader({ title, description = null, meta = null, size = 'h2', actions = null, compact = false }) {
  return h`<header class="zl-page-header${compact ? ' is-compact-mobile' : ''}">
    <h1 class="zl-page-header__title zl-${size}">${title}</h1>
    ${description ? h`<p class="zl-page-header__description">${description}</p>` : raw('')}
    ${meta ? h`<p class="zl-page-header__meta">${meta}</p>` : raw('')}
    ${actions ? h`<div class="zl-page-header__actions">${actions}</div>` : raw('')}
  </header>`;
}

/* Alert (shadcn's Alert): icon, optional title, body. `role="alert"` only for
   errors the user must act on; everything else is a note. */
const ALERT_ICON = { info: 'info', warning: 'alert', danger: 'alert', success: 'check' };
export function alert({ tone = 'info', title = null, body = null, extra = null }) {
  return h`<div class="zl-alert zl-alert--${tone}" role="${tone === 'danger' && !title ? 'alert' : 'note'}">
    <span class="zl-icon-ring zl-icon-ring--${tone}" aria-hidden="true">${ICONS[ALERT_ICON[tone]]}</span>
    <div class="zl-alert__content">
      ${title ? h`<p class="zl-alert__title">${title}</p>` : raw('')}
      ${body ? h`<p class="zl-alert__body">${body}</p>` : raw('')}
      ${extra || raw('')}
    </div>
  </div>`;
}

/* Breadcrumbs: an ordered list, chevrons drawn by CSS-sized SVGs. The last
   item is the current page and is not a link. */
export function crumbs(items, label = 'Breadcrumb') {
  return h`<nav class="zl-crumbs" aria-label="${label}"><ol>
    ${items.map(([text, href], i) => h`<li>${i ? h`<span class="zl-crumbs__sep">${ICONS.chevronRight}</span>` : raw('')}${href
      ? h`<a href="${href}">${text}</a>` : h`<span aria-current="page">${text}</span>`}</li>`)}
  </ol></nav>`;
}

/* A link that leads somewhere else in the site, with a trailing arrow. */
export const arrowLink = (href, text, cls = '') =>
  h`<a class="zl-link-arrow ${cls}" href="${href}"><span>${text}</span>${ICONS.arrowRight}</a>`;

/* A link that leaves the site: new tab, no referrer, and says so to screen readers. */
export const extLink = (href, text, t, cls = '') =>
  h`<a class="zl-link-ext ${cls}" href="${href}" target="_blank" rel="noopener noreferrer"><span>${text}</span>${ICONS.external}<span class="zl-sr-only">${t('a11y.newtab')}</span></a>`;

export const verifiedBadge = (t) =>
  h`<span class="zl-badge zl-badge--verified">${ICONS.check}<span>${t('seller.verified')}</span></span>`;

/* Assets are cached for an hour, so their URLs carry a version that changes
   when the server restarts — a deploy (or a dev restart) can never leave a
   browser on last week's stylesheet. */
export const ASSET_V = process.env.ASSET_V || String(Date.now());

/* `lead` is the listing page's own size: the price there is the second thing
   read after the title and had been rendering smaller than the lede beneath
   it. Everywhere else — cards, rows, linked items — keeps the default. */
export function priceTag(l, t, { lead = false } = {}) {
  const big = lead ? ' zl-price--lead' : '';
  if (l.price_type === 'free')
    return h`<span class="zl-price zl-price--free${raw(big)}">${t('price.free')}</span>`;
  if (l.price_type === 'negotiable')
    return h`<span class="zl-price zl-price--negotiable${raw(big)}">${t('price.negotiable')}</span>`;
  return h`<span class="zl-price${raw(big)}">${money(l.price_cents)}</span>`;
}
export const campusName = (code, locale) => {
  const c = ref().campuses.find((x) => x.code === code);
  return c ? (locale === 'zh' ? c.name_zh : c.name_en) : code;
};
export const categoryName = (row, locale) => (locale === 'zh' ? row.name_zh : row.name_en);

/* Listing card. ONE hit area: the title link stretches over the whole card and
   the favourite button sits above it. Never wrap the card in an <a>. */
export function card(l, { locale, t, favorited = false, showStatus = false, position = 99 }) {
  const badge = l.status === 'sold' ? h`<span class="zl-badge zl-badge--sold">${t('listing.sold')}</span>`
    : l.status === 'expired' ? h`<span class="zl-badge zl-badge--neutral">${t('listing.expired')}</span>`
    : l.price_type === 'free' ? h`<span class="zl-badge zl-badge--success">${t('price.free')}</span>` : raw('');
  const ids = (l.image_srcs && l.image_srcs.length ? l.image_srcs : (l.cover_src ? [l.cover_src] : []));
  const many = ids.length > 1;
  return h`<article class="zl-card">
  <div class="zl-card__media">
    ${ids.length ? h`<div class="zl-card__slides ${many ? 'js-cardslides' : ''}">
      ${/* The first row's cover is the LCP candidate on the feed, so it loads
            eagerly; every other slide and every card below it stays lazy.
            docs/interface.md: "lazy-load below the fold, eager-load the first row". */
        ids.map((src, i) => h`<img src="${sized(src, 400, 300)}"
        ${srcset(src) ? raw(`srcset="${esc(srcset(src))}" sizes="(min-width:1024px) 23vw, (min-width:640px) 31vw, 47vw"`) : raw('')}
        alt="${l.title}${many ? ` — ${i + 1}/${ids.length}` : ''}"
        ${i === 0 && position < 4 ? raw('fetchpriority="high"') : raw('loading="lazy"')}
        decoding="async" width="400" height="300">`)}
    </div>` : raw('')}
    ${many ? h`
      <button class="zl-card__nav zl-card__nav--prev js-card-prev" type="button" aria-label="Previous photo">${ICONS.chevronLeft}</button>
      <button class="zl-card__nav zl-card__nav--next js-card-next" type="button" aria-label="Next photo">${ICONS.chevronRight}</button>
      <div class="zl-card__dots js-card-dots" aria-hidden="true">
        ${ids.map((_, i) => h`<span class="zl-card__dot ${i === 0 ? 'is-on' : ''}"></span>`)}
      </div>` : raw('')}
    ${badge ? h`<div class="zl-card__badges">${badge}</div>` : raw('')}
    ${many ? h`<span class="zl-card__count" aria-label="${ids.length} photos">${ICON.photos} ${ids.length}</span>` : raw('')}
  </div>
  ${showStatus ? raw('') : h`<button type="button" class="zl-card__fav js-fav" data-id="${l.id}" aria-pressed="${favorited ? 'true' : 'false'}"
      aria-label="${t('listing.save')}">${ICON.heart}</button>`}
  <div class="zl-card__body">
    <h3 class="zl-card__title">
      <a class="zl-card__link" href="${L(locale, '/listing/' + l.id)}">${l.title}</a>
    </h3>
    <div class="zl-card__meta">
      ${priceTag(l, t)}
      <span class="zl-badge zl-badge--campus">${campusName(l.campus, locale)}</span>
    </div>
  </div>
</article>`;
}

export const feed = (rows, ctx) =>
  h`<div class="zl-feed">${rows.map((r, i) =>
    card(r, { ...ctx, favorited: ctx.favSet?.has(r.id), position: i }))}</div>`;

/* Category + campus chips, and the applied-filters overview. */
export function filters({ locale, t, path, params, showCampus = false }) {
  const cats = ref().categories, camps = ref().campuses;
  const chip = (label, on, next) =>
    h`<a class="zl-chip" aria-pressed="${on ? 'true' : 'false'}" href="${path + qs(next)}">${label}</a>`;
  const base = { ...params }; delete base.offset;
  return h`
  <div class="zl-chipscroll js-chipscroll">
    <div class="zl-chiprow js-chiptrack" role="group" aria-label="${t('filter.category')}">
      ${chip(t('filter.cat.all'), !params.category, { ...base, category: '' })}
      ${cats.map((c) => chip((c.icon || '') + ' ' + categoryName(c, locale), params.category === c.slug,
          { ...base, category: c.slug }))}
    </div>
    <!-- Hidden until script measures actual overflow: on a wide screen every
         category already fits, and an arrow pointing at nothing is noise.
         Without JavaScript the row still scrolls and swipes as before. -->
    <button class="zl-chipscroll__nav zl-chipscroll__nav--prev js-chip-prev" type="button"
            aria-label="${esc(t('filter.back'))}" hidden>${ICON.chevron}</button>
    <button class="zl-chipscroll__nav zl-chipscroll__nav--next js-chip-next" type="button"
            aria-label="${esc(t('filter.more'))}" hidden>${ICON.chevron}</button>
  </div>
  ${showCampus ? h`<div class="zl-chiprow zl-chiprow--secondary" role="group" aria-label="${t('filter.campus')}">
    ${chip(t('filter.all'), !params.campus, { ...base, campus: '' })}
    ${camps.map((c) => chip(locale === 'zh' ? c.name_zh : c.name_en, params.campus === c.code,
        { ...base, campus: c.code }))}
  </div>` : raw('')}`;
}

/* The selection is held in plural names internally (campuses, categories,
   conditions) but the URL uses the singular repeated form the server parses
   (?campus=a&campus=b). Every link built from a selection goes through here —
   getting this wrong makes chips and "load more" silently drop filters. */
export const selQuery = (sel, over = {}) => ({
  f: '1',
  q: sel.q || '',
  sort: sel.sort || '',
  campus: over.campus ?? sel.campuses ?? [],
  category: over.category ?? sel.categories ?? [],
  condition: over.condition ?? sel.conditions ?? [],
  min: over.min ?? (sel.min ?? ''),
  max: over.max ?? (sel.max ?? ''),
  offset: over.offset ?? '',
});

export function appliedFilters({ locale, t, path, sel }) {
  const bits = [];
  const without = (urlKey, stateKey, value) =>
    path + qs(selQuery(sel, { [urlKey]: (sel[stateKey] || []).filter((v) => v !== value) }));
  for (const slug of sel.categories || []) {
    const c = ref().categories.find((x) => x.slug === slug);
    if (c) bits.push([categoryName(c, locale), without('category', 'categories', slug)]);
  }
  for (const code of sel.campuses || []) bits.push([campusName(code, locale), without('campus', 'campuses', code)]);
  for (const c of sel.conditions || []) bits.push([t('cond.' + c), without('condition', 'conditions', c)]);
  if (sel.min != null) bits.push([`≥ ¥${sel.min}`, path + qs(selQuery(sel, { min: '' }))]);
  if (sel.max != null) bits.push([`≤ ¥${sel.max}`, path + qs(selQuery(sel, { max: '' }))]);
  if (!bits.length) return raw('');
  return h`<div class="zl-applied">
    <span class="zl-applied__label">${t('filter.applied')}</span>
    ${bits.map(([label, href]) => h`<a class="zl-chip zl-chip--applied" href="${href}">${label}<span class="x" aria-hidden="true">×</span></a>`)}
    <a class="zl-applied__clear" href="${path + qs({ q: sel.q })}">${t('filter.clear')}</a>
  </div>`;
}

export function sortBar({ t, path, params, total, sel }) {
  const opt = (v, label) =>
    h`<option value="${v}"${params.sort === v || (!params.sort && v === 'varied') ? raw(' selected') : raw('')}>${label}</option>`;
  /* Carry the current selection through the sort form as hidden fields, in the
     URL's own parameter names. */
  const carried = sel
    ? Object.entries(selQuery(sel)).flatMap(([k, v]) =>
        k === 'sort' || k === 'offset' ? [] : (Array.isArray(v) ? v.map((x) => [k, x]) : (v ? [[k, v]] : [])))
    : Object.entries(params).filter(([k, v]) => v && k !== 'sort' && k !== 'offset');
  return h`<div class="zl-resultbar">
    <span class="zl-resultbar__count">${raw(t('results.count', total))}</span>
    <form class="zl-sort" method="get" action="${path}">
      ${carried.map(([k, v]) => h`<input type="hidden" name="${k}" value="${v}">`)}
      <label class="zl-caption" for="sort">${t('sort.label')}</label>
      <select class="zl-select zl-select--pill js-autosubmit" id="sort" name="sort">
        ${opt('varied', t('sort.varied'))}${opt('new', t('sort.new'))}
        ${opt('low', t('sort.low'))}${opt('high', t('sort.high'))}
      </select>
    </form>
  </div>`;
}

/* ---------- Page shell ---------- */
export function page({ locale, t, user, title, body, unread = 0, path = '/', search = '', campus = null, searchValue = '', section = 'market', fab = null }) {
  const o = other(locale);
  /* One header, four sections. Search, its rolling hint and the primary
     action follow the section you are in; the campus scope is shared by all.
     This was a pair of booleans while there were three sections and a
     three-way ternary was still readable; Events made it four and the table
     is the honest shape — one row per section, nothing to re-derive. */
  const SECTIONS = {
    community: { tab: 'section.community', href: '/community', search: '/community',
                 label: 'com.search', terms: 'com.search.terms',
                 cta: { href: '/community/new', label: 'com.new' } },
    market:    { tab: 'section.market', href: '/market', search: '/search',
                 label: 'nav.search', terms: 'search.terms',
                 cta: { href: '/post', label: 'nav.post' } },
    events:    { tab: 'section.events', href: '/events', search: '/events',
                 label: 'ev.search', terms: 'ev.search.terms',
                 cta: { href: '/events/new', label: 'ev.new', organiserOnly: true } },
    guide:     { tab: 'section.guide', href: '/guide', search: '/guide',
                 label: 'guide.search', terms: 'guide.search.terms',
                 cta: { href: '/community/new?board=paperwork&from=guide', label: 'guide.ask' } },
  };
  const here = SECTIONS[section] ? section : 'market';
  const sec = SECTIONS[here];
  const searchAction = L(locale, sec.search);
  const searchLabel = t(sec.label);
  const terms = t(sec.terms);
  /* Events is the one section whose action most people cannot take —
     posting is for verified organisers (docs/events.md). Rather than offer a
     button that leads to a refusal, the section simply has no action for
     anyone else, and the header and the thumb button both go quiet. */
  const mayAct = !sec.cta.organiserOnly
    || (user && (user.role === 'organizer' || user.role === 'admin'));
  /* Demo: every creation button would lead to a refusal, so there are none. */
  const cta = mayAct && !DEMO ? { href: L(locale, sec.cta.href), label: t(sec.cta.label) } : null;
  const switchPath = '/' + o + (path.replace(/^\/(en|zh)/, '') || '/');
  /* The logo is the white wordmark PNG, which already carries the BETA pill.
     It is an image now, not real text: a rename means new PNGs (decisions #3).
     The alt text is the brand name from the i18n dictionary (t('brand')), so a
     screen reader still hears the name and the name still has one home. */
  const wordmark = esc(t('brand'));
  /* The floating button is the section's action by default, but a page can
     claim it: on a listing, "Add listing" is not what the thumb is there for.
     A page that posts (messaging a seller) hands us an action instead of an
     href and gets a form around the same button. */
  const f = fab || cta;
  const fabInner = f ? `${unwrap(f.icon || ICONS.plus)}<span>${esc(f.label)}</span>` : '';
  const fabEl = !f ? ''
    : f.action
      ? `<form class="app-fab-form" method="post" action="${esc(f.action)}"><button class="zl-btn zl-btn--primary zl-btn--lg zl-btn--pill app-fab" type="submit">${fabInner}</button></form>`
      : `<a class="zl-btn zl-btn--primary zl-btn--lg zl-btn--pill app-fab" href="${f.href}">${fabInner}</a>`;
  return `<!DOCTYPE html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(t('brand'))}</title>
<link rel="preconnect" href="https://images.unsplash.com" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=${ASSET_V}">
<!-- SVG first for the browsers that take it; the 32px PNG is the fallback for the
     ones that do not (Safari), and the 180px one is what iOS puts on a home screen.
     That one is square on purpose: iOS rounds the corners itself. -->
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg?v=${ASSET_V}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png?v=${ASSET_V}">
<link rel="apple-touch-icon" href="/assets/icon-180.png?v=${ASSET_V}">
<noscript><style>.app-burger{display:none !important} .app-nav--user{display:flex !important}</style></noscript>
</head>
<body class="zl-ui">
<a class="zl-sr-only" href="#main">${esc(t('a11y.skip'))}</a>
<div class="zl-disclaimer"><b class="zl-disclaimer__a">${esc(t('disclaimer.a'))}</b><span class="zl-disclaimer__sep" aria-hidden="true"> · </span><span class="zl-disclaimer__b">${esc(t('disclaimer.b'))}</span></div>
<header class="zl-header">
  <div class="zl-header__inner">
    <a class="zl-wordmark" href="${L(locale, '/community')}"><img class="zl-wordmark__img" src="/assets/logo-white.png?v=${ASSET_V}" alt="${wordmark}" width="2338" height="465"></a>
    <form class="zl-campus" method="get" action="${L(locale, '/campus')}">
      <input type="hidden" name="next" value="${esc(path + (search || ''))}">
      <span class="zl-campus__pin">${unwrap(ICON.pin)}</span>
      <!-- The visible two-line label is decorative: the <select> sitting on top
           of it carries the accessible name, so a screen reader hears the field
           once rather than twice. -->
      <span class="zl-campus__text" aria-hidden="true">
        <span class="zl-campus__eyebrow">${esc(t('campus.searching'))}</span>
        <span class="zl-campus__value"><span class="zl-campus__label">${esc(campusLabel(campus, locale, t))}</span>${unwrap(ICON.chevron)}</span>
      </span>
      <label class="zl-sr-only" for="campusPick">${esc(t('campus.searching'))}</label>
      <select class="zl-campus__native js-autosubmit" id="campusPick" name="to">
        <option value="all"${campus ? '' : ' selected'}>${esc(t('campus.all'))}</option>
        ${campus === '__many' ? `<option value="__many" selected disabled>${esc(t('campus.many'))}</option>` : ''}
        ${ref().campuses.map((c) => `<option value="${c.code}"${campus === c.code ? ' selected' : ''}>${esc(locale === 'zh' ? c.name_zh : c.name_en)}</option>`).join('')}
      </select>
      <noscript><button class="zl-btn zl-btn--secondary zl-btn--sm" type="submit">OK</button></noscript>
    </form>
    <form class="zl-search" method="get" action="${searchAction}">
      <label class="zl-sr-only" for="q">${esc(searchLabel)}</label>
      <!-- placeholder is a single space on purpose: it keeps :placeholder-shown
           working, which is what hides the animated hint once you type. -->
      <!-- Type-ahead: the listbox is filled by app.js, and the "search for
           everything" row is built from this template so the wording stays in
           the dictionary. Without JavaScript this is a plain search box. -->
      <input class="zl-input js-searchinput" id="q" name="q" type="search" placeholder=" " autocomplete="off"
             role="combobox" aria-expanded="false" aria-controls="suggest" aria-autocomplete="list"
             data-section="${section}" data-suggest="${L(locale, '/suggest')}"
             data-all="${esc(t('suggest.all', '%s'))}"
             value="${esc(searchValue || '')}">
      <div class="zl-suggest js-suggest" id="suggest" role="listbox" aria-label="${esc(t('suggest.label'))}" hidden></div>
      <span class="zl-typer" aria-hidden="true">
        <span class="zl-typer__prefix">${esc(t('search.prefix'))}</span>
        <span class="zl-typer__window"><span class="zl-typer__roll">
          ${[...terms, terms[0]].map((w) => `<span>${esc(w)}</span>`).join('')}
        </span></span>
      </span>
      <!-- A real submit button, not a decorative glyph: the search now happens
           on click as well as on Enter. Last in the form so it stacks above the
           animated hint. -->
      <button class="zl-search__btn" type="submit" aria-label="${esc(searchLabel)}">${unwrap(ICON.search)}</button>
    </form>
    ${user ? `<button type="button" class="app-burger js-menu-open" aria-haspopup="dialog" aria-controls="appMenu" aria-expanded="false" aria-label="${esc(unread ? t('nav.menu.unread', unread) : t('nav.menu'))}">${unwrap(ICONS.menu)}${unread ? `<span class="app-dot" aria-hidden="true">${unread}</span>` : ''}</button>` : ''}
    <nav class="app-nav${user ? ' app-nav--user' : ''}">
      ${user ? `<a class="app-nav__link" href="${L(locale, '/messages')}">${esc(t('nav.messages'))}${unread ? `<span class="app-dot">${unread}</span>` : ''}</a>` : ''}
      ${user ? `<a class="app-nav__link" href="${L(locale, '/my')}">${esc(t('nav.my'))}</a>` : ''}
      ${user ? `<a class="app-nav__link" href="${L(locale, '/saved')}">${esc(t('nav.saved'))}</a>` : ''}
      <a class="app-nav__link" href="${switchPath}">${esc(t('lang'))}</a>
      ${user
        ? `<form class="app-nav__form" method="post" action="${L(locale, '/signout')}"><button class="app-nav__link app-nav__btn" type="submit">${esc(t('nav.signout'))}</button></form>`
        : `<a class="zl-btn zl-btn--secondary zl-btn--sm" href="${esc(/\/signin$/.test(path) ? L(locale, '/signin') + search
            : L(locale, '/signin') + '?next=' + encodeURIComponent(path + search))}">${esc(t('nav.signin'))}</a>`}
      <!-- The supply side of a marketplace. Shown signed-out too: a visitor who
           cannot see how to list is a visitor who never lists. -->
      ${cta ? `<a class="zl-btn zl-btn--cta zl-btn--sm app-nav__cta" href="${cta.href}">${unwrap(ICONS.plus)}<span>${esc(cta.label)}</span></a>` : ''}
    </nav>
  </div>
</header>
${user ? `<dialog class="app-menu js-menu" id="appMenu" aria-labelledby="appMenuTitle">
  <div class="app-menu__panel">
    <div class="app-menu__head">
      <h2 class="app-menu__title" id="appMenuTitle">${esc(t('nav.menu'))}</h2>
      <button type="button" class="app-menu__close js-menu-close" aria-label="${esc(t('nav.menu.close'))}">${unwrap(ICONS.x)}</button>
    </div>
    <ul class="app-menu__list">
      ${[['/messages', t('nav.messages'), unread], ['/my', t('nav.my'), 0], ['/saved', t('nav.saved'), 0]].map(([href, label, n]) =>
        `<li><a class="app-menu__item" href="${L(locale, href)}"${path === L(locale, href) ? ' aria-current="page"' : ''}><span>${esc(label)}</span>${n ? `<span class="app-dot" aria-hidden="true">${n}</span><span class="zl-sr-only">${esc(t('nav.unread', n))}</span>` : ''}</a></li>`).join('')}
      <li><a class="app-menu__item" href="${switchPath}" lang="${locale === 'en' ? 'zh' : 'en'}"><span>${esc(t('lang'))}</span></a></li>
    </ul>
    <form class="app-menu__signout" method="post" action="${L(locale, '/signout')}"><button class="app-menu__item app-menu__item--quiet" type="submit"><span>${esc(t('nav.signout'))}</span></button></form>
  </div>
</dialog>` : ''}
<!-- Outside <header> on purpose: a sticky element can only stick inside its
     own parent, and on a phone the header itself scrolls away. As a sibling
     the section bar can stay pinned on its own. -->
<nav class="app-sections" aria-label="${esc(t('section.nav'))}">
    <div class="app-sections__inner">
      ${Object.entries(SECTIONS).map(([key, s2]) => {
        /* aria-current="page" means "this link IS the page you are on". On a
           listing, a profile or an event it is not: the tab still points at the
           section index, so a screen reader announced "Marketplace, current
           page" on a link that navigates away. "true" is the value for "the
           section you are in"; "page" is kept for the exact match. */
        const target = L(locale, s2.href);
        const cur = key === here ? (target === path ? 'page' : 'true') : null;
        return `<a class="app-sections__tab" href="${target}"${cur ? ` aria-current="${cur}"` : ''}>${esc(t(s2.tab))}</a>`;
      }).join('\n      ')}
  </div>
</nav>
${DEMO && user && user.email === DEMO_EMAIL
  ? `<div class="app-demobar" role="note"><div class="zl-container">${esc(t('demo.banner'))}</div></div>` : ''}
<main id="main" class="zl-container app-main">
${unwrap(body)}
</main>
<!-- Same button component as everywhere else; only its position is special. -->
${fabEl}
<footer class="app-footer">
  <div class="zl-container app-footer__inner">
    <p class="zl-caption app-footer__note">
      <span>${esc(t('disclaimer.a'))}</span>
      <span class="app-footer__heart" aria-hidden="true">❤️</span>
      <span>${esc(t('disclaimer.b'))}</span>
    </p>
    <nav class="app-footer__menu" aria-label="${esc(t('footer.nav'))}">
      <a class="zl-caption" href="${L(locale, '/rules')}">${esc(t('nav.rules'))}</a>
      <a class="zl-caption" href="${L(locale, '/contact')}">${esc(t('nav.contact'))}</a>
      ${/* Footer only, as asked. It passes the page you were on so the form can
           say where the problem was without asking you to type a URL. */ ''}
      <a class="zl-caption" href="${L(locale, '/bug')}?from=${encodeURIComponent((path + search).slice(0, 200))}">${esc(t('nav.bug'))}</a>
    </nav>
  </div>
</footer>
<div class="app-toast" role="status" aria-live="polite" hidden data-fail="${esc(t('fav.fail'))}"></div>
<script src="/assets/app.js?v=${ASSET_V}"></script>
</body>
</html>`;
}
