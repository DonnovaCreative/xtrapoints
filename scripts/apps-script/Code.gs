/**
 * =============================================================================
 * XtraPoint — waitlist capture (donor + ambassador) → Google Sheets.
 *
 * This file is the SOURCE OF TRUTH for the Apps Script behind the waitlist
 * workbook. It is checked in because code that only exists inside a Google
 * account is code nobody can review, diff, or restore.
 *
 * It is called only by the site's server route (src/pages/api/lead.ts) — never
 * by a browser. See src/lib/leadSheet.ts for the calling side.
 *
 * -----------------------------------------------------------------------------
 * DEPLOYING (about five minutes)
 *
 *  1. Open the workbook → Extensions → Apps Script.
 *  2. Paste this file over Code.gs.
 *  3. Set SHEET_ID below to the workbook id (the long string in its URL:
 *     docs.google.com/spreadsheets/d/<THIS PART>/edit).
 *  4. Set SECRET to a long random string. Generate one: openssl rand -hex 24
 *  5. Deploy → New deployment → type "Web app".
 *       Execute as:      Me
 *       Who has access:  Anyone            <-- required; SECRET is the real guard
 *  6. Authorize when prompted, then copy the /exec URL.
 *  7. Put both values in the site's environment (.env locally, Vercel for
 *     Production + Preview):
 *       SHEETS_WEBHOOK_URL = the /exec URL
 *       SHEETS_SECRET      = the same SECRET as below
 *
 * RE-DEPLOYING AFTER AN EDIT: Deploy → Manage deployments → edit the existing
 * deployment → Version: New version. Creating a *new* deployment instead gives
 * you a different /exec URL and the site keeps posting to the old one.
 * -----------------------------------------------------------------------------
 */

/** Workbook id — the long string in the spreadsheet URL. */
var SHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';

/** Must match SHEETS_SECRET in the site's environment. */
var SECRET = 'PASTE_A_LONG_RANDOM_SECRET_HERE';

/** Tab name suffix per form type. */
var KIND = {
  donor: 'Donors',
  ambassador: 'Ambassadors',
  contact: 'Contact'
};

var HEADERS = [
  'Timestamp',
  'First name',
  'Last name',
  'Email',
  'Phone',
  'School',
  'Organization',
  'Organization type',
  'Message',
  'Source',
  'Page URL'
];

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respond({ ok: false, error: 'Empty request body.' });
    }

    var body = JSON.parse(e.postData.contents);

    // The deployment must be world-reachable for the site to POST to it, so this
    // shared secret is what actually stops strangers writing to the sheet.
    if (!body.secret || body.secret !== SECRET) {
      return respond({ ok: false, error: 'Unauthorized.' });
    }

    var sheet = tabFor(body.school, body.type);

    sheet.appendRow([
      new Date(),
      body.firstName || '',
      body.lastName || '',
      body.email || '',
      body.phone || '',
      body.school || '',
      body.organization || '',
      body.orgType || '',
      body.message || '',
      body.source || '',
      body.page || ''
    ]);

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

/**
 * Find (or create) the tab for one school + form type, e.g.
 * "University at Albany — Ambassadors".
 *
 * Auto-creating is the point: launching school #2 needs no spreadsheet setup at
 * all, and no one has to remember to add tabs before a campaign goes live.
 */
function tabFor(school, type) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var kind = KIND[type] || 'Other';
  var name = (school || 'Unassigned') + ' — ' + kind;

  // Sheet names cap at 100 chars; a long school name would otherwise throw.
  if (name.length > 99) name = name.substring(0, 99);

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setColumnWidth(1, 160);
  }
  return sheet;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Health check. Visiting the /exec URL in a browser should say the script is
 * alive without revealing anything or writing a row.
 */
function doGet() {
  return respond({ ok: true, service: 'xtrapoint-waitlist' });
}
