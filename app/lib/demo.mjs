/* Read-only demo mode.

   DEMO_MODE=1 makes the site safe to put in front of strangers:

     - Nobody can create an account. Email sign-in is refused outright. That
       also closes a second hole: the sign-in code is shown on screen (there is
       no mail sender), so on a public site anyone could sign in as ANY seeded
       user, organisers included, by typing their address.
     - Visitors get one button that signs them in as a dedicated demo student.
     - That account can look at everything and change nothing. The rule is
       enforced in ONE place, as an allowlist of writes, rather than by
       remembering to guard each route: a route added next month is read-only
       by default, and a forgotten guard is a refusal, not a hole.

   The demo account is shared by every visitor, which is the other reason
   writes are off: one stranger's post, vote or saved item would be shown to
   the next. */
import { one, run, uid, now } from '../db.mjs';

export const DEMO = process.env.DEMO_MODE === '1';
export const PROD = process.env.NODE_ENV === 'production';

/* .invalid is reserved (RFC 2606): it can never be a real mailbox, so this
   address cannot be reached by the email flow even if it were switched on. */
export const DEMO_EMAIL = 'demo@wezjuers.invalid';

/* A demo session is a day, not the 30 a real one gets. */
export const DEMO_SESSION_DAYS = 1;

/* The only things a demo visitor may POST. Revealing a WeChat handle is a read
   in all but HTTP verb, and the handles in the sample data are made up. */
const ALLOWED_POSTS = [
  /^\/(en|zh)\/signout$/,
  /^\/(en|zh)\/signin$/,                          // only step=demo gets past the handler
  /^\/(en|zh)\/listing\/[0-9a-f-]{36}\/wechat$/i,
];

/* Pages that exist only to compose something. Showing the form to someone who
   cannot submit it is a trap, so these are refused on GET as well. */
const COMPOSE_PAGES = [
  /^\/(en|zh)\/post$/,
  /^\/(en|zh)\/community\/new$/,
  /^\/(en|zh)\/events\/new$/,
];

/* Returns 'write' or 'compose' if this request should be refused, else null. */
export function refusal(method, pathname) {
  if (!DEMO) return null;
  if (method === 'GET' || method === 'HEAD') {
    return COMPOSE_PAGES.some((re) => re.test(pathname)) ? 'compose' : null;
  }
  return ALLOWED_POSTS.some((re) => re.test(pathname)) ? null : 'write';
}

/* Create the demo account if it is missing. Idempotent: runs on every boot. */
export async function ensureDemoUser() {
  const found = await one('SELECT id FROM "user" WHERE email = $1', [DEMO_EMAIL]);
  if (found) return found.id;
  const id = uid();
  await run(
    `INSERT INTO "user" (id,email,email_verified_at,is_zju_verified,display_name,family_name,given_name,
                         home_campus,role,created_at,last_seen_at)
     VALUES ($1,$2,$3,TRUE,'Demo Student','Student','Demo','zijingang','user',$3,$3)`,
    [id, DEMO_EMAIL, now()]);
  return id;
}
