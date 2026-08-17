// Resolves the shared Klipy app key so most users never need their own (see
// BACKLOG.md, "Now: move to Klipy"). Fallback chain: freshly fetched
// config.json, then the last value cached in chrome.storage.local, then a
// constant baked into the build, so the extension still works when the host
// is down. Serving our own config file is not proxying Klipy traffic, so
// this stays inside their terms (dev/notes/klipy-api.md); the key itself is
// not secret, since it also sits in the URL path of every request Klipy
// expects the client to send.

const CONFIG_URL = 'https://gifgo.app/config.json';
const CACHE_KEY = 'klipyConfigCache';

// Empty until GifGo has a production Klipy key (JP: request it through the
// Partner Panel once the adapter is tested, then fill this in). Filling it
// in later needs no other code change.
const BUILT_IN_KLIPY_KEY = '';

async function fetchConfig() {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`config.json fetch failed: ${res.status}`);
    const config = await res.json();
    if (!config.klipyAppKey) throw new Error('config.json missing klipyAppKey');
    return config;
}

// Pulls a fresh key and caches it. Callers that just need a key should use
// getKlipyAppKey() instead; this is for the daily alarm and for healing a
// revoked key after a 401/403 from Klipy (call this, then retry once).
export async function refreshKlipyKey() {
    try {
        const config = await fetchConfig();
        await chrome.storage.local.set({ [CACHE_KEY]: config });
        return config.klipyAppKey;
    } catch (err) {
        return null;
    }
}

export async function getKlipyAppKey() {
    const { [CACHE_KEY]: cached } = await chrome.storage.local.get(CACHE_KEY);
    if (cached?.klipyAppKey) return cached.klipyAppKey;
    const fresh = await refreshKlipyKey();
    return fresh || BUILT_IN_KLIPY_KEY || null;
}
