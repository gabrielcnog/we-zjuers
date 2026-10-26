/* Sessions and email-code sign-in.
   Codes and session tokens are hashed before storage — a leaked database must
   not hand over live credentials (docs/infrastructure.md 4.2). */
import { q, one, run, uid, now, sha256, token } from '../db.mjs';
import { randomInt } from 'node:crypto';

const CODE_TTL_MIN = 10, MAX_ATTEMPTS = 5, SESSION_DAYS = 30;
const ZJU_DOMAINS = ['zju.edu.cn', 'stu.zju.edu.cn', 'intl.zju.edu.cn'];
export const isZjuEmail = (e) => ZJU_DOMAINS.some((d) => e.toLowerCase().endsWith('@' + d));

/* Simple in-memory rate limiter. Production uses a shared store; the shape of
   the rule is what matters here. */
const hits = new Map();
export function rateLimit(key, max, windowMs) {
  const t = Date.now(), rec = hits.get(key);
  if (!rec || t > rec.reset) { hits.set(key, { n: 1, reset: t + windowMs }); return true; }
  if (rec.n >= max) return false;
  rec.n++; return true;
}

export async function requestCode(email) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await run('DELETE FROM login_code WHERE email = $1 AND consumed_at IS NULL', [email]);
  await run(`INSERT INTO login_code (id,email,code_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,$5)`,
    [uid(), email, sha256(code), new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(), now()]);
  return code;   // PROTOTYPE: returned to the caller and shown on screen. Production: emailed only.
}

export async function verifyCode(email, code) {
  const rec = await one(
    `SELECT * FROM login_code WHERE email = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC LIMIT 1`, [email]);
  if (!rec) return null;
  if (new Date(rec.expires_at) < new Date()) return null;
  if (rec.attempts >= MAX_ATTEMPTS) return null;
  await run('UPDATE login_code SET attempts = attempts + 1 WHERE id = $1', [rec.id]);
  if (rec.code_hash !== sha256(String(code))) return null;
  await run('UPDATE login_code SET consumed_at = $1 WHERE id = $2', [now(), rec.id]);
  return rec;
}

export async function findOrCreateUser(email, displayName) {
  const found = await one('SELECT * FROM "user" WHERE email = $1', [email]);
  if (found) {
    await run('UPDATE "user" SET last_seen_at = $1, email_verified_at = COALESCE(email_verified_at, $1) WHERE id = $2',
      [now(), found.id]);
    return found;
  }
  const id = uid();
  await run(`INSERT INTO "user" (id,email,email_verified_at,is_zju_verified,display_name,created_at,last_seen_at)
             VALUES ($1,$2,$3,$4,$5,$6,$6)`,
    [id, email, now(), isZjuEmail(email), displayName || email.split('@')[0], now()]);
  return one('SELECT * FROM "user" WHERE id = $1', [id]);
}

export async function createSession(userId, days = SESSION_DAYS) {
  const t = token();
  await run('INSERT INTO session (id,user_id,token_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,$5)',
    [uid(), userId, sha256(t), new Date(Date.now() + days * 864e5).toISOString(), now()]);
  return t;
}
export async function userForToken(t) {
  if (!t) return null;
  /* The unread-message count rides along as a column: asking for it separately
     was a second round trip on every signed-in page, which is the expensive
     part when the database is in another city. */
  return (await one(
    `SELECT u.*,
            (SELECT COUNT(*)::int FROM message m JOIN conversation c ON c.id = m.conversation_id
              WHERE (c.buyer_id = u.id OR c.seller_id = u.id) AND m.sender_id <> u.id AND m.read_at IS NULL) AS unread
       FROM session s JOIN "user" u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`, [sha256(t)])) || null;
}
export const destroySession = (t) =>
  t ? run('DELETE FROM session WHERE token_hash = $1', [sha256(t)]) : Promise.resolve(0);

export const COOKIE = 'zl_session';
/* HttpOnly: JavaScript can't read it. SameSite=Lax: not sent on cross-site POSTs.
   Secure cannot be set on http://localhost — the browser drops the cookie and
   sign-in silently stops working — but leaving it off anywhere else means the
   session token travels in clear on the first http request and can be stolen.
   So it is decided by the environment rather than left as a note to remember:
   NODE_ENV=production (or SECURE_COOKIES=1) turns it on. */
const SECURE = process.env.SECURE_COOKIES === '1'
  || process.env.NODE_ENV === 'production';
const FLAGS = `Path=/; HttpOnly; SameSite=Lax${SECURE ? '; Secure' : ''}`;
export function setCookie(res, value, maxAgeDays = SESSION_DAYS) {
  res.setHeader('Set-Cookie',
    `${COOKIE}=${value}; ${FLAGS}; Max-Age=${maxAgeDays * 86400}`);
}
export const clearCookie = (res) =>
  res.setHeader('Set-Cookie', `${COOKIE}=; ${FLAGS}; Max-Age=0`);
export function readCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
