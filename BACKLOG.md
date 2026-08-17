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

So the extension talks to Klipy directly:

- Klipy adapter in `js/api.js`, alongside the Giphy one. The provider seam
  already exists; the response mapping is worked out and the key goes in the
  URL path rather than the query string.
- Provider setting: "Klipy (no key needed)" vs "My own Giphy key". A privacy
  escape hatch, and the failover if the shared key is ever revoked.
- **Attribution is required**: "Search KLIPY" as the search placeholder
  whenever Klipy is the provider. The Giphy logo link stays for Giphy.
- Request production access through the Partner Panel form once the
  integration is tested; the test key's 100/hour is the same ceiling that
  keeps `liveSearch` off today. Flip the `liveSearch` default to on for the
  Klipy provider once the production key is live.
- **Key delivery: mostly built.** `js/remoteConfig.js` resolves the shared
  Klipy key through the fallback chain (fetched from `gifgo.app/config.json`,
  then the copy cached in `chrome.storage.local`, then a constant baked into
  the build), and `js/background.js` refreshes it on a daily `chrome.alarms`
  timer. `manifest.json` and `PRIVACY.md` already cover the new host and the
  `alarms` permission. What's still open: the Klipy adapter needs to call
  `refreshKlipyKey()` and retry once on any 401/403, so a revoked key heals
  itself (no code exists yet to wire that, since the adapter doesn't exist
  yet); `server/config.json` is a placeholder (`klipyAppKey: ""`) until a
  production key exists to put in it; and the file isn't live anywhere until
  the static host is deployed (below).

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
  above); the popup port and PWA manifest are still unbuilt. Nothing is
  deployed anywhere yet: still needs a Cloudflare Pages project, the
  `CLOUDFLARE_API_TOKEN` repo secret (JP), and the GitHub Actions deploy job.

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
