# GifGo Backlog

Feature ideas not in the current release. Ordered by how much each shortens the
core loop: urge → find → paste.

## In review

v2.0 is submitted to both the Chrome Web Store and Edge Add-ons. Nothing to
do but wait. Once approved, tag the release commit. If a reviewer comes back
with questions, the permission justifications and test instructions they were
given are in `dev/store-listing.md`.

## Now: finish the Klipy release

Klipy (klipy.com/developers, docs.klipy.com) is free: test keys are limited to
100 req/hour like Giphy dev keys, but **production keys are unlimited** (their
model monetizes with optional ad content, not API fees).

The extension talks to Klipy directly, and always will. A proxy holding the key
server-side and caching responses is off the table: Klipy's integration
requirements say requests have to originate from the end user's browser, and
proxies, intermediaries and partner-operated caches each need written approval
first. Their app key is a URL path segment meant to be visible in the client,
so a proxy was never buying secrecy; it would only have moved the abuse surface
onto an open endpoint of ours to rate-limit and pay for.

Shipped, live, and in the commit log if the detail is ever needed: the Klipy
adapter and provider setting, Klipy as the default for new installs while
upgraders keep Giphy, provider-namespaced favorites and usage, shared-key
delivery from `gifgo.app/config.json` on a daily refresh, and the web app
itself at gifgo.app, PWA installable and redeployed from `server/` on every
push to main.

Left to do:

- **Bump `manifest.json`.** It still reads 2.0, which is the build sitting in
  review. Nothing above can be submitted until that moves.
- Request Klipy production access through the Partner Panel. That wanted a
  live site and a demo video first; the site is done, the video is not. It
  lifts the 100/hour ceiling, after which `liveSearch` can default on for
  Klipy.
- Verify the adapter against a real Klipy response from inside the extension
  itself, rather than the harness mock and a standalone curl.
- Exercise the 401/403 refresh-and-retry against an actual key rotation.
- A 512px PWA icon (only the 128px extension one exists), and offline caching
  in `server/sw.js`: it installs, but it is not offline-capable.
- Port this session's UI changes into `dev/gifgo-demo.html` and republish the
  artifact, which is now well behind the real thing.

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
