import { h, raw, esc, html as unwrap, money, ago, qs } from '../lib/html.mjs';
import { ref } from '../lib/queries.mjs';
import { personName, personInitials } from '../lib/names.mjs';
import { eventCard } from './events.mjs';
import { DEMO } from '../lib/demo.mjs';
import { sized, srcset, utm, unsplashHome } from '../lib/unsplash.mjs';
import { L, ICON, ICONS, feed, card, filters, appliedFilters, sortBar, selQuery, priceTag, campusName, categoryName,
  pageHeader, alert, crumbs, arrowLink, verifiedBadge } from './layout.mjs';

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'parts'];

/* Carousel. The track scroll-snaps, so swipe works with no JS; arrows,
   thumbnails and the counter are enhancement. Alt text falls back to the
   listing title because listing photos are user content — see
   docs/ux-guidelines.md 6. */
function gallery(images, title, t) {
  if (!images.length) return h`<div class="zl-gallery zl-gallery--single"><div class="zl-gallery__frame">
    <div class="zl-gallery__slide zl-gallery__slide--empty"></div></div></div>`;
  const single = images.length === 1;
  return h`<div class="zl-gallery ${single ? 'zl-gallery--single' : ''} js-gallery">
    <div class="zl-gallery__frame">
      <div class="zl-gallery__track js-gallery-track">
        ${images.map((im, i) => h`<div class="zl-gallery__slide">
          <img src="${sized(im.src, 600, 450)}"
               ${srcset(im.src) ? raw(`srcset="${esc(srcset(im.src))}" sizes="(min-width:900px) 46vw, 94vw"`) : raw('')}
               alt="${title}${images.length > 1 ? ` — ${i + 1}/${images.length}` : ''}"
               width="400" height="300" decoding="async" ${i === 0 ? raw('fetchpriority="high"') : raw('loading="lazy"')}>
        </div>`)}
      </div>
      ${single ? raw('') : h`
        <button class="zl-gallery__nav zl-gallery__nav--prev js-gallery-prev" type="button" aria-label="Previous photo">${ICONS.chevronLeft}</button>
        <button class="zl-gallery__nav zl-gallery__nav--next js-gallery-next" type="button" aria-label="Next photo">${ICONS.chevronRight}</button>
        <span class="zl-gallery__count js-gallery-count">1 / ${images.length}</span>`}
    </div>
    ${/* Unsplash attribution: photographer and Unsplash, both linked with
          utm referral params. One line per photo; the gallery script shows
          the one for the current slide. */
      images.map((im, i) => im.credit && im.credit_url ? h`<p class="zl-gallery__credit js-gallery-credit" ${i ? raw('hidden') : raw('')}>
        ${t('photo.by')} <a href="${utm(im.credit_url)}" rel="noopener noreferrer" target="_blank">${im.credit}</a>
        ${t('photo.on')} <a href="${unsplashHome()}" rel="noopener noreferrer" target="_blank">Unsplash</a></p>`
        : h`<p class="zl-gallery__credit js-gallery-credit" hidden></p>`)}
    ${single ? raw('') : h`<div class="zl-gallery__thumbs">
      ${images.map((im, i) => h`<button class="zl-gallery__thumb js-gallery-thumb" type="button"
          data-i="${i}" aria-current="${i === 0 ? 'true' : 'false'}" aria-label="Photo ${i + 1}">
        <img src="${sized(im.src, 72, 54)}" alt="" width="72" height="54" loading="lazy"></button>`)}
    </div>`}
  </div>`;
}

/* ---------- Home ---------- */
/* The category rail: one row per category with its count, the same component
   the Community and Events sections use. Marked js-swapnav so clicking a
   category swaps the feed in place rather than reloading the page — the chips
   already did that, and a rail that reloaded while the chips did not would be
   a worse version of the same control. */
function categoryRail({ locale, t, path, params, counts }) {
  const base = { ...params }; delete base.offset;
  const item = (label, icon, on, next, n) => h`
    <a class="app-railnav__item" href="${path + qs(next)}"${on ? raw(' aria-current="page"') : raw('')}>
      ${icon ? h`<span class="app-railnav__icon" aria-hidden="true">${icon}</span>` : raw('')}
      <span>${label}</span>
      ${n != null ? h`<span class="app-railnav__n">${n}</span>` : raw('')}
    </a>`;
  return h`<nav class="app-railnav js-swapnav" aria-label="${t('filter.category')}">
    <div class="app-railnav__label zl-label">${t('filter.category')}</div>
    ${item(t('filter.cat.all'), ICONS.grid, !params.category, { ...base, category: '' })}
    ${ref().categories.map((c) => item(categoryName(c, locale), c.icon || '•',
        params.category === c.slug, { ...base, category: c.slug }, counts[c.slug] || 0))}
  </nav>`;
}

export function home({ locale, t, rows, total, params, favSet, catCounts = {} }) {
  const path = L(locale, '/market');
  return h`<div class="app-mk">
    ${/* Rail on a wide screen, chips on a narrow one — the same trade Events
         and the Community make. Both render the same links, so a filtered URL
         is shareable either way and neither depends on JavaScript. */ raw('')}
    <aside class="app-mk__aside">${categoryRail({ locale, t, path, params, counts: catCounts })}</aside>
    <div class="app-mk__main">
      ${pageHeader({ title: t('home.title'), description: t('home.lede'), size: 'h1', compact: true })}
      <div class="app-mk__chips">${filters({ locale, t, path, params })}</div>
      ${/* No applied-filter row here: the rail and the chip row both show the
           active category, and campus lives in the header. The row belongs on
           search, where facets are multi-select and not otherwise visible. */ raw('')}
      ${/* Everything a category choice changes lives in this region, so the
           rail and the chips can swap just this part. */ raw('')}
      <div class="app-feed-region js-feed-region" aria-live="polite">
        <h2 class="zl-sr-only">${t('feed.heading')}</h2>
        ${sortBar({ t, path, params, total })}
        ${rows.length ? feed(rows, { locale, t, favSet }) : emptyState(t, locale)}
        ${total > rows.length ? h`<div class="zl-loadmore">
            <a class="zl-btn zl-btn--tertiary" href="${path + qs({ ...params, offset: rows.length })}">${t('loadmore')}</a>
            <span class="zl-loadmore__progress">${t('showing', rows.length, total)}</span>
          </div>` : raw('')}
      </div>
    </div>
  </div>`;
}

const emptyState = (t, locale) => h`<div class="zl-empty">
  <div class="zl-icon-ring zl-icon-ring--lg" aria-hidden="true">◇</div>
  <div class="zl-empty__title">${t('empty.title')}</div>
  <p class="zl-empty__body">${t('empty.body')}</p>
  ${DEMO ? raw('') : h`<a class="zl-btn zl-btn--primary" href="${L(locale, '/post')}">${ICONS.plus}<span>${t('nav.post')}</span></a>`}
</div>`;

/* ---------- Search ---------- */
export function search({ locale, t, rows, total, sel, favSet, relaxed, bounds, counts }) {
  const path = L(locale, '/search');
  return h`
  ${pageHeader({ title: sel.q ? h`${t('results.for')} “${sel.q}”` : t('nav.search') })}
  <div class="app-search">
    <aside class="app-search__rail">
      <details class="zl-rail-wrap js-rail" open>
        <summary class="zl-rail-wrap__toggle">
          ${t('filter.title')}${activeFilterCount(sel) ? h` <span class="zl-rail-wrap__n">${activeFilterCount(sel)}</span>` : raw('')}
        </summary>
        ${rail({ locale, t, path, sel, bounds, counts })}
      </details>
    </aside>
    <div>
      ${appliedFilters({ locale, t, path, sel })}
      ${total ? h`${sortBar({ t, path, params: sel, total, sel })}${feed(rows, { locale, t, favSet })}` : noResults({ locale, t, params: sel, relaxed })}
      ${total > rows.length ? h`<div class="zl-loadmore">
          <a class="zl-btn zl-btn--tertiary" href="${path + qs(selQuery(sel, { offset: rows.length }))}">${t('loadmore')}</a>
          <span class="zl-loadmore__progress">${t('showing', rows.length, total)}</span>
        </div>` : raw('')}
    </div>
  </div>`;
}

export const activeFilterCount = (s) =>
  (s.categories?.length || 0) + (s.campuses?.length || 0) +
  (s.conditions?.length || 0) + (s.min != null ? 1 : 0) + (s.max != null ? 1 : 0);

/* One GET form for the whole rail, so every facet submits together and the URL
   carries repeated params (?campus=a&campus=b). Order is deliberate: price
   first, condition second, then campus and category as checkbox lists. */
function rail({ locale, t, path, sel, bounds, counts }) {
  const { categories, campuses } = ref();
  const lo = sel.min ?? bounds.min, hi = sel.max ?? bounds.max;

  const box = (name, value, label, count, checked) => h`
    <li><label class="zl-checklist__row ${count === 0 && !checked ? 'is-empty' : ''}">
      <input type="checkbox" name="${name}" value="${value}"${checked ? raw(' checked') : raw('')}>
      <span class="lbl">${label}</span>
      <span class="n">${count ?? 0}</span>
    </label></li>`;

  const condLabel = sel.conditions.length
    ? t('filter.selected', sel.conditions.length)
    : t('filter.condition.any');

  return h`<form class="zl-rail js-filterform" method="get" action="${path}">
    <!-- Marks this search as rail-driven, so an empty campus selection is
         honoured as "all" rather than falling back to the header scope. -->
    <input type="hidden" name="f" value="1">
    ${sel.q ? h`<input type="hidden" name="q" value="${sel.q}">` : raw('')}
    ${sel.sort ? h`<input type="hidden" name="sort" value="${sel.sort}">` : raw('')}

    <div class="zl-rail__group">
      <h3>${t('filter.price.range')}</h3>
      <div class="zl-slider js-slider" data-min="${bounds.min}" data-max="${bounds.max}">
        <div class="zl-slider__track"><div class="zl-slider__fill"></div></div>
        <input class="zl-slider__input js-slider-lo" type="range" aria-label="${esc(t('filter.min'))}"
               min="${bounds.min}" max="${bounds.max}" step="10" value="${lo}">
        <input class="zl-slider__input js-slider-hi" type="range" aria-label="${esc(t('filter.max'))}"
               min="${bounds.min}" max="${bounds.max}" step="10" value="${hi}">
      </div>
      <div class="zl-range-values">
        <label class="zl-sr-only" for="fmin">${t('filter.min')}</label>
        <input class="zl-input js-min" id="fmin" name="min" inputmode="numeric"
               value="${sel.min ?? ''}" placeholder="${bounds.min}">
        <span class="zl-range-values__sep">—</span>
        <label class="zl-sr-only" for="fmax">${t('filter.max')}</label>
        <input class="zl-input js-max" id="fmax" name="max" inputmode="numeric"
               value="${sel.max ?? ''}" placeholder="${bounds.max}">
      </div>
    </div>

    <div class="zl-rail__group">
      <h3>${t('filter.condition')}</h3>
      <details class="zl-dropdown">
        <summary class="zl-dropdown__toggle">${condLabel}</summary>
        <div class="zl-dropdown__menu">
          <ul class="zl-checklist">
            ${CONDITIONS.map((c) => box('condition', c, t('cond.' + c),
                counts.condition[c], sel.conditions.includes(c)))}
          </ul>
        </div>
      </details>
    </div>

    <div class="zl-rail__group">
      <h3>${t('filter.campus')}</h3>
      <ul class="zl-checklist">
        ${campuses.map((c) => box('campus', c.code, locale === 'zh' ? c.name_zh : c.name_en,
            counts.campus[c.code], sel.campuses.includes(c.code)))}
      </ul>
    </div>

    <div class="zl-rail__group">
      <h3>${t('filter.category')}</h3>
      <ul class="zl-checklist">
        ${categories.map((c) => box('category', c.slug,
            (c.icon || '') + ' ' + categoryName(c, locale),
            counts.category[c.slug], sel.categories.includes(c.slug)))}
      </ul>
    </div>

    <button class="zl-btn zl-btn--primary js-filter-submit" type="submit">${t('filter.apply')}</button>
    ${activeFilterCount(sel) ? h`<a class="zl-applied__clear" href="${path + qs({ q: sel.q })}">${t('filter.clear')}</a>` : raw('')}
  </form>`;
}

/* The zero-result page. On a board this size it is the common path, so it names
   the query, says which filter it relaxed, offers one-tap widening and always
   leaves something browsable underneath. See docs/ux-guidelines.md 3.2 */
function noResults({ locale, t, params, relaxed }) {
  const sp = L(locale, '/search');
  const hasCampus = (params.campuses || []).length > 0;
  const hasPrice = params.min != null || params.max != null;
  return h`<div class="zl-noresults">
    <span class="zl-icon-ring zl-icon-ring--lg" aria-hidden="true">${ICON.search}</span>
    <p class="zl-noresults__title">${t('nores.title')}${params.q ? h` <span class="zl-noresults__query">“${params.q}”</span>` : raw('')}</p>
    ${relaxed?.kind === 'relaxed' ? h`<p class="zl-muted">${t('nores.relaxed', relaxed.total)}</p>` : raw('')}
    <div class="zl-noresults__paths">
      <div class="zl-row zl-row--center">
        ${hasCampus ? h`<a class="zl-btn zl-btn--secondary zl-btn--sm" href="${sp + qs(selQuery(params, { campus: [] }))}">${t('nores.allcampus')}</a>` : raw('')}
        ${hasPrice ? h`<a class="zl-btn zl-btn--secondary zl-btn--sm" href="${sp + qs(selQuery(params, { min: '', max: '' }))}">${t('nores.noprice')}</a>` : raw('')}
        <a class="zl-btn zl-btn--secondary zl-btn--sm" href="${L(locale, '/market')}">${t('nores.browse')}</a>
      </div>
      <button class="zl-btn zl-btn--primary zl-btn--sm" type="button" disabled title="Not in the prototype">${t('nores.notify')}</button>
    </div>
    ${relaxed ? h`<div class="zl-noresults__fallback">
      <h4>${relaxed.kind === 'relaxed' ? t('nores.relaxedhead') : t('nores.fallback')}</h4>
      ${feed(relaxed.rows, { locale, t })}
    </div>` : raw('')}
  </div>`;
}

/* ---------- Listing detail ----------
   Three regions, not two. The rail on the right holds everything you act on —
   price, the actions, who you are dealing with, the safety note — and the
   reading matter (description, spec table) sits under the gallery instead of
   on top of the actions. Kleinanzeigen's product page is built this way and
   the reason is measurable: with description and specs in the rail, "Message
   seller" started 824px down a 768px-tall screen, and the seller, Save, Share
   and Report were all below the fold. */
export function listing({ locale, t, l, images, seller, langs, favorited, user, sellerOther, reported, saveCount = 0, wechat = null }) {
  const isOwn = user && user.id === l.user_id;
  /* Scarcity is real here rather than manufactured: listings expire after 30
     days, so the countdown only appears in the last week. */
  const days = l.expires_at ? Math.ceil((new Date(l.expires_at) - Date.now()) / 864e5) : null;
  const daysLeft = l.status === 'active' && days != null && days > 0 && days <= 7 ? days : null;
  const catName = categoryName({ name_en: l.category_en, name_zh: l.category_zh }, locale);
  return h`
  ${crumbs([[t('home.title'), L(locale, '/market')], [catName, L(locale, '/search') + qs({ category: l.category_slug })], [l.title, null]], t('a11y.crumbs'))}
  <div class="app-detail">
    <div class="app-detail__media">${gallery(images, l.title, t)}</div>
    <div class="app-detail__side zl-stack">
      <header class="app-detail__head">
        ${l.status !== 'active' ? h`<span class="zl-badge zl-badge--sold">${t('listing.' + (l.status === 'sold' ? 'sold' : 'expired'))}</span>` : raw('')}
        <h1 class="zl-h2">${l.title}</h1>
        ${/* The price is the second thing a buyer looks for after the title,
             and it was set at 18px — smaller than the lede under it. --lead
             gives it the weight that ranking deserves. The old figure sits
             beside it, struck, only when the seller actually lowered the
             price: a reduction is news a buyer wants, and the query makes
             sure it can never mean anything else. */ raw('')}
        <p class="app-detail__price">
          ${priceTag(l, t, { lead: true })}
          ${l.previous_price_cents && l.price_type === 'fixed'
            ? h`<s class="zl-price__was">${money(l.previous_price_cents)}</s>
                <span class="zl-sr-only">${t('listing.wasprice', money(l.previous_price_cents))}</span>`
            : raw('')}
        </p>
        ${/* Two rows, not one. The first says what the thing is — where it is
             and what state it is in — and those are the two facts a buyer
             filters on. The date was sitting in with them as a bare caption,
             a different kind of fact wearing the same clothes. It moves down
             to the second row, with the counts, where everything is a number
             about the advert rather than about the item. Each gets an icon,
             the way Kleinanzeigen marks the same two. */ raw('')}
        <div class="zl-row">
          <span class="zl-badge zl-badge--campus">${campusName(l.campus, locale)}</span>
          ${l.condition ? h`<span class="zl-badge zl-badge--neutral">${t('condb.' + l.condition)}</span>` : raw('')}
        </div>
        <p class="zl-caption app-detail__signals">
          <span class="app-detail__fact">${ICON.calendar}<span>${ago(l.published_at, t)}</span></span>
          <span class="app-detail__fact">${ICON.eye}<span>${t('listing.views', l.view_count)}</span></span>
          ${saveCount > 1 ? h`<span>${t('listing.saves', saveCount)}</span>` : raw('')}
          ${daysLeft != null ? h`<span>${t('listing.expires', daysLeft)}</span>` : raw('')}
        </p>
      </header>
      ${/* The action block, first thing under the price. Save and Share share a
           row: they are peers, and stacking three full-width buttons pushed the
           seller card off the fold for nothing. */ raw('')}
      <div class="zl-stack zl-stack--sm">
        ${isOwn
          ? h`${alert({ tone: 'info', body: t('listing.own') })}
              <a class="zl-btn zl-btn--secondary zl-btn--block" href="${L(locale, '/my')}"><span>${t('nav.my')}</span></a>`
          : h`<form class="js-fab-yield" method="post" action="${L(locale, '/listing/' + l.id + '/contact')}">
                <button class="zl-btn zl-btn--primary zl-btn--lg zl-btn--block" type="submit"${l.status !== 'active' ? raw(' disabled') : raw('')}><span>${t('listing.contact')}</span></button>
              </form>
              ${/* Second, never first: the in-app thread is the one that leaves
                   a record if something goes wrong, so it keeps the primary
                   button. This is the seller's stated preference, offered
                   alongside. Once revealed the button is replaced by the
                   handle — there is nothing left to press. */ raw('')}
              ${l.wechat_ok && l.seller_wechat && l.status === 'active'
                ? wechat
                  ? h`<div class="app-wechat-out">
                        <span class="app-wechat-out__mark" aria-hidden="true">${ICON.wechat}</span>
                        <span class="zl-caption">${t('listing.wechat.is')}</span>
                        <b class="app-wechat-out__id">${wechat}</b>
                      </div>`
                  : h`<form method="post" action="${L(locale, '/listing/' + l.id + '/wechat')}">
                        <button class="zl-btn zl-btn--wechat zl-btn--lg zl-btn--block" type="submit">${ICON.wechat}<span>${t('listing.wechat')}</span></button>
                      </form>`
                : raw('')}
              <div class="app-detail__minor">
                <button class="zl-btn zl-btn--secondary zl-grow js-fav" type="button" data-id="${l.id}"
                  aria-pressed="${favorited ? 'true' : 'false'}"
                  data-on="${esc(t('listing.saved'))}" data-off="${esc(t('listing.save'))}"
                  >${ICON.heart}<span>${favorited ? t('listing.saved') : t('listing.save')}</span></button>
                ${/* Hidden until script runs: sharing needs the Web Share API or
                     the clipboard, so without JavaScript this would be a button
                     that does nothing. */ raw('')}
                <button class="zl-btn zl-btn--secondary zl-grow js-share" type="button" hidden
                        data-copied="${esc(t('listing.linkcopied'))}"
                        data-title="${esc(l.title)}">${ICON.share}<span>${t('listing.share')}</span></button>
              </div>`}
      </div>
      ${sellerCard({ locale, t, u: seller, langs, level: 'h2', compact: true, me: !!user })}
      ${/* Quiet, and the last thing in the rail — but in the first screen,
           which is the point: the person who needs it is the person who has
           just read the listing and found something wrong with it. */ raw('')}
      ${isOwn ? raw('') : h`<div class="zl-listing-actions">${reportBox({ l, locale, t, reported })}</div>`}
    </div>
    ${/* Read, not act on: under the gallery on a desktop, under the rail on a
         phone — the grid places it, the source order stays sensible. */ raw('')}
    <div class="app-detail__body zl-stack">
      ${/* The safety note sits under the gallery, full width, above the
           description — the same place Kleinanzeigen puts its buyer-protection
           banner. In the rail it was a narrow box nobody reached. */ raw('')}
      ${alert({ tone: 'warning', title: t('listing.safety.title'), body: t('listing.safety.body'),
                extra: arrowLink(L(locale, '/rules'), t('listing.rules')) })}
      ${l.description ? h`<section class="app-desc">
        <h2 class="zl-label app-specs__title">${t('listing.desc')}</h2>
        <p class="app-detail__desc">${l.description}</p>
      </section>` : raw('')}
      ${specs({ l, locale, t })}
    </div>
  </div>
  ${sellerOther.length ? h`<section class="zl-section app-detail__more">
    <h2 class="zl-h3 zl-section__title">${t('seller.listings')}</h2>
    ${feed(sellerOther, { locale, t })}
  </section>` : raw('')}`;
}

/* Seller / profile card — one component for the listing sidebar and the
   public profile header, so the two can't drift apart. */
/* Exported because the Events page shows its organiser with the same card:
   one component, so a person looks the same whether they are selling a desk
   or running a tournament. `note` is the one slot the two uses differ by —
   the body an event is run on behalf of. */
export function sellerCard({ locale, t, u, langs, level = 'h2', link = true, compact = false, me = false, note = null, stacked = false }) {
  /* Signed-in students see each other as NOGUEIRA, Gabriel; the public web
     sees the short name the account was made with. See lib/names.mjs. */
  const parts = { family: u.family_name, given: u.given_name, fallback: u.display_name };
  const shown = personName(parts, me);
  const name = link ? h`<a href="${L(locale, '/u/' + u.id)}">${shown}</a>` : shown;
  const heading = level === 'h1'
    ? h`<h1 class="zl-seller__name zl-h3">${name}</h1>`
    : h`<h2 class="zl-seller__name">${name}</h2>`;
  return h`<section class="zl-seller ${compact ? 'zl-seller--compact' : ''} ${stacked ? 'zl-seller--stacked' : ''}" aria-label="${shown}">
    <span class="zl-avatar ${compact ? '' : 'zl-avatar--lg'}" aria-hidden="true">${personInitials(parts)}</span>
    <div class="zl-seller__body">
      <div class="zl-row">${heading}${u.is_zju_verified ? verifiedBadge(t) : raw('')}</div>
      ${note ? h`<p class="zl-seller__note">${note}</p>` : raw('')}
      ${/* The facts are one group so the stacked card can space them as one.
           Each half of "campus · member since 2026" is its own span: a long
           campus name used to wrap mid-phrase and leave the year alone on a
           line, and as separate pieces the break can only fall between them. */ raw('')}
      <div class="zl-seller__facts">
        <p class="zl-seller__meta"><span class="zl-seller__where">${campusName(u.home_campus, locale)}</span><span class="zl-seller__dot" aria-hidden="true"> · </span><span class="zl-seller__since">${t('seller.since')} ${new Date(u.created_at).getFullYear()}</span></p>
        ${u.last_seen_at ? h`<p class="zl-seller__meta">${t('seller.active')} ${ago(u.last_seen_at, t)}</p>` : raw('')}
      </div>
      ${/* One wrapper, two layouts: stacked on the profile, label and chips on
           one line in the listing rail. */ raw('')}
      ${langs.length ? h`<div class="zl-seller__speaks">
        <p class="zl-seller__label">${t('seller.speaks')}</p>
        <ul class="zl-seller__langs">${langs.map((g) => h`<li class="zl-chip zl-chip--static">${locale === 'zh' ? g.name_zh : g.name_en}</li>`)}</ul>
      </div>` : raw('')}
    </div>
  </section>`;
}

/* The facts of the listing as a labelled table. OLX puts its substance here and
   it reads far better than a row of badges — adopted in structure, set in our
   own type scale. */
function specs({ l, locale, t }) {
  const rows = [
    [t('spec.category'), categoryName({ name_en: l.category_en, name_zh: l.category_zh }, locale), false],
    /* Services have no condition — the column is NULL for them, so the row is
       simply absent rather than showing a blank or a meaningless "Good". */
    l.condition ? [t('spec.condition'), t('cond.' + l.condition), false] : null,
    [t('spec.campus'), campusName(l.campus, locale), false],
    l.meetup_note ? [t('spec.meetup'), l.meetup_note, false] : null,
    /* Posted and views are in the caption line beside the price now; repeating
       them here only made the table longer than the facts in it. */
    l.expires_at && l.status === 'active' ? [t('spec.expires'), new Date(l.expires_at).toISOString().slice(0, 10), true] : null,
  ].filter(Boolean);
  return h`<section class="app-specs">
    <h2 class="zl-label app-specs__title">${t('spec.title')}</h2>
    <dl class="zl-specs">
      ${rows.map(([k, v, num]) => h`<div class="zl-specs__row">
        <dt class="zl-specs__key">${k}</dt>
        <dd class="zl-specs__val ${num ? 'zl-specs__val--num' : ''}">${v}</dd>
      </div>`)}
    </dl>
  </section>`;
}

const REPORT_REASONS = ['prohibited', 'spam', 'wrong', 'offensive', 'other'];
function reportBox({ l, locale, t, reported }) {
  if (reported) return h`<p class="zl-caption">${t('report.sent')}</p>`;
  return h`<details class="zl-report">
    <summary class="zl-minor-action">${ICON.flag}<span>${t('listing.report')}</span></summary>
    <form class="zl-report__body" method="post" action="${L(locale, '/listing/' + l.id + '/report')}">
      <div class="zl-field zl-grow">
        <label class="zl-field__label zl-caption" for="reason">${t('report.reason')}</label>
        <select class="zl-select" id="reason" name="reason">
          ${REPORT_REASONS.map((r) => h`<option value="${r}">${t('report.r.' + r)}</option>`)}
        </select>
      </div>
      <button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit"><span>${t('report.send')}</span></button>
    </form>
  </details>`;
}

/* ---------- Public profile ---------- */
/* An open profile: what this person is selling, what they are going to, and
   what they run. Attendance is public to signed-in students by design — it
   is the same list that appears on the event page, seen from the other end. */
/* Who on the left, what they are doing on the right — the same rail-and-main
   shape the Marketplace and Events pages use, so the third column layout on
   the site is not a third layout. The card is sticky: scrolling a long list
   of someone's listings should not scroll away whose listings they are. */
export function profile({ locale, t, u, langs, rows, going = [], organising = [], me = false }) {
  return h`<div class="app-profile">
    <aside class="app-profile__aside">
      ${sellerCard({ locale, t, u, langs, level: 'h1', link: false, me, stacked: true })}
    </aside>
    <div class="app-profile__main">
      <section class="zl-section">
        <h2 class="zl-h3 zl-section__title">${t('seller.listings')}</h2>
        ${rows.length ? feed(rows, { locale, t }) : h`<p class="zl-muted">${t('empty.title')}</p>`}
      </section>
      ${organising.length ? h`<section class="zl-section">
        <h2 class="zl-h3 zl-section__title">${t('profile.organising')}</h2>
        <div class="app-ev-list">${organising.map((e) => eventCard(e, { locale, t }))}</div>
      </section>` : raw('')}
      <section class="zl-section">
        <h2 class="zl-h3 zl-section__title">${t('profile.events')}</h2>
        ${going.length
          ? h`<div class="app-ev-list">${going.map((e) => eventCard(e, { locale, t, joinedKey: 'ev.joined.them' }))}</div>`
          : h`<p class="zl-muted">${t('profile.events.none')}</p>`}
      </section>
    </div>
  </div>`;
}

/* ---------- My listings ---------- */
export function my({ locale, t, tab, rows, counts }) {
  const tabLink = (k, label, n) =>
    h`<a class="zl-tab ${tab === k ? 'is-active' : ''}" href="${L(locale, '/my') + qs({ tab: k })}">${label} · ${n}</a>`;
  return h`
  ${pageHeader({ title: t('my.title') })}
  <div class="zl-tabs app-page-tabs">
    ${tabLink('active', t('my.active'), counts.active)}
    ${tabLink('sold', t('my.sold'), counts.sold)}
    ${tabLink('expired', t('my.expired'), counts.expired)}
  </div>
  ${rows.length ? h`<div class="app-mylist">${rows.map((l) => h`
    <div class="app-mylist__row">
      <div class="app-mylist__thumb">${l.cover_src ? h`<img src="${sized(l.cover_src, 80, 60)}" alt="" width="80" height="60">` : raw('')}</div>
      <div class="zl-grow">
        <a href="${L(locale, '/listing/' + l.id)}">${l.title}</a>
        <div class="zl-caption">${campusName(l.campus, locale)} · ${ago(l.bumped_at, t)}</div>
      </div>
      <div>${priceTag(l, t)}</div>
      ${/* Changing the price is its own form: it carries a field, and putting
           an input inside the sold/renew/delete form would submit the number
           with whichever of those buttons was pressed. Active listings only —
           there is no asking price to revise on something already sold. */
        tab === 'active' ? h`<form method="post" action="${L(locale, '/listing/' + l.id + '/action')}" class="app-mylist__price">
          <input type="hidden" name="op" value="price">
          <label class="zl-sr-only" for="price-${l.id}">${t('my.newprice')}</label>
          <div class="zl-price-input">
            <span class="prefix">¥</span>
            <input class="zl-input zl-input--sm" id="price-${l.id}" name="price" type="text" inputmode="numeric"
                   value="${l.price_type === 'fixed' ? Math.round(l.price_cents / 100) : ''}"
                   placeholder="${t('my.newprice')}" maxlength="7">
          </div>
          <button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit"><span>${t('my.setprice')}</span></button>
        </form>` : raw('')}
      <form method="post" action="${L(locale, '/listing/' + l.id + '/action')}" class="app-mylist__actions">
        ${tab === 'active' ? h`<button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit" name="op" value="sold"><span>${t('my.marksold')}</span></button>` : raw('')}
        ${tab !== 'active' ? h`<button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit" name="op" value="renew"><span>${t('my.renew')}</span></button>` : raw('')}
        <button class="zl-btn zl-btn--ghost zl-btn--sm js-confirm" type="submit" data-msg="${t('my.confirmdel')}" name="op" value="delete"><span>${t('my.delete')}</span></button>
      </form>
    </div>`)}</div>` : h`<p class="zl-muted">${t('empty.title')}</p>`}`;
}

/* ---------- Saved ---------- */
export const saved = ({ locale, t, rows, favSet }) => h`
  ${pageHeader({ title: t('saved.title') })}
  ${rows.length ? feed(rows, { locale, t, favSet }) : h`<p class="zl-muted">${t('saved.none')}</p>`}`;

/* ---------- Messages ---------- */
export function inbox({ locale, t, convos }) {
  return h`${pageHeader({ title: t('msg.title') })}
  ${convos.length ? h`<div class="app-inbox">${convos.map((c) => h`
    <a class="app-inbox__row" href="${L(locale, '/messages/' + c.id)}">
      <div class="app-mylist__thumb">${c.cover_src ? h`<img src="${sized(c.cover_src, 56, 42)}" alt="" width="56" height="42">` : raw('')}</div>
      <div class="zl-grow">
        <div class="app-inbox__name">${personName({ family: c.other_family, given: c.other_given, fallback: c.other_name }, true)}${c.unread ? h` <span class="app-dot">${c.unread}</span>` : raw('')}</div>
        <div class="zl-caption zl-truncate">${c.listing_title}</div>
        <div class="zl-caption zl-truncate">${c.last_body || ''}</div>
      </div>
      <span class="zl-caption">${ago(c.last_message_at, t)}</span>
    </a>`)}</div>` : h`<p class="zl-muted">${t('msg.none')}</p>`}`;
}

export function thread({ locale, t, convo, msgs, me, otherUser, myWechat, theirWechat }) {
  return h`
  ${crumbs([[t('msg.title'), L(locale, '/messages')], [convo.listing_title, null]], t('a11y.crumbs'))}
  <div class="app-thread__head">
    <div class="app-mylist__thumb">${convo.cover_src ? h`<img src="${sized(convo.cover_src, 56, 42)}" alt="" width="56" height="42">` : raw('')}</div>
    <div>
      <div class="zl-caption">${t('msg.about')}</div>
      <a href="${L(locale, '/listing/' + convo.listing_id)}">${convo.listing_title}</a>
      <div class="zl-caption">${personName({ family: otherUser.family_name, given: otherUser.given_name, fallback: otherUser.display_name }, true)}</div>
    </div>
  </div>
  <div class="zl-thread app-thread">
    ${msgs.map((m) => h`<div class="zl-msg ${m.sender_id === me.id ? 'zl-msg--me' : 'zl-msg--them'}">${m.body}
      <span class="zl-msg__time">${ago(m.created_at, t)}</span></div>`)}
  </div>
  <form class="app-composer" method="post" action="${L(locale, '/messages/' + convo.id)}">
    <label class="zl-sr-only" for="body">${t('msg.placeholder')}</label>
    <input class="zl-input" id="body" name="body" placeholder="${esc(t('msg.placeholder'))}" required maxlength="2000" autocomplete="off">
    <button class="zl-btn zl-btn--primary" type="submit"><span>${t('msg.send')}</span></button>
  </form>
  <div class="zl-stack zl-stack--md app-thread__extra">
    ${theirWechat ? alert({ tone: 'success', body: raw(t('msg.wechatshared', esc(theirWechat))) }) : raw('')}
    ${myWechat ? raw('') : h`<form method="post" action="${L(locale, '/messages/' + convo.id + '/wechat')}">
        <button class="zl-btn zl-btn--secondary zl-btn--sm" type="submit"><span>${t('msg.sharewechat')}</span></button></form>`}
  </div>`;
}

/* ---------- Sign in ----------
   One narrow column; the form fills it. The old fixed 340px form left the
   input and button short of the text above them on every phone. */
export function signin({ t, locale, step, email, devCode, error, next, demo = false }) {
  const nextField = next ? h`<input type="hidden" name="next" value="${next}">` : raw('');
  /* Demo: no email field at all. One button, one shared read-only account. */
  if (demo) return h`<div class="zl-narrow">
    ${pageHeader({ title: t('demo.title'), description: t('demo.lede') })}
    <div class="zl-stack">
      ${error ? alert({ tone: 'danger', body: error }) : raw('')}
      ${alert({ tone: 'info', body: t('demo.rules') })}
      <form method="post" action="${L(locale, '/signin')}" class="zl-form">
        <input type="hidden" name="step" value="demo">${nextField}
        <div class="zl-form__actions">
          <button class="zl-btn zl-btn--primary zl-btn--lg" type="submit"><span>${t('demo.enter')}</span></button>
        </div>
      </form>
    </div>
  </div>`;
  return h`<div class="zl-narrow">
    ${pageHeader({ title: t('auth.title'), description: t('auth.lede'), meta: t('auth.why') })}
    <div class="zl-stack">
      ${error ? alert({ tone: 'danger', body: error }) : raw('')}
      ${devCode ? alert({ tone: 'info', title: t('auth.dev'), body: h`<span class="app-devcode zl-num">${devCode}</span>` }) : raw('')}
      ${step === 'code'
        ? h`<form method="post" action="${L(locale, '/signin')}" class="zl-form">
            <input type="hidden" name="step" value="verify"><input type="hidden" name="email" value="${email}">${nextField}
            <div class="zl-field">
              <label class="zl-field__label" for="code">${t('auth.code')}</label>
              <input class="zl-input zl-num" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus>
            </div>
            <div class="zl-field">
              <label class="zl-field__label" for="name">${t('auth.name')}</label>
              <input class="zl-input" id="name" name="name" autocomplete="nickname" placeholder="${esc(email.split('@')[0])}">
            </div>
            <div class="zl-form__actions">
              <button class="zl-btn zl-btn--primary" type="submit"><span>${t('auth.verify')}</span></button>
            </div>
          </form>`
        : h`<form method="post" action="${L(locale, '/signin')}" class="zl-form">
            <input type="hidden" name="step" value="request">${nextField}
            <div class="zl-field">
              <label class="zl-field__label" for="email">${t('auth.email')}</label>
              <input class="zl-input" id="email" name="email" type="email" autocomplete="email" required autofocus
                placeholder="you@intl.zju.edu.cn" value="${email || ''}" aria-describedby="emailPrivacy">
              <p class="zl-field__hint" id="emailPrivacy">${t('auth.privacy')}</p>
            </div>
            <div class="zl-form__actions">
              <button class="zl-btn zl-btn--primary" type="submit"><span>${t('auth.send')}</span></button>
            </div>
          </form>`}
    </div>
  </div>`;
}

/* ---------- Post ---------- */
export function post({ t, locale, error, wechatId = null }) {
  const { categories, campuses } = ref();
  return h`<div class="zl-narrow">
    ${pageHeader({ title: t('post.title'), description: t('post.lede') })}
    ${error ? h`<div class="app-form-error">${alert({ tone: 'danger', body: error })}</div>` : raw('')}
    <form class="zl-form" method="post" action="${L(locale, '/post')}" id="postForm">
      <div class="zl-field">
        <label class="zl-field__label" for="photos">${t('post.f.photos')}<span class="req">*</span></label>
        <input class="zl-input" id="photos" type="file" accept="image/*" multiple>
        <p class="zl-field__hint">${t('post.f.photohint')}</p>
        <div id="thumbs" class="app-thumbs"></div>
        <input type="hidden" name="images" id="imagesField">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="title">${t('post.f.title')}<span class="req">*</span></label>
        <input class="zl-input" id="title" name="title" maxlength="80" required>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="category">${t('post.f.cat')}<span class="req">*</span></label>
        <select class="zl-select" id="category" name="category" required>
          ${categories.map((c) => h`<option value="${c.slug}">${(c.icon || '') + ' ' + categoryName(c, locale)}</option>`)}
        </select>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="price">${t('post.f.price')}</label>
        <div class="zl-price-input"><span class="prefix">¥</span>
          <input class="zl-input" id="price" name="price" inputmode="numeric" placeholder="80"></div>
        <p class="zl-field__hint">${t('post.f.pricehint')}</p>
      </div>
      <label class="zl-check"><input type="checkbox" name="free" value="1"> <span>${t('post.f.free')}</span></label>
      <div class="zl-field">
        <span class="zl-field__label" id="condLabel">${t('post.f.cond')}</span>
        <div class="zl-row zl-row--md" role="radiogroup" aria-labelledby="condLabel">
          ${CONDITIONS.map((c, i) => h`<label class="zl-radio"><input type="radio" name="condition" value="${c}"${i === 2 ? raw(' checked') : raw('')}> <span>${t('cond.' + c)}</span></label>`)}
        </div>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="campus">${t('post.f.campus')}<span class="req">*</span></label>
        <select class="zl-select" id="campus" name="campus" required>
          ${campuses.map((c) => h`<option value="${c.code}">${locale === 'zh' ? c.name_zh : c.name_en}</option>`)}
        </select>
        <p class="zl-field__hint">${t('post.f.campushint')}</p>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="description">${t('post.f.desc')}</label>
        <textarea class="zl-textarea" id="description" name="description" maxlength="2000"></textarea>
      </div>
      ${/* Optional, and off unless ticked. The hint says exactly who ends up
           seeing the handle, because "contact me on WeChat" and "publish my
           WeChat to the internet" are different offers and a seller should
           not have to guess which one they are making. */ raw('')}
      <div class="zl-field">
        <label class="zl-field__label" for="wechat">${t('post.f.wechat')}</label>
        <input class="zl-input" id="wechat" name="wechat" maxlength="20"
               autocomplete="off" spellcheck="false"
               placeholder="${t('post.f.wechat.ph')}" value="${wechatId || ''}"
               aria-describedby="wechatHint">
        <p class="zl-field__hint" id="wechatHint">${t('post.f.wechat.hint')}</p>
        <label class="zl-check">
          <input type="checkbox" name="wechat_ok" value="1"${wechatId ? raw(' checked') : raw('')}>
          <span>${t('post.f.wechat.ok')}</span>
        </label>
      </div>
      <div class="zl-form__actions"><button class="zl-btn zl-btn--primary" type="submit"><span>${t('post.submit')}</span></button></div>
    </form>
  </div>`;
}

/* ---------- Contact ----------
   ONE place to set how people reach the team. Until an address is filled in,
   the page still works: it routes everything through the Community, which is
   a channel that genuinely exists today. Set `email` to a real inbox and the
   page grows an email route; leave it null and nothing on the page lies.

   Why this page exists at all: the Events gate tells clubs to "get in touch",
   and the rules page says an account "may be suspended" and that details may
   be passed to the university — both of which were dead ends. A platform that
   states consequences and offers no way to ask about them reads as evasive,
   which is the opposite of what an unofficial student project can afford. */
export const CONTACT = {
  email: null,          // e.g. 'you@example.com' — then the email card appears
  board: 'clubs',       // the Community board organiser requests are posted to
};

/* ---------- Rules ---------- */
const RULES = {
  services: {
    en: ['About Services', 'You may offer skills you actually have — tutoring, translation, repairs, design, photography. You may not offer to do someone else\'s coursework: essay writing, sitting exams, or attending classes for another student. That falls under the prohibited list below and will be removed. Teaching someone is fine; doing it for them is not.'],
    zh: ['关于「技能服务」', '可以提供：辅导、翻译、维修、设计、摄影等你本人具备的技能。不可以提供：代写作业、代考、代课，或任何替他人完成其学业的服务 —— 这属于下方的禁止项，会被下架。辅导可以，替写不行。'],
  },
  prohibitedTitle: { en: 'Prohibited items and services', zh: '禁止发布的物品与服务' },
  prohibited: {
    en: ['ID documents and SIM cards', 'Prescription medication', 'Weapons', 'Alcohol and tobacco', 'Adult material', 'Gambling', 'Live animals', 'Counterfeit goods', 'Pirated textbooks and software', 'Academic services (essay writing, exam sitting)', 'Sublets and visa services'],
    zh: ['身份证件与手机 SIM 卡', '处方药', '武器', '烟酒', '成人内容', '赌博相关', '活体动物', '假冒商品', '盗版教材与软件', '代写作业、代考等学术服务', '转租与签证服务'],
  },
  /* Worded as "may", not "will": the site is not a ZJU body and cannot promise
     what the university or the police do. It states what we do (remove,
     suspend) and what can follow — without implying affiliation. */
  consequences: {
    en: ['Breaking these rules has consequences', 'Listings that include anything above will be removed, and the account behind them may be suspended. Where a listing may break the law or university regulations, we may pass the relevant details to Zhejiang University or the authorities, and you may face disciplinary action or legal consequences.'],
    zh: ['违规后果', '发布上述任何物品或服务的内容将被下架，账号可能被封禁。如内容可能违反法律或校规，我们可能将相关信息提交给浙江大学相关部门或执法机关，发布者可能因此承担纪律处分或法律责任。'],
  },
};
export const contact = ({ t, locale }) => h`<div class="zl-narrow">
  ${pageHeader({ title: t('nav.contact'), description: t('contact.lede') })}
  <div class="zl-stack zl-stack--lg">
    <section class="zl-section zl-section--prose">
      <h2 class="zl-h3 zl-section__title">${t('contact.organiser.title')}</h2>
      <p>${t('contact.organiser.body')}</p>
      ${DEMO ? raw('') : h`<p>${arrowLink(L(locale, '/community/new?board=' + CONTACT.board), t('contact.organiser.cta'))}</p>`}
    </section>
    <section class="zl-section zl-section--prose">
      <h2 class="zl-h3 zl-section__title">${t('contact.report.title')}</h2>
      <p>${t('contact.report.body')}</p>
      <p>${arrowLink(L(locale, '/rules'), t('nav.rules'))}</p>
    </section>
    ${CONTACT.email
      ? h`<section class="zl-section zl-section--prose">
            <h2 class="zl-h3 zl-section__title">${t('contact.email.title')}</h2>
            <p>${t('contact.email.body')}</p>
            <p><a class="zl-link-arrow" href="mailto:${CONTACT.email}">${CONTACT.email}</a></p>
          </section>`
      : raw('')}
    ${alert({ tone: 'info', body: t('contact.note') })}
  </div>
</div>`;

/* ---------- Report a bug ---------- */
export function reportBug({ t, locale, v = {}, error = null, sent = false }) {
  const KINDS = ['broken', 'looks', 'translation', 'other'];
  return h`<div class="zl-narrow">
    ${pageHeader({ title: t('bug.title'), description: t('bug.lede') })}
    <div class="zl-stack">
    ${sent ? alert({ tone: 'success', body: t('bug.thanks') }) : raw('')}
    ${error ? alert({ tone: 'danger', body: error }) : raw('')}
    <form class="zl-form" method="post" action="${L(locale, '/bug')}">
      <div class="zl-field">
        <label class="zl-field__label" for="kind">${t('bug.f.kind')}</label>
        <select class="zl-select" id="kind" name="kind">
          ${KINDS.map((k) => h`<option value="${k}"${v.kind === k ? raw(' selected') : raw('')}>${t('bug.kind.' + k)}</option>`)}
        </select>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="summary">${t('bug.f.summary')}<span class="req">*</span></label>
        <input class="zl-input" id="summary" name="summary" maxlength="120" required value="${v.summary || ''}">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="details">${t('bug.f.details')}<span class="req">*</span></label>
        <textarea class="zl-textarea" id="details" name="details" maxlength="2000" required
                  aria-describedby="detailsHint">${v.details || ''}</textarea>
        <p class="zl-field__hint" id="detailsHint">${t('bug.f.detailshint')}</p>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="expected">${t('bug.f.expected')}</label>
        <textarea class="zl-textarea app-bug__short" id="expected" name="expected" maxlength="1000">${v.expected || ''}</textarea>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="page">${t('bug.f.page')}</label>
        <input class="zl-input" id="page" name="page" maxlength="200" value="${v.page || ''}" placeholder="/en/market">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="email">${t('bug.f.email')}</label>
        <input class="zl-input" id="email" name="email" type="email" maxlength="120" autocomplete="email"
               value="${v.email || ''}" aria-describedby="emailHint">
        <p class="zl-field__hint" id="emailHint">${t('bug.f.emailhint')}</p>
      </div>
      ${/* A honeypot. People never see or reach it; a bot that fills every
           field does, and its report is quietly dropped. Hidden with the
           visually-hidden class rather than display:none, which some bots
           skip. tabindex -1 and aria-hidden keep it out of a real reader's way. */ raw('')}
      <div class="zl-sr-only" aria-hidden="true">
        <label for="website">Leave this empty</label>
        <input id="website" name="website" tabindex="-1" autocomplete="off">
      </div>
      <div class="zl-form__actions">
        <button class="zl-btn zl-btn--primary" type="submit"><span>${t('bug.send')}</span></button>
      </div>
    </form>
    </div>
  </div>`;
}

export const rules = ({ t, locale }) => {
  const lang = locale === 'zh' ? 'zh' : 'en';
  return h`<div class="zl-narrow">
  ${pageHeader({ title: t('nav.rules'), description: t('rules.lede') })}
  <div class="zl-stack">
    ${alert({ tone: 'warning', title: t('listing.safety.title'), body: t('listing.safety.body') })}
    ${alert({ tone: 'info', title: RULES.services[lang][0], body: RULES.services[lang][1] })}
    <section class="app-rules-list">
      <h2 class="zl-h3 zl-section__title">${RULES.prohibitedTitle[lang]}</h2>
      <ul class="app-list">${RULES.prohibited[lang].map((x) => h`<li>${x}</li>`)}</ul>
    </section>
    ${alert({ tone: 'danger', title: RULES.consequences[lang][0], body: RULES.consequences[lang][1] })}
  </div>
</div>`;
};
