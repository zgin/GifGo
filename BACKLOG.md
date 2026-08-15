# GifGo Backlog

Feature ideas not in the current release. Ordered by how much each shortens the
core loop: urge → find → paste.

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
