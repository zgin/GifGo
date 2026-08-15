import { searchGifs, validateKey } from './api.js';
import {
    getSettings, saveSettings,
    getApiKey, setApiKey, clearApiKey,
    getFavorites, saveFavorite, removeFavorite,
    getUsage, recordUse,
} from './storage.js';
import { copyText, copyImage } from './clipboard.js';

const $ = (sel) => document.querySelector(sel);

let settings;
let apiKey = null;
let favorites = {};        // id -> favorite
let usage = {};            // id -> {n: times copied, t: last copied}
let view = 'search';       // 'search' | 'favorites' | 'settings'

const uses = (id) => usage[id]?.n || 0;
const byMostUsed = (a, b) => uses(b.id) - uses(a.id) || b.addedAt - a.addedAt;

const ICONS = {
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
};

const ACTIONS = {
    linkSmall:  { label: 'Copy link (small)',  done: 'Link (small) copied',  icon: 'link',  size: 'S', run: (d) => copyText(d.small) },
    linkBig:    { label: 'Copy link (big)',    done: 'Link (big) copied',    icon: 'link',  size: 'L', run: (d) => copyText(d.big) },
    imageSmall: { label: 'Copy image (small)', done: 'Image (small) copied', icon: 'image', size: 'S', run: (d) => copyImage(d.small) },
    imageBig:   { label: 'Copy image (big)',   done: 'Image (big) copied',   icon: 'image', size: 'L', run: (d) => copyImage(d.big) },
};

// ---------- tiny DOM helpers ----------

function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') node.className = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
        if (child != null) node.append(child);
    }
    return node;
}

function icon(name) {
    const span = el('span', { class: 'icon' });
    span.innerHTML = ICONS[name];
    return span;
}

// Small filled heart in the tile corner: the rest-state "saved" cue.
function favMark() {
    const mark = el('span', { class: 'fav-mark', title: 'In your favorites' });
    mark.innerHTML = ICONS.heart;
    return mark;
}

function hint(text) {
    return el('p', { class: 'hint center' }, text);
}

// ---------- init ----------

async function init() {
    [settings, apiKey, favorites, usage] = await Promise.all([getSettings(), getApiKey(), getFavorites(), getUsage()]);
    applySettingsToForm();
    wireEvents();

    if (!apiKey) {
        openSettings('Add your Giphy API key to get started.');
    } else if (Object.keys(favorites).length) {
        renderFavoritesView();
    } else {
        $('#results').append(hint('Search for GIFs to get going.'));
    }
    $('#searchInput').focus();
}

function wireEvents() {
    $('#searchButton').addEventListener('click', doSearch);
    $('#searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
    });
    $('#searchInput').addEventListener('input', (e) => {
        $('#clearSearchButton').hidden = e.target.value.length === 0;
    });
    $('#clearSearchButton').addEventListener('click', () => {
        $('#searchInput').value = '';
        $('#clearSearchButton').hidden = true;
        $('#results').innerHTML = '';
        $('#searchInput').focus();
    });

    $('#favoritesButton').addEventListener('click', renderFavoritesView);
    $('#settingsButton').addEventListener('click', () => {
        view === 'settings' ? closeSettings() : openSettings();
    });

    $('#saveKeyButton').addEventListener('click', onSaveKey);
    $('#removeKeyButton').addEventListener('click', onRemoveKey);
    for (const id of ['defaultActionSelect', 'limitSelect', 'ratingSelect']) {
        $('#' + id).addEventListener('change', onDefaultsChange);
    }
}

// ---------- search ----------

async function doSearch() {
    const term = $('#searchInput').value.trim();
    if (!term) return;
    if (!apiKey) {
        openSettings('Add your Giphy API key first.');
        return;
    }
    closeSettings();
    view = 'search';

    const results = $('#results');
    results.innerHTML = '';
    results.append(el('div', { class: 'loader' }));

    try {
        const gifs = await searchGifs(apiKey, term, settings);
        renderResults(matchFavorites(term), gifs.map(normalizeGif));
    } catch (err) {
        renderError(err);
        if (err.status === 401) openSettings('Giphy rejected the API key. Double-check it below.');
    }
}

function normalizeGif(gif) {
    const images = gif.images || {};
    const fw = images.fixed_width || images.downsized || images.original || {};
    return {
        id: gif.id,
        title: gif.title || '',
        preview: fw.url,
        small: fw.url,
        big: (images.original || images.downsized_large || images.fixed_width)?.url,
        w: Number(fw.width) || 0,
        h: Number(fw.height) || 0,
    };
}

function matchFavorites(term) {
    const words = term.toLowerCase().split(/\s+/);
    return Object.values(favorites)
        .filter((fav) => {
            const haystack = (fav.tags.join(' ') + ' ' + fav.title).toLowerCase();
            return words.every((word) => haystack.includes(word));
        })
        .sort(byMostUsed);
}

function renderResults(favMatches, gifs) {
    const results = $('#results');
    results.innerHTML = '';
    const favIds = new Set(favMatches.map((f) => f.id));
    const items = [...favMatches, ...gifs.filter((g) => !favIds.has(g.id))];

    if (!items.length) {
        results.append(hint('No GIFs found.'));
        return;
    }
    results.append(masonry(items, {}, 3));
}

// Fixed-width columns, dynamic tile heights. Each tile goes to the currently
// shortest column (heights tracked from the API's aspect ratios) so reading
// order stays roughly left-to-right and favorites stay on top — Giphy-style.
function masonry(items, opts, nCols) {
    const wrap = el('div', { class: 'masonry' + (opts.tags ? ' with-tags' : '') });
    const cols = Array.from({ length: nCols }, () => {
        const node = el('div', { class: 'mcol' });
        wrap.append(node);
        return { node, h: 0 };
    });
    for (const item of items) {
        const col = cols.reduce((best, c) => (c.h < best.h ? c : best));
        col.node.append(makeTile(item, opts));
        col.h += (item.w && item.h ? item.h / item.w : 1) + (opts.tags ? 0.22 : 0);
    }
    return wrap;
}

// ---------- tiles ----------

// Must match the CSS hover scale and the #content fade-mask stops.
const HOVER_SCALE = 1.6;
const FADE_TOP = 0.03;
const FADE_BOTTOM = 0.05;

// Pick a transform-origin so the scaled tile stays fully visible inside the
// scroller, clear of the top/bottom fade zones. A scaled box always contains
// the original, so sliding the origin between 0% and 100% is always enough
// when there is room; when there isn't, keeping the top visible wins.
function adjustHoverOrigin(tile) {
    const c = $('#content').getBoundingClientRect();
    const r = tile.getBoundingClientRect();
    const minTop = c.top + c.height * FADE_TOP;
    const maxBottom = c.bottom - c.height * FADE_BOTTOM;

    const extraY = r.height * (HOVER_SCALE - 1);
    const fyMax = (r.top - minTop) / extraY;
    const fyMin = 1 - (maxBottom - r.bottom) / extraY;
    const fy = Math.max(0, Math.min(1, Math.min(Math.max(0.5, fyMin), fyMax)));

    const extraX = r.width * (HOVER_SCALE - 1);
    const fxMax = (r.left - (c.left + 4)) / extraX;
    const fxMin = 1 - ((c.right - 4) - r.right) / extraX;
    const fx = Math.max(0, Math.min(1, Math.min(Math.max(0.5, fxMin), fxMax)));

    tile.style.transformOrigin = `${fx * 100}% ${fy * 100}%`;

    // A tile already inside a fade zone can't be rescued by origin alone
    // (the scaled box always contains the original): nudge it out instead.
    const scaledTop = r.top - fy * extraY;
    const scaledBottom = r.bottom + (1 - fy) * extraY;
    let shift = 0;
    if (scaledBottom > maxBottom) shift = maxBottom - scaledBottom;
    if (scaledTop + shift < minTop) shift = minTop - scaledTop;
    tile.style.setProperty('--hover-shift', `${Math.round(shift)}px`);
}

function makeTile(data, opts = {}) {
    const actionButtons = Object.entries(ACTIONS).map(([key, action]) =>
        el('button', {
            type: 'button',
            title: action.label,
            onclick: () => runAction(key, data, tile),
        }, icon(action.icon), el('span', { class: 'sz' }, action.size)));

    const heartButton = el('button', {
        type: 'button',
        class: 'heart' + (favorites[data.id] ? ' faved' : ''),
        title: 'Favorite',
        onclick: (e) => toggleFavorite(data, e.currentTarget, tile),
    }, icon('heart'));

    const tile = el('div', {
        class: 'tile',
        'data-id': data.id,
        onclick: (e) => {
            if (e.target.closest('button, input, .tags')) return;
            runAction(settings.defaultAction, data, tile);
        },
    }, el('figure', { class: 'imgwrap' },
        el('img', { src: data.preview, alt: data.title || 'GIF', loading: 'lazy' }),
        // Mark any favorited gif outside the favorites view, however it got
        // into the results (favorites-first match or regular API result).
        favorites[data.id] && !opts.tags ? favMark() : null,
        opts.tags && uses(data.id) > 0
            ? el('span', { class: 'use-count', title: `Copied ${uses(data.id)} times` }, `${uses(data.id)}×`)
            : null,
        el('div', { class: 'actions' }, el('div', { class: 'bar' }, actionButtons, heartButton)),
        el('div', { class: 'overlay' }),
    ));

    if (!opts.tags) tile.addEventListener('mouseenter', () => adjustHoverOrigin(tile));

    if (opts.tags) tile.append(makeTagsRow(data));
    return tile;
}

const flashTimers = new WeakMap();

function flash(tile, text, { error = false, sticky = false } = {}) {
    const overlay = tile.querySelector('.overlay');
    overlay.textContent = text;
    overlay.classList.toggle('error', error);
    overlay.classList.add('show');
    clearTimeout(flashTimers.get(tile));
    if (!sticky) {
        flashTimers.set(tile, setTimeout(() => overlay.classList.remove('show'), 800));
    }
}

async function runAction(key, data, tile) {
    const action = ACTIONS[key] || ACTIONS.linkSmall;
    flash(tile, 'Copying…', { sticky: true });
    try {
        await action.run(data);
        flash(tile, action.done);
        recordUse(data.id).then((u) => { usage = u; }).catch(() => {});
    } catch (err) {
        console.error(err);
        flash(tile, 'Copy failed', { error: true });
    }
}

// ---------- favorites ----------

async function toggleFavorite(data, button, tile) {
    try {
        if (favorites[data.id]) {
            await removeFavorite(data.id);
            delete favorites[data.id];
            button.classList.remove('faved');
            tile.querySelector('.fav-mark')?.remove();
            if (view === 'favorites') {
                tile.remove();
                updateFavoritesCaption();
            } else {
                flash(tile, 'Removed from favorites');
            }
        } else {
            const fav = {
                id: data.id,
                title: data.title || '',
                preview: data.preview,
                small: data.small,
                big: data.big,
                w: data.w || 0,
                h: data.h || 0,
                tags: data.tags || [],
                addedAt: Date.now(),
            };
            await saveFavorite(fav);
            favorites[fav.id] = fav;
            button.classList.add('faved');
            const wrap = tile.querySelector('.imgwrap');
            if (view !== 'favorites' && !wrap.querySelector('.fav-mark')) {
                wrap.querySelector('img').after(favMark());
            }
            flash(tile, 'Saved ♥');
        }
    } catch (err) {
        console.error(err);
        const quota = /QUOTA|MAX_ITEMS/i.test(err.message || '');
        flash(tile, quota ? 'Sync storage is full' : 'Could not save', { error: true });
    }
}

function renderFavoritesView() {
    view = 'favorites';
    closeSettings();

    const results = $('#results');
    results.hidden = false;
    results.innerHTML = '';

    const favs = Object.values(favorites).sort(byMostUsed);
    results.append(el('div', { class: 'caption', id: 'favCaption' }, `Favorites (${favs.length})`));
    if (!favs.length) {
        results.append(hint('No favorites yet — hover a GIF and click the ♥.'));
        return;
    }
    results.append(masonry(favs, { tags: true }, 2));
}

function updateFavoritesCaption() {
    const caption = $('#favCaption');
    if (caption) caption.textContent = `Favorites (${Object.keys(favorites).length})`;
}

function makeTagsRow(fav) {
    const row = el('div', { class: 'tags' });

    const rebuild = () => {
        row.innerHTML = '';
        fav.tags.forEach((tag) => row.append(
            el('span', { class: 'chip' }, tag,
                el('button', {
                    type: 'button',
                    title: 'Remove tag',
                    onclick: async () => {
                        fav.tags = fav.tags.filter((t) => t !== tag);
                        await saveFavorite(fav);
                        rebuild();
                    },
                }, '✕'))));

        const input = el('input', { class: 'tag-input', placeholder: '+ add tag', title: 'Type a tag and press Enter' });
        input.addEventListener('keydown', async (e) => {
            if (e.key !== 'Enter') return;
            const tag = input.value.trim().toLowerCase();
            if (tag && !fav.tags.includes(tag)) {
                fav.tags.push(tag);
                await saveFavorite(fav);
                rebuild();
                row.querySelector('.tag-input').focus();
            } else {
                input.value = '';
            }
        });
        row.append(input);
    };

    rebuild();
    return row;
}

// ---------- settings ----------

function openSettings(message = '') {
    view = 'settings';
    $('#results').hidden = true;
    $('#settingsPanel').hidden = false;
    const note = $('#settingsNote');
    note.textContent = message;
    note.hidden = !message;
    $('#apiKeyInput').value = apiKey || '';
    $('#keyStatus').textContent = '';
}

function closeSettings() {
    if (view !== 'settings') return;
    $('#settingsPanel').hidden = true;
    $('#results').hidden = false;
    view = 'search';
}

function applySettingsToForm() {
    $('#defaultActionSelect').value = settings.defaultAction;
    $('#limitSelect').value = String(settings.limit);
    $('#ratingSelect').value = settings.rating;
}

async function onDefaultsChange() {
    settings = await saveSettings({
        defaultAction: $('#defaultActionSelect').value,
        limit: Number($('#limitSelect').value),
        rating: $('#ratingSelect').value,
    });
}

async function onSaveKey() {
    const key = $('#apiKeyInput').value.trim();
    const status = $('#keyStatus');
    if (!key) return;
    status.textContent = 'Checking key…';
    try {
        await validateKey(key);
        await setApiKey(key);
        apiKey = key;
        status.textContent = '✓ Key saved and working.';
    } catch (err) {
        status.textContent = err.status === 401 ? '✗ Giphy rejected this key.' : `✗ ${err.message}`;
    }
}

async function onRemoveKey() {
    await clearApiKey();
    apiKey = null;
    $('#apiKeyInput').value = '';
    $('#keyStatus').textContent = 'Key removed.';
}

// ---------- errors ----------

function renderError(err) {
    const results = $('#results');
    results.hidden = false;
    results.innerHTML = '';

    let message = err.message;
    if (err.status === 401) {
        message = 'Giphy returned 401 — the API key is bad or lacks access.';
    }
    const note = el('div', { class: 'notification' }, el('p', {}, message));
    if (err.response) {
        const pre = el('pre', { hidden: true }, JSON.stringify(err.response, null, 2));
        note.append(
            el('button', { type: 'button', class: 'btn small', onclick: () => { pre.hidden = !pre.hidden; } }, 'Details'),
            pre);
    }
    results.append(note);
}

init();
