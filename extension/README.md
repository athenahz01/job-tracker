# Job Tracker Extension

Manifest V3 Chrome extension for saving job applications to the web API.

## Load locally

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Choose Load unpacked.
4. Select `C:\AA_Projects\job-tracker\extension`.
5. Open the extension options.
6. Set the API base URL, for example `http://localhost:3000`.
7. Set the same shared secret used by `EXTENSION_API_SECRET`.

## Use

The popup saves the current job page with one click. Save adds the job to the Saved column so you can apply later. If the company cannot be found, it asks for the company before posting.

The job becomes Applied when you submit it or when an email confirms the application. Greenhouse, Lever, Ashby, and Workday content scripts look for a submitted application confirmation before posting automatically. A broad posting-capture content script also watches job pages for confident title plus salary or location signals so the app can enrich later application rows. This personal unpacked extension uses broad host access for that cache, and it ignores thank-you and submitted confirmation pages.

The extension stores a short recent URL memory in `chrome.storage.local` so refreshes and repeat clicks do not post the same job again.

Source values:

- Popup one-click and ATS auto-detect use `extension`.
- Generic submitted-page confirmation uses `extension_heuristic`.

The shared secret is stored in Chrome local extension storage. That is fine for this personal tool, but it is not a true secret once it lives in a browser.
