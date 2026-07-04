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
    water: false
};

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
    return { backdrop: scenery.backdrop, water: scenery.water };
}

function loadScenerySettings(settings) {
    scenery.backdrop = (settings && settings.backdrop) || 'none';
    scenery.water = !!(settings && settings.water);

    // Sync the settings UI if present
    const select = document.getElementById('backdrop-select');
    if (select) select.value = scenery.backdrop;
    const toggle = document.getElementById('water-enabled');
    if (toggle) toggle.checked = scenery.water;
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

function buildRidge(rand, amplitudeMin, amplitudeMax) {
    // A ridge as peaks connected across the width
    const points = [{ x: -20, y: 0 }];
    let x = -20;
    while (x < 820) {
        x += 60 + rand() * 90;
        points.push({ x: x, y: amplitudeMin + rand() * (amplitudeMax - amplitudeMin) });
    }
    points.push({ x: 840, y: 0 });
    return points;
}

function buildMountains(rand) {
    return {
        kind: 'mountains',
        far: buildRidge(rand, 70, 150),
        near: buildRidge(rand, 25, 85)
    };
}

function buildForest(rand) {
    function treeRow(minH, maxH, avgGap) {
        const trees = [];
        let x = -10 + rand() * 20;
        while (x < 810) {
            trees.push({ x: x, h: minH + rand() * (maxH - minH), w: 16 + rand() * 12 });
            x += avgGap * (0.7 + rand() * 0.6);
        }
        return trees;
    }
    return {
        kind: 'forest',
        far: treeRow(35, 60, 30),
        near: treeRow(55, 95, 46)
    };
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
            ctx.lineTo(840, baseY + 6);
            ctx.closePath();
            ctx.fill();
        };
        drawRidge(geo.far, '#101530');
        drawRidge(geo.near, '#070a18');
    }

    if (geo.kind === 'forest') {
        const drawRow = (trees, color) => {
            ctx.fillStyle = color;
            trees.forEach(t => {
                // A pine as one stepped polygon: tip down zigzag sides + trunk
                const tiers = 3;
                ctx.beginPath();
                ctx.moveTo(t.x, baseY - t.h);
                for (let i = 1; i <= tiers; i++) {
                    const y = baseY - t.h + (t.h * 0.82) * (i / tiers);
                    const half = (t.w / 2) * (i / tiers);
                    ctx.lineTo(t.x + half, y);
                    if (i < tiers) ctx.lineTo(t.x + half * 0.4, y);
                }
                ctx.lineTo(t.x + 2, baseY - t.h * 0.15);
                ctx.lineTo(t.x + 2, baseY + 4);
                ctx.lineTo(t.x - 2, baseY + 4);
                ctx.lineTo(t.x - 2, baseY - t.h * 0.15);
                for (let i = tiers; i >= 1; i--) {
                    const y = baseY - t.h + (t.h * 0.82) * (i / tiers);
                    const half = (t.w / 2) * (i / tiers);
                    if (i < tiers) ctx.lineTo(t.x - half * 0.4, y);
                    ctx.lineTo(t.x - half, y);
                }
                ctx.closePath();
                ctx.fill();
            });
        };
        drawRow(geo.far, '#0a0e1f');
        drawRow(geo.near, '#05070f');
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
