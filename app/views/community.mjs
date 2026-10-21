/* ============================================================
   Community (forum prototype) — views.
   Same conventions as pages.mjs: everything goes through h``, which escapes
   by default; post and comment bodies are user content and are never raw.
   ============================================================ */
import { h, raw, esc, ago, qs } from '../lib/html.mjs';
import { ref } from '../lib/queries.mjs';
import { sized } from '../lib/unsplash.mjs';
import { boards, KINDS, SORTS } from '../lib/community.mjs';
import { L, ICON, ICONS, campusName, priceTag, pageHeader, alert, crumbs, arrowLink } from './layout.mjs';
import { personName, personInitials } from '../lib/names.mjs';

const REPORT_REASONS = ['spam', 'offensive', 'other'];

const CI = {
  up: raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <path d="M12 4.5 4.8 12.6h4.6v6.9h5.2v-6.9h4.6L12 4.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>
  </svg>`),
  bubble: raw(`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6.2l-4.3 3.6V16H7a2.5 2.5 0 0 1-2.5-2.5v-7Z"
      stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  </svg>`),
};

const boardLabel = (b, locale) => (locale === 'zh' ? b.name_zh : b.name_en);
const postBoardLabel = (p, locale) => (locale === 'zh' ? p.board_zh : p.board_en);
/* Emoji have no side bearing, so a plain space reads as no space at all. */
const ico = (icon) => (icon ? h`<span class="app-ico" aria-hidden="true">${icon}</span>` : raw(''));

/* Upvote. A real form, so it works without JavaScript (the server redirects
   back to `next`); app.js upgrades it to an in-place toggle. */
function vote({ locale, t, type, id, score, voted, next, inline = false }) {
  return h`<form class="app-vote ${inline ? 'app-vote--inline' : ''}" method="post"
      action="${L(locale, `/community/vote/${type}/${id}`)}">
    <input type="hidden" name="next" value="${next}">
    <button class="app-vote__btn js-vote" type="submit" aria-pressed="${voted ? 'true' : 'false'}"
      aria-label="${t('com.upvote')}">${CI.up}</button>
    <span class="app-vote__n js-vote-n">${score}</span>
  </form>`;
}

const flair = (kind, t) => h`<span class="app-flair app-flair--${kind}">${t('com.kind.' + kind)}</span>`;

function linkedListing(p, locale, t) {
  if (!p.listing_id) return raw('');
  const l = { price_type: p.listing_price_type, price_cents: p.listing_price_cents };
  /* A post outlives the listing it links. Without this the card advertises a
     sold or expired item at its old price, with its photo, as if you could
     still buy it — the query has carried `listing_status` all along, it was
     simply never read. Removed listings never reach here: the join in
     lib/community.mjs drops anything with a deleted_at. */
  const gone = p.listing_status && p.listing_status !== 'active';
  return h`<a class="app-linked ${gone ? 'app-linked--gone' : ''}" href="${L(locale, '/listing/' + p.listing_id)}">
    ${p.listing_cover ? h`<img src="${sized(p.listing_cover, 72, 54)}" alt="" width="72" height="54" loading="lazy">` : raw('')}
    <span class="app-linked__text">
      <span class="zl-caption">${t('com.linked')}</span>
      <span class="app-linked__title">${p.listing_title}</span>
      <span class="app-linked__foot">
        ${priceTag(l, t)}
        ${gone ? h`<span class="zl-badge zl-badge--sold">${t('listing.' + (p.listing_status === 'sold' ? 'sold' : 'expired'))}</span>` : raw('')}
      </span>
    </span>
  </a>`;
}

/* An organiser announces an event in a board and the post carries a button
   through to it — the same bridge linkedListing() builds to the marketplace,
   pointed at the Events section. Cancelled events say so here rather than
   sending people to a page that has been called off. */
function linkedEvent(p, locale, t) {
  if (!p.event_id) return raw('');
  const off = p.event_status === 'cancelled';
  const past = p.event_starts && new Date(p.event_starts) < new Date();
  return h`<a class="app-linked ${off || past ? 'app-linked--gone' : ''}" href="${L(locale, '/events/' + p.event_id)}">
    <span class="app-linked__cat" aria-hidden="true">${evIcon(p.event_category)}</span>
    <span class="app-linked__text">
      <span class="zl-caption">${t('com.linked.event')}</span>
      <span class="app-linked__title">${p.event_title}</span>
      <span class="app-linked__foot">
        ${p.event_starts ? h`<span class="zl-caption">${eventWhen(p.event_starts, locale)}</span>` : raw('')}
        ${off ? h`<span class="zl-badge zl-badge--sold">${t('ev.cancelled')}</span>`
              : past ? h`<span class="zl-badge zl-badge--neutral">${t('ev.past')}</span>`
              : h`<span class="zl-caption app-linked__go">${t('ev.seepage')} →</span>`}
      </span>
    </span>
  </a>`;
}
const EV_ICON = { party: '🎉', sports: '⚽', club: '👥', cooking: '🍜', culture: '🏛', talk: '🎤', other: '📌' };
const evIcon = (c) => EV_ICON[c] || '📌';
const eventWhen = (iso, locale) => new Date(iso).toLocaleDateString(
  locale === 'zh' ? 'zh-CN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  + ', ' + new Date(iso).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-GB',
      { hour: '2-digit', minute: '2-digit', hour12: false });

function meta(p, locale, t, { showBoard = true, me = false } = {}) {
  return h`<div class="app-post__meta">
    ${showBoard ? h`<a class="app-post__board" href="${L(locale, '/community/b/' + p.board_slug)}">${ico(p.board_icon)}${postBoardLabel(p, locale)}</a><span aria-hidden="true">·</span>` : raw('')}
    <span>${personName({ family: p.author_family, given: p.author_given, fallback: p.author }, me)}${p.is_zju_verified ? h` <span class="app-verified" title="${t('seller.verified')}" aria-hidden="true">${ICONS.check}</span><span class="zl-sr-only">${t('seller.verified')}</span>` : raw('')}</span>
    <span aria-hidden="true">·</span>
    <time datetime="${new Date(p.created_at).toISOString()}">${ago(p.created_at, t)}</time>
    ${p.campus ? h`<span class="zl-badge zl-badge--campus">${campusName(p.campus, locale)}</span>` : raw('')}
  </div>`;
}

export function postCard(p, { locale, t, next, showBoard = true, me = false }) {
  const href = L(locale, '/community/post/' + p.id);
  return h`<article class="app-post">
    ${vote({ locale, t, type: 'post', id: p.id, score: p.score, voted: p.voted, next })}
    <div class="app-post__main">
      ${meta(p, locale, t, { showBoard, me })}
      <h2 class="app-post__title">${flair(p.kind, t)}
        <a class="app-post__link" href="${href}">${p.title}</a></h2>
      ${p.body ? h`<p class="app-post__excerpt">${p.body}</p>` : raw('')}
      ${linkedListing(p, locale, t)}
      ${linkedEvent(p, locale, t)}
      <div class="app-post__foot">
        <a class="app-post__action" href="${href}#comments">${CI.bubble}<span>${t('com.comments', p.comment_count)}</span></a>
      </div>
    </div>
  </article>`;
}

/* Boards as a vertical list (wide screens) and as a chip row (narrow ones).
   The chip row reuses the marketplace's scroller and in-place swap. */
function boardNav({ locale, t, board, counts }) {
  const all = boards();
  return h`<nav class="app-boards js-swapnav" aria-label="${t('com.boards')}">
    <div class="app-boards__label zl-label">${t('com.boards')}</div>
    <a class="app-boards__item" href="${L(locale, '/community')}"${board ? raw('') : raw(' aria-current="page"')}>
      <span class="app-boards__icon" aria-hidden="true">${ICONS.grid}</span><span>${t('com.all')}</span></a>
    ${all.map((b) => h`<a class="app-boards__item" href="${L(locale, '/community/b/' + b.slug)}"${board?.id === b.id ? raw(' aria-current="page"') : raw('')}>
      <span class="app-boards__icon" aria-hidden="true">${b.icon || '•'}</span>
      <span>${boardLabel(b, locale)}</span>
      <span class="app-boards__n">${counts[b.id] || 0}</span></a>`)}
  </nav>`;
}
function boardChips({ locale, t, board }) {
  const chip = (label, on, href) =>
    h`<a class="zl-chip" aria-pressed="${on ? 'true' : 'false'}" href="${href}">${label}</a>`;
  return h`<div class="zl-chipscroll js-chipscroll app-com__chips">
    <div class="zl-chiprow js-chiptrack" role="group" aria-label="${t('com.boards')}">
      ${chip(t('com.all'), !board, L(locale, '/community'))}
      ${boards().map((b) => chip(h`${ico(b.icon)}${boardLabel(b, locale)}`, board?.id === b.id, L(locale, '/community/b/' + b.slug)))}
    </div>
    <button class="zl-chipscroll__nav zl-chipscroll__nav--prev js-chip-prev" type="button" aria-label="${esc(t('filter.back'))}" hidden>${ICON.chevron}</button>
    <button class="zl-chipscroll__nav zl-chipscroll__nav--next js-chip-next" type="button" aria-label="${esc(t('filter.more'))}" hidden>${ICON.chevron}</button>
  </div>`;
}

function aside({ locale, t, stats, board }) {
  return h`<aside class="app-com__side">
    <div class="app-side-card">
      <h2 class="app-side-card__title">${board ? h`${ico(board.icon)}${boardLabel(board, locale)}` : t('com.about')}</h2>
      <p class="zl-caption app-side-card__body">${board ? (locale === 'zh' ? board.desc_zh : board.desc_en) : t('com.about.body')}</p>
      ${stats ? h`<dl class="app-stats">
        <div><dt>${t('com.stats.posts')}</dt><dd>${stats.posts}</dd></div>
        <div><dt>${t('com.stats.comments')}</dt><dd>${stats.comments}</dd></div>
        <div><dt>${t('com.stats.members')}</dt><dd>${stats.members}</dd></div>
      </dl>` : raw('')}
      <a class="zl-btn zl-btn--primary zl-btn--block" href="${L(locale, '/community/new') + (board ? '?board=' + board.slug : '')}">${ICONS.plus}<span>${t('com.new')}</span></a>
    </div>
    <div class="app-side-card">
      <h2 class="app-side-card__title">${t('com.guidelines')}</h2>
      <ol class="app-guidelines">${t('com.g').map((g) => h`<li>${g}</li>`)}</ol>
      ${arrowLink(L(locale, '/rules'), t('nav.rules'), 'zl-caption')}
    </div>
  </aside>`;
}

/* ---------- Feed (all boards, one board, or a search) ---------- */
function hero({ locale, t }) {
  return h`<section class="app-hero" aria-labelledby="heroTitle">
    <h2 class="app-hero__title zl-h2" id="heroTitle">${t('hero.title')}</h2>
    <p class="app-hero__body">${t('hero.body')}</p>
    <div class="app-hero__actions">
      <a class="zl-btn zl-btn--primary" href="${L(locale, '/signin') + '?next=' + encodeURIComponent(L(locale, '/community'))}"><span>${t('hero.cta')}</span></a>
      <a class="zl-btn zl-btn--secondary" href="${L(locale, '/market')}"><span>${t('hero.browse')}</span>${ICONS.arrowRight}</a>
    </div>
    <ul class="app-hero__points">
      <li>${t('hero.free')}</li><li>${t('hero.nofees')}</li><li>${t('hero.campus')}</li>
    </ul>
  </section>`;
}

export function communityFeed({ locale, t, board, rows, total, sort, query, stats, counts, path, user = null }) {
  const next = path + qs({ sort: sort === 'hot' ? '' : sort, q: query });
  const tab = (s) => h`<a class="zl-tab js-swap ${s === sort ? 'is-active' : ''}"
      ${s === sort ? raw('aria-current="true"') : raw('')}
      href="${path + qs({ sort: s === 'hot' ? '' : s, q: query })}">${t('com.sort.' + s)}</a>`;
  return h`<div class="app-com">
    <aside class="app-com__boards">${boardNav({ locale, t, board, counts })}</aside>
    <div class="app-com__main">
      ${!user && !board && !query ? hero({ locale, t }) : raw('')}
      ${boardChips({ locale, t, board })}
      <div class="js-feed-region" aria-live="polite">
        ${pageHeader({
          title: query ? h`${t('com.results.for')} “${query}”` : board ? h`${ico(board.icon)}${boardLabel(board, locale)}` : t('com.title'),
          description: board ? (locale === 'zh' ? board.desc_zh : board.desc_en) : t('com.lede'),
          compact: true,
        })}
        <div class="app-com__bar">
          <nav class="zl-tabs app-com__tabs" aria-label="${t('com.sort')}">${SORTS.map(tab)}</nav>
          <span class="zl-caption">${raw(t('com.count', total))}</span>
        </div>
        ${rows.length
          ? h`<div class="app-posts">${rows.map((p) => postCard(p, { locale, t, next, showBoard: !board, me: !!user }))}</div>`
          : h`<div class="zl-empty">
              <div class="zl-icon-ring zl-icon-ring--lg" aria-hidden="true">${CI.bubble}</div>
              <div class="zl-empty__title">${t('com.empty')}</div>
              <p class="zl-empty__body">${t('com.empty.body')}</p>
              <a class="zl-btn zl-btn--primary" href="${L(locale, '/community/new') + (board ? '?board=' + board.slug : '')}">${ICONS.plus}<span>${t('com.new')}</span></a>
            </div>`}
      </div>
    </div>
    ${aside({ locale, t, stats })}
  </div>`;
}

/* ---------- One post + its comment tree ---------- */
function commentTree(list, ctx, parentId = null, depth = 0) {
  const kids = ctx.children.get(parentId) || [];
  return kids.map((c) => {
    const deleted = !!c.deleted_at;
    const next = ctx.next + '#c-' + c.id;
    // Past depth 4 replies stop indenting: a thread that marches off the right
    // edge of a phone is unreadable. They still sit under their parent.
    const nested = commentTree(list, ctx, c.id, depth + 1);
    return h`<div class="app-comment" id="c-${c.id}">
      <div class="app-comment__head">
        <span class="zl-avatar zl-avatar--sm" aria-hidden="true">${deleted ? '?' : personInitials({ family: c.author_family, given: c.author_given, fallback: c.author })}</span>
        <b>${deleted ? ctx.t('com.deleted') : personName({ family: c.author_family, given: c.author_given, fallback: c.author }, ctx.me)}</b>
        ${!deleted && c.user_id === ctx.post.user_id ? h`<span class="app-op">${ctx.t('com.op')}</span>` : raw('')}
        <span aria-hidden="true">·</span>
        <time class="zl-caption" datetime="${new Date(c.created_at).toISOString()}">${ago(c.created_at, ctx.t)}</time>
      </div>
      <div class="app-comment__body">${deleted ? ctx.t('com.deleted') : c.body}</div>
      <div class="app-comment__actions">
        ${deleted ? raw('') : vote({ locale: ctx.locale, t: ctx.t, type: 'comment', id: c.id, score: c.score, voted: c.voted, next, inline: true })}
        ${deleted ? raw('') : ctx.user
          ? h`<details class="app-reply">
              <summary class="app-post__action">${CI.bubble}<span>${ctx.t('com.reply')}</span></summary>
              <form class="app-reply__form" method="post" action="${L(ctx.locale, '/community/post/' + ctx.post.id + '/comment')}">
                <input type="hidden" name="parent" value="${c.id}">
                <label class="zl-sr-only" for="r-${c.id}">${ctx.t('com.reply')}</label>
                <textarea class="zl-textarea" id="r-${c.id}" name="body" maxlength="4000" required rows="3"></textarea>
                <div class="app-reply__buttons">
                  <button class="zl-btn zl-btn--primary zl-btn--sm" type="submit"><span>${ctx.t('com.reply.submit')}</span></button>
                </div>
              </form>
            </details>`
          : h`<a class="app-post__action" href="${L(ctx.locale, '/signin') + '?next=' + encodeURIComponent(next)}">${CI.bubble}<span>${ctx.t('com.reply')}</span></a>`}
      </div>
      ${nested.length ? h`<div class="app-comment__children ${depth >= 4 ? 'is-flat' : ''}">${nested}</div>` : raw('')}
    </div>`;
  });
}

export function postPage({ locale, t, p, comments, user, board, reported, path }) {
  const children = new Map();
  for (const c of comments) {
    if (!children.has(c.parent_id)) children.set(c.parent_id, []);
    children.get(c.parent_id).push(c);
  }
  // Top-level comments: most upvoted first. Replies stay chronological so a
  // conversation reads in order.
  children.get(null)?.sort((a, b) => b.score - a.score || new Date(a.created_at) - new Date(b.created_at));
  const ctx = { locale, t, user, post: p, children, next: path, me: !!user };
  return h`<div class="app-com app-com--post">
    <div class="app-com__main">
      ${crumbs([[t('com.title'), L(locale, '/community')], [postBoardLabel(p, locale), L(locale, '/community/b/' + p.board_slug)], [p.title, null]], t('a11y.crumbs'))}
      <article class="app-post app-post--full">
        ${vote({ locale, t, type: 'post', id: p.id, score: p.score, voted: p.voted, next: path })}
        <div class="app-post__main">
          ${meta(p, locale, t, { showBoard: false, me: !!user })}
          <h1 class="app-post__title app-post__title--full">${flair(p.kind, t)} ${p.title}</h1>
          ${p.body ? h`<div class="app-post__body">${p.body}</div>` : raw('')}
          ${linkedListing(p, locale, t)}
          ${linkedEvent(p, locale, t)}
          <div class="zl-listing-actions app-post__tools">
            <a class="app-post__action" href="#comments">${CI.bubble}<span>${t('com.comments', p.comment_count)}</span></a>
            <button class="zl-minor-action js-share" type="button" hidden
                data-copied="${esc(t('listing.linkcopied'))}" data-title="${p.title}">${ICON.share}<span>${t('listing.share')}</span></button>
            ${reported ? h`<p class="zl-caption">${t('report.sent')}</p>`
              : user && user.id !== p.user_id ? h`<details class="zl-report">
                  <summary class="zl-minor-action">${ICON.flag}<span>${t('listing.report')}</span></summary>
                  <form class="zl-report__body" method="post" action="${L(locale, '/community/post/' + p.id + '/report')}">
                    <div class="zl-field zl-grow">
                      <label class="zl-field__label zl-caption" for="reason">${t('report.reason')}</label>
                      <select class="zl-select" id="reason" name="reason">
                        ${REPORT_REASONS.map((r) => h`<option value="${r}">${t('report.r.' + r)}</option>`)}
                      </select>
                    </div>
                    <button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit"><span>${t('report.send')}</span></button>
                  </form>
                </details>` : raw('')}
          </div>
        </div>
      </article>

      <section class="app-comments" id="comments" aria-label="${t('com.comments', p.comment_count)}">
        ${user
          ? h`<form class="app-comment-form" method="post" action="${L(locale, '/community/post/' + p.id + '/comment')}">
              <label class="zl-field__label" for="newComment">${t('com.comment.label')}</label>
              <textarea class="zl-textarea" id="newComment" name="body" maxlength="4000" required rows="3"></textarea>
              <div class="app-reply__buttons"><button class="zl-btn zl-btn--primary zl-btn--sm" type="submit"><span>${t('com.comment.submit')}</span></button></div>
            </form>`
          : h`<div class="app-signin-prompt">
              <span>${t('com.signin.to')}</span>
              <a class="zl-btn zl-btn--secondary zl-btn--sm" href="${L(locale, '/signin') + '?next=' + encodeURIComponent(path + '#comments')}"><span>${t('nav.signin')}</span></a>
            </div>`}
        <div class="app-thread">${commentTree(comments, ctx)}</div>
      </section>
    </div>
    ${aside({ locale, t, board })}
  </div>`;
}

/* ---------- New post ---------- */
export function newPost({ locale, t, error, values = {}, myListings = [], myEvents = [], from = null }) {
  const { campuses } = ref();
  const v = { board: '', kind: 'question', title: '', body: '', campus: '', listing: '', ...values };
  return h`<div class="zl-narrow">
    ${crumbs([[t('com.title'), L(locale, '/community')], [t('com.new'), null]], t('a11y.crumbs'))}
    ${pageHeader({ title: t('com.new'), description: t('com.new.lede') })}
    ${error ? h`<div class="app-form-error">${alert({ tone: 'danger', body: error })}</div>` : raw('')}
    <form class="zl-form" method="post" action="${L(locale, '/community/new')}">
      ${from === 'guide' ? h`<input type="hidden" name="from" value="guide">` : raw('')}
      <div class="zl-field">
        <label class="zl-field__label" for="board">${t('com.f.board')}<span class="req">*</span></label>
        <select class="zl-select" id="board" name="board" required>
          ${boards().map((b) => h`<option value="${b.slug}"${v.board === b.slug ? raw(' selected') : raw('')}>${ico(b.icon)}${boardLabel(b, locale)}</option>`)}
        </select>
      </div>
      <fieldset class="zl-field app-fieldset">
        <legend class="zl-field__label">${t('com.f.kind')}</legend>
        <div class="app-kinds">
          ${KINDS.map((k) => h`<label class="app-kind"><input type="radio" name="kind" value="${k}"${v.kind === k ? raw(' checked') : raw('')}>
            <span class="app-flair app-flair--${k}">${t('com.kind.' + k)}</span></label>`)}
        </div>
      </fieldset>
      <div class="zl-field">
        <label class="zl-field__label" for="title">${t('com.f.title')}<span class="req">*</span></label>
        <input class="zl-input" id="title" name="title" maxlength="140" required value="${v.title}">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="body">${t('com.f.body')}</label>
        <textarea class="zl-textarea" id="body" name="body" maxlength="10000" rows="7">${v.body}</textarea>
        <p class="zl-field__hint">${t('com.f.bodyhint')}</p>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="campus">${t('com.f.campus')}</label>
        <select class="zl-select" id="campus" name="campus">
          <option value="">${t('com.f.campus.all')}</option>
          ${campuses.map((c) => h`<option value="${c.code}"${v.campus === c.code ? raw(' selected') : raw('')}>${locale === 'zh' ? c.name_zh : c.name_en}</option>`)}
        </select>
      </div>
      ${myListings.length ? h`<div class="zl-field">
        <label class="zl-field__label" for="listing">${t('com.f.listing')}</label>
        <select class="zl-select" id="listing" name="listing">
          <option value="">${t('com.f.listing.none')}</option>
          ${myListings.map((l) => h`<option value="${l.id}"${v.listing === l.id ? raw(' selected') : raw('')}>${l.title}</option>`)}
        </select>
      </div>` : raw('')}
      ${/* Organisers only: the select is empty for everyone else, so it is
           simply absent rather than disabled. */ raw('')}
      ${myEvents.length ? h`<div class="zl-field">
        <label class="zl-field__label" for="event">${t('com.linked.event')}</label>
        <select class="zl-select" id="event" name="event">
          <option value="">${t('com.f.listing.none')}</option>
          ${myEvents.map((e) => h`<option value="${e.id}"${v.event === e.id ? raw(' selected') : raw('')}>${e.title}</option>`)}
        </select>
      </div>` : raw('')}
      ${alert({ tone: 'info', body: t('com.f.market'), extra: arrowLink(L(locale, '/post'), t('nav.post')) })}
      <div class="zl-form__actions"><button class="zl-btn zl-btn--primary" type="submit"><span>${t('com.submit')}</span></button></div>
    </form>
  </div>`;
}
