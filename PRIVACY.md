# GifGo Privacy Policy

Last updated: August 16, 2026

GifGo does not collect, store, or transmit your personal information. There is
no analytics, no tracking, no advertising, and no account to create. The
developer of GifGo receives no data from you at all.

## What GifGo stores, and where

Everything GifGo saves is stored by your own browser, using the standard
extension storage API. None of it is sent to the developer or to any server we
control, because there is no such server.

Synced with your browser profile (`chrome.storage.sync`), so it follows you
across browsers where you are signed in:

- Your Giphy API key.
- Your settings: default copy action, results per search, maximum rating,
  whether the popup closes after copying, which view it opens on, and whether
  live search is enabled.
- Your favorites: for each favorited GIF, its Giphy ID, title, image URLs,
  dimensions, any tags you add, and when you added it.
- Usage counts: how many times you have copied each GIF, and when you last
  copied it. This is what powers most-used sorting.

Stored on your device only (`chrome.storage.local`), never synced:

- Your recent copies: up to 24 recently copied GIFs.

You can remove any of it at any time. Deleting a favorite removes its entry,
clearing your key removes the key, and uninstalling GifGo removes all of it.

## What leaves your browser

GifGo talks to exactly one third party, Giphy, and only to do the thing you
asked for:

- **Searching and browsing trending GIFs.** When you run a search, GifGo sends
  your search term, your result limit, your rating setting, and your Giphy API
  key to `api.giphy.com`. Loading the Trending view sends the same information
  without a search term.
- **Displaying and copying GIFs.** GIF images load from Giphy's media servers
  (`*.giphy.com`). Copying a GIF as an image fetches that image from those
  servers so it can be written to your clipboard.

As with any web request, Giphy will also see your IP address and standard
request headers. Giphy's handling of that data is covered by their own privacy
policy at https://support.giphy.com/hc/en-us/articles/360020027752-GIPHY-Privacy-Policy.

GifGo makes no other network requests. It contacts no other host, and it
contains no remote code.

## Your clipboard

GifGo writes to your clipboard when you copy a GIF, and only in response to
you clicking or pressing a key. It never reads your clipboard, and it holds
no clipboard permission: the write happens through the browser's standard
Clipboard API on the strength of that click or keypress alone.

## Permissions, and why each one is needed

- `storage`: to save the settings, favorites, usage counts, and recents
  described above.
- `https://api.giphy.com/*`: to run searches and load trending GIFs.
- `https://*.giphy.com/*`: to load GIF images and fetch the image data used
  when you copy a GIF as an image.

## Children

GifGo is not directed at children. Giphy content is rated, and GifGo defaults
to a maximum rating of PG-13, which you can change in settings.

## Changes

If this policy changes, the updated version will be published in this
repository and the date at the top will change.

## Contact

Questions or concerns: open an issue at
https://github.com/zgin/GifGo/issues.
