# C&J Aviation — Bench Stock

The bench-stock inventory app as its own website, hosted on GitHub Pages, with
the QR label generator built in as a tab.

The Google Sheet is still the database and the Apps Script still does the work.
What changed is the front end: instead of Apps Script serving the HTML, the page
is served from this repo and talks to the script over a small JSON API.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The page shell — PIN gate, header, tabs |
| `app.js` | The whole app: parts, reorder, labels, year-end, manage |
| `styles.css` | Ported straight from the Apps Script version, so it looks the same |
| `config.js` | The one file you edit — the API URL |
| `vendor/qrcode.min.js` | QR generation, vendored so labels work on bad hangar wifi |
| `Api.gs` | **Not part of the website.** Paste this into Apps Script (see below) |
| `LOGO.png` | Same file as the public site, so the badge matches |

## Setup

### 1. Apps Script side

1. Open the Benchstock Apps Script project.
2. **Add a new file** called `Api.gs` and paste in the contents of `Api.gs`
   from this repo. Do not paste it over `Code.gs` — nothing in `Code.gs`
   changes, and overwriting it is how functions have gone missing before.
3. Run `apiSetup()` once. The execution log prints the shop PIN.
4. Deploy → New deployment → Web app:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the `/exec` URL.
6. Optional but recommended: run `installApiBackupTrigger()` for a nightly
   copy of the sheet. It needs Drive permission the first time.

"Anyone" looks alarming and isn't. A static page cannot call a login-required
Apps Script — the request gets redirected to Google sign-in and the browser
blocks it. The endpoint is open; every request still has to carry a token the
script issued, and it will only run the eleven actions on its allow-list.

### 2. Website side

1. Paste the `/exec` URL into `API_URL` in `config.js`.
2. Push to GitHub, Settings → Pages → deploy from `main`.
3. For `benchstock.cjaviationtn.org`: add a CNAME record at Squarespace
   pointing to `cjaviationtn.github.io`, then put the hostname in Pages →
   Custom domain. No nameserver change, so the Apple Business mail records
   are untouched.

### 3. Phones

Open the site, enter the PIN once, then Share → Add to Home Screen.
The PIN is stored as a token on that phone and doesn't need re-entering.

## Security notes

- The API URL is in `config.js`, which is served to every visitor. That is
  fine and unavoidable — anything a browser can call is public. The token is
  the control, not the URL.
- **No PIN or token is ever committed to this repo.** Both live in Script
  Properties on the Apps Script side.
- Only `doPost` changes data. Nothing mutates on a GET, so crawlers and link
  previews can't trigger a write by fetching a URL.
- `doPost` will not accept a function name from the caller. It looks the
  action up in a fixed table, so the endpoint can't be used to reach anything
  else in the account.
- Every write is logged with a timestamp to a hidden `Web Log` tab.
- Lost phone: run `apiRotateToken()` in the editor. Every device is signed
  out and has to enter the PIN again.

## QR labels

The Labels tab replaces the old `Labels.html`. The difference is where the
codes point: they used to open a Google Form, and now they open this site at
`?p=<part number>`, which lands on that part's card with take/add ready.
Scan, tap, done — no form.

Print from the Labels tab. The print stylesheet drops the header and controls
and lays the labels out three across.

## Working on it

It's plain HTML/CSS/JS with no build step. Edit, commit, push.
