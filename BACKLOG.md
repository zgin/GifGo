# GifGo Backlog

Feature ideas not in the current release. Ordered by how much each shortens the
core loop: urge → find → paste.

## GifGo server: Klipy-backed proxy (removes the BYO-API-key requirement)

Klipy (klipy.com/developers, docs.klipy.com) is free: test keys are limited to
100 req/hour like Giphy dev keys, but **production keys are unlimited** (their
model monetizes with optional ad content, not API fees). Plan:

- Small proxy service (host it ourselves): `GET /search?q=`, `GET /trending`.
  The Klipy production key lives only on the server; the extension ships with
  no key requirement at all. Same backend later powers a web app.
- **Server-side response cache** is the workhorse: popular search terms and
  trending are served from cache (60s–1h TTL), so even live typing across all
  users costs few upstream calls.
- **Abuse control, layered** (skip real user accounts — OAuth for a GIF picker
  kills the simple-and-clean ethos):
  1. Per-IP token-bucket rate limit (e.g. 30 searches/min) + a global cap.
  2. Anonymous install token: extension generates a random ID on install,
     server rate-limits per token as well as per IP.
  3. Check the `Origin: chrome-extension://<id>` header — spoofable by
     scripts, but blocks lazy reuse; combined with 1+2 it is plenty until
     the extension is popular enough to have a real abuse problem.
- Extension keeps a provider setting: "GifGo server (no key needed)" vs
  "My own Giphy key" — privacy escape hatch and failover if the server dies.
  `js/api.js` is already the provider seam; add a Klipy response adapter
  (renditions + width/height mapping) once a platform is registered and the
  docs are readable.
- Once the server exists, flip `liveSearch` default to on when the provider
  is the GifGo server.

## Tier 1 — loop shorteners
- **Trending on open**: populate the popup from Giphy's trending endpoint
  (same API key) instead of opening empty.
- **Search-as-you-type**: debounced (~300ms) live search, no Enter required.
- **Keyboard-first flow**: arrows move a selection ring through the grid,
  Enter runs the default copy, F favorites, 1–4 run the specific copy actions.
- **Auto-close on copy** (setting): close the popup after a successful copy so
  the paste is the very next action.

## Tier 2 — library compounding
- **Recents view**: surface recently-copied GIFs from the existing usage data
  ("the one I used yesterday" retrieval).
- **Frecency sorting**: weight use counts by recency instead of raw totals.
- **Tag autocomplete**: suggest existing tags while typing to keep the tag
  vocabulary consistent; clickable tag chips filter the favorites view.
- **Export / import favorites**: JSON backup — sync is not a backup.

## Tier 3 — reach beyond the popup
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
- **Tenor as a second provider** — Google shut down the public Tenor API
  (confirmed 2026). If a second source is ever wanted, candidates would need
  re-evaluation at the time.
