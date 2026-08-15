const API_BASE = 'https://api.giphy.com/v1/gifs';

export class ApiError extends Error {
    constructor(message, status = 0, response = null) {
        super(message);
        this.status = status;
        this.response = response;
    }
}

async function request(path, params) {
    let res;
    try {
        res = await fetch(`${API_BASE}/${path}?${new URLSearchParams(params)}`);
    } catch (err) {
        throw new ApiError('Could not reach Giphy. Are you online?');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new ApiError(`Giphy error: ${body?.meta?.msg || res.statusText}`, res.status, body);
    }
    return body;
}

export async function searchGifs(apiKey, q, { limit = 30, rating = 'pg-13' } = {}) {
    const body = await request('search', { q, limit, rating, api_key: apiKey });
    return body.data;
}

export async function validateKey(apiKey) {
    await request('trending', { limit: 1, api_key: apiKey });
}
