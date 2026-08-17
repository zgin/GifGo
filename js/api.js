import { refreshKlipyKey } from './remoteConfig.js';

export class ApiError extends Error {
    constructor(message, status = 0, response = null) {
        super(message);
        this.status = status;
        this.response = response;
    }
}

// ---------- Giphy ----------

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

async function giphyFetch(path, params) {
    let res;
    try {
        res = await fetch(`${GIPHY_BASE}/${path}?${new URLSearchParams(params)}`);
    } catch (err) {
        throw new ApiError('Could not reach Giphy. Are you online?');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new ApiError(`Giphy error: ${body?.meta?.msg || res.statusText}`, res.status, body);
    }
    return body;
}

function normalizeGiphy(gif) {
    const images = gif.images || {};
    const fw = images.fixed_width || images.downsized || images.original || {};
    return {
        id: `giphy:${gif.id}`,
        title: gif.title || '',
        preview: fw.url,
        small: fw.url,
        big: (images.original || images.downsized_large || images.fixed_width)?.url,
        w: Number(fw.width) || 0,
        h: Number(fw.height) || 0,
    };
}

async function searchGiphy(apiKey, q, { limit = 30, rating = 'pg-13' } = {}) {
    const body = await giphyFetch('search', { q, limit, rating, api_key: apiKey });
    return body.data.map(normalizeGiphy);
}

async function trendingGiphy(apiKey, { limit = 30, rating = 'pg-13' } = {}) {
    const body = await giphyFetch('trending', { limit, rating, api_key: apiKey });
    return body.data.map(normalizeGiphy);
}

async function validateGiphyKey(apiKey) {
    await giphyFetch('trending', { limit: 1, api_key: apiKey });
}

// ---------- Klipy ----------

const KLIPY_BASE = 'https://api.klipy.com/api/v1';

// g -> high, pg -> medium, pg-13 -> low, r -> off: assumed mapping, not
// verified against Klipy's per-category content-filtering tables
// (dev/notes/klipy-api.md).
const KLIPY_CONTENT_FILTER = { g: 'high', pg: 'medium', 'pg-13': 'low', r: 'off' };

async function klipyFetch(appKey, path, params) {
    let res;
    try {
        res = await fetch(`${KLIPY_BASE}/${appKey}/${path}?${new URLSearchParams(params)}`);
    } catch (err) {
        throw new ApiError('Could not reach Klipy. Are you online?');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.result === false) {
        throw new ApiError(`Klipy error: ${body?.message || res.statusText}`, res.status, body);
    }
    return body;
}

// The shared key (js/remoteConfig.js) can be revoked and rotated server
// side at any time. A 401/403 means the key we tried is stale: pull a
// fresh one and retry exactly once before giving up, so a rotated key
// heals itself without a store update.
async function klipyRequest(appKey, path, params) {
    try {
        return await klipyFetch(appKey, path, params);
    } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            const fresh = await refreshKlipyKey();
            if (fresh && fresh !== appKey) return klipyFetch(fresh, path, params);
        }
        throw err;
    }
}

function normalizeKlipy(item) {
    const sm = item.file?.sm?.gif;
    const big = item.file?.hd?.gif || item.file?.md?.gif || sm;
    return {
        id: `klipy:${item.slug}`,
        title: item.title || '',
        preview: sm?.url,
        small: sm?.url,
        big: big?.url,
        w: Number(sm?.width) || 0,
        h: Number(sm?.height) || 0,
    };
}

// Ads only appear when enabled for the key in the Partner Panel; ours are
// off, but filter defensively rather than assume.
function klipyItems(body) {
    return (body.data?.data || []).filter((item) => item.type !== 'ad').map(normalizeKlipy);
}

async function searchKlipy(appKey, q, { limit = 30, rating = 'pg-13' } = {}) {
    const body = await klipyRequest(appKey, 'gifs/search', {
        q,
        per_page: Math.max(8, Math.min(50, limit)),
        content_filter: KLIPY_CONTENT_FILTER[rating] || 'low',
    });
    return klipyItems(body);
}

async function trendingKlipy(appKey, { limit = 30, rating = 'pg-13' } = {}) {
    const body = await klipyRequest(appKey, 'gifs/trending', {
        per_page: Math.max(1, Math.min(50, limit)),
        content_filter: KLIPY_CONTENT_FILTER[rating] || 'low',
    });
    return klipyItems(body);
}

async function validateKlipyKey(appKey) {
    await klipyRequest(appKey, 'gifs/trending', { per_page: 1 });
}

// ---------- provider dispatch ----------

const ADAPTERS = {
    giphy: { search: searchGiphy, trending: trendingGiphy, validateKey: validateGiphyKey },
    klipy: { search: searchKlipy, trending: trendingKlipy, validateKey: validateKlipyKey },
};

export async function searchGifs(provider, apiKey, q, opts) {
    return ADAPTERS[provider].search(apiKey, q, opts);
}

export async function trendingGifs(provider, apiKey, opts) {
    return ADAPTERS[provider].trending(apiKey, opts);
}

export async function validateKey(provider, apiKey) {
    return ADAPTERS[provider].validateKey(apiKey);
}
