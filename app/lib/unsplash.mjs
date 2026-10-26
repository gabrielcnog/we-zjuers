/* ============================================================
   Unsplash display helpers — the parts of the API guidelines that
   live in the views. https://help.unsplash.com/en/articles/2511245

   1. Hotlink: images load from images.unsplash.com, never re-hosted.
      Sizing is done with imgix params on photo.urls.raw, which keeps
      the `ixid` parameter Unsplash uses to count views.
   2. Attribution: "Photo by <photographer> on Unsplash", both linked,
      both carrying utm_source=<app name>&utm_medium=referral.

   The download-endpoint trigger (3rd rule) is in fetch-photos.mjs,
   because it fires when a photo is put on a listing, not per view.
   ============================================================ */

const HOST = 'https://images.unsplash.com/';
const appName = () => process.env.UNSPLASH_APP_NAME || 'listings_zju';

export const isUnsplash = (src) => typeof src === 'string' && src.startsWith(HOST);

/* Append the referral params without touching anything already there. */
export function utm(href) {
  const u = new URL(href);
  u.searchParams.set('utm_source', appName());
  u.searchParams.set('utm_medium', 'referral');
  return u.href;
}

export const unsplashHome = () => utm('https://unsplash.com/');

/* Size an image for a slot. Uploaded photos (/img/:id) pass through;
   Unsplash URLs get a 4:3 crop at 2x the CSS size for sharp retina. */
export function sized(src, w, h) {
  if (!isUnsplash(src)) return src;
  const u = new URL(src);                       // keeps ixid and every raw param
  for (const [k, v] of Object.entries({ w: w * 2, h: h * 2, fit: 'crop', crop: 'entropy', q: 70, auto: 'format' }))
    u.searchParams.set(k, String(v));
  return u.href;
}

/* A card is 158px wide on a phone and 270px on a desktop feed, but every
   layout was asking for the desktop 2x file — about five times the pixels a
   phone can show. srcset + sizes lets the browser pick; `sizes` describes the
   slot, not the image. Uploaded photos have one size, so they get no srcset. */
/* Three widths, not six: every entry is a ~180-character URL repeated on
   every image, and on a 52-card feed that markup costs more than the bytes
   the extra steps save. */
const WIDTHS = [240, 400, 640];
export function srcset(src, ratio = 4 / 3) {
  if (!isUnsplash(src)) return '';
  return WIDTHS.map((w) => {
    const u = new URL(src);
    for (const [k, v] of Object.entries({ w, h: Math.round(w / ratio), fit: 'crop', crop: 'entropy', q: 70, auto: 'format' }))
      u.searchParams.set(k, String(v));
    return `${u.href} ${w}w`;
  }).join(', ');
}
