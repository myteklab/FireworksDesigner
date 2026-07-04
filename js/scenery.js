/**
 * Scenery - backdrop silhouettes and lake reflection
 *
 * Backdrops are procedural silhouettes generated from a fixed seed, so a
 * saved show renders the identical skyline everywhere (editor, share page,
 * thumbnails). The lake mirrors the rendered sky live, so bursts reflect.
 */

const SCENERY_HORIZON_Y = 455; // Matches the ground horizon line
const WATER_DEPTH = 45;        // 455..500 is the water band

const scenery = {
    backdrop: 'none', // 'none' | 'city' | 'mountains' | 'forest' | 'rooftops'
    water: false,
    skyBrightness: 50 // 0 = near black, 50 = classic night, 100 = dusk
};

// Sky color ramp: darkest -> classic night (#0a0a1a) -> blue dusk
const SKY_DARKEST = [3, 3, 10];
const SKY_CLASSIC = [10, 10, 26];
const SKY_DUSK = [38, 44, 84];

function skyColorFor(value) {
    const t = Math.max(0, Math.min(100, value));
    const mix = (a, b, k) => Math.round(a + (b - a) * k);
    const seg = t <= 50 ? [SKY_DARKEST, SKY_CLASSIC, t / 50] : [SKY_CLASSIC, SKY_DUSK, (t - 50) / 50];
    return 'rgb(' + mix(seg[0][0], seg[1][0], seg[2]) + ',' + mix(seg[0][1], seg[1][1], seg[2]) + ',' + mix(seg[0][2], seg[1][2], seg[2]) + ')';
}

function setSkyBrightness(value) {
    scenery.skyBrightness = Math.max(0, Math.min(100, Number(value) || 0));
    backgroundColor = skyColorFor(scenery.skyBrightness);

    const label = document.getElementById('sky-brightness-label');
    if (label) label.textContent = scenery.skyBrightness + '%';
}

// Cached geometry per backdrop, built lazily from a fixed seed
const backdropCache = {};

/**
 * Small deterministic PRNG so silhouettes are identical on every load
 */
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function getScenerySettings() {
    return {
        backdrop: scenery.backdrop,
        water: scenery.water,
        skyBrightness: scenery.skyBrightness
    };
}

function loadScenerySettings(settings) {
    scenery.backdrop = (settings && settings.backdrop) || 'none';
    scenery.water = !!(settings && settings.water);
    setSkyBrightness(settings && settings.skyBrightness !== undefined ? settings.skyBrightness : 50);

    // Sync the settings UI if present
    const select = document.getElementById('backdrop-select');
    if (select) select.value = scenery.backdrop;
    const toggle = document.getElementById('water-enabled');
    if (toggle) toggle.checked = scenery.water;
    const slider = document.getElementById('sky-brightness');
    if (slider) slider.value = scenery.skyBrightness;
}

/**
 * Wire up the Scenery section of the settings modal
 */
function initScenery() {
    const select = document.getElementById('backdrop-select');
    if (select) {
        select.addEventListener('change', function () {
            scenery.backdrop = this.value;
            markDirty();
        });
    }

    const toggle = document.getElementById('water-enabled');
    if (toggle) {
        toggle.addEventListener('change', function () {
            scenery.water = this.checked;
            markDirty();
        });
    }

    const slider = document.getElementById('sky-brightness');
    if (slider) {
        slider.addEventListener('input', function () {
            setSkyBrightness(this.value);
            markDirty();
        });
    }
}

// ── Backdrop geometry builders ──────────────────────────────────────

function buildCity(rand) {
    const buildings = [];
    let x = -10;
    while (x < 810) {
        const w = 26 + rand() * 42;
        const tall = rand() < 0.18;
        const h = tall ? 95 + rand() * 55 : 35 + rand() * 60;
        const b = { x: x, w: w, h: h, windows: [], antenna: tall && rand() < 0.6 };

        // Sparse warm lit windows
        const cols = Math.max(1, Math.floor(w / 11));
        const rows = Math.max(1, Math.floor(h / 13));
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows; r++) {
                if (rand() < 0.22) {
                    b.windows.push({
                        wx: 4 + c * (w - 8) / cols,
                        wy: 6 + r * (h - 10) / rows,
                        alpha: 0.3 + rand() * 0.45
                    });
                }
            }
        }
        buildings.push(b);
        x += w + 1 + rand() * 6;
    }
    return { kind: 'city', buildings: buildings, glow: true };
}

function buildFractalRidge(rand, ampMin, ampMax, roughness) {
    // Coarse peaks, then midpoint displacement for a natural rocky line
    let points = [{ x: -40, y: ampMin * 0.5 }];
    let x = -40;
    while (x < 840) {
        x += 130 + rand() * 130;
        points.push({ x: x, y: ampMin + rand() * (ampMax - ampMin) });
    }
    points.push({ x: 880, y: ampMin * 0.5 });

    for (let iter = 0; iter < 4; iter++) {
        const next = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const midY = (a.y + b.y) / 2 + (rand() - 0.5) * (b.x - a.x) * roughness;
            next.push({ x: (a.x + b.x) / 2, y: Math.max(2, midY) });
            next.push(b);
        }
        points = next;
    }
    return points;
}

function buildMountains(rand) {
    return {
        kind: 'mountains',
        far: buildFractalRidge(rand, 95, 170, 0.18),
        mid: buildFractalRidge(rand, 50, 105, 0.26),
        near: buildFractalRidge(rand, 18, 55, 0.34)
    };
}

function buildForest(rand) {
    // Distant forest: short pines packed so tightly they merge into a mass
    const mass = [];
    let x = -10;
    while (x < 810) {
        mass.push({ x: x, h: 26 + rand() * 26, w: 15 + rand() * 10, tiers: 3 });
        x += 5 + rand() * 6;
    }

    // Gently rolling ground the near trees stand on
    const ground = buildFractalRidge(rand, 4, 16, 0.05);

    // Near pines: varied heights, widths, and tier counts, uneven spacing
    const near = [];
    x = -10 + rand() * 30;
    while (x < 810) {
        near.push({
            x: x,
            h: 45 + rand() * 65,
            w: 16 + rand() * 16,
            tiers: 2 + Math.floor(rand() * 3)
        });
        x += 24 + rand() * 55;
    }

    return { kind: 'forest', mass: mass, ground: ground, near: near };
}

function buildRooftops(rand) {
    const houses = [];
    let x = -15;
    while (x < 815) {
        const w = 55 + rand() * 40;
        const wall = 22 + rand() * 22;
        const roof = 16 + rand() * 14;
        const h = { x: x, w: w, wall: wall, roof: roof, chimney: rand() < 0.5, windows: [] };
        const windowCount = 1 + Math.floor(rand() * 3);
        for (let i = 0; i < windowCount; i++) {
            if (rand() < 0.6) {
                h.windows.push({
                    wx: 8 + rand() * (w - 22),
                    wy: 6 + rand() * (wall - 14),
                    alpha: 0.35 + rand() * 0.4
                });
            }
        }
        houses.push(h);
        x += w + 4 + rand() * 14;
    }
    return { kind: 'rooftops', houses: houses, glow: true };
}

function getBackdropGeometry(name) {
    if (!backdropCache[name]) {
        const rand = mulberry32({ city: 1776, mountains: 1812, forest: 1620, rooftops: 1901 }[name] || 1);
        backdropCache[name] = {
            city: buildCity,
            mountains: buildMountains,
            forest: buildForest,
            rooftops: buildRooftops
        }[name](rand);
    }
    return backdropCache[name];
}

// ── Backdrop rendering ──────────────────────────────────────────────

/**
 * Draw the selected backdrop silhouette. Called after stars, before
 * fireworks, so bursts light up the sky above it.
 */
function drawBackdrop(ctx) {
    if (scenery.backdrop === 'none') return;
    const geo = getBackdropGeometry(scenery.backdrop);
    const baseY = SCENERY_HORIZON_Y;

    ctx.save();

    // Faint light-pollution glow above city-like skylines
    if (geo.glow) {
        const glow = ctx.createLinearGradient(0, baseY - 130, 0, baseY);
        glow.addColorStop(0, 'rgba(90, 70, 130, 0)');
        glow.addColorStop(1, 'rgba(90, 70, 130, 0.14)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, baseY - 130, 800, 130);
    }

    if (geo.kind === 'city') {
        ctx.fillStyle = '#050712';
        geo.buildings.forEach(b => {
            ctx.fillRect(b.x, baseY - b.h, b.w, b.h + 4);
            if (b.antenna) {
                ctx.fillRect(b.x + b.w / 2 - 1, baseY - b.h - 14, 2, 14);
            }
        });
        // Lit windows
        geo.buildings.forEach(b => {
            b.windows.forEach(w => {
                ctx.fillStyle = `rgba(255, 208, 120, ${w.alpha})`;
                ctx.fillRect(b.x + w.wx, baseY - b.h + w.wy, 3, 4);
            });
        });
    }

    if (geo.kind === 'mountains') {
        const drawRidge = (points, color) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(points[0].x, baseY + 6);
            points.forEach(p => ctx.lineTo(p.x, baseY - p.y));
            ctx.lineTo(880, baseY + 6);
            ctx.closePath();
            ctx.fill();
        };
        drawRidge(geo.far, '#161c3d');
        drawRidge(geo.mid, '#0c1028');
        drawRidge(geo.near, '#05070f');
    }

    if (geo.kind === 'forest') {
        const drawPine = (t, rootY) => {
            ctx.beginPath();
            ctx.moveTo(t.x, rootY - t.h);
            for (let i = 1; i <= t.tiers; i++) {
                const y = rootY - t.h + (t.h * 0.82) * (i / t.tiers);
                const half = (t.w / 2) * (i / t.tiers);
                ctx.lineTo(t.x + half, y);
                if (i < t.tiers) ctx.lineTo(t.x + half * 0.4, y);
            }
            ctx.lineTo(t.x + 2, rootY - t.h * 0.15);
            ctx.lineTo(t.x + 2, rootY + 4);
            ctx.lineTo(t.x - 2, rootY + 4);
            ctx.lineTo(t.x - 2, rootY - t.h * 0.15);
            for (let i = t.tiers; i >= 1; i--) {
                const y = rootY - t.h + (t.h * 0.82) * (i / t.tiers);
                const half = (t.w / 2) * (i / t.tiers);
                if (i < t.tiers) ctx.lineTo(t.x - half * 0.4, y);
                ctx.lineTo(t.x - half, y);
            }
            ctx.closePath();
            ctx.fill();
        };

        // Height of the rolling ground at a given x
        const groundAt = (gx) => {
            const pts = geo.ground;
            for (let i = 1; i < pts.length; i++) {
                if (pts[i].x >= gx) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    const t = (gx - a.x) / (b.x - a.x || 1);
                    return a.y + (b.y - a.y) * t;
                }
            }
            return pts[pts.length - 1].y;
        };

        // Distant tree mass, merged into one dark band
        ctx.fillStyle = '#0c1129';
        geo.mass.forEach(t => drawPine(t, baseY - groundAt(t.x) * 0.4));

        // Rolling ground fill
        ctx.fillStyle = '#04060d';
        ctx.beginPath();
        ctx.moveTo(-10, baseY + 6);
        geo.ground.forEach(p => ctx.lineTo(p.x, baseY - p.y));
        ctx.lineTo(880, baseY + 6);
        ctx.closePath();
        ctx.fill();

        // Near pines rooted on the rolling ground
        geo.near.forEach(t => drawPine(t, baseY - groundAt(t.x) + 2));
    }

    if (geo.kind === 'rooftops') {
        ctx.fillStyle = '#050712';
        geo.houses.forEach(h => {
            const top = baseY - h.wall;
            ctx.fillRect(h.x, top, h.w, h.wall + 4);
            ctx.beginPath();
            ctx.moveTo(h.x - 3, top);
            ctx.lineTo(h.x + h.w / 2, top - h.roof);
            ctx.lineTo(h.x + h.w + 3, top);
            ctx.closePath();
            ctx.fill();
            if (h.chimney) {
                ctx.fillRect(h.x + h.w * 0.72, top - h.roof * 0.75, 7, h.roof * 0.75);
            }
        });
        geo.houses.forEach(h => {
            h.windows.forEach(w => {
                ctx.fillStyle = `rgba(255, 208, 120, ${w.alpha})`;
                ctx.fillRect(h.x + w.wx, baseY - h.wall + w.wy, 5, 5);
            });
        });
    }

    ctx.restore();
}

// ── Water rendering ─────────────────────────────────────────────────

/**
 * Draw the lake: a compressed live mirror of the sky above the waterline,
 * with animated ripple, depth tint, and a bright waterline.
 * Called after fireworks are drawn, so bursts reflect.
 *
 * @param {CanvasRenderingContext2D} ctx - Target context (logic space)
 * @param {HTMLCanvasElement} sourceCanvas - The canvas holding the scene
 * @param {number} bufferScale - Buffer pixels per logic pixel
 * @param {number} timestamp - For ripple animation (ms)
 */
function drawWater(ctx, sourceCanvas, bufferScale, timestamp) {
    if (!scenery.water) return;

    const waterY = SCENERY_HORIZON_Y;
    const srcH = 320; // Sky strip that gets mirrored; deep compression reads as a grazing-angle reflection

    ctx.save();

    // Water base
    ctx.fillStyle = '#081226';
    ctx.fillRect(0, waterY, 800, WATER_DEPTH);

    // Mirrored sky, drawn in horizontal slices with animated offsets.
    // Additive blending makes bright bursts genuinely glow on the water.
    const slices = 9;
    const sliceH = WATER_DEPTH / slices;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < slices; i++) {
        const dstY = waterY + i * sliceH;
        // Deeper water reflects higher sky
        const srcY = waterY - (i + 1) * (srcH / slices);
        const wobble = Math.sin(timestamp / 600 + i * 1.4) * (1 + i * 0.35);

        ctx.save();
        ctx.translate(wobble, 0);
        ctx.scale(1, -1);
        ctx.drawImage(
            sourceCanvas,
            0, srcY * bufferScale, sourceCanvas.width, (srcH / slices) * bufferScale,
            0, -(dstY + sliceH), 800, sliceH
        );
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Depth tint: darker and bluer toward the bottom
    const tint = ctx.createLinearGradient(0, waterY, 0, waterY + WATER_DEPTH);
    tint.addColorStop(0, 'rgba(10, 22, 55, 0.12)');
    tint.addColorStop(1, 'rgba(5, 10, 30, 0.45)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, waterY, 800, WATER_DEPTH);

    // Waterline
    ctx.strokeStyle = 'rgba(140, 170, 230, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waterY + 0.5);
    ctx.lineTo(800, waterY + 0.5);
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw barge hulls under the launchers when the lake is on
 * (fireworks fired from the water launch from barges)
 */
function drawBarges(ctx, launchers) {
    if (!scenery.water) return;

    ctx.save();
    launchers.forEach(l => {
        // Hull
        ctx.fillStyle = '#141a30';
        ctx.beginPath();
        ctx.moveTo(l.x - 26, l.y - 8);
        ctx.lineTo(l.x + 26, l.y - 8);
        ctx.lineTo(l.x + 20, l.y + 4);
        ctx.lineTo(l.x - 20, l.y + 4);
        ctx.closePath();
        ctx.fill();

        // Lit deck edge
        ctx.strokeStyle = 'rgba(170, 190, 230, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.x - 26, l.y - 8.5);
        ctx.lineTo(l.x + 26, l.y - 8.5);
        ctx.stroke();

        // Faint hull shadow on the water
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(l.x, l.y + 6, 24, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}
