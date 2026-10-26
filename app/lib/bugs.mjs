/* Bug reports: store, then forward to a Google Sheet.

   The spreadsheet is reached through a Google Apps Script web app (setup in
   docs/bug-reports.md). The server posts to it; the browser never does, so the
   script's address and its shared token stay in the environment and out of the
   page and the repository.

     BUG_SHEET_URL    the web app's /exec address
     BUG_SHEET_TOKEN  a shared secret the script checks, so a leaked address
                      alone cannot be used to write to the sheet

   Neither set: reports are still saved here, and nothing is forwarded. */
import { q, one, run, uid, now } from '../db.mjs';

const URL_ = process.env.BUG_SHEET_URL || '';
const TOKEN = process.env.BUG_SHEET_TOKEN || '';
export const SHEET_CONFIGURED = !!URL_;

export const KINDS = ['broken', 'looks', 'translation', 'other'];
export const LIMITS = { summary: 120, details: 2000, expected: 1000, page: 200, email: 120 };
const MAX_ATTEMPTS = 5;

export async function saveBug(d) {
  const id = uid();
  await run(
    `INSERT INTO bug_report (id, created_at, kind, summary, details, expected, page, email, locale, user_agent, signed_in)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, now(), d.kind, d.summary, d.details, d.expected || null, d.page || null, d.email || null,
     d.locale, (d.userAgent || '').slice(0, 300), d.signedIn]);
  return id;
}

/* One attempt to deliver a stored report. Records the outcome either way. */
export async function forwardBug(id) {
  if (!SHEET_CONFIGURED) return 'unconfigured';
  const r = await one('SELECT * FROM bug_report WHERE id = $1 AND forwarded_at IS NULL', [id]);
  if (!r) return 'done';
  await run('UPDATE bug_report SET forward_attempts = forward_attempts + 1 WHERE id = $1', [id]);
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: TOKEN, id: r.id, time: new Date(r.created_at).toISOString(), kind: r.kind,
        summary: r.summary, details: r.details, expected: r.expected || '', page: r.page || '',
        email: r.email || '', locale: r.locale || '', browser: r.user_agent || '', signedIn: r.signed_in || '',
      }),
      redirect: 'follow',                       // Apps Script answers through a 302
      signal: AbortSignal.timeout(10_000),
    });
    /* A 200 is not enough: Apps Script returns 200 with an error page when the
       token is wrong or the script threw. The script says {"ok":true} on
       success, so that is what counts. */
    const body = await res.text();
    let ok = false;
    try { ok = res.ok && JSON.parse(body).ok === true; } catch { ok = false; }
    if (!ok) throw new Error(`sheet answered ${res.status}: ${body.replace(/\s+/g, ' ').slice(0, 120)}`);
    await run('UPDATE bug_report SET forwarded_at = $1 WHERE id = $2', [now(), id]);
    return 'sent';
  } catch (e) {
    console.error('[bug-sheet]', id, e.message);
    return 'failed';
  }
}

/* Hourly: try again for anything that did not make it, a few times each. */
export async function retryUnforwarded() {
  if (!SHEET_CONFIGURED) return 0;
  const rows = await q(
    `SELECT id FROM bug_report WHERE forwarded_at IS NULL AND forward_attempts < $1
      ORDER BY created_at LIMIT 20`, [MAX_ATTEMPTS]);
  let n = 0;
  for (const r of rows) if (await forwardBug(r.id) === 'sent') n++;
  return n;
}
