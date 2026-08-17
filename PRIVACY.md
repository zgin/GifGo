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

- Your Giphy API key, if you've chosen to use your own.
- Your settings: which GIF provider you're using, default copy action,
  results per search, maximum rating, whether the popup closes after
  copying, which view it opens on, and whether live search is enabled.
- Your favorites: for each favorited GIF, its ID (tagged with which
  provider it came from), title, image URLs, dimensions, any tags you add,
  and when you added it.
- Usage counts: how many times you have copied each GIF, and when you last
  copied it. This is what powers most-used sorting.

Stored on your device only (`chrome.storage.local`), never synced:

- Your recent copies: up to 24 recently copied GIFs.
- A cached copy of a small shared configuration file GifGo fetches from its
  own server (see below), so a shared API key keeps working if that server
  is briefly unreachable.

You can remove any of it at any time. Deleting a favorite removes its entry,
clearing your key removes the key, and uninstalling GifGo removes all of it.

## What leaves your browser

GifGo talks to whichever GIF provider you've selected in settings, Klipy by
default, and only to do the thing you asked for:

- **Searching and browsing trending GIFs.** When you run a search, GifGo sends
  your search term, your result limit, and your rating setting to that
  provider's servers (`api.giphy.com` or `api.klipy.com`), along with an API
  key: your own if you're using Giphy, or a shared one GifGo supplies if
  you're using Klipy. Loading the Trending view sends the same information
  without a search term.
- **Displaying and copying GIFs.** GIF images load from that provider's media
  servers (`*.giphy.com` or `*.klipy.com`). Copying a GIF as an image fetches
  that image from those servers so it can be written to your clipboard.
- **Switching providers keeps the two separate.** GifGo never blends results
  from both providers into one search, and never sends one provider's data to
  the other.

As with any web request, whichever provider you're using will also see your
IP address and standard request headers. Their handling of that data is
covered by their own privacy policies: Giphy's at
https://support.giphy.com/hc/en-us/articles/360020027752-GIPHY-Privacy-Policy,
Klipy's at https://klipy.com.

GifGo also fetches a small configuration file from `gifgo.app`, a server we
control, roughly once a day. That file holds the shared Klipy API key so most
people never have to create their own account with a second GIF provider;
the request carries no search terms, no identifying information, and nothing
you have typed or copied. This file is data, not code: it contains no
scripts, and GifGo runs nothing it receives from that request.

GifGo contains no remote code, and contacts no other hosts than the ones
described here.

## Your clipboard

GifGo writes to your clipboard when you copy a GIF, and only in response to
you clicking or pressing a key. It never reads your clipboard, and it holds
no clipboard permission: the write happens through the browser's standard
Clipboard API on the strength of that click or keypress alone.

## Permissions, and why each one is needed

- `storage`: to save the settings, favorites, usage counts, and recents
  described above.
- `alarms`: to schedule the once-a-day check for a fresh shared Klipy API key.
- `https://api.giphy.com/*` and `https://*.giphy.com/*`: to run Giphy
  searches, load trending GIFs, and load or copy GIF images, when Giphy is
  your chosen provider.
- `https://api.klipy.com/*` and `https://*.klipy.com/*`: the same, for
  Klipy, GifGo's default provider.
- `https://gifgo.app/*`: to fetch the shared API key configuration file
  described above.

## Children

GifGo is not directed at children. Both Giphy and Klipy content are rated,
and GifGo defaults to a maximum rating of PG-13, which you can change in
settings.

## Changes

If this policy changes, the updated version will be published in this
repository and the date at the top will change.

## Contact

Questions or concerns: open an issue at
https://github.com/zgin/GifGo/issues.
