/* ============================================================
   Events — list, detail, create.

   The page people actually use is the detail one: it answers "what is it,
   when, where, am I in, and who else is coming" without a scroll on a phone.
   Everything else is in service of getting there.
   ============================================================ */
import { h, raw, esc } from '../lib/html.mjs';
import { CATEGORIES, WHEN } from '../lib/events.mjs';
import { personName, personInitials } from '../lib/names.mjs';
import { L, ICON, ICONS, pageHeader, alert, crumbs, arrowLink, verifiedBadge, campusLabel } from './layout.mjs';
import { sellerCard } from './pages.mjs';

/* Dates are shown in the reader's own language, with the weekday spelled out:
   "Sat 25 Oct, 19:00". A student deciding whether to go cares which day of
   the week it is long before they care about the date. */
export function when(e, locale, { withYear = false } = {}) {
  const d = new Date(e.starts_at);
  const loc = locale === 'zh' ? 'zh-CN' : 'en-GB';
  const date = d.toLocaleDateString(loc, {
    weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  if (!e.ends_at) return `${date}, ${time}`;
  const end = new Date(e.ends_at);
  const sameDay = end.toDateString() === d.toDateString();
  const endTime = end.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  return sameDay ? `${date}, ${time}–${endTime}`
    : `${date}, ${time} – ${end.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })}, ${endTime}`;
}

/* "Thu 22 Oct" makes the reader work out whether that is soon. A proximity
   cue answers it for them, which is both the faster read and the only honest
   urgency this page has — the events are free, so there is no price pressure
   to lean on, just the calendar. Only within a week: past that, "in 23 days"
   tells a student nothing they cannot see from the date. */
export function soon(e, t) {
  const start = new Date(e.starts_at);
  const now = new Date();
  const ms = start - now;
  if (ms < 0) return null;
  const day = 864e5;
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(start) - midnight(now)) / day);
  if (ms < 36e5) return t('ev.soon.hour');
  if (days === 0) return t('ev.soon.today');
  if (days === 1) return t('ev.soon.tomorrow');
  if (days <= 6) return t('ev.soon.days', days);
  return null;
}

/* The Community's three, not the marketplace's five: an event has no price
   and no item, so "prohibited item" and "misleading listing" have nothing to
   describe. */
const REPORT_REASONS = ['spam', 'offensive', 'other'];

const CAT_ICON = { party: '🎉', sports: '⚽', club: '👥', cooking: '🍜', culture: '🏛', talk: '🎤', other: '📌' };

const isPast = (e) => new Date(e.starts_at) < new Date();
const isFull = (e) => e.capacity !== null && e.signup_count >= e.capacity;

/* A state badge, or nothing. Cancelled beats finished beats full: if an
   event was called off, that is the only thing worth saying about it. */
function stateBadge(e, t, cls = '') {
  if (e.status === 'cancelled') return h`<span class="zl-badge zl-badge--sold ${cls}">${t('ev.cancelled')}</span>`;
  if (isPast(e)) return h`<span class="zl-badge zl-badge--neutral ${cls}">${t('ev.past')}</span>`;
  if (isFull(e)) return h`<span class="zl-badge zl-badge--neutral ${cls}">${t('ev.full')}</span>`;
  return raw('');
}

/* A tile, the same component as a marketplace card: .zl-card gives the frame,
   the hover and focus states, and the stretched-link overlay. Where a listing
   has a photo an event has a category plate — events carry no image, and a
   grid of grey placeholders would be worse than a grid of coloured ones. The
   date sits on the plate because that is what people scan a listing of events
   for, ahead of the name. */
/* `joinedKey` is whose "going" this is. On the events list it is the reader's
   own, so "You are going" is right. On a profile every tile is the profile
   owner's, and "You are going" read as if the person looking were signed up. */
export function eventCard(e, { locale, t, joinedKey = 'ev.joined' }) {
  const gone = e.status === 'cancelled' || isPast(e);
  const d = new Date(e.starts_at);
  const loc = locale === 'zh' ? 'zh-CN' : 'en-GB';
  return h`<article class="zl-card app-ev-tile ${gone ? 'app-ev-tile--gone' : ''}">
    <div class="zl-card__media app-ev-tile__plate app-ev-tile__plate--${e.category}">
      <span class="app-ev-tile__emoji" aria-hidden="true">${CAT_ICON[e.category] || '📌'}</span>
      <span class="app-ev-tile__date">
        <b>${d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })}</b>
        <span>${d.toLocaleDateString(loc, { weekday: 'short' })} · ${d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </span>
      ${(() => { const n = gone ? null : soon(e, t);
          return n ? h`<span class="app-ev-tile__soon">${n}</span>` : raw(''); })()}
      ${e.joined ? h`<span class="app-ev-tile__flag zl-badge zl-badge--success">${t(joinedKey)}</span>`
        : gone || isFull(e) ? stateBadge(e, t, 'app-ev-tile__flag') : raw('')}
    </div>
    <div class="zl-card__body">
      <h3 class="zl-card__title">
        <a class="zl-card__link" href="${L(locale, '/events/' + e.id)}">${e.title}</a>
      </h3>
      <p class="app-ev-tile__org">${e.org_name}</p>
      <div class="zl-card__meta">
        ${e.campus ? h`<span class="zl-badge zl-badge--campus">${campusLabel(e.campus, locale, t)}</span>` : raw('')}
        ${/* "0 going" reads as nobody wants to come; say nothing until someone does. */ raw('')}
        ${e.signup_count > 0 ? h`<span class="zl-caption">${t('ev.going', e.signup_count)}</span>` : raw('')}
      </div>
    </div>
  </article>`;
}

/* The filter rail: the date window and the categories, as two lists of links.
   Same component as the Community board nav — one item per row, count on the
   right — because it is the same job. Below the rail's breakpoint the chip
   rows take over; see .app-ev__chips. */
function filterRail({ locale, t, sel, counts, qs }) {
  const item = (label, icon, on, href, n) => h`
    <a class="app-railnav__item" href="${href}"${on ? raw(' aria-current="page"') : raw('')}>
      ${icon ? h`<span class="app-railnav__icon" aria-hidden="true">${icon}</span>` : raw('')}
      <span>${label}</span>
      ${n != null ? h`<span class="app-railnav__n">${n}</span>` : raw('')}
    </a>`;
  return h`<div class="app-ev__rail">
    <nav class="app-railnav" aria-label="${t('ev.when')}">
      <div class="app-railnav__label zl-label">${t('ev.when')}</div>
      ${WHEN.map((w) => item(t('ev.when.' + w), null, sel.when === w, qs({ when: w })))}
    </nav>
    <nav class="app-railnav" aria-label="${t('ev.f.cat')}">
      <div class="app-railnav__label zl-label">${t('ev.f.cat')}</div>
      ${item(t('ev.cat.all'), ICONS.grid, !sel.category, qs({ category: '' }))}
      ${CATEGORIES.map((c) => item(t('ev.cat.' + c), CAT_ICON[c], sel.category === c, qs({ category: c }), counts[c] || 0))}
    </nav>
  </div>`;
}

/* The chip scroller's arrows. Hidden until the script measures real overflow —
   on a wide screen every chip already fits and an arrow pointing at nothing is
   noise. Without JavaScript the row still swipes. The initialiser requires
   both buttons: a .js-chipscroll without them throws. */
const scrollNav = (t) => h`
    <button class="zl-chipscroll__nav zl-chipscroll__nav--prev js-chip-prev" type="button"
            aria-label="${t('filter.back')}" hidden>${ICON.chevron}</button>
    <button class="zl-chipscroll__nav zl-chipscroll__nav--next js-chip-next" type="button"
            aria-label="${t('filter.more')}" hidden>${ICON.chevron}</button>`;

export function eventList({ locale, t, rows, sel, counts, canPost }) {
  const path = L(locale, '/events');
  const qs = (over) => {
    const p = new URLSearchParams();
    const v = { when: sel.when, category: sel.category, ...over };
    if (v.when && v.when !== 'upcoming') p.set('when', v.when);
    if (v.category) p.set('category', v.category);
    const s = p.toString();
    return path + (s ? '?' + s : '');
  };
  const chip = (label, on, href) =>
    h`<a class="zl-chip" aria-pressed="${on ? 'true' : 'false'}" href="${href}">${label}</a>`;
  return h`<div class="app-ev">
    ${/* The rail on a wide screen, the chip rows on a narrow one — the same
         trade the Community makes. Both render the same links, so a filtered
         URL is shareable either way and nothing depends on JavaScript. */ raw('')}
    <aside class="app-ev__aside">${filterRail({ locale, t, sel, counts, qs })}</aside>
    <div class="app-ev__main">
      ${pageHeader({ title: t('ev.title'), description: t('ev.lede'), size: 'h1', compact: true,
        actions: canPost ? h`<a class="zl-btn zl-btn--primary" href="${L(locale, '/events/new')}">${ICONS.plus}<span>${t('ev.new')}</span></a>` : null })}

      <div class="app-ev__chips">
        <div class="zl-chipscroll js-chipscroll">
          <div class="zl-chiprow js-chiptrack" role="group" aria-label="${t('ev.when')}">
            ${WHEN.map((w) => chip(t('ev.when.' + w), sel.when === w, qs({ when: w })))}
          </div>
          ${scrollNav(t)}
        </div>
        <div class="zl-chipscroll js-chipscroll">
          <div class="zl-chiprow js-chiptrack" role="group" aria-label="${t('ev.f.cat')}">
            ${chip(t('ev.cat.all'), !sel.category, qs({ category: '' }))}
            ${/* Icon and name only, no count. The marketplace's chip row sets the
                 pattern: counts belong to the rail, where they sit in a column
                 and line up to be read down. In a horizontal row each count
                 widens its own chip and pushes the next one further off the
                 edge, which costs more than the number is worth on a phone. */
              CATEGORIES.map((c) => chip(h`${CAT_ICON[c]} ${t('ev.cat.' + c)}`,
                sel.category === c, qs({ category: c })))}
          </div>
          ${scrollNav(t)}
        </div>
      </div>

      ${/* The tiles are h3s, so the grid needs an h2 above it or the document
           jumps h1 -> h3. Screen-reader only: the page header right above
           already says what this is. */ raw('')}
      <h2 class="zl-sr-only">${t('ev.title')}</h2>
      ${rows.length
        ? h`<div class="app-ev-grid">${rows.map((e) => eventCard(e, { locale, t }))}</div>`
        : h`<div class="zl-empty">
            <div class="zl-icon-ring zl-icon-ring--lg" aria-hidden="true">${ICONS.grid}</div>
            <div class="zl-empty__title">${t('ev.empty.title')}</div>
            <p class="zl-empty__body">${t('ev.empty.body')}</p>
            ${/* The body said "try a wider date range" and then left the reader
                 to work out how. If a filter is what emptied the page, the way
                 out of it belongs here as one click, not as an instruction. */
              (sel.category || sel.when !== 'upcoming')
                ? h`<a class="zl-btn zl-btn--secondary" href="${path}">${t('ev.empty.clear')}</a>`
                : raw('')}
          </div>`}
    </div>
  </div>`;
}

/* The team sheet, for the organiser and nobody else. It is the only place a
   student ID appears, and it only renders when the server fetched the roster
   — which it does solely for the organiser (lib/events.mjs participants()).
   Captains type their teammates' IDs on their behalf, so those people never
   consented to anything public; the organiser needs them to check a squad in
   at the pitch, and that is the whole of the use. */
function roster({ t, rows }) {
  const teams = rows.filter((r) => r.team_name);
  if (!teams.length) return raw('');
  return h`<section class="app-ev-roster">
    <h2 class="zl-h3 zl-section__title">${t('ev.roster.title')}</h2>
    <p class="zl-field__hint">${t('ev.roster.note')}</p>
    <ul class="app-ev-roster__list">
      ${teams.map((r) => h`<li class="app-ev-roster__team">
        <b>${r.team_name}</b>
        <span class="zl-caption">${t('ev.roster.captain')}: ${personName({ family: r.family_name, given: r.given_name, fallback: r.display_name }, true)}</span>
        ${r.teammates ? h`<ul class="app-ev-roster__mates">
          ${r.teammates.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => h`<li>${x}</li>`)}
        </ul>` : raw('')}
      </li>`)}
    </ul>
  </section>`;
}

/* The participant list. Signed-out visitors get the count and a prompt, not
   the names: attendance is open to the community, not to the public web.
   See docs/events.md. */
function people({ locale, t, rows, user, teamEvent }) {
  if (!user) return h`<div class="app-ev-people__gate">${alert({ tone: 'info', body: t('ev.participants.signin'),
    extra: arrowLink(L(locale, '/signin'), t('nav.signin')) })}</div>`;
  if (!rows.length) return h`<p class="zl-muted">${t('ev.participants.none')}</p>`;
  /* Two columns of tiles rather than full-width rows: the whole tile is the
     link, and a name plus an avatar does not need the width of the page.
     Teammate names are no longer collected with a student ID, so there is
     nothing here that the guidelines ask us to keep out of a public post —
     an avatar, a name, and (for a tournament) the team they are playing for. */
  return h`<ul class="app-ev-people">
    ${rows.map((p) => h`<li class="app-ev-person">
      <a class="app-ev-person__link" href="${L(locale, '/u/' + p.user_id)}">
        <span class="zl-avatar zl-avatar--sm" aria-hidden="true">${personInitials({ family: p.family_name, given: p.given_name, fallback: p.display_name })}</span>
        <span class="app-ev-person__text">
          <span class="app-ev-person__name">
            <span class="app-ev-person__who">${personName({ family: p.family_name, given: p.given_name, fallback: p.display_name }, true)}</span>
            ${/* The tick, not the full "ZJU verified" pill: that badge is 108px
                 and the tile is 245px, so it pushed every name down to
                 "NOGUEI...". Same compact mark the Community byline uses —
                 the trust signal survives, the name stays readable, and the
                 label is still announced. */
              p.is_zju_verified
                ? h`<span class="app-verified" title="${t('seller.verified')}" aria-hidden="true">${ICONS.check}</span><span class="zl-sr-only">${t('seller.verified')}</span>`
                : raw('')}
          </span>
          ${teamEvent && p.team_name ? h`<span class="app-ev-person__team">${t('ev.team.yours')} ${p.team_name}</span>` : raw('')}
        </span>
      </a>
    </li>`)}
  </ul>`;
}

export function eventPage({ locale, t, e, parts, user, error, organiser, organiserLangs = [], reported = false }) {
  const mine = user && user.id === e.organizer_id;
  const past = isPast(e), full = isFull(e), off = e.status === 'cancelled';
  const closed = past || off || (full && !e.joined);
  const left = e.capacity === null ? null : Math.max(e.capacity - e.signup_count, 0);
  /* "194 of 200 places left" is not scarcity, it is an empty room — it tells a
     student nobody is going and talks them out of the very thing the page is
     asking for. The count only earns its place once it is genuinely running
     out, so it appears at a quarter remaining or less (and whenever the room
     is small enough that 25% is only a place or two). */
  const scarce = left !== null && left > 0 && left <= Math.max(Math.ceil(e.capacity * 0.25), 3);
  return h`
  ${crumbs([[t('ev.title'), L(locale, '/events')], [t('ev.cat.' + e.category), L(locale, '/events') + '?category=' + e.category], [e.title, null]], t('a11y.crumbs'))}
  <div class="app-detail">
    <div class="app-detail__media app-ev-hero">
      <span class="app-ev-hero__cat" aria-hidden="true">${CAT_ICON[e.category] || '📌'}</span>
      <span class="app-ev-hero__label">${t('ev.cat.' + e.category)}</span>
    </div>
    <div class="app-detail__side zl-stack">
      <header class="app-detail__head">
        ${stateBadge(e, t)}
        <h1 class="zl-h2">${e.title}</h1>
        <p class="app-ev-when">${when(e, locale, { withYear: true })}${(() => {
          const n = soon(e, t); return n ? h` <span class="app-ev-when__soon">· ${n}</span>` : raw(''); })()}</p>
        <div class="zl-row">
          <span class="zl-badge zl-badge--success">${t('ev.free')}</span>
          ${e.campus ? h`<span class="zl-badge zl-badge--campus">${campusLabel(e.campus, locale, t)}</span>` : raw('')}
        </div>
        <p class="zl-caption app-detail__signals">
          ${e.signup_count > 0 ? h`<span>${t('ev.going', e.signup_count)}</span>` : raw('')}
          ${scarce ? h`<span class="app-ev-scarce">${t('ev.places', left, e.capacity)}</span>` : raw('')}
        </p>
      </header>

      ${error ? alert({ tone: 'danger', body: error }) : raw('')}

      <div class="zl-stack zl-stack--sm">
        ${mine
          ? alert({ tone: 'info', body: t('ev.manage') })
          : e.joined
            ? h`<form class="js-fab-yield" method="post" action="${L(locale, '/events/' + e.id + '/leave')}">
                  <div class="app-ev-joined">${ICONS.check}<span>${t('ev.joined')}</span></div>
                  <button class="zl-btn zl-btn--secondary zl-btn--block" type="submit"><span>${t('ev.leave')}</span></button>
                </form>`
            : h`<form class="js-fab-yield" method="post" action="${L(locale, '/events/' + e.id + '/join')}">
                  ${e.team_size ? h`<fieldset class="zl-form app-ev-team">
                      <legend class="zl-field__label">${t('ev.team.title')}</legend>
                      <p class="zl-field__hint">${t('ev.team.lede', e.team_size)}</p>
                      <div class="zl-field">
                        <label class="zl-field__label" for="team">${t('ev.team.name')}</label>
                        <input class="zl-input" id="team" name="team" maxlength="60" required${closed ? raw(' disabled') : raw('')}>
                      </div>
                      <div class="zl-field">
                        <label class="zl-field__label" for="mates">${t('ev.team.mates')}</label>
                        <textarea class="zl-input app-ev-team__mates" id="mates" name="mates"
                          rows="${Math.max(3, e.team_size - 1)}" placeholder="${t('ev.team.mates.ph')}"
                          aria-describedby="matesHint"${closed ? raw(' disabled') : raw('')}></textarea>
                        <p class="zl-field__hint" id="matesHint">${t('ev.team.mates.hint')}</p>
                      </div>
                    </fieldset>` : raw('')}
                  <button class="zl-btn zl-btn--primary zl-btn--lg zl-btn--block" type="submit"${closed ? raw(' disabled') : raw('')}>
                    <span>${off ? t('ev.cancelled') : past ? t('ev.past') : full ? t('ev.full') : t('ev.join')}</span>
                  </button>
                  ${/* Joining puts your name on a list every signed-in student
                       can read, and nothing said so before the click. The
                       guidelines promise "no phone numbers, addresses or ID
                       photos in public posts", so a student reasonably reads
                       this page as private. State the consequence and the way
                       back out at the point of decision, not after it. */
                    closed ? raw('') : h`<p class="zl-field__hint app-ev-consent">${t('ev.join.note')}</p>`}
                </form>`}
      </div>

      ${/* The same card the marketplace uses for a seller: a person, their
           badge, where and since when, and the languages they can deal in.
           The body they are organising for rides in the note slot — it is the
           one thing an event has that a listing does not. */ raw('')}
      ${organiser ? sellerCard({ locale, t, u: organiser, langs: organiserLangs,
          level: 'h2', compact: true, me: !!user,
          note: h`${t('ev.by')} <b>${e.org_name}</b>` }) : raw('')}

      ${mine && e.status === 'published' ? h`<form method="post" action="${L(locale, '/events/' + e.id + '/cancel')}">
        <button class="zl-minor-action" type="submit">${ICONS.x}<span>${t('ev.cancel')}</span></button>
      </form>` : raw('')}

      ${/* Report, the same component and the same three reasons the Community
           offers — an event is a post by an organisation, so "prohibited item"
           and "misleading listing" do not apply. Hidden from the organiser:
           reporting your own event is not a thing, and the cancel button is
           already the control they want. */
        mine ? raw('')
          : reported ? h`<p class="zl-caption">${t('report.sent')}</p>`
          : user ? h`<div class="zl-listing-actions">
              <details class="zl-report">
                <summary class="zl-minor-action">${ICON.flag}<span>${t('listing.report')}</span></summary>
                <form class="zl-report__body" method="post" action="${L(locale, '/events/' + e.id + '/report')}">
                  <div class="zl-field zl-grow">
                    <label class="zl-field__label zl-caption" for="reason">${t('report.reason')}</label>
                    <select class="zl-select" id="reason" name="reason">
                      ${REPORT_REASONS.map((r) => h`<option value="${r}">${t('report.r.' + r)}</option>`)}
                    </select>
                  </div>
                  <button class="zl-btn zl-btn--tertiary zl-btn--sm" type="submit"><span>${t('report.send')}</span></button>
                </form>
              </details>
            </div>`
          : raw('')}
    </div>

    <div class="app-detail__body zl-stack">
      ${e.venue ? h`<section class="app-ev-where">
        <h2 class="zl-label app-specs__title app-specs__title--ico">${ICONS.mapPin}${t('ev.venue')}</h2>
        <p class="app-detail__desc">${e.venue}</p>
      </section>` : raw('')}
      ${e.body ? h`<section class="app-desc">
        <h2 class="zl-label app-specs__title app-specs__title--ico">${ICONS.details}${t('ev.f.body')}</h2>
        <p class="app-detail__desc">${e.body}</p>
      </section>` : raw('')}
      ${mine && e.team_size ? roster({ t, rows: parts }) : raw('')}
      <section class="app-ev-people-sec">
        <h2 class="zl-h3 zl-section__title">${t('ev.participants')} <span class="zl-caption">${t('ev.going', e.signup_count)}</span></h2>
        ${people({ locale, t, rows: parts, user, teamEvent: !!e.team_size })}
      </section>
    </div>
  </div>`;
}

export function newEvent({ locale, t, error, values = {}, campuses }) {
  const v = values;
  return h`<div class="zl-narrow">
    ${crumbs([[t('ev.title'), L(locale, '/events')], [t('ev.new'), null]], t('a11y.crumbs'))}
    ${pageHeader({ title: t('ev.new'), description: t('ev.lede') })}
    ${error ? alert({ tone: 'danger', body: error }) : raw('')}
    <form class="zl-form" method="post" action="${L(locale, '/events/new')}">
      <div class="zl-field">
        <label class="zl-field__label" for="title">${t('ev.f.title')}</label>
        <input class="zl-input" id="title" name="title" maxlength="140" required value="${v.title || ''}">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="org">${t('ev.f.org')}</label>
        <input class="zl-input" id="org" name="org" maxlength="80" required value="${v.org || ''}" aria-describedby="orgHint">
        <p class="zl-field__hint" id="orgHint">${t('ev.f.org.hint')}</p>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="category">${t('ev.f.cat')}</label>
        <select class="zl-select" id="category" name="category">
          ${CATEGORIES.map((c) => h`<option value="${c}"${v.category === c ? raw(' selected') : raw('')}>${CAT_ICON[c]} ${t('ev.cat.' + c)}</option>`)}
        </select>
      </div>
      <div class="zl-row zl-row--md">
        <div class="zl-field zl-grow">
          <label class="zl-field__label" for="starts">${t('ev.f.starts')}</label>
          <input class="zl-input" id="starts" name="starts" type="datetime-local" required value="${v.starts || ''}">
        </div>
        <div class="zl-field zl-grow">
          <label class="zl-field__label" for="ends">${t('ev.f.ends')}</label>
          <input class="zl-input" id="ends" name="ends" type="datetime-local" value="${v.ends || ''}">
        </div>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="venue">${t('ev.f.venue')}</label>
        <input class="zl-input" id="venue" name="venue" maxlength="120" value="${v.venue || ''}">
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="campus">${t('spec.campus')}</label>
        <select class="zl-select" id="campus" name="campus">
          <option value="">—</option>
          ${campuses.map((c) => h`<option value="${c.code}"${v.campus === c.code ? raw(' selected') : raw('')}>${locale === 'zh' ? c.name_zh : c.name_en}</option>`)}
        </select>
      </div>
      <div class="zl-field">
        <label class="zl-field__label" for="body">${t('ev.f.body')}</label>
        <textarea class="zl-input" id="body" name="body" rows="5" aria-describedby="bodyHint">${v.body || ''}</textarea>
        <p class="zl-field__hint" id="bodyHint">${t('ev.f.body.hint')}</p>
      </div>
      <div class="zl-row zl-row--md">
        <div class="zl-field zl-grow">
          <label class="zl-field__label" for="capacity">${t('ev.f.capacity')}</label>
          <input class="zl-input" id="capacity" name="capacity" type="number" min="1" value="${v.capacity || ''}" aria-describedby="capHint">
          <p class="zl-field__hint" id="capHint">${t('ev.f.capacity.hint')}</p>
        </div>
        <div class="zl-field zl-grow">
          <label class="zl-field__label" for="team">${t('ev.f.team')}</label>
          <input class="zl-input" id="team" name="team" type="number" min="2" value="${v.team || ''}" aria-describedby="teamHint">
          <p class="zl-field__hint" id="teamHint">${t('ev.f.team.hint')}</p>
        </div>
      </div>
      <div class="zl-form__actions">
        <button class="zl-btn zl-btn--primary" type="submit"><span>${t('ev.submit')}</span></button>
      </div>
    </form>
  </div>`;
}

/* Shown to a signed-in student who is not an organiser. It explains the rule
   rather than 404ing, because "why can't I post?" is a fair question. */
export function eventGate({ locale, t }) {
  return h`<div class="zl-narrow">
    ${crumbs([[t('ev.title'), L(locale, '/events')], [t('ev.new'), null]], t('a11y.crumbs'))}
    ${pageHeader({ title: t('ev.gate.title') })}
    ${/* The body says "get in touch and we will enable it for your account",
         which pointed nowhere at all until /contact existed. Send them there:
         an organiser reading this page is exactly the person it is for. */
      alert({ tone: 'info', body: t('ev.gate.body'),
        extra: arrowLink(L(locale, '/contact'), t('nav.contact')) })}
  </div>`;
}
