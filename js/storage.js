// All state lives in chrome.storage.sync so it follows the user's browser profile.
// Favorites are stored one-per-key ("fav_<id>") to stay under the 8KB per-item sync quota.

const sync = chrome.storage.sync;
const FAV_PREFIX = 'fav_';

const DEFAULT_SETTINGS = {
    defaultAction: 'linkSmall',
    limit: 30,
    rating: 'pg-13',
};

export async function getSettings() {
    const { settings } = await sync.get('settings');
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
    const merged = { ...(await getSettings()), ...patch };
    await sync.set({ settings: merged });
    return merged;
}

export async function getApiKey() {
    const { giphyApiKey } = await sync.get('giphyApiKey');
    return giphyApiKey || null;
}

export async function setApiKey(key) {
    await sync.set({ giphyApiKey: key });
}

export async function clearApiKey() {
    await sync.remove('giphyApiKey');
}

export async function getFavorites() {
    const all = await sync.get(null);
    const favorites = {};
    for (const [key, value] of Object.entries(all)) {
        if (key.startsWith(FAV_PREFIX)) favorites[value.id] = value;
    }
    return favorites;
}

export async function saveFavorite(fav) {
    await sync.set({ [FAV_PREFIX + fav.id]: fav });
}

export async function removeFavorite(id) {
    await sync.remove(FAV_PREFIX + id);
}
