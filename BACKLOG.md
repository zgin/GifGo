# GifGo Backlog

Feature ideas not in the current release. Ordered by how much each shortens the
core loop: urge → find → paste.

## Now: Chrome Web Store v2 release

Screenshots, listing copy, privacy policy and the pack script are done. What
is left needs a browser and a developer account:

- Merge `feature/v2-overhaul` to `main` and push, so the PRIVACY.md link
  used by both store listings resolves.
- Load `dist/gifgo-2.0.zip` unpacked in real Chrome and check the parts the
  harness cannot: clipboard copies (link and image), the Alt+Shift+G
  shortcut, and favorites syncing across profiles.
- Submit to the Chrome Web Store, then to Edge Add-ons.
- Tag the release commit once approved.

## Next: GifGo server (Klipy proxy) and web app

Klipy (klipy.com/developers, docs.klipy.com) is free: test keys are limited to
100 req/hour like Giphy dev keys, but **production keys are unlimited** (their
model monetizes with optional ad content, not API fees). Plan:

- Lives in this repo under `server/`: the worker script, `wrangler.toml`,
  and the web app assets it serves. The web app reuses the root `js/` and
  `css/` files rather than copying them; one repo, no mirror drift. Split
  into its own repo only if the server ever needs to be private or grows
  its own release cadence.
- Small proxy service (host it ourselves): `GET /search?q=`, `GET /trending`.
  The Klipy production key lives only on the server (a Wrangler secret,
  never in the repo); the extension ships with no key requirement at all.
- **Server-side response cache** is the workhorse: popular search terms and
  trending are served from cache (60s–1h TTL), so even live typing across all
  users costs few upstream calls.
- **Abuse control, layered** (skip real user accounts: OAuth for a GIF picker
  kills the simple-and-clean ethos):
  1. Per-IP token-bucket rate limit (e.g. 30 searches/min) + a global cap.
  2. Anonymous install token: extension generates a random ID on install,
     server rate-limits per token as well as per IP.
  3. Check the `Origin: chrome-extension://<id>` header, spoofable by
     scripts, but blocks lazy reuse; combined with 1+2 it is plenty until
     the extension is popular enough to have a real abuse problem.
- Extension keeps a provider setting: "GifGo server (no key needed)" vs
  "My own Giphy key", a privacy escape hatch and failover if the server dies.
  `js/api.js` is already the provider seam; add a Klipy response adapter
  (renditions + width/height mapping) once a platform is registered and the
  docs are readable.
- Once the server exists, flip `liveSearch` default to on when the provider
  is the GifGo server.
- **Web app on the same backend**: the popup UI already runs in a plain
  browser page, so serve it as a site with a web manifest. Installed as a
  PWA it pins to the taskbar and runs in its own window; this is the
  taskbar story for locked-down corporate machines that block installing
  unsigned executables.

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
