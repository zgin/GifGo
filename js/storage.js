// All state lives in chrome.storage.sync so it follows the user's browser profile.
// Favorites are stored one-per-key ("fav_<id>") to stay under the 8KB per-item sync quota.

const sync = chrome.storage.sync;
const FAV_PREFIX = 'fav_';

// Ids are namespaced "provider:id" (see js/popup.js) so a second source
// can't collide with Giphy's. Storage predates that: existing sync/local
// data has bare ids. Each getter below migrates any bare id it finds to the
// giphy namespace and writes the result back, so an upgrade doesn't strand
// a user's favorites or usage counts.
const GIPHY = 'giphy';
const isNamespaced = (id) => typeof id === 'string' && id.includes(':');

const DEFAULT_SETTINGS = {
    provider: 'klipy',      // 'giphy' | 'klipy'; see getSettings for the carve-out
    defaultAction: 'linkSmall',
    limit: 30,
    rating: 'pg-13',
    autoClose: true,
    landing: 'recents',    // 'recents' | 'trending'
    // Off by default: Giphy developer keys allow only 100 requests/hour,
    // and typing burns several requests per search.
    liveSearch: false,
};

export async function getSettings() {
    const { settings } = await sync.get('settings');
    const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    // New installs land on Klipy, which needs no key. Anyone upgrading from a
    // version that predates the provider setting went to the trouble of
    // creating a Giphy key, so that is a choice, not a default: leave them on
    // Giphy until they switch it themselves.
    // Covers both a settings object saved before the provider existed and no
    // settings object at all, which is what an upgrader who set a key and
    // never touched a default looks like.
    if (!settings || settings.provider === undefined) {
        const { giphyApiKey } = await sync.get('giphyApiKey');
        if (giphyApiKey) merged.provider = 'giphy';
    }
    return merged;
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
    const migrated = {};
    const stale = [];
    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(FAV_PREFIX)) continue;
        if (isNamespaced(value.id)) {
            favorites[value.id] = value;
            continue;
        }
        const fav = { ...value, id: `${GIPHY}:${value.id}` };
        favorites[fav.id] = fav;
        migrated[FAV_PREFIX + fav.id] = fav;
        stale.push(key);
    }
    if (stale.length) {
        await sync.set(migrated);
        await sync.remove(stale);
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
    if (!recents) return [];
    let migrated = false;
    const namespaced = recents.map((r) => {
        if (isNamespaced(r.id)) return r;
        migrated = true;
        return { ...r, id: `${GIPHY}:${r.id}` };
    });
    if (migrated) await chrome.storage.local.set({ [RECENTS_KEY]: namespaced });
    return namespaced;
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
    if (!usage) return {};
    let migrated = false;
    const namespaced = {};
    for (const [id, entry] of Object.entries(usage)) {
        const nsId = isNamespaced(id) ? id : `${GIPHY}:${id}`;
        if (nsId !== id) migrated = true;
        namespaced[nsId] = entry;
    }
    if (migrated) await sync.set({ [USAGE_KEY]: namespaced });
    return namespaced;
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
