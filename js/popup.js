import { searchGifs, trendingGifs, validateKey } from './api.js';
import {
    getSettings, saveSettings,
    getApiKey, setApiKey, clearApiKey,
    getFavorites, saveFavorite, removeFavorite,
    getUsage, recordUse,
    getRecents, addRecent,
} from './storage.js';
import { copyText, copyImage } from './clipboard.js';
import { getKlipyAppKey } from './remoteConfig.js';

const $ = (sel) => document.querySelector(sel);

// True only inside the real extension popup, never in the web app (where
// server/chrome-shim.js polyfills chrome.storage but nothing else). autoClose
// closing the popup makes sense for a transient extension popup; closing a
// persistent web app tab or PWA window on every copy would not.
const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

let settings;
let apiKey = null;
let favorites = {};        // id -> favorite
let usage = {};            // id -> {n: times copied, t: last copied}
let view = 'search';       // 'landing' | 'search' | 'favorites' | 'settings'
let selected = null;       // keyboard-selected tile element
const tileData = new WeakMap();

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

// Edge ignores ::-webkit-scrollbar outright (it paints its own Fluent
// scrollbars), so the magenta thumb never lands there and the popup gets an
// OS-grey one instead. The standard scrollbar-color property is what Edge
// honors, but setting that in Chromium disables the webkit pseudo-elements,
// taking the fixed 14px gutter and the proximity-fattening with them. So ask
// the browser which one it actually applied rather than sniffing the UA:
// measure a probe that requested 14px and see whether it got it.
function probeScrollbars() {
    const probe = el('div', { class: 'sb-probe' });
    document.body.append(probe);
    const honored = probe.offsetWidth - probe.clientWidth === 14;
    probe.remove();
    if (!honored) document.documentElement.classList.add('std-scrollbars');
}

// ---------- init ----------

async function init() {
    [settings, apiKey, favorites, usage] = await Promise.all([getSettings(), getApiKey(), getFavorites(), getUsage()]);
    probeScrollbars();
    applySettingsToForm();
    wireEvents();

    if (settings.provider === 'giphy' && !apiKey) {
        openSettings('Add your Giphy API key to get started.');
    } else {
        renderLanding();
    }
    $('#searchInput').focus();
}

// Klipy needs no key from the user (js/remoteConfig.js resolves the shared
// one); Giphy needs the key saved in settings.
async function resolveApiKey() {
    return settings.provider === 'klipy' ? getKlipyAppKey() : apiKey;
}

let searchTimer;

function wireEvents() {
    $('#searchButton').addEventListener('click', doSearch);
    $('#searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            clearTimeout(searchTimer);
            doSearch();
        }
    });
    // With live search on, search as you type (debounced); otherwise wait for
    // Enter or the search button. An emptied box always returns to landing.
    $('#searchInput').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        $('#clearSearchButton').hidden = e.target.value.length === 0;
        clearTimeout(searchTimer);
        if (!term) {
            if (view === 'search') renderLanding();
            return;
        }
        if (settings.liveSearch) searchTimer = setTimeout(doSearch, 300);
    });
    $('#clearSearchButton').addEventListener('click', () => {
        clearTimeout(searchTimer);
        $('#searchInput').value = '';
        $('#clearSearchButton').hidden = true;
        renderLanding();
        $('#searchInput').focus();
    });

    document.addEventListener('keydown', onGridKeydown);

    // Jump back to recent copies from anywhere. Clears the search box on the
    // way so the top bar is not still showing a term whose results just left
    // the screen, and pins the landing mode the way the Recent/Trending
    // toggle does, so the next open comes back here too.
    $('#recentsButton').addEventListener('click', async () => {
        clearTimeout(searchTimer);
        $('#searchInput').value = '';
        $('#clearSearchButton').hidden = true;
        if (settings.landing !== 'recents') settings = await saveSettings({ landing: 'recents' });
        renderLanding();
    });

    $('#favoritesButton').addEventListener('click', renderFavoritesView);
    $('#settingsButton').addEventListener('click', () => {
        view === 'settings' ? closeSettings() : openSettings();
    });

    // v1 nicety: nearing the right edge fattens the scrollbar thumb into the
    // gutter (pure repaint; the scrollbar element never changes size).
    const content = $('#content');
    let pointer = null;
    document.addEventListener('mousemove', (e) => {
        const edge = content.getBoundingClientRect().right;
        content.classList.toggle('wide-scroll', e.clientX > edge - 20 && e.clientX <= edge);

        // Reaching for the mouse hands the grid back to it: drop the keyboard
        // selection so a selected tile and a hovered one cannot sit zoomed at
        // once. This has to hang off mousemove, which only fires when the
        // pointer actually travels; mouseenter also fires when tiles scroll
        // under a still cursor, and select() scrolls on every arrow press.
        const moved = pointer && (e.clientX !== pointer.x || e.clientY !== pointer.y);
        pointer = { x: e.clientX, y: e.clientY };
        if (moved && selected) select(null);
    });

    // Re-lay the grid when the window resizes, since the column count comes
    // from the available width. Only the web app can resize; the extension
    // popup is a fixed 550x600, so this never fires there.
    let reflowTimer;
    window.addEventListener('resize', () => {
        clearTimeout(reflowTimer);
        reflowTimer = setTimeout(reflow, 150);
    });

    $('#saveKeyButton').addEventListener('click', onSaveKey);
    $('#removeKeyButton').addEventListener('click', onRemoveKey);
    $('#providerSelect').addEventListener('change', onProviderChange);
    for (const id of ['defaultActionSelect', 'limitSelect', 'ratingSelect', 'autoCloseCheck', 'liveSearchCheck']) {
        $('#' + id).addEventListener('change', onDefaultsChange);
    }
}

// ---------- keyboard navigation ----------

function select(tile) {
    if (selected) selected.classList.remove('selected');
    selected = tile || null;
    if (selected) {
        // Scroll first, then compute the zoom origin from the settled
        // position, then apply the class that triggers the scale (selection
        // zooms like hover; the favorites view zooms in neither case).
        selected.scrollIntoView({ block: 'nearest' });
        if (!selected.closest('.masonry')?.classList.contains('with-tags')) {
            adjustHoverOrigin(selected);
        }
        selected.classList.add('selected');
    }
}

// Geometric nearest-neighbor: works for masonry, where DOM order is column-major.
function moveSelection(dir) {
    const tiles = [...$('#results').querySelectorAll('.tile')];
    if (!tiles.length) return;
    if (!selected || !tiles.includes(selected)) {
        select(tiles[0]);
        return;
    }
    // Offset geometry, not getBoundingClientRect: the selected tile is
    // scaled 1.6x by the zoom, and offset values ignore transforms, so the
    // zoom cannot skew the scoring. All tiles share an offset parent.
    const cx = selected.offsetLeft + selected.offsetWidth / 2;
    const cy = selected.offsetTop + selected.offsetHeight / 2;
    let best = null;
    let bestScore = Infinity;
    for (const tile of tiles) {
        if (tile === selected) continue;
        const dx = tile.offsetLeft + tile.offsetWidth / 2 - cx;
        const dy = tile.offsetTop + tile.offsetHeight / 2 - cy;
        const forward = dir.x * dx + dir.y * dy;
        if (forward <= 1) continue;
        const score = forward + Math.abs(dir.x ? dy : dx) * 2.5;
        if (score < bestScore) {
            bestScore = score;
            best = tile;
        }
    }
    if (best) select(best);
}

const ARROWS = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
};

function onGridKeydown(e) {
    if (view === 'settings') return;
    const target = e.target;
    if (target.classList?.contains('tag-input')) return;
    const inSearchBox = target === $('#searchInput');

    const dir = ARROWS[e.key];
    if (dir) {
        // Arrows other than Down keep moving the caret while typing.
        if (inSearchBox && e.key !== 'ArrowDown' && !selected) return;
        e.preventDefault();
        if (inSearchBox) target.blur();
        moveSelection(dir);
        return;
    }

    if (!selected || !selected.isConnected) return;
    const data = tileData.get(selected);
    if (!data) return;

    if (e.key === 'Enter') {
        e.preventDefault();
        runAction(settings.defaultAction, data, selected);
    } else if (e.key === 'Escape') {
        select(null);
        $('#searchInput').focus();
    } else if (!inSearchBox && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        selected.querySelector('.heart')?.click();
    } else if (!inSearchBox && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        runAction(Object.keys(ACTIONS)[Number(e.key) - 1], data, selected);
    }
}

// ---------- landing (recents / trending) ----------

async function renderLanding() {
    if (view === 'settings') closeSettings();
    view = 'landing';
    select(null);

    const results = $('#results');
    results.hidden = false;
    results.innerHTML = '';
    const mode = settings.landing === 'trending' ? 'trending' : 'recents';
    const providerLabel = settings.provider === 'klipy' ? 'Klipy' : 'Giphy';
    results.append(el('div', { class: 'caption' },
        mode === 'recents' ? 'Recent copies' : `Trending on ${providerLabel}`,
        landingToggle(mode)));

    if (mode === 'recents') {
        const recents = await getRecents();
        if (view !== 'landing') return;
        if (!recents.length) {
            results.append(hint('GIFs you copy will show up here.'));
            return;
        }
        results.append(masonry(recents, {}, columnsFor(MIN_COL, 3)));
    } else {
        const cacheKey = `${settings.provider}|trending|${settings.limit}|${settings.rating}`;
        let gifs = searchCache.get(cacheKey);
        if (!gifs) {
            results.append(el('div', { class: 'loader' }));
            try {
                const key = await resolveApiKey();
                gifs = await trendingGifs(settings.provider, key, settings);
                searchCache.set(cacheKey, gifs);
            } catch (err) {
                if (view === 'landing') renderError(err);
                return;
            }
            if (view !== 'landing') return;
            results.querySelector('.loader')?.remove();
        }
        results.append(masonry(gifs, {}, columnsFor(MIN_COL, 3)));
    }
}

function landingToggle(mode) {
    const seg = el('span', { class: 'seg' });
    for (const [key, label] of [['recents', 'Recent'], ['trending', 'Trending']]) {
        seg.append(el('button', {
            type: 'button',
            class: mode === key ? 'active' : '',
            onclick: async () => {
                settings = await saveSettings({ landing: key });
                renderLanding();
            },
        }, label));
    }
    return seg;
}

// ---------- search ----------

async function doSearch() {
    const term = $('#searchInput').value.trim();
    if (!term) return;
    if (settings.provider === 'giphy' && !apiKey) {
        openSettings('Add your Giphy API key first.');
        return;
    }
    closeSettings();
    view = 'search';
    select(null);

    const results = $('#results');
    results.innerHTML = '';

    // Repeats of a search this session are free, sparing the hourly quota.
    const cacheKey = `${settings.provider}|${term}|${settings.limit}|${settings.rating}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
        renderResults(matchFavorites(term), cached);
        return;
    }

    results.append(el('div', { class: 'loader' }));
    try {
        const key = await resolveApiKey();
        const gifs = await searchGifs(settings.provider, key, term, settings);
        searchCache.set(cacheKey, gifs);
        // A newer keystroke may have superseded this response.
        if (view !== 'search' || $('#searchInput').value.trim() !== term) return;
        renderResults(matchFavorites(term), gifs);
    } catch (err) {
        renderError(err);
        if (err.status === 401 && settings.provider === 'giphy') {
            openSettings('Giphy rejected the API key. Double-check it below.');
        }
    }
}

// Re-render whatever is on screen so the masonry picks up a new column count.
// Search rebuilds from searchCache, so resizing never costs an API request.
function reflow() {
    if (view === 'landing') renderLanding();
    else if (view === 'favorites') renderFavoritesView();
    else if (view === 'search') doSearch();
}

const searchCache = new Map();

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
    results.append(masonry(items, {}, columnsFor(MIN_COL, 3)));
}

// Fixed-width columns, dynamic tile heights. Each tile goes to the currently
// shortest column (heights tracked from the API's aspect ratios) so reading
// order stays roughly left-to-right and favorites stay on top, Giphy style.
// Columns grow with the window instead of being fixed at three. The floor is
// what the extension's 550px popup already shows, so the popup is unchanged
// and only the web app (which can be any size) ever sees more: a column never
// gets narrower than it is there, it just stops adding columns until the next
// one fits at that width.
const GRID_GAP = 10;              // matches .masonry / .mcol gap in popup.css
const MIN_COL = 165;             // ~the column width three-up at 550px
const MIN_COL_TAGS = 250;        // favorites tiles carry a tag row, so wider
// Ceiling on top of the minimum width: every visible tile is an animated GIF
// decoding continuously, so a really wide window turns into a wall of them
// and the grid gets sluggish. Past five columns the masonry stops growing and
// centers instead, capped by max-width in popup.css.
const MAX_COLS = 5;

function columnsFor(minCol, floor) {
    const content = $('#content');
    const pad = getComputedStyle(content);
    const avail = content.clientWidth
        - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
    // n columns need n*minCol plus (n-1) gaps, so solve with one gap added
    // to both sides rather than special-casing the last column.
    const fits = Math.floor((avail + GRID_GAP) / (minCol + GRID_GAP));
    return Math.min(MAX_COLS, Math.max(floor, fits || floor));
}

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

// HOVER_SCALE is the ceiling, not a constant: the CSS reads --hover-scale
// per tile and falls back to this. FADE_* must match the #content fade-mask
// stops.
const HOVER_SCALE = 1.6;
const FADE_TOP = 0.03;
const FADE_BOTTOM = 0.05;

// Pick a transform-origin so the scaled tile stays fully visible inside the
// scroller, clear of the top/bottom fade zones. A scaled box always contains
// the original, so sliding the origin between 0% and 100% is always enough
// when there is room; when there isn't, keeping the top visible wins.
function adjustHoverOrigin(tile) {
    const content = $('#content');
    const c = content.getBoundingClientRect();
    const r = tile.getBoundingClientRect();
    const minTop = c.top + c.height * FADE_TOP;
    const maxBottom = c.bottom - c.height * FADE_BOTTOM;
    // The scrollbar gutter sits inside the border box but outside the visible
    // area, so the right edge to aim for comes from clientWidth. Using the
    // bounding rect instead lets the scaled tile slide under the scrollbar,
    // where overflow-x clips it and eats the ring on that side.
    const visibleRight = c.left + content.clientWidth;

    // Cap the zoom so a lifted tile can never outgrow the visible area. At the
    // extension's 550px this never binds (three-up tiles are ~167px, and 1.6x
    // of that is well inside the popup), so the popup is untouched; it only
    // engages in the web app, where a wide window makes columns wide enough
    // that a flat 1.6x would run past the edges. Never below 1: shrinking a
    // hovered tile would be worse than not zooming it.
    const scale = Math.max(1, Math.min(
        HOVER_SCALE,
        (content.clientWidth - 8) / r.width,
        (maxBottom - minTop) / r.height));
    tile.style.setProperty('--hover-scale', scale);

    // Everything below is in terms of the scale actually used, not the
    // ceiling, or the origin would be solved for a size the tile never
    // reaches. At scale 1 the extras are 0 and both factors fall back to
    // 0.5, which is the right no-op origin.
    const extraY = r.height * (scale - 1);
    const fyMax = (r.top - minTop) / extraY;
    const fyMin = 1 - (maxBottom - r.bottom) / extraY;
    const fy = Math.max(0, Math.min(1, Math.min(Math.max(0.5, fyMin), fyMax))) || 0.5;

    const extraX = r.width * (scale - 1);
    const fxMax = (r.left - (c.left + 4)) / extraX;
    const fxMin = 1 - ((visibleRight - 4) - r.right) / extraX;
    const fx = Math.max(0, Math.min(1, Math.min(Math.max(0.5, fxMin), fxMax))) || 0.5;

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
    tileData.set(tile, data);
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
        addRecent(data).catch(() => {});
        recordUse(data.id).then((u) => { usage = u; }).catch(() => {});
        // Long enough to see the confirmation, short enough to feel instant.
        if (settings.autoClose && isExtension) setTimeout(() => window.close(), 650);
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
    closeSettings();
    view = 'favorites';
    select(null);

    const results = $('#results');
    results.hidden = false;
    results.innerHTML = '';

    const favs = Object.values(favorites).sort(byMostUsed);
    results.append(el('div', { class: 'caption', id: 'favCaption' }, `Favorites (${favs.length})`));
    if (!favs.length) {
        results.append(hint('No favorites yet. Hover a GIF and click the ♥.'));
        return;
    }
    results.append(masonry(favs, { tags: true }, columnsFor(MIN_COL_TAGS, 2)));
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
    $('#providerSelect').value = settings.provider;
    $('#giphyKeySection').hidden = settings.provider !== 'giphy';
    $('#giphyAttribution').hidden = settings.provider !== 'giphy';
    $('#klipyAttribution').hidden = settings.provider !== 'klipy';
    $('#defaultActionSelect').value = settings.defaultAction;
    $('#limitSelect').value = String(settings.limit);
    $('#ratingSelect').value = settings.rating;
    $('#autoCloseRow').hidden = !isExtension;
    $('#autoCloseCheck').checked = settings.autoClose;
    $('#liveSearchCheck').checked = settings.liveSearch;
    const base = settings.provider === 'klipy' ? 'Search KLIPY' : 'Search GIFs';
    $('#searchInput').placeholder = settings.liveSearch ? base : `${base} (press Enter)`;
}

async function onProviderChange() {
    settings = await saveSettings({ provider: $('#providerSelect').value });
    applySettingsToForm();
}

async function onDefaultsChange() {
    settings = await saveSettings({
        defaultAction: $('#defaultActionSelect').value,
        limit: Number($('#limitSelect').value),
        rating: $('#ratingSelect').value,
        autoClose: $('#autoCloseCheck').checked,
        liveSearch: $('#liveSearchCheck').checked,
    });
    applySettingsToForm();
}

async function onSaveKey() {
    const key = $('#apiKeyInput').value.trim();
    const status = $('#keyStatus');
    if (!key) return;
    status.textContent = 'Checking key…';
    try {
        await validateKey('giphy', key);
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
        message = settings.provider === 'klipy'
            ? 'Klipy returned 401: the shared key was rejected.'
            : 'Giphy returned 401: the API key is bad or lacks access.';
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
