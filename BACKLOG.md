# GifGo Backlog

Feature ideas not in the current release, roughly in priority order.

## Tenor as a second provider
- Tenor API v2 (owned by Google): `https://tenor.googleapis.com/v2/search`, free key via Google Cloud Console.
- Settings: separate Tenor API key, provider toggles (Giphy / Tenor / both).
- Display decision (made): interleave results from both providers in one grid with a small
  G/T source badge per tile. There is no popularity metric comparable across the two APIs,
  so a true merged ranking is not possible — both return relevance-ranked lists.
- Media format mapping: Tenor's `media_formats` (gif / mediumgif / tinygif) maps onto the
  small/big rendition model already used by the copy actions.

## Full settings page
- Move settings out of the inline panel into an options page (`options_ui` in the manifest)
  if the settings surface keeps growing.

## Smaller ideas
- Trending GIFs on open (before any search).
- Pagination / infinite scroll (`offset` param on both APIs).
- Keyboard navigation: arrows to move between tiles, Enter to copy default, F to favorite.
- Export / import favorites as JSON (backup beyond chrome.storage.sync).
- Favorites search/filter box inside the favorites view.
- Multi-select tags filter (click a chip to filter favorites by that tag).
- Context-menu integration: right-click an image on any page to save it to favorites.
- Local cache of recent searches to soften API rate limits.
