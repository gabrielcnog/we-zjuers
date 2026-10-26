# Bug reports to a Google Sheet

The footer's **Report a bug** page stores every report in the database, then
forwards it to a Google Sheet. The server does the forwarding; the browser never
talks to Google. If Google is slow or down nothing is lost: the report stays in
the database and is retried hourly (up to five times).

Reports work without any of this. Until you set the two variables below they are
simply stored, and nothing is forwarded.

## One-time setup (about five minutes)

1. Create a new Google Sheet. Name it whatever you like.
2. In it: **Extensions → Apps Script**. Delete what is there and paste the script
   below.
3. In the script, replace `CHANGE-ME` with a long random string. This is your
   shared secret.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Authorise it when asked, then copy the **Web app URL** (ends in `/exec`).
5. Set two environment variables on the server (on Render: your service →
   Environment):

   | Variable | Value |
   |---|---|
   | `BUG_SHEET_URL` | the `/exec` URL from step 4 |
   | `BUG_SHEET_TOKEN` | the same random string as in step 3 |

6. Restart the service and send a test report from the footer.

"Anyone" has to be selected, because the server calling it is not signed in to
Google. The token is what stops other people writing to your sheet: the script
ignores any request that does not carry it. Keep the URL and the token out of
the repository.

## The script

```javascript
const TOKEN = 'CHANGE-ME';           // must match BUG_SHEET_TOKEN on the server
const SHEET = 'Reports';             // created automatically on first report
const HEADERS = ['Time', 'ID', 'Type', 'Summary', 'What happened', 'Expected',
                 'Page', 'Email', 'Language', 'Browser', 'Signed in'];

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: 'bad token' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);            // two reports at once must not share a row
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
      if (sh.getLastRow() === 0) {
        sh.appendRow(HEADERS);
        sh.setFrozenRows(1);
      }
      // A retry after a timeout can arrive twice: the ID makes that harmless.
      const ids = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
      if (ids.indexOf(d.id) !== -1) return out({ ok: true, duplicate: true });

      const row = [d.time, d.id, d.kind, d.summary, d.details, d.expected,
                   d.page, d.email, d.locale, d.browser, d.signedIn];
      const r = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
      // Plain text, always. Without this a report that begins with = or + is
      // evaluated as a formula, which lets whoever fills in the form run
      // formulas in your sheet.
      r.setNumberFormat('@').setValues([row.map(String)]);
    } finally {
      lock.releaseLock();
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
```

If you change the script later, use **Deploy → Manage deployments → Edit →
New version**. Saving alone does not update the live web app.

## What the sheet contains

Time, report ID, type, summary, what happened, what was expected, page, email,
language, browser, and whether the reporter was signed in. The email is optional
and is the only personal data in a report: say so in your privacy notice if you
publish one, and treat the sheet accordingly (do not share it widely).

## How it is protected

The page is open to anyone, including signed-out visitors and the demo account,
so it carries more defences than a form behind a login would: a hidden honeypot
field that quietly drops bots, 5 reports per visitor per hour and 100 overall,
length limits on every field, and the shared token on the Google side.
`X-Forwarded-For` is only trustworthy behind the host's proxy, so the overall
cap, not the per-visitor one, is what bounds a determined flood.
