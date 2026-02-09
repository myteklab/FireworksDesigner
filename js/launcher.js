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
        this.flash = 0; // Flash when launching

        // Drag state
        this.isDragging = false;
    }

    /**
     * Trigger launch flash animation
     */
    triggerFlash() {
        this.flash = 1;
    }

    /**
     * Update launcher state
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        // Decay flash
        if (this.flash > 0) {
            this.flash -= dt * 3;
            if (this.flash < 0) this.flash = 0;
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

        // Draw flash effect when launching
        if (this.flash > 0) {
            ctx.globalAlpha = this.flash * 0.8;
            ctx.fillStyle = '#ffcc00';
            ctx.shadowColor = '#ffaa00';
            ctx.shadowBlur = 30;
            ctx.beginPath();
            ctx.arc(x, y - 20, 25, 0, Math.PI * 2);
            ctx.fill();
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
