/* Escaping and tiny template helpers. Everything user-supplied goes through
   esc(); there is no raw-HTML escape hatch for user content anywhere. */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

/* Tagged template that escapes every interpolation by default.
   Pass raw(x) to opt out — used only for markup this codebase generated. */
const RAW = Symbol('raw');
export const raw = (s) => ({ [RAW]: String(s) });
export function h(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    out += (v && v[RAW] !== undefined ? v[RAW]
         : Array.isArray(v) ? v.map((x) => (x && x[RAW] !== undefined ? x[RAW] : esc(x))).join('')
         : esc(v)) + strings[i + 1];
  }
  return raw(out);
}
export const html = (v) => (v && v[RAW] !== undefined ? v[RAW] : esc(v));

export function money(cents) {
  return '¥' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/* Relative time, in the reader's language. */
export function ago(iso, t) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return t('time.now');
  const m = Math.floor(s / 60); if (m < 60) return t('time.min', m);
  const hr = Math.floor(m / 60);  if (hr < 24) return t('time.hour', hr);
  const d = Math.floor(hr / 24);  if (d < 30) return t('time.day', d);
  return t('time.month', Math.floor(d / 30));
}
/* Arrays become repeated params (?campus=a&campus=b) so multi-select facets
   round-trip through the URL without any encoding scheme of their own. */
export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.filter((x) => x !== '' && x != null).forEach((x) => p.append(k, x));
    else if (v !== '' && v != null) p.set(k, v);
  }
  const s = p.toString(); return s ? '?' + s : '';
};
