/* ============================================================
   Guidebook — view.
   Three columns on wide screens: contents · chapters · glossary.
   Content is static and ours (content/guide.mjs), but it still goes through
   h`` and esc() like everything else; the only markup added to it is the
   glossary term links, inserted after escaping.
   ============================================================ */
import { h, raw, esc } from '../lib/html.mjs';
import { CHAPTERS, GLOSSARY, GUIDE_SOURCE } from '../content/guide.mjs';
import { L, pageHeader, arrowLink, extLink } from './layout.mjs';
import { DEMO } from '../lib/demo.mjs';

const pick = (o, locale) => (o ? (o[locale] ?? o.en) : '');

/* All text a chapter contains, for the header search. */
function chapterText(c, locale) {
  const parts = [pick(c.title, locale), pick(c.intro, locale)];
  for (const b of c.blocks) {
    parts.push(pick(b.h, locale), pick(b.p, locale));
    for (const k of ['list', 'steps']) if (b[k]) parts.push(...pick(b[k], locale));
    if (b.table) for (const r of b.table.rows) parts.push(...r.map((x) => pick(x, locale)));
    for (const x of b.contacts || []) parts.push(pick(x.label, locale), pick(x.value, locale));
    for (const x of b.links || []) parts.push(pick(x.label, locale), x.href, pick(x.note, locale));
  }
  return parts.join(' \n ').toLowerCase();
}
const glossText = (g, locale) =>
  [g.term.en, g.term.zh, g.pinyin, pick(g.def, locale)].join(' ').toLowerCase();

/* Link the first mention of each glossary term in a chapter. Runs on already
   escaped text, and never inside a link it has already inserted. */
function withTerms(text, locale, used) {
  let out = esc(text);
  for (const g of GLOSSARY) {
    if (used.has(g.id)) continue;
    for (const m of g.match[locale] || []) {
      const needle = esc(m);
      const parts = out.split(/(<a [^>]*>.*?<\/a>)/);
      let done = false;
      for (let i = 0; i < parts.length && !done; i += 2) {
        const at = parts[i].indexOf(needle);
        if (at === -1) continue;
        parts[i] = parts[i].slice(0, at)
          + `<a class="app-term js-term" href="#g-${g.id}" data-term="${g.id}">${needle}</a>`
          + parts[i].slice(at + needle.length);
        done = true;
      }
      if (done) { out = parts.join(''); used.add(g.id); break; }
    }
  }
  return raw(out);
}

function block(b, { locale, t, used }) {
  const tx = (o) => withTerms(pick(o, locale), locale, used);
  const inner = h`
    ${b.h && !b.note ? h`<h3 class="app-chapter__h">${pick(b.h, locale)}</h3>` : raw('')}
    ${b.p && !b.note ? h`<p>${tx(b.p)}</p>` : raw('')}
    ${b.list ? h`<ul class="app-guide-list">${pick(b.list, locale).map((x) => h`<li>${withTerms(x, locale, used)}</li>`)}</ul>` : raw('')}
    ${b.steps ? h`<ol class="app-steps">${pick(b.steps, locale).map((x) => h`<li>${withTerms(x, locale, used)}</li>`)}</ol>` : raw('')}
    ${b.table ? h`<div class="app-table-wrap"><table class="app-table">
        <thead><tr>${pick(b.table.head, locale).map((x) => h`<th scope="col">${x}</th>`)}</tr></thead>
        <tbody>${b.table.rows.map((r) => h`<tr>${r.map((c, i) => i === 0
          ? h`<th scope="row">${pick(c, locale)}</th>` : h`<td>${withTerms(pick(c, locale), locale, used)}</td>`)}</tr>`)}</tbody>
      </table></div>` : raw('')}
    ${b.links ? h`<ul class="app-links">${b.links.map((l) => h`<li>
        ${extLink(l.href, pick(l.label, locale), t)}
        <span class="zl-caption">${l.href.replace(/^https?:\/\//, '')}${l.note ? h` · ${pick(l.note, locale)}` : raw('')}</span>
      </li>`)}</ul>` : raw('')}
    ${b.contacts ? h`<dl class="app-contacts">${b.contacts.map((c) => h`<div>
        <dt>${pick(c.label, locale)}</dt><dd>${pick(c.value, locale)}</dd></div>`)}</dl>` : raw('')}`;
  if (!b.note) return inner;
  return h`<div class="zl-alert zl-alert--${b.note === 'warning' ? 'warning' : 'info'} app-guide-note">
    <div class="zl-icon-ring ${b.note === 'warning' ? 'zl-icon-ring--alert' : ''}" aria-hidden="true">${b.note === 'warning' ? '!' : 'i'}</div>
    <div>
      ${b.h ? h`<b>${pick(b.h, locale)}</b>` : raw('')}
      ${b.p ? h`<p>${tx(b.p)}</p>` : raw('')}
      ${b.contacts ? h`<dl class="app-contacts app-contacts--inline">${b.contacts.map((c) => h`<div><dt>${pick(c.label, locale)}</dt><dd>${pick(c.value, locale)}</dd></div>`)}</dl>` : raw('')}
      ${b.linkTo === 'market' ? h`<div class="app-guide-note__actions">
          <a class="zl-btn zl-btn--secondary zl-btn--sm" href="${L(locale, '/search')}"><span>${t('section.market')}</span></a>
          <a class="zl-btn zl-btn--secondary zl-btn--sm" href="${L(locale, '/community/b/housing')}"><span>${t('section.community')}</span></a>
        </div>` : raw('')}
    </div>
  </div>`;
}

/* Type-ahead for the guidebook: chapters first, then glossary terms. */
export function guideSuggest(term, locale, limit = 6) {
  const needle = term.toLowerCase();
  const out = [];
  for (const c of CHAPTERS) {
    if (chapterText(c, locale).includes(needle))
      out.push({ label: pick(c.title, locale), icon: c.icon, href: `/${locale}/guide#${c.id}` });
    if (out.length >= limit) return out;
  }
  for (const g of GLOSSARY) {
    if (glossText(g, locale).includes(needle))
      out.push({ label: pick(g.term, locale), scope: pick(g.def, locale).slice(0, 44), href: `/${locale}/guide#g-${g.id}` });
    if (out.length >= limit) break;
  }
  return out;
}

export function guide({ locale, t, q = '' }) {
  const needle = q.trim().toLowerCase();
  const chapters = needle ? CHAPTERS.filter((c) => chapterText(c, locale).includes(needle)) : CHAPTERS;
  const byId = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
  const month = new Date(GUIDE_SOURCE.updated + '-01T00:00:00Z');
  const updated = month.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  // Glossary sorted in the reader's language: A–Z, or by pinyin for Chinese.
  const terms = [...GLOSSARY].sort((a, b) => locale === 'zh'
    ? (a.pinyin || a.term.en).localeCompare(b.pinyin || b.term.en, 'en')
    : a.term.en.localeCompare(b.term.en, 'en'));

  return h`<div class="app-guide">
    <nav class="app-guide__toc" aria-label="${t('guide.contents')}">
      <details class="app-toc js-toc" open>
        <summary class="app-toc__label zl-label">${t('guide.contents')}</summary>
        <ol class="app-toc__list">
          ${CHAPTERS.map((c) => h`<li><a class="app-toc__link js-toc-link" href="#${c.id}">
            <span class="app-toc__icon" aria-hidden="true">${c.icon}</span><span>${pick(c.title, locale)}</span></a></li>`)}
        </ol>
      </details>
    </nav>

    <div class="app-guide__main">
      <header class="app-guide__head">
        ${pageHeader({ title: t('guide.title'), description: t('guide.lede') })}
        <div class="app-source">
          <div class="app-source__text">
            <span class="zl-label">${t('guide.source')}</span>
            ${extLink(GUIDE_SOURCE.url, pick(GUIDE_SOURCE.title, locale), t, 'app-source__title')}
            <span class="zl-caption">${pick(GUIDE_SOURCE.publisher, locale)} · ${t('guide.updated', updated)}</span>
          </div>
          <p class="zl-caption app-source__note">${t('guide.disclaimer')}
            ${extLink(GUIDE_SOURCE.exchange, t('guide.exchange'), t)}</p>
        </div>
      </header>

      ${needle ? h`<div class="app-guide__results">
          <span>${raw(t('guide.results', chapters.length, esc(q)))}</span>
          <a class="zl-btn zl-btn--tertiary zl-btn--sm" href="${L(locale, '/guide')}"><span>${t('guide.clear')}</span></a>
        </div>` : raw('')}

      ${chapters.map((c) => {
        const used = new Set();
        return h`<section class="app-chapter" id="${c.id}" aria-labelledby="h-${c.id}">
          <h2 class="app-chapter__title" id="h-${c.id}"><span class="app-ico" aria-hidden="true">${c.icon}</span>${pick(c.title, locale)}</h2>
          <p class="app-chapter__intro">${withTerms(pick(c.intro, locale), locale, used)}</p>
          ${c.blocks.map((b) => block(b, { locale, t, used }))}
        </section>`;
      })}

      <div class="app-guide__foot">
        <p>${t('guide.feedback')}</p>
        ${DEMO ? raw('') : h`<a class="zl-btn zl-btn--secondary" href="${L(locale, '/community/new?board=paperwork&from=guide')}"><span>${t('guide.ask')}</span></a>`}
      </div>
    </div>

    <aside class="app-guide__glossary" aria-labelledby="glossaryTitle">
      <details class="app-gloss js-gloss" open>
        <summary class="app-gloss__head">
          <h2 class="app-side-card__title" id="glossaryTitle">${t('guide.glossary')}</h2>
          <span class="zl-caption">${terms.length}</span>
        </summary>
        <label class="zl-sr-only" for="glossFilter">${t('guide.gloss.filter')}</label>
        <input class="zl-input app-gloss__filter js-gloss-filter" id="glossFilter" type="search"
               placeholder="${t('guide.gloss.filter')}" autocomplete="off" value="${needle ? q : ''}">
        <dl class="app-gloss__list js-gloss-list">
          ${terms.map((g) => {
            const hidden = needle && !glossText(g, locale).includes(needle);
            const primary = pick(g.term, locale), secondary = locale === 'zh' ? g.term.en : g.term.zh;
            return h`<div class="app-gloss__item js-gloss-item" id="g-${g.id}" data-text="${glossText(g, locale)}"${hidden ? raw(' hidden') : raw('')}>
              <dt>${primary}${secondary && secondary !== primary ? h` <span class="app-gloss__alt" lang="${locale === 'zh' ? 'en' : 'zh-CN'}">${secondary}</span>` : raw('')}
                ${g.pinyin ? h`<span class="app-gloss__pinyin">${g.pinyin}</span>` : raw('')}</dt>
              <dd>${pick(g.def, locale)}
                ${byId[g.see] ? h` ${arrowLink(L(locale, '/guide') + '#' + g.see, t('guide.gloss.see'), 'app-gloss__see')}` : raw('')}</dd>
            </div>`;
          })}
        </dl>
        <p class="zl-caption js-gloss-none"${needle && !terms.some((g) => glossText(g, locale).includes(needle)) ? raw('') : raw(' hidden')}>${t('guide.gloss.none')}</p>
      </details>
    </aside>
  </div>`;
}
