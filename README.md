# GifGo

GifGo is a Chrome extension for searching Giphy and copying GIFs, as links or as actual
images, straight to your clipboard. It's a fun and easy way to add some personality to
your online conversations!

## Features

- Search Giphy by keyword
- Hover a GIF for copy actions: link (small), link (big), image (small), image (big)
- Click anywhere on a GIF to run your default copy action (configurable in settings)
- Image copy writes multiple clipboard formats at once, so rich editors (Gmail, Slack,
  Discord) paste the animated GIF, plain editors get the URL, image apps get a still frame
- Favorites: heart any GIF, tag your favorites, and matching favorites appear first in
  search results
- Favorites and settings sync across your browsers via `chrome.storage.sync`
- Configurable defaults: copy action, results per search, max rating
- Zero dependencies, just plain JavaScript and CSS

## Installation

Install GifGo from the Chrome Web Store, or load it unpacked:

1. Clone this repository.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

## Setup

GifGo uses your own Giphy API key:

1. Go to [developers.giphy.com](https://developers.giphy.com/) and create an app (API type).
2. Copy the API key.
3. Click the GifGo icon, open settings (sliders button), paste the key, and save.

## Usage

Click the GifGo icon, type a search, and hit Enter. Hover any GIF for the copy buttons and
the ♥ favorite button, or just click the GIF to copy with your default action. The heart
button in the top bar shows your favorites, where you can tag them.

## Contributing

We welcome contributions! See [BACKLOG.md](BACKLOG.md) for planned features, and feel free
to submit a pull request or open an issue.

## License

This extension is licensed under the [MIT License](LICENSE).
