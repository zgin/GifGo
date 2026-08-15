// All state lives in chrome.storage.sync so it follows the user's browser profile.
// Favorites are stored one-per-key ("fav_<id>") to stay under the 8KB per-item sync quota.

const sync = chrome.storage.sync;
const FAV_PREFIX = 'fav_';

const DEFAULT_SETTINGS = {
    defaultAction: 'linkSmall',
    limit: 30,
    rating: 'pg-13',
    autoClose: true,
    landing: 'recents',    // 'recents' | 'trending'
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

// Recently copied gifs, newest first. Full records live in storage.local:
// they carry image urls, which would blow sync's 8KB item quota, and recents
// are a per-device convenience anyway (usage counts still sync).
const RECENTS_KEY = 'recents';
const RECENTS_MAX = 24;

export async function getRecents() {
    const { [RECENTS_KEY]: recents } = await chrome.storage.local.get(RECENTS_KEY);
    return recents || [];
}

export async function addRecent(data) {
    const recents = (await getRecents()).filter((r) => r.id !== data.id);
    recents.unshift({ ...data, t: Date.now() });
    await chrome.storage.local.set({ [RECENTS_KEY]: recents.slice(0, RECENTS_MAX) });
}

// Usage counts: one synced map of gif id -> {n: times copied, t: last copied}.
// Pruned to the most recently used entries to stay under the 8KB per-item quota.
const USAGE_KEY = 'usage';
const USAGE_MAX = 150;

export async function getUsage() {
    const { [USAGE_KEY]: usage } = await sync.get(USAGE_KEY);
    return usage || {};
}

export async function recordUse(id) {
    const usage = await getUsage();
    const entry = usage[id] || { n: 0 };
    entry.n += 1;
    entry.t = Date.now();
    usage[id] = entry;
    const ids = Object.keys(usage);
    if (ids.length > USAGE_MAX) {
        ids.sort((a, b) => usage[b].t - usage[a].t);
        for (const stale of ids.slice(USAGE_MAX)) delete usage[stale];
    }
    await sync.set({ [USAGE_KEY]: usage });
    return usage;
}
