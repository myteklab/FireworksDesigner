/**
 * Show Class - Manages the fireworks show sequence
 */
class Show {
    constructor(launcherManager) {
        this.launcherManager = launcherManager;
        this.events = [];
        this.activeFireworks = [];
        this.currentTime = 0;
        this.duration = 30000; // Default 30 seconds
        this.isPlaying = false;
        this.playbackSpeed = 1;
        this.loop = false;

        // Callbacks
        this.onTimeUpdate = null;
        this.onPlayStateChange = null;
        this.onEventTriggered = null;
    }

    /**
     * Add a launch event to the schedule
     */
    addEvent(eventData) {
        const event = {
            id: eventData.id || this.generateEventId(),
            time: eventData.time || 0,
            launcherId: eventData.launcherId || 1,
            type: eventData.type || 'chrysanthemum',
            primaryColor: eventData.primaryColor || '#ff0000',
            secondaryColor: eventData.secondaryColor || '#ffaa00',
            size: eventData.size || 'medium',
            height: eventData.height || 'high',
            trail: eventData.trail || 'sparkle',
            text: eventData.text || null,
            shellId: eventData.shellId || null,
            group: eventData.group || null,
            groupLabel: eventData.groupLabel || null,
            triggered: false
        };

        this.events.push(event);
        this.sortEvents();
        this.updateDuration();

        return event;
    }

    /**
     * Update an existing event
     */
    updateEvent(eventId, updates) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            Object.assign(event, updates);
            event.triggered = false; // Reset trigger status
            this.sortEvents();
            this.updateDuration();
        }
        return event;
    }

    /**
     * Remove an event from the schedule
     */
    removeEvent(eventId) {
        const index = this.events.findIndex(e => e.id === eventId);
        if (index !== -1) {
            this.events.splice(index, 1);
            this.updateDuration();
            return true;
        }
        return false;
    }

    /**
     * Clear all events
     */
    clearEvents() {
        this.events = [];
        this.activeFireworks = [];
        this.currentTime = 0;
        this.duration = 5000; // Reset to minimal duration
    }

    /**
     * Generate unique event ID
     */
    generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Sort events by time
     */
    sortEvents() {
        this.events.sort((a, b) => a.time - b.time);
    }

    /**
     * Update show duration based on events
     * Duration = last event time + time for firework to complete (~5 seconds)
     */
    updateDuration() {
        if (this.events.length === 0) {
            // No events - set minimal duration
            this.duration = 5000; // 5 seconds minimum
            return;
        }

        const lastEventTime = Math.max(...this.events.map(e => e.time));
        // Add 5 seconds buffer for firework to launch, burst, and fade
        this.duration = lastEventTime + 5000;

        // Update timeline UI if callback exists
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime, this.duration);
        }
    }

    /**
     * Add a finale sequence (legacy - random settings)
     */
    addFinale(startTime = null) {
        return this.addFinaleWithOptions({
            startTime: startTime,
            duration: 10000,
            count: 25,
            intensity: 'gradual',
            theme: 'random',
            types: null // Use all types
        });
    }

    /**
     * Add a finale sequence with customization options
     * @param {Object} options - Finale configuration
     * @param {number} options.startTime - When finale starts (null = after last event)
     * @param {number} options.duration - Duration in ms (5000-30000)
     * @param {number} options.count - Number of fireworks (10-50)
     * @param {string} options.intensity - 'gradual', 'steady', or 'chaos'
     * @param {string} options.pattern - 'random', 'sweep', 'pingpong', or 'volley'
     * @param {boolean} options.grandEnding - Add an all-launcher barrage at the end
     * @param {string} options.theme - Color theme name or 'custom'
     * @param {Array} options.customColors - Array of hex colors for custom theme
     * @param {Array} options.types - Array of allowed firework type names
     * @returns {Object} { count, startTime, groupId }
     */
    addFinaleWithOptions(options) {
        const finaleStart = options.startTime !== null && options.startTime !== undefined
            ? options.startTime
            : (this.events.length > 0 ? Math.max(...this.events.map(e => e.time)) + 2000 : 5000);

        const finaleEvents = [];
        const finaleDuration = options.duration || 10000;
        const fireworkCount = options.count || 25;
        const intensity = options.intensity || 'gradual';
        const pattern = options.pattern || 'random';
        const grandEnding = options.grandEnding !== false;
        const theme = options.theme || 'random';
        const customColors = options.customColors || [];
        const allowedTypes = options.types || Object.keys(FIREWORK_TYPES).filter(t => !SPECIAL_TYPES.includes(t));
        const groupId = 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        // Launchers sorted left-to-right so sweep patterns move across the sky
        const sortedLaunchers = [...this.launcherManager.launchers].sort((a, b) => a.x - b.x);
        const launcherIds = sortedLaunchers.map(l => l.id);
        const numLaunchers = launcherIds.length;

        // Map linear progress (0-1) to a time offset per the intensity curve
        const timeForProgress = (progress) => {
            switch (intensity) {
                case 'steady': return progress * finaleDuration;
                case 'chaos': return Math.random() * finaleDuration;
                case 'gradual':
                default: return progress * progress * finaleDuration;
            }
        };

        const pickPalette = () => (theme === 'custom' && customColors.length > 0)
            ? getCustomPalette(customColors)
            : getThemePalette(theme);

        const makeEvent = (time, launcherId, size) => {
            const palette = pickPalette();
            return {
                time: time,
                launcherId: launcherId,
                type: allowedTypes[Math.floor(Math.random() * allowedTypes.length)],
                primaryColor: palette.primary,
                secondaryColor: palette.secondary,
                size: size,
                height: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
                trail: ['none', 'sparkle', 'comet'][Math.floor(Math.random() * 3)],
                group: groupId,
                groupLabel: 'Finale'
            };
        };

        // During a gradual buildup, sizes ramp small -> large toward the climax
        const sizeForProgress = (progress) => {
            if (intensity !== 'gradual') {
                return ['small', 'medium', 'large'][Math.floor(Math.random() * 3)];
            }
            const bias = progress + (Math.random() - 0.5) * 0.4;
            if (bias < 0.35) return 'small';
            if (bias < 0.7) return 'medium';
            return 'large';
        };

        if (pattern === 'volley') {
            // Launchers fire together in salvos; salvo times follow the intensity curve
            const volleyCount = Math.max(2, Math.ceil(fireworkCount / numLaunchers));
            let made = 0;
            for (let v = 0; v < volleyCount && made < fireworkCount; v++) {
                const progress = volleyCount > 1 ? v / (volleyCount - 1) : 0;
                const volleyTime = finaleStart + timeForProgress(progress);
                for (let l = 0; l < numLaunchers && made < fireworkCount; l++) {
                    finaleEvents.push(makeEvent(volleyTime, launcherIds[l], sizeForProgress(progress)));
                    made++;
                }
            }
        } else {
            for (let i = 0; i < fireworkCount; i++) {
                const progress = i / fireworkCount;
                let launcherIndex;

                switch (pattern) {
                    case 'sweep':
                        launcherIndex = i % numLaunchers;
                        break;
                    case 'pingpong': {
                        const cycle = numLaunchers > 1 ? (numLaunchers - 1) * 2 : 1;
                        const pos = i % cycle;
                        launcherIndex = pos < numLaunchers ? pos : cycle - pos;
                        break;
                    }
                    case 'random':
                    default:
                        launcherIndex = Math.floor(Math.random() * numLaunchers);
                }

                finaleEvents.push(makeEvent(
                    finaleStart + timeForProgress(progress),
                    launcherIds[launcherIndex],
                    sizeForProgress(progress)
                ));
            }
        }

        // Grand ending: two rapid all-launcher barrages of big shells at the climax
        if (grandEnding) {
            const bigTypes = ['chrysanthemum', 'peony', 'brocade', 'pistil'].filter(t => allowedTypes.includes(t));
            const endingTypes = bigTypes.length > 0 ? bigTypes : allowedTypes;
            for (let wave = 0; wave < 2; wave++) {
                const waveTime = finaleStart + finaleDuration + wave * 600;
                launcherIds.forEach(id => {
                    const palette = pickPalette();
                    finaleEvents.push({
                        time: waveTime,
                        launcherId: id,
                        type: endingTypes[Math.floor(Math.random() * endingTypes.length)],
                        primaryColor: palette.primary,
                        secondaryColor: palette.secondary,
                        size: 'large',
                        height: wave === 0 ? 'high' : 'medium',
                        trail: 'sparkle',
                        group: groupId,
                        groupLabel: 'Finale'
                    });
                });
            }
        }

        // Add all finale events
        finaleEvents.forEach(e => this.addEvent(e));

        return { count: finaleEvents.length, startTime: finaleStart, groupId: groupId };
    }

    /**
     * Launch a firework for an event
     */
    launchFirework(event) {
        const launcher = this.launcherManager.getLauncherById(event.launcherId);
        if (!launcher || !launcher.enabled) return;

        const launchPos = launcher.getLaunchPosition();

        const firework = new Firework({
            launchX: launchPos.x,
            launchY: launchPos.y,
            type: event.type,
            primaryColor: event.primaryColor,
            secondaryColor: event.secondaryColor,
            size: event.size,
            height: event.height,
            trail: event.trail,
            text: event.text,
            shellId: event.shellId
        });

        this.activeFireworks.push(firework);

        // Trigger launcher flash
        this.launcherManager.triggerLaunch(event.launcherId);

        // Callback
        if (this.onEventTriggered) {
            this.onEventTriggered(event);
        }
    }

    /**
     * Update the show
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        if (!this.isPlaying) return;

        // Update time
        this.currentTime += dt * 1000 * this.playbackSpeed;

        // Check for events to trigger
        this.events.forEach(event => {
            if (!event.triggered && this.currentTime >= event.time) {
                this.launchFirework(event);
                event.triggered = true;
            }
        });

        // Update active fireworks
        this.activeFireworks.forEach(fw => fw.update(dt));

        // Remove completed fireworks
        this.activeFireworks = this.activeFireworks.filter(fw => fw.phase !== 'done');

        // Note: launchers are updated unconditionally in the engine render
        // loop so flash/spark effects animate even while paused or stopped

        // Check for end of show
        if (this.currentTime >= this.duration) {
            if (this.loop) {
                this.reset();
                // Don't stop playing - just reset
            } else {
                // Wait for all fireworks to finish
                if (this.activeFireworks.length === 0) {
                    this.stop();
                }
            }
        }

        // Time update callback
        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime, this.duration);
        }
    }

    /**
     * Draw all active fireworks
     */
    draw(ctx) {
        this.activeFireworks.forEach(fw => fw.draw(ctx));
    }

    /**
     * Play the show
     */
    play() {
        if (this.currentTime >= this.duration) {
            this.reset();
        }
        this.isPlaying = true;

        // Start crowd ambience
        if (typeof playCrowdAmbience === 'function') {
            playCrowdAmbience();
        }

        if (this.onPlayStateChange) {
            this.onPlayStateChange(true);
        }
    }

    /**
     * Pause the show
     */
    pause() {
        this.isPlaying = false;

        // Stop crowd ambience
        if (typeof stopCrowdAmbience === 'function') {
            stopCrowdAmbience();
        }

        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
    }

    /**
     * Stop the show and reset
     */
    stop() {
        this.isPlaying = false;
        this.currentTime = 0;
        this.activeFireworks = [];

        // Stop crowd ambience
        if (typeof stopCrowdAmbience === 'function') {
            stopCrowdAmbience();
        }

        // Reset all event triggers
        this.events.forEach(e => e.triggered = false);

        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
        if (this.onTimeUpdate) {
            this.onTimeUpdate(0, this.duration);
        }
    }

    /**
     * Reset show to beginning (for looping)
     */
    reset() {
        this.currentTime = 0;
        this.activeFireworks = [];
        this.events.forEach(e => e.triggered = false);
    }

    /**
     * Seek to a specific time
     */
    seek(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));

        // Reset events that are after the new time
        this.events.forEach(e => {
            e.triggered = e.time < this.currentTime;
        });

        // Clear active fireworks when seeking
        this.activeFireworks = [];

        if (this.onTimeUpdate) {
            this.onTimeUpdate(this.currentTime, this.duration);
        }
    }

    /**
     * Set playback speed
     */
    setSpeed(speed) {
        this.playbackSpeed = speed;
    }

    /**
     * Set loop mode
     */
    setLoop(loop) {
        this.loop = loop;
    }

    /**
     * Get events for UI display (sorted by time)
     */
    getEventList() {
        return [...this.events].sort((a, b) => a.time - b.time);
    }

    /**
     * Serialize show data for saving
     */
    toJSON() {
        // Get weather settings if available
        let weatherSettings = null;
        if (typeof getWeatherSettings === 'function') {
            weatherSettings = getWeatherSettings();
        }

        // Get audio settings if available
        let audioSettings = null;
        if (typeof getAudioSettings === 'function') {
            audioSettings = getAudioSettings();
        }

        return {
            version: '1.0',
            settings: {
                duration: this.duration,
                backgroundColor: '#0a0a1a',
                showStars: true
            },
            weather: weatherSettings,
            audio: audioSettings,
            launchers: this.launcherManager.toJSON(),
            events: this.events.map(e => ({
                id: e.id,
                time: e.time,
                launcherId: e.launcherId,
                type: e.type,
                primaryColor: e.primaryColor,
                secondaryColor: e.secondaryColor,
                size: e.size,
                height: e.height,
                trail: e.trail,
                text: e.text || null,
                shellId: e.shellId || null,
                group: e.group || null,
                groupLabel: e.groupLabel || null
            })),
            customShells: (typeof serializeShells === 'function') ? serializeShells() : []
        };
    }

    /**
     * Load show data from saved JSON
     */
    fromJSON(data) {
        if (!data) return;

        // Load settings
        if (data.settings) {
            this.duration = data.settings.duration || 30000;
        }

        // Load weather settings if available
        if (data.weather && typeof loadWeatherSettings === 'function') {
            loadWeatherSettings(data.weather);
        }

        // Load audio settings if available
        if (data.audio && typeof loadAudioSettings === 'function') {
            loadAudioSettings(data.audio);
        }

        // Load launchers
        if (data.launchers) {
            this.launcherManager.loadFromData(data.launchers);
        }

        // Load custom shells (before events, which may reference them)
        if (typeof loadShells === 'function') {
            loadShells(data.customShells);
        }

        // Load events
        this.events = [];
        if (data.events && Array.isArray(data.events)) {
            data.events.forEach(eventData => {
                this.addEvent(eventData);
            });
        }

        // Reset playback state
        this.currentTime = 0;
        this.activeFireworks = [];
        this.events.forEach(e => e.triggered = false);
    }
}
