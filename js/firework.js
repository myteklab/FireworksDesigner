/**
 * Firework Class - Multi-phase firework with launch, burst, and fade
 */
class Firework {
    constructor(config) {
        // Launch position (ground level)
        this.launchX = config.launchX || 400;
        this.launchY = config.launchY || 500;

        // Burst position (in the sky)
        const heightConfig = HEIGHT_CONFIGS[config.height || 'high'];
        this.burstY = heightConfig.burstY;
        this.launchSpeed = heightConfig.launchSpeed;

        // Current position (starts at launch)
        this.x = this.launchX;
        this.y = this.launchY;

        // Firework configuration
        this.type = config.type || 'chrysanthemum';
        this.typeConfig = FIREWORK_TYPES[this.type];
        this.primaryColor = config.primaryColor || '#ff0000';
        this.secondaryColor = config.secondaryColor || '#ffaa00';
        this.size = config.size || 'medium';
        this.trailEffect = config.trail || 'sparkle';

        // Phase management
        this.phase = 'launch'; // 'launch', 'burst', 'fade', 'done'
        this.phaseTime = 0;

        // Rocket particle (during launch phase)
        this.rocket = null;
        this.rocketTrail = [];

        // Burst particles
        this.particles = [];

        // Secondary burst tracking
        this.secondaryBurstTriggered = false;

        // Crossette split tracking
        this.splitTriggered = false;

        // Initialize rocket for launch
        this.initRocket();
    }

    /**
     * Initialize the rocket (rising mortar)
     */
    initRocket() {
        const trailConfig = TRAIL_CONFIGS[this.trailEffect];

        this.rocket = {
            x: this.launchX,
            y: this.launchY,
            vy: -this.launchSpeed,
            size: 4,
            trailLength: 15 * (trailConfig.trailMultiplier || 1)
        };
    }

    /**
     * Update firework based on current phase
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        this.phaseTime += dt;

        switch (this.phase) {
            case 'launch':
                this.updateLaunch(dt);
                break;
            case 'burst':
                this.updateBurst(dt);
                break;
            case 'fade':
                this.updateFade(dt);
                break;
        }
    }

    /**
     * Update launch phase - rocket rising
     */
    updateLaunch(dt) {
        // Emit launch smoke at the base (if smoke system is available)
        if (typeof smokeManager !== 'undefined' && smokeManager && this.phaseTime < 0.5) {
            // Only emit smoke during first 0.5 seconds of launch
            if (!this.launchSmokeStarted) {
                smokeManager.createLaunchSmoke(this.launchX, this.launchY);
                this.launchSmokeStarted = true;
            }
        }

        // Update rocket trail
        this.rocketTrail.unshift({ x: this.rocket.x, y: this.rocket.y });
        if (this.rocketTrail.length > this.rocket.trailLength) {
            this.rocketTrail.pop();
        }

        // Apply slight gravity deceleration
        this.rocket.vy += 100 * dt;

        // Apply wind to rocket (if weather system is loaded)
        if (typeof getWindForce === 'function') {
            const windForce = getWindForce();
            this.rocket.x += windForce * dt * 0.3; // Rockets are less affected by wind
        }

        // Move rocket
        this.rocket.y += this.rocket.vy * dt;

        // Add slight wobble
        this.rocket.x = this.rocket.x + Math.sin(this.phaseTime * 10) * 0.5;

        // Check if reached burst height
        if (this.rocket.y <= this.burstY || this.rocket.vy >= 0) {
            // Play whoosh sound as rocket reaches peak
            if (typeof playSound === 'function') {
                playSound('whoosh', 0.7);
            }

            this.x = this.rocket.x;
            this.y = this.rocket.y;
            this.burst();
            this.phase = 'burst';
            this.phaseTime = 0;
        }
    }

    /**
     * Update burst phase - particles exploding
     */
    updateBurst(dt) {
        // Update all particles
        this.particles = this.particles.filter(p => p.update(dt));

        // Check for secondary burst
        if (this.typeConfig.hasSecondaryBurst &&
            !this.secondaryBurstTriggered &&
            this.phaseTime >= this.typeConfig.secondaryDelay) {
            this.triggerSecondaryBurst();
            this.secondaryBurstTriggered = true;
        }

        // Check for crossette split
        if (this.typeConfig.hasSplit &&
            !this.splitTriggered &&
            this.phaseTime >= this.typeConfig.splitDelay) {
            this.triggerCrossetteSplit();
            this.splitTriggered = true;
        }

        // Transition to fade when most particles are gone
        if (this.particles.length < 10) {
            this.phase = 'fade';
            this.phaseTime = 0;
        }
    }

    /**
     * Update fade phase - remaining particles fading out
     */
    updateFade(dt) {
        // Continue updating remaining particles
        this.particles = this.particles.filter(p => p.update(dt));

        // Mark as done when all particles gone or timeout
        if (this.particles.length === 0 || this.phaseTime > 3) {
            this.phase = 'done';
        }
    }

    /**
     * Create burst particles
     */
    burst() {
        // Play boom sound
        if (typeof playSound === 'function') {
            const boomVariant = 'boom' + (Math.floor(Math.random() * 3) + 1);
            const volumeMult = this.size === 'large' ? 1.0 : this.size === 'medium' ? 0.8 : 0.6;
            playSound(boomVariant, volumeMult);

            // Trigger crowd cheer after burst (with delay for realism)
            if (typeof triggerCrowdCheer === 'function') {
                setTimeout(() => triggerCrowdCheer(this.size), 300);
            }
        }

        const sizeMultiplier = SIZE_MULTIPLIERS[this.size];
        const trailConfig = TRAIL_CONFIGS[this.trailEffect];
        const particleCount = this.typeConfig.particleCount[this.size] ||
                             Math.floor(this.typeConfig.particleCount.medium * sizeMultiplier.particles);

        // Emit burst smoke at explosion point (if smoke system is available)
        if (typeof smokeManager !== 'undefined' && smokeManager) {
            // Larger fireworks create more smoke
            const smokeIntensity = sizeMultiplier.particles;
            // Pass primary color for colored/glowing smoke effect
            smokeManager.createBurstSmoke(this.x, this.y, smokeIntensity, this.primaryColor);
        }

        // Special handling for heart shape
        if (this.typeConfig.customPattern === 'heart') {
            this.createHeartPattern(particleCount, sizeMultiplier, trailConfig);
            return;
        }

        // Special handling for saturn (ring + center burst)
        if (this.typeConfig.customPattern === 'saturn') {
            this.createSaturnPattern(particleCount, sizeMultiplier, trailConfig);
            return;
        }

        // Create particles in burst pattern
        for (let i = 0; i < particleCount; i++) {
            const particle = this.createBurstParticle(i, particleCount, sizeMultiplier, trailConfig);
            this.particles.push(particle);
        }
    }

    /**
     * Create a single burst particle
     */
    createBurstParticle(index, total, sizeMultiplier, trailConfig) {
        const config = this.typeConfig;

        // Calculate angle based on spread
        let angle;
        if (config.spread === 360) {
            angle = (index / total) * Math.PI * 2;
        } else {
            const spreadRad = (config.spread * Math.PI) / 180;
            const offsetRad = ((config.spreadOffset || 0) * Math.PI) / 180;
            angle = offsetRad + (Math.random() - 0.5) * spreadRad;
        }

        // Calculate speed
        let speed;
        if (config.uniformSpeed) {
            speed = (config.speed.min + config.speed.max) / 2;
        } else {
            speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);
        }
        speed *= sizeMultiplier.speed;

        // Calculate velocity
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Calculate lifetime
        const lifetime = config.lifetime.min +
                        Math.random() * (config.lifetime.max - config.lifetime.min);

        // Calculate trail length
        const trailLength = Math.floor(config.trailLength * (trailConfig.trailMultiplier || 1));

        // Determine colors (brocade forces gold/silver)
        let colorStart = this.primaryColor;
        let colorEnd = this.secondaryColor;
        if (config.forceGold) {
            const goldColors = ['#ffd700', '#ffcc00', '#c0c0c0', '#fffacd', '#fff8dc'];
            colorStart = goldColors[Math.floor(Math.random() * goldColors.length)];
            colorEnd = '#ffffff';
        }

        return new Particle({
            x: this.x,
            y: this.y,
            vx: vx,
            vy: vy,
            gravity: config.gravity,
            lifetime: lifetime,
            colorStart: colorStart,
            colorEnd: colorEnd,
            sizeStart: config.sizeStart * sizeMultiplier.spread,
            sizeEnd: config.sizeEnd,
            shape: config.shape,
            trailLength: trailLength,
            twinkle: config.twinkle || false,
            strobe: config.strobe || false,
            strobeSpeed: config.strobeSpeed || 15
        });
    }

    /**
     * Create heart-shaped burst pattern
     */
    createHeartPattern(particleCount, sizeMultiplier, trailConfig) {
        const config = this.typeConfig;

        for (let i = 0; i < particleCount; i++) {
            // Heart parametric equation
            const t = (i / particleCount) * Math.PI * 2;
            const heartX = 16 * Math.pow(Math.sin(t), 3);
            const heartY = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));

            // Scale and calculate velocity
            const scale = 5 * sizeMultiplier.speed;
            const angle = Math.atan2(heartY, heartX);
            const distance = Math.sqrt(heartX * heartX + heartY * heartY);
            const speed = distance * scale;

            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            const lifetime = config.lifetime.min +
                            Math.random() * (config.lifetime.max - config.lifetime.min);

            const trailLength = Math.floor(config.trailLength * (trailConfig.trailMultiplier || 1));

            this.particles.push(new Particle({
                x: this.x,
                y: this.y,
                vx: vx,
                vy: vy,
                gravity: config.gravity,
                lifetime: lifetime,
                colorStart: this.primaryColor,
                colorEnd: this.secondaryColor,
                sizeStart: config.sizeStart * sizeMultiplier.spread,
                sizeEnd: config.sizeEnd,
                shape: config.shape,
                trailLength: trailLength
            }));
        }
    }

    /**
     * Create Saturn pattern (ring + central burst)
     */
    createSaturnPattern(particleCount, sizeMultiplier, trailConfig) {
        const config = this.typeConfig;

        // Split particles: 40% for ring, 60% for center
        const ringCount = Math.floor(particleCount * 0.4);
        const centerCount = particleCount - ringCount;

        // Create ring particles (horizontal plane)
        for (let i = 0; i < ringCount; i++) {
            const angle = (i / ringCount) * Math.PI * 2;
            const speed = 100 * sizeMultiplier.speed;

            const lifetime = config.lifetime.min +
                            Math.random() * (config.lifetime.max - config.lifetime.min);
            const trailLength = Math.floor(config.trailLength * (trailConfig.trailMultiplier || 1));

            this.particles.push(new Particle({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed * 0.3, // Flatten the ring
                gravity: 15, // Low gravity for ring
                lifetime: lifetime,
                colorStart: this.secondaryColor, // Ring uses secondary color
                colorEnd: '#ffffff',
                sizeStart: config.sizeStart * sizeMultiplier.spread * 0.8,
                sizeEnd: config.sizeEnd,
                shape: 'ring',
                trailLength: trailLength
            }));
        }

        // Create center burst particles
        for (let i = 0; i < centerCount; i++) {
            const angle = (i / centerCount) * Math.PI * 2;
            const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min);

            const lifetime = config.lifetime.min +
                            Math.random() * (config.lifetime.max - config.lifetime.min);
            const trailLength = Math.floor(config.trailLength * (trailConfig.trailMultiplier || 1));

            this.particles.push(new Particle({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed * sizeMultiplier.speed,
                vy: Math.sin(angle) * speed * sizeMultiplier.speed,
                gravity: config.gravity,
                lifetime: lifetime,
                colorStart: this.primaryColor,
                colorEnd: this.secondaryColor,
                sizeStart: config.sizeStart * sizeMultiplier.spread,
                sizeEnd: config.sizeEnd,
                shape: config.shape,
                trailLength: trailLength
            }));
        }
    }

    /**
     * Trigger crossette split (particles split into multiple trails)
     */
    triggerCrossetteSplit() {
        const splitCount = this.typeConfig.splitCount || 4;
        const newParticles = [];

        // Select particles to split (not all, to keep some original paths)
        const particlesToSplit = this.particles.filter(() => Math.random() < 0.6);

        particlesToSplit.forEach(p => {
            // Add tiny smoke wisp at split point
            if (typeof smokeManager !== 'undefined' && smokeManager) {
                smokeManager.createBurstSmoke(p.x, p.y, 0.2, this.primaryColor);
            }

            // Create split particles
            for (let j = 0; j < splitCount; j++) {
                const splitAngle = (j / splitCount) * Math.PI * 2;
                const splitSpeed = 40 + Math.random() * 30;

                newParticles.push(new Particle({
                    x: p.x,
                    y: p.y,
                    vx: p.vx * 0.3 + Math.cos(splitAngle) * splitSpeed,
                    vy: p.vy * 0.3 + Math.sin(splitAngle) * splitSpeed,
                    gravity: 50,
                    lifetime: 0.8 + Math.random() * 0.5,
                    colorStart: this.primaryColor,
                    colorEnd: this.secondaryColor,
                    sizeStart: 3,
                    sizeEnd: 1,
                    shape: 'circle',
                    trailLength: 6
                }));
            }
        });

        // Add new split particles
        this.particles.push(...newParticles);

        // Play a subtle crackle for the split
        if (typeof playSound === 'function') {
            playSound('crackle', 0.4);
        }
    }

    /**
     * Trigger secondary burst (for crackle type)
     */
    triggerSecondaryBurst() {
        // Play crackle sound
        if (typeof playSound === 'function') {
            playSound('crackle', 0.6);
        }

        // Select random particles to burst
        const burstCount = Math.min(
            this.typeConfig.secondaryCount || 3,
            Math.floor(this.particles.length * 0.3)
        );

        const selectedParticles = [];
        for (let i = 0; i < burstCount && this.particles.length > 0; i++) {
            const index = Math.floor(Math.random() * this.particles.length);
            selectedParticles.push(this.particles[index]);
        }

        // Create mini-bursts at selected particle positions
        selectedParticles.forEach(p => {
            // Add tiny smoke puff at each mini-explosion
            if (typeof smokeManager !== 'undefined' && smokeManager) {
                smokeManager.createBurstSmoke(p.x, p.y, 0.3, this.secondaryColor);
            }

            for (let j = 0; j < 8; j++) {
                const angle = (j / 8) * Math.PI * 2;
                const speed = 30 + Math.random() * 30;

                this.particles.push(new Particle({
                    x: p.x,
                    y: p.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    gravity: 60,
                    lifetime: 0.3 + Math.random() * 0.3,
                    colorStart: '#ffffff',
                    colorEnd: this.secondaryColor,
                    sizeStart: 2,
                    sizeEnd: 1,
                    shape: 'circle',
                    trailLength: 0
                }));
            }
        });
    }

    /**
     * Draw firework on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        switch (this.phase) {
            case 'launch':
                this.drawRocket(ctx);
                break;
            case 'burst':
            case 'fade':
                this.drawParticles(ctx);
                break;
        }
    }

    /**
     * Draw rocket during launch phase
     */
    drawRocket(ctx) {
        // Draw trail
        for (let i = 0; i < this.rocketTrail.length; i++) {
            const point = this.rocketTrail[i];
            const t = i / this.rocketTrail.length;
            const alpha = 1 - t;
            const size = this.rocket.size * (1 - t * 0.5);

            ctx.save();
            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = this.primaryColor;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw rocket head
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = this.primaryColor;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.rocket.x, this.rocket.y, this.rocket.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Draw sparks from rocket
        for (let i = 0; i < 3; i++) {
            const sparkX = this.rocket.x + (Math.random() - 0.5) * 10;
            const sparkY = this.rocket.y + Math.random() * 15;
            const sparkSize = 1 + Math.random() * 2;

            ctx.save();
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Draw burst/fade particles
     */
    drawParticles(ctx) {
        // Add glow effect at burst center during early burst
        if (this.phase === 'burst' && this.phaseTime < 0.3) {
            const glowAlpha = 1 - (this.phaseTime / 0.3);
            ctx.save();
            ctx.globalAlpha = glowAlpha * 0.5;
            ctx.fillStyle = this.primaryColor;
            ctx.shadowColor = this.primaryColor;
            ctx.shadowBlur = 50;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 30 * glowAlpha, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw all particles
        this.particles.forEach(p => p.draw(ctx));
    }
}
