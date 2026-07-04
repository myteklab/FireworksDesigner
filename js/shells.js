/**
 * Custom Shells - user-designed burst patterns and text fireworks
 *
 * A shell is a set of points normalized to roughly [-1, 1] that a burst
 * expands into. Shells are stored per-project and serialized with the show.
 */

// Project shell library: [{ id, name, points: [{x, y}, ...] }]
let customShells = [];

// Cached point sets for text fireworks, keyed by uppercased text
const textPointsCache = {};

// Text fireworks allow a limited, friendly character set
const TEXT_ALLOWED = /^[A-Za-z0-9 !?.'\-+=*#&]{1,14}$/;
const MAX_SHELL_POINTS = 260;

/**
 * Get a shell by id
 */
function getShellById(id) {
    return customShells.find(s => s.id === id) || null;
}

/**
 * Add a shell to the library
 */
function addCustomShell(name, points) {
    const shell = {
        id: 'shl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: name,
        points: points
    };
    customShells.push(shell);
    return shell;
}

/**
 * Remove a shell from the library
 */
function removeCustomShell(id) {
    const index = customShells.findIndex(s => s.id === id);
    if (index !== -1) {
        customShells.splice(index, 1);
        return true;
    }
    return false;
}

/**
 * Serialize the shell library for saving
 */
function serializeShells() {
    return customShells.map(s => ({
        id: s.id,
        name: s.name,
        points: s.points.map(p => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }))
    }));
}

/**
 * Load the shell library from saved data
 */
function loadShells(data) {
    customShells = [];
    if (!data || !Array.isArray(data)) return;
    data.forEach(s => {
        if (s && s.id && Array.isArray(s.points)) {
            customShells.push({
                id: s.id,
                name: String(s.name || 'My Shell').slice(0, 20),
                points: s.points
                    .filter(p => p && typeof p.x === 'number' && typeof p.y === 'number')
                    .slice(0, MAX_SHELL_POINTS)
            });
        }
    });
}

/**
 * Validate text for a text firework
 */
function isValidFireworkText(text) {
    return typeof text === 'string' && TEXT_ALLOWED.test(text.trim());
}

/**
 * Thin a point list down to a maximum count, keeping even coverage
 */
function thinPoints(points, max) {
    if (points.length <= max) return points;
    const step = points.length / max;
    const out = [];
    for (let i = 0; i < points.length; i += step) {
        out.push(points[Math.floor(i)]);
    }
    return out;
}

/**
 * Sample a word into normalized burst points by rasterizing it offscreen.
 * Aspect ratio is preserved: wide words burst wide.
 */
function getTextPoints(text) {
    const key = String(text).trim().toUpperCase();
    if (textPointsCache[key]) return textPointsCache[key];

    const W = 280;
    const H = 90;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const cx = c.getContext('2d');

    // Shrink the font until the word fits
    let fontSize = 68;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    do {
        cx.font = 'bold ' + fontSize + 'px Arial, sans-serif';
        if (cx.measureText(key).width <= W - 12) break;
        fontSize -= 4;
    } while (fontSize > 14);

    cx.fillStyle = '#ffffff';
    cx.fillText(key, W / 2, H / 2);

    // Sample lit pixels into centered points
    const data = cx.getImageData(0, 0, W, H).data;
    let points = [];
    const stride = 2;
    for (let py = 0; py < H; py += stride) {
        for (let px = 0; px < W; px += stride) {
            if (data[(py * W + px) * 4 + 3] > 128) {
                points.push({ x: px - W / 2, y: py - H / 2 });
            }
        }
    }
    if (points.length === 0) return [];

    points = thinPoints(points, MAX_SHELL_POINTS);

    // Normalize preserving aspect: the widest dimension maps to 1
    let maxDim = 1;
    points.forEach(p => {
        maxDim = Math.max(maxDim, Math.abs(p.x), Math.abs(p.y));
    });
    const normalized = points.map(p => ({
        x: p.x / maxDim,
        y: p.y / maxDim
    }));

    textPointsCache[key] = normalized;
    return normalized;
}

/**
 * Resolve the burst points for an event/firework config, or null
 */
function resolveShellPoints(config) {
    if (config.shellPoints && Array.isArray(config.shellPoints)) {
        return config.shellPoints;
    }
    if (config.type === 'text' && config.text) {
        return getTextPoints(config.text);
    }
    if (config.type === 'custom' && config.shellId) {
        const shell = getShellById(config.shellId);
        return shell ? shell.points : null;
    }
    return null;
}
