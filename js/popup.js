import { searchGifs, validateKey } from './api.js';
import {
    getSettings, saveSettings,
    getApiKey, setApiKey, clearApiKey,
    getFavorites, saveFavorite, removeFavorite,
} from './storage.js';
import { copyText, copyImage } from './clipboard.js';

const $ = (sel) => document.querySelector(sel);

let settings;
let apiKey = null;
let favorites = {};        // id -> favorite
let view = 'search';       // 'search' | 'favorites' | 'settings'

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

function hint(text) {
    return el('p', { class: 'hint center' }, text);
}

// ---------- init ----------

async function init() {
    [settings, apiKey, favorites] = await Promise.all([getSettings(), getApiKey(), getFavorites()]);
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
    return {
        id: gif.id,
        title: gif.title || '',
        preview: (images.fixed_width || images.downsized || images.original)?.url,
        small: (images.fixed_width || images.downsized || images.original)?.url,
        big: (images.original || images.downsized_large || images.fixed_width)?.url,
    };
}

function matchFavorites(term) {
    const words = term.toLowerCase().split(/\s+/);
    return Object.values(favorites)
        .filter((fav) => {
            const haystack = (fav.tags.join(' ') + ' ' + fav.title).toLowerCase();
            return words.every((word) => haystack.includes(word));
        })
        .sort((a, b) => b.addedAt - a.addedAt);
}

function renderResults(favMatches, gifs) {
    const results = $('#results');
    results.innerHTML = '';
    const favIds = new Set(favMatches.map((f) => f.id));
    const grid = el('div', { class: 'grid' });

    favMatches.forEach((fav) => grid.append(makeTile(fav, { badge: true })));
    gifs.filter((g) => !favIds.has(g.id)).forEach((g) => grid.append(makeTile(g)));

    if (!grid.children.length) {
        results.append(hint('No GIFs found.'));
        return;
    }
    results.append(grid);
}

// ---------- tiles ----------

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
        opts.badge ? el('span', { class: 'fav-badge' }, '♥ saved') : null,
        el('div', { class: 'actions' }, actionButtons, heartButton),
        el('div', { class: 'overlay' }),
    ));

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
        flashTimers.set(tile, setTimeout(() => overlay.classList.remove('show'), 1100));
    }
}

async function runAction(key, data, tile) {
    const action = ACTIONS[key] || ACTIONS.linkSmall;
    flash(tile, 'Copying…', { sticky: true });
    try {
        await action.run(data);
        flash(tile, action.done);
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
                tags: data.tags || [],
                addedAt: Date.now(),
            };
            await saveFavorite(fav);
            favorites[fav.id] = fav;
            button.classList.add('faved');
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

    const favs = Object.values(favorites).sort((a, b) => b.addedAt - a.addedAt);
    results.append(el('div', { class: 'caption', id: 'favCaption' }, `Favorites (${favs.length})`));
    if (!favs.length) {
        results.append(hint('No favorites yet — hover a GIF and click the ♥.'));
        return;
    }
    const grid = el('div', { class: 'grid with-tags' });
    favs.forEach((fav) => grid.append(makeTile(fav, { tags: true })));
    results.append(grid);
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

        const input = el('input', { class: 'tag-input', placeholder: '+ tag' });
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
