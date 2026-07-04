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

// ── Content filter for text fireworks and shell names ──────────────
// Severe terms are blocked anywhere in the text; ambiguous short words
// only as whole words (so CLASS, PEACOCK, HELLO stay fine). Matches the
// platform's server-side ProfanityFilter list, plus leet normalization.
// Shared-gallery moderation remains the backstop.
const TEXT_BLOCK_SUBSTR = [
    'fuck', 'cunt', 'nigg', 'faggot', 'bitch', 'whore', 'slut',
    'asshole', 'dickhead', 'bastard', 'cocksuck', 'blowjob', 'handjob',
    'jackass', 'dumbass', 'retard', 'wanker', 'bollock', 'goddamn',
    'bullshit', 'jerkoff', 'porn', 'hitler', 'nazi'
];
const TEXT_BLOCK_WORD = [
    'ass', 'shit', 'damn', 'hell', 'dick', 'cock', 'tits', 'piss',
    'fag', 'crap', 'twat', 'prick', 'pussy', 'cum', 'sex', 'hoe',
    'kys', 'kms', 'kkk', 'rape', 'stfu', 'wtf'
];

function normalizeForFilter(text) {
    const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '+': 't' };
    return String(text).toLowerCase().split('').map(ch => leet[ch] || ch).join('');
}

function containsBlockedWord(text) {
    const norm = normalizeForFilter(text);
    const squeezed = norm.replace(/[^a-z]/g, '');
    const collapsed = squeezed.replace(/(.)\1+/g, '$1'); // fuuuck -> fuck
    if (TEXT_BLOCK_SUBSTR.some(w => squeezed.includes(w) || collapsed.includes(w))) {
        return true;
    }
    const words = norm.replace(/[^a-z]/g, ' ').split(/\s+/).filter(Boolean);
    return words.some(w => TEXT_BLOCK_WORD.includes(w) || TEXT_BLOCK_WORD.includes(w.replace(/(.)\1+/g, '$1')));
}

// ── Starter shells ──────────────────────────────────────────────────
// Built into the app (not stored in projects); events reference them by
// id ("builtin:star") so they work in every project and on share pages.
const BUILTIN_SHELLS = (function () {
    function circlePoints(count, radius, cx = 0, cy = 0) {
        const pts = [];
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2;
            pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
        }
        return pts;
    }

    function polygonOutline(vertices, perEdge) {
        const pts = [];
        for (let i = 0; i < vertices.length; i++) {
            const a = vertices[i];
            const b = vertices[(i + 1) % vertices.length];
            for (let j = 0; j < perEdge; j++) {
                const t = j / perEdge;
                pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
        }
        return pts;
    }

    // Five-pointed star outline
    const starVerts = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        starVerts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    // Spiral winding out from the center
    const spiralPts = [];
    for (let i = 0; i < 40; i++) {
        const t = i / 39;
        const a = t * Math.PI * 4;
        const r = 0.12 + 0.88 * t;
        spiralPts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    // Smiley: face outline, eyes, smile arc
    const smileyPts = circlePoints(30, 1);
    smileyPts.push(
        { x: -0.35, y: -0.32 }, { x: -0.35, y: -0.44 }, { x: -0.28, y: -0.38 }, { x: -0.42, y: -0.38 },
        { x: 0.35, y: -0.32 }, { x: 0.35, y: -0.44 }, { x: 0.28, y: -0.38 }, { x: 0.42, y: -0.38 }
    );
    for (let i = 0; i < 11; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / 10));
        smileyPts.push({ x: Math.cos(a) * 0.55, y: Math.sin(a) * 0.55 });
    }

    // Diamond outline
    const diamondVerts = [{ x: 0, y: -1 }, { x: 0.7, y: 0 }, { x: 0, y: 1 }, { x: -0.7, y: 0 }];

    return {
        'builtin:star': { id: 'builtin:star', name: 'Star', points: polygonOutline(starVerts, 4), builtin: true },
        'builtin:spiral': { id: 'builtin:spiral', name: 'Spiral', points: spiralPts, builtin: true },
        'builtin:smiley': { id: 'builtin:smiley', name: 'Smiley', points: smileyPts, builtin: true },
        'builtin:diamond': { id: 'builtin:diamond', name: 'Diamond', points: polygonOutline(diamondVerts, 8), builtin: true }
    };
})();

/**
 * Get a shell by id (starter shells or the project library)
 */
function getShellById(id) {
    if (id && BUILTIN_SHELLS[id]) return BUILTIN_SHELLS[id];
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
 * Validate text for a text firework (charset, length, content)
 */
function isValidFireworkText(text) {
    return typeof text === 'string' &&
           TEXT_ALLOWED.test(text.trim()) &&
           !containsBlockedWord(text);
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
