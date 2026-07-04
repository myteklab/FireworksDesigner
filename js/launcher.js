/**
 * Launcher Class - Ground launcher positions
 */
class Launcher {
    constructor(id, x, canvasHeight) {
        this.id = id;
        this.x = x;
        this.y = canvasHeight - 20; // Near bottom of canvas
        this.enabled = true;
        this.width = 30;
        this.height = 40;
        this.canvasHeight = canvasHeight;

        // Animation state
        this.flash = 0; // Sharp muzzle flash (fast decay)
        this.glow = 0;  // Lingering afterglow and ground light (slow decay)
        this.sparks = []; // Ejected sparks from the tube mouth

        // Drag state
        this.isDragging = false;
    }

    /**
     * Trigger launch flash animation
     */
    triggerFlash() {
        this.flash = 1;
        this.glow = 1;

        // Eject a burst of sparks from the tube mouth
        const mouthY = this.y - 32;
        const count = 10 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            this.sparks.push({
                x: this.x + (Math.random() - 0.5) * 8,
                y: mouthY,
                vx: (Math.random() - 0.5) * 90,
                vy: -70 - Math.random() * 140,
                life: 0,
                maxLife: 0.3 + Math.random() * 0.4,
                size: 1 + Math.random() * 1.8
            });
        }
    }

    /**
     * Update launcher state
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Sharp flash decays fast (~0.25s), afterglow lingers (~0.7s)
        if (this.flash > 0) {
            this.flash = Math.max(0, this.flash - dt * 4);
        }
        if (this.glow > 0) {
            this.glow = Math.max(0, this.glow - dt * 1.5);
        }

        // Sparks fly out with gravity
        if (this.sparks.length > 0) {
            this.sparks = this.sparks.filter(s => {
                s.life += dt;
                s.vy += 320 * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                return s.life < s.maxLife;
            });
        }
    }

    /**
     * Draw launcher on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {boolean} isSelected - Whether this launcher is selected in UI
     */
    draw(ctx, isSelected = false) {
        const x = this.x;
        const y = this.y;

        ctx.save();

        // Warm light pool spilling onto the ground while firing
        if (this.glow > 0) {
            const g = this.glow * this.glow;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.translate(x, y - 6);
            ctx.scale(1, 0.4);
            const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, 95);
            pool.addColorStop(0, `rgba(255, 175, 80, ${0.4 * g})`);
            pool.addColorStop(0.45, `rgba(255, 120, 40, ${0.16 * g})`);
            pool.addColorStop(1, 'rgba(255, 90, 20, 0)');
            ctx.fillStyle = pool;
            ctx.beginPath();
            ctx.arc(0, 0, 95, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.globalAlpha = 1;

        // Draw mortar tube
        const gradient = ctx.createLinearGradient(x - 12, y, x + 12, y);
        gradient.addColorStop(0, '#333');
        gradient.addColorStop(0.5, '#555');
        gradient.addColorStop(1, '#333');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x - 8, y - 30);
        ctx.lineTo(x + 8, y - 30);
        ctx.lineTo(x + 10, y);
        ctx.closePath();
        ctx.fill();

        // Draw tube rim
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(x, y - 30, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw inner darkness
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(x, y - 30, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw base
        ctx.fillStyle = '#444';
        ctx.fillRect(x - 15, y - 5, 30, 10);

        // Muzzle effects sit in front of the tube
        const mouthY = y - 32;

        // Lingering ember glow inside the tube mouth
        if (this.glow > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const ember = ctx.createRadialGradient(x, mouthY + 2, 0, x, mouthY + 2, 9);
            ember.addColorStop(0, `rgba(255, 190, 90, ${0.55 * this.glow})`);
            ember.addColorStop(1, 'rgba(255, 100, 20, 0)');
            ctx.fillStyle = ember;
            ctx.beginPath();
            ctx.arc(x, mouthY + 2, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Sharp muzzle flash: white-hot core with orange falloff, flickering
        if (this.flash > 0) {
            const f = this.flash;
            const flicker = 0.85 + Math.random() * 0.15;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            const r = (7 + 24 * f) * flicker;
            const core = ctx.createRadialGradient(x, mouthY, 0, x, mouthY, r);
            core.addColorStop(0, `rgba(255, 255, 235, ${0.95 * f})`);
            core.addColorStop(0.3, `rgba(255, 215, 130, ${0.7 * f})`);
            core.addColorStop(0.65, `rgba(255, 135, 45, ${0.35 * f})`);
            core.addColorStop(1, 'rgba(255, 80, 0, 0)');
            ctx.fillStyle = core;
            ctx.beginPath();
            ctx.arc(x, mouthY, r, 0, Math.PI * 2);
            ctx.fill();

            // Brief vertical flame jet in the first instants of launch
            if (f > 0.45) {
                const jetH = (58 * (f - 0.45) / 0.55) * flicker;
                const jet = ctx.createLinearGradient(x, mouthY, x, mouthY - jetH);
                jet.addColorStop(0, `rgba(255, 240, 185, ${0.85 * f})`);
                jet.addColorStop(0.5, `rgba(255, 165, 65, ${0.45 * f})`);
                jet.addColorStop(1, 'rgba(255, 100, 20, 0)');
                ctx.fillStyle = jet;
                ctx.beginPath();
                ctx.moveTo(x - 5, mouthY);
                ctx.quadraticCurveTo(x - 2, mouthY - jetH * 0.55, x, mouthY - jetH);
                ctx.quadraticCurveTo(x + 2, mouthY - jetH * 0.55, x + 5, mouthY);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }

        // Ejected sparks
        if (this.sparks.length > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            this.sparks.forEach(s => {
                const t = 1 - s.life / s.maxLife;
                ctx.globalAlpha = t;
                ctx.fillStyle = t > 0.55 ? '#ffe9b3' : '#ff9c3f';
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * t + 0.4, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        }

        // Draw launcher number
        ctx.fillStyle = isSelected ? '#9b59b6' : '#888';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id.toString(), x, y + 15);

        // Draw selection indicator
        if (isSelected) {
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y - 15, 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw drag indicator when dragging
        if (this.isDragging) {
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(x, y - 15, 24, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    /**
     * Set position (for dragging)
     */
    setPosition(newX) {
        this.x = newX;
    }

    /**
     * Check if a point is within this launcher's clickable area
     */
    containsPoint(px, py) {
        return Math.abs(px - this.x) < 20 && Math.abs(py - this.y) < 30;
    }

    /**
     * Get launch position for firework
     */
    getLaunchPosition() {
        return {
            x: this.x,
            y: this.y - 30 // Top of mortar tube
        };
    }
}

/**
 * LauncherManager - Manages all launchers
 */
class LauncherManager {
    constructor(canvasWidth, canvasHeight) {
        this.launchers = [];
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.nextId = 1;
        this.maxLaunchers = 10;
        this.minLaunchers = 1;

        // Drag state
        this.draggingLauncher = null;

        // Callbacks
        this.onLaunchersChanged = null;

        // Create default 5 launchers evenly spaced
        this.initDefaultLaunchers();
    }

    /**
     * Initialize default launcher positions
     */
    initDefaultLaunchers() {
        const spacing = this.canvasWidth / 6;
        for (let i = 1; i <= 5; i++) {
            const x = spacing * i;
            this.launchers.push(new Launcher(i, x, this.canvasHeight));
        }
        this.nextId = 6;
    }

    /**
     * Add a new launcher at specified position or center
     */
    addLauncher(x = null) {
        if (this.launchers.length >= this.maxLaunchers) {
            return null; // Max launchers reached
        }

        // Default position: center of canvas
        if (x === null) {
            x = this.canvasWidth / 2;
        }

        // Clamp to canvas bounds
        x = Math.max(30, Math.min(this.canvasWidth - 30, x));

        const launcher = new Launcher(this.nextId, x, this.canvasHeight);
        this.launchers.push(launcher);
        this.nextId++;

        // Notify of change
        if (this.onLaunchersChanged) {
            this.onLaunchersChanged();
        }

        return launcher;
    }

    /**
     * Remove a launcher by ID
     */
    removeLauncher(id) {
        if (this.launchers.length <= this.minLaunchers) {
            return false; // Must keep at least one launcher
        }

        const index = this.launchers.findIndex(l => l.id === id);
        if (index !== -1) {
            this.launchers.splice(index, 1);

            // Notify of change
            if (this.onLaunchersChanged) {
                this.onLaunchersChanged();
            }
            return true;
        }
        return false;
    }

    /**
     * Start dragging a launcher
     */
    startDrag(launcher) {
        this.draggingLauncher = launcher;
        launcher.isDragging = true;
    }

    /**
     * Update drag position
     */
    updateDrag(x) {
        if (this.draggingLauncher) {
            // Clamp to canvas bounds
            x = Math.max(30, Math.min(this.canvasWidth - 30, x));
            this.draggingLauncher.setPosition(x);
        }
    }

    /**
     * End dragging
     */
    endDrag() {
        if (this.draggingLauncher) {
            this.draggingLauncher.isDragging = false;
            this.draggingLauncher = null;

            // Notify of change
            if (this.onLaunchersChanged) {
                this.onLaunchersChanged();
            }
        }
    }

    /**
     * Check if currently dragging
     */
    isDragging() {
        return this.draggingLauncher !== null;
    }

    /**
     * Space launchers evenly across the canvas in numeric order,
     * so the visible numbers read 1, 2, 3... left to right
     */
    distributeEvenly() {
        const sorted = [...this.launchers].sort((a, b) => a.id - b.id);
        const spacing = this.canvasWidth / (sorted.length + 1);
        sorted.forEach((launcher, i) => {
            launcher.setPosition(spacing * (i + 1));
        });

        if (this.onLaunchersChanged) {
            this.onLaunchersChanged();
        }
    }

    /**
     * Clear all launchers and reset
     */
    clearLaunchers() {
        this.launchers = [];
        this.nextId = 1;
    }

    /**
     * Load launchers from saved data
     */
    loadFromData(launcherData) {
        if (!launcherData || !Array.isArray(launcherData)) return;

        // Clear existing launchers
        this.launchers = [];
        this.nextId = 1;

        // Load each launcher from data
        launcherData.forEach(data => {
            const launcher = new Launcher(data.id, data.x, this.canvasHeight);
            launcher.enabled = data.enabled !== false;
            this.launchers.push(launcher);

            // Track highest ID for next launcher
            if (data.id >= this.nextId) {
                this.nextId = data.id + 1;
            }
        });

        // If no launchers loaded, create default
        if (this.launchers.length === 0) {
            this.initDefaultLaunchers();
        }

        // Notify of change
        if (this.onLaunchersChanged) {
            this.onLaunchersChanged();
        }
    }

    /**
     * Get launcher by ID
     */
    getLauncherById(id) {
        return this.launchers.find(l => l.id === id);
    }

    /**
     * Get launcher at a specific point (for click detection)
     */
    getLauncherAtPoint(x, y) {
        return this.launchers.find(l => l.containsPoint(x, y));
    }

    /**
     * Trigger flash on a specific launcher
     */
    triggerLaunch(launcherId) {
        const launcher = this.getLauncherById(launcherId);
        if (launcher) {
            launcher.triggerFlash();
        }
    }

    /**
     * Update all launchers
     */
    update(dt) {
        this.launchers.forEach(l => l.update(dt));
    }

    /**
     * Draw all launchers
     */
    draw(ctx, selectedLauncherId = null) {
        this.launchers.forEach(l => {
            l.draw(ctx, l.id === selectedLauncherId);
        });
    }

    /**
     * Serialize launcher data for saving
     */
    toJSON() {
        return this.launchers.map(l => ({
            id: l.id,
            x: l.x,
            enabled: l.enabled
        }));
    }
}
