# GifGo Backlog

Feature ideas not in the current release. Ordered by how much each shortens the
core loop: urge → find → paste.

## In review

v2.0 is submitted to both the Chrome Web Store and Edge Add-ons. Nothing to
do but wait. Once approved, tag the release commit. If a reviewer comes back
with questions, the permission justifications and test instructions they were
given are in `dev/store-listing.md`.

## Now: move to Klipy, then the web app

Klipy (klipy.com/developers, docs.klipy.com) is free: test keys are limited to
100 req/hour like Giphy dev keys, but **production keys are unlimited** (their
model monetizes with optional ad content, not API fees). Account and test key
are in hand.

The plan here used to be a proxy service that held the key server-side and
cached responses in front of it. That is off the table. Klipy's integration
requirements say API requests have to originate from the end user's browser
or app, and that proxies, intermediaries and partner-operated caches each
need written approval first. Their app key is a URL path segment and is meant
to be visible in the client, so the proxy was never buying secrecy: it would
only have moved the abuse surface off Klipy's infrastructure and onto an open
endpoint of ours, which we would then have to rate-limit and pay for. Not
worth building, and not worth asking permission to build.

So the extension talks to Klipy directly. **Done as of 2026-08-16:**

- Klipy adapter in `js/api.js`, alongside the Giphy one: `searchGifs`,
  `trendingGifs`, and `validateKey` all take a provider argument now and
  normalize each provider's response internally. A 401/403 from Klipy
  triggers one `refreshKlipyKey()` + retry before giving up.
- Provider setting: "Klipy (no key needed)" vs "Giphy (your own key)" in
  settings. Existing installs stay on Giphy by default (nothing changes for
  them unless they switch); new installs also default to Giphy for now,
  flip `DEFAULT_SETTINGS.provider` in `js/storage.js` to `'klipy'` once
  ready to make it the primary experience.
- "Search KLIPY" placeholder and a "Powered by KLIPY" footer link (the
  watermark is optional per Klipy's docs, added anyway for parity with the
  Giphy attribution).
- Key delivery (`js/remoteConfig.js` + `js/background.js`, config.json on
  `gifgo.app`): live, holding the real test key as of 2026-08-16.

Still open:

- Request production access through the Partner Panel form once the
  integration is tested; the test key's 100/hour is the same ceiling that
  keeps `liveSearch` off today. Flip the `liveSearch` default to on for the
  Klipy provider once the production key is live. Needs a live site and a
  demonstration video first (in progress, see below).
- Verify the adapter against a real Klipy response from inside the
  extension itself, not just the harness's mocked shape (dev/notes/klipy-api.md)
  and the earlier standalone `curl`.

Then the web app, which none of the above changes:

- The popup UI already runs in a plain browser page, so serve it as a site
  with a web manifest. Installed as a PWA it pins to the taskbar and runs in
  its own window; this is the taskbar story for locked-down corporate
  machines that block installing unsigned executables.
- Lives in this repo under `server/`, now just a static host for those assets
  and no API in front of them (serving our own files is not proxying). It
  reuses the root `js/` and `css/` rather than copying them; one repo, no
  mirror drift. Split it out only if it ever needs to be private or grows its
  own release cadence.
- `server/` exists today holding only `config.json` (the key-delivery file
  above); the popup port and PWA manifest are still unbuilt. It's live: a
  `gifgo` Cloudflare Worker with static assets (not a Pages project;
  Cloudflare's dashboard creates static sites as Workers-with-assets now)
  serves it at the `gifgo.app` custom domain, deployed by
  `.github/workflows/deploy-server.yml` via `wrangler.toml` on every push to
  main that touches `server/**` or `wrangler.toml`.

## Then: Windows tray app (the flagship)

A small native host for the same UI: tray icon, global hotkey, popup window
near the tray. The reason it earns flagship status is the clipboard: a native
app can put the actual .gif on the clipboard as a file, alongside the HTML,
PNG, and URL flavors. Paste targets that only accept file/image data on paste
(Discord, and any plain upload box) then receive the animated GIF itself,
which no browser-based tool can offer.

- Leanest Windows-only host: a small C# app embedding WebView2 (ships with
  Windows 11). No npm, no bundler; the popup HTML/CSS/JS ports nearly
  verbatim with a thin shim replacing `chrome.storage` and the clipboard
  calls. Tauri is the fallback if Mac support is ever wanted.
- Native clipboard writes CF_HDROP (temp .gif file) + CF_HTML + PNG + text.
- Distribution caveat: unsigned executables trip SmartScreen; the PWA above
  stays as the frictionless channel.

## Tier 2: library compounding

- **Frecency sorting**: weight use counts by recency instead of raw totals.
- **Tag autocomplete**: suggest existing tags while typing to keep the tag
  vocabulary consistent; clickable tag chips filter the favorites view.
- **Export / import favorites**: JSON backup; sync is not a backup.

## Tier 3: reach beyond the popup

- **Omnibox keyword**: `gif <search>` in the address bar, Enter copies.
- **Context menu**: right-click any image on any page → "Save to GifGo
  favorites".
- **Drag-to-chat**: drag a tile straight into a compose box.
- **GIPHY stickers**: transparent-background stickers endpoint, same key.

## Smaller ideas

- Pagination / infinite scroll (`offset` param).
- Random / "surprise me" button (Giphy random endpoint).
- Full options page (`options_ui`) if the settings surface keeps growing.
- Local cache of recent searches to soften API rate limits.

## Dead ends

- **Tenor as a second provider**: Google shut down the public Tenor API
  (confirmed 2026). If a second source is ever wanted, candidates would need
  re-evaluation at the time.
- **Mobile (iOS/Android)**: the GIF flow on mobile belongs to the OS
  keyboard; competing there means building custom keyboards against Gboard.
  Not worth it for this project.
