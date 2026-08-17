// Minimal chrome.storage.sync/local polyfill backed by localStorage, so the
// same js/popup.js, js/storage.js, and js/remoteConfig.js run unmodified as
// a plain web page. This is real storage, not a test stub: it persists
// actual user data. The one real gap versus the extension is that
// localStorage doesn't sync across devices, since there's no browser
// profile behind a plain web page for it to sync through.
(() => {
    const PREFIX = 'gifgo:';

    function readAll(scope) {
        const p = PREFIX + scope + ':';
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k.startsWith(p)) continue;
            try { out[k.slice(p.length)] = JSON.parse(localStorage.getItem(k)); } catch (err) { /* skip corrupt entry */ }
        }
        return out;
    }

    function makeArea(scope) {
        return {
            async get(keys) {
                if (keys === null || keys === undefined) return readAll(scope);
                const list = typeof keys === 'string' ? [keys] : keys;
                const out = {};
                for (const key of list) {
                    const raw = localStorage.getItem(PREFIX + scope + ':' + key);
                    if (raw === null) continue;
                    try { out[key] = JSON.parse(raw); } catch (err) { /* skip corrupt entry */ }
                }
                return out;
            },
            async set(obj) {
                for (const [key, value] of Object.entries(obj)) {
                    localStorage.setItem(PREFIX + scope + ':' + key, JSON.stringify(value));
                }
            },
            async remove(keys) {
                for (const key of Array.isArray(keys) ? keys : [keys]) {
                    localStorage.removeItem(PREFIX + scope + ':' + key);
                }
            },
        };
    }

    window.chrome = window.chrome || {};
    window.chrome.storage = window.chrome.storage || {
        sync: makeArea('sync'),
        local: makeArea('local'),
    };
})();
