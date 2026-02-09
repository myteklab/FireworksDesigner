/**
 * Weather System - Wind and environmental effects
 */

// Global weather state
const weather = {
    windSpeed: 0,        // 0-100 (percentage)
    windDirection: 1,    // 1 = right, -1 = left
    smokeEnabled: false,
    smokeDensity: 3      // 1-5
};

/**
 * Get wind force as a velocity modifier
 * Returns pixels per second of horizontal drift
 */
function getWindForce() {
    // Max wind force of 80 pixels per second at 100% wind
    return (weather.windSpeed / 100) * 80 * weather.windDirection;
}

/**
 * SmokeParticle Class - Individual smoke particle with enhanced blending
 */
class SmokeParticle {
    constructor(x, y, config = {}) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 30;  // More random horizontal spread
        this.vy = -15 - Math.random() * 25;     // Rise upward
        this.size = 6 + Math.random() * 10;
        this.alpha = 0.25 + Math.random() * 0.15;
        this.maxAlpha = this.alpha;
        this.lifetime = 3 + Math.random() * 3;  // 3-6 seconds for more dispersion time
        this.age = 0;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.8;
        this.disperseRate = 0.5 + Math.random() * 0.5; // Random disperse rate

        // Enhanced blending properties
        this.color = config.color || null;  // Firework color for tinting
        this.isHot = config.isHot || false; // Hot smoke from burst
        this.temperature = config.isHot ? 1.0 : 0;  // 1.0 = hot (glowing), 0 = cool (gray)
        this.coolingRate = 0.4 + Math.random() * 0.3; // How fast it cools down
    }

    update(dt) {
        this.age += dt;

        // Apply wind
        const windForce = getWindForce();
        this.vx += windForce * dt * 0.8;

        // Add random turbulence for more natural dispersion
        this.vx += (Math.random() - 0.5) * 20 * dt;
        this.vy += (Math.random() - 0.5) * 10 * dt;

        // Apply velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Slow down over time (more drag)
        this.vx *= 0.97;
        this.vy *= 0.96;

        // Expand size as smoke disperses - faster expansion
        this.size += dt * 15 * this.disperseRate;

        // Fade out with smooth cubic ease
        const lifeProgress = this.age / this.lifetime;
        const fadeEase = 1 - Math.pow(lifeProgress, 1.5);
        this.alpha = this.maxAlpha * fadeEase;

        // Cool down temperature over time
        if (this.temperature > 0) {
            this.temperature = Math.max(0, this.temperature - dt * this.coolingRate);
        }

        // Rotation
        this.rotation += this.rotationSpeed * dt;
    }

    isDead() {
        return this.age >= this.lifetime;
    }

    /**
     * Get smoke color based on temperature and tint
     */
    getSmokeColor(alpha) {
        if (this.temperature > 0 && this.color) {
            // Hot smoke: blend between firework color and gray
            const r = parseInt(this.color.slice(1, 3), 16);
            const g = parseInt(this.color.slice(3, 5), 16);
            const b = parseInt(this.color.slice(5, 7), 16);

            // Lerp from color to gray based on temperature
            const gray = 80;
            const t = this.temperature;
            const finalR = Math.round(r * t + gray * (1 - t));
            const finalG = Math.round(g * t + gray * (1 - t));
            const finalB = Math.round(b * t + gray * (1 - t));

            return `rgba(${finalR}, ${finalG}, ${finalB}, ${alpha})`;
        }
        return `rgba(80, 80, 80, ${alpha})`;
    }

    draw(ctx) {
        if (this.alpha <= 0.01) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Hot smoke uses additive blending for glow effect
        if (this.temperature > 0.3) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = this.alpha * this.temperature * 0.6;
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this.alpha;
        }

        // Draw smoke as a soft gradient circle with more stops for smoother edges
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);

        if (this.temperature > 0.2 && this.color) {
            // Hot/colored smoke with glow
            const coreColor = this.getSmokeColor(0.5);
            const midColor = this.getSmokeColor(0.25);
            const edgeColor = this.getSmokeColor(0.08);

            gradient.addColorStop(0, coreColor);
            gradient.addColorStop(0.3, midColor);
            gradient.addColorStop(0.6, edgeColor);
            gradient.addColorStop(1, 'rgba(60, 60, 60, 0)');
        } else {
            // Cool gray smoke with softer falloff
            gradient.addColorStop(0, 'rgba(90, 90, 95, 0.35)');
            gradient.addColorStop(0.25, 'rgba(75, 75, 80, 0.2)');
            gradient.addColorStop(0.5, 'rgba(65, 65, 70, 0.1)');
            gradient.addColorStop(0.75, 'rgba(55, 55, 60, 0.04)');
            gradient.addColorStop(1, 'rgba(50, 50, 55, 0)');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Add secondary softer outer layer for more natural blending
        if (this.size > 15 && this.alpha > 0.1) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this.alpha * 0.3;

            const outerGradient = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.4);
            outerGradient.addColorStop(0, 'rgba(70, 70, 75, 0.15)');
            outerGradient.addColorStop(0.5, 'rgba(60, 60, 65, 0.06)');
            outerGradient.addColorStop(1, 'rgba(50, 50, 55, 0)');

            ctx.fillStyle = outerGradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size * 1.4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * SmokeEmitter Class - Manages smoke particles for a launcher
 */
class SmokeEmitter {
    constructor(x, y, config = {}) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.emitting = false;
        this.emitTimer = 0;
        this.emitDuration = 0;
        this.color = config.color || '#ff6600';  // Default warm orange for launch
        this.isHot = config.isHot !== undefined ? config.isHot : true;
    }

    /**
     * Start emitting smoke (called when firework launches)
     */
    startEmit(duration = 0.5) {
        this.emitting = true;
        this.emitTimer = 0;
        this.emitDuration = duration;
    }

    /**
     * Update position (for moving emitters)
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    update(dt) {
        // Emit new particles if active
        if (this.emitting && weather.smokeEnabled) {
            this.emitTimer += dt;

            // Calculate temperature decay (hotter at start, cooler at end)
            const emitProgress = this.emitTimer / this.emitDuration;
            const isStillHot = emitProgress < 0.6;

            // Emit based on density setting (1-5 particles per frame equivalent)
            const particlesToEmit = weather.smokeDensity;
            for (let i = 0; i < particlesToEmit; i++) {
                // Spread spawn position slightly
                const offsetX = (Math.random() - 0.5) * 20;
                const offsetY = Math.random() * 10;
                this.particles.push(new SmokeParticle(
                    this.x + offsetX,
                    this.y + offsetY,
                    {
                        color: this.color,
                        isHot: this.isHot && isStillHot
                    }
                ));
            }

            // Stop emitting after duration
            if (this.emitTimer >= this.emitDuration) {
                this.emitting = false;
            }
        }

        // Update all particles
        this.particles.forEach(p => p.update(dt));

        // Remove dead particles
        this.particles = this.particles.filter(p => !p.isDead());
    }

    draw(ctx) {
        if (!weather.smokeEnabled) return;
        this.particles.forEach(p => p.draw(ctx));
    }

    /**
     * Clear all particles
     */
    clear() {
        this.particles = [];
        this.emitting = false;
    }
}

/**
 * Global smoke manager - handles all smoke emitters
 */
class SmokeManager {
    constructor() {
        this.emitters = [];
        this.burstSmoke = [];  // Smoke from firework bursts
    }

    /**
     * Create a launch smoke effect at position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} color - Optional color tint (defaults to warm orange)
     */
    createLaunchSmoke(x, y, color = '#ff6600') {
        if (!weather.smokeEnabled) return;

        const emitter = new SmokeEmitter(x, y, {
            color: color,
            isHot: true  // Launch smoke starts hot with glow
        });
        emitter.startEmit(0.4);  // Short burst for launch
        this.emitters.push(emitter);
    }

    /**
     * Create burst smoke at explosion point
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} intensity - Smoke intensity multiplier
     * @param {string} color - Firework primary color (hex) for tinting
     */
    createBurstSmoke(x, y, intensity = 1, color = null) {
        if (!weather.smokeEnabled) return;

        // Create several smoke particles at burst location
        const count = Math.floor(5 * intensity * weather.smokeDensity);
        for (let i = 0; i < count; i++) {
            const particle = new SmokeParticle(
                x + (Math.random() - 0.5) * 30,
                y + (Math.random() - 0.5) * 30,
                {
                    color: color,
                    isHot: true  // Burst smoke starts hot and glowing
                }
            );
            particle.size *= 1.5;  // Bigger smoke for bursts
            particle.lifetime *= 1.2;
            // Hot smoke starts with higher alpha for visible glow
            particle.maxAlpha = 0.35 + Math.random() * 0.15;
            particle.alpha = particle.maxAlpha;
            this.burstSmoke.push(particle);
        }
    }

    update(dt) {
        // Update emitters
        this.emitters.forEach(e => e.update(dt));

        // Remove finished emitters (no particles left)
        this.emitters = this.emitters.filter(e =>
            e.emitting || e.particles.length > 0
        );

        // Update burst smoke
        this.burstSmoke.forEach(p => p.update(dt));
        this.burstSmoke = this.burstSmoke.filter(p => !p.isDead());
    }

    draw(ctx) {
        if (!weather.smokeEnabled) return;

        // Draw emitter smoke (behind fireworks)
        this.emitters.forEach(e => e.draw(ctx));

        // Draw burst smoke
        this.burstSmoke.forEach(p => p.draw(ctx));
    }

    /**
     * Clear all smoke
     */
    clear() {
        this.emitters.forEach(e => e.clear());
        this.emitters = [];
        this.burstSmoke = [];
    }
}

// Global smoke manager instance
let smokeManager = null;

/**
 * Initialize the weather system
 */
function initWeather() {
    smokeManager = new SmokeManager();

    // Set up UI event listeners
    const windSpeedSlider = document.getElementById('wind-speed');
    const windSpeedLabel = document.getElementById('wind-speed-label');
    const windDirection = document.getElementById('wind-direction');
    const smokeEnabled = document.getElementById('smoke-enabled');
    const smokeDensity = document.getElementById('smoke-density');
    const smokeControl = document.querySelector('.smoke-control');

    if (windSpeedSlider) {
        windSpeedSlider.addEventListener('input', function() {
            weather.windSpeed = parseInt(this.value);
            windSpeedLabel.textContent = this.value + '%';
            markDirty();
        });
    }

    if (windDirection) {
        windDirection.addEventListener('change', function() {
            weather.windDirection = this.value === 'left' ? -1 : 1;
            markDirty();
        });
    }

    if (smokeEnabled) {
        smokeEnabled.addEventListener('change', function() {
            weather.smokeEnabled = this.checked;
            if (smokeControl) {
                smokeControl.style.display = this.checked ? 'flex' : 'none';
            }
            markDirty();
        });
    }

    if (smokeDensity) {
        smokeDensity.addEventListener('input', function() {
            weather.smokeDensity = parseInt(this.value);
            markDirty();
        });
    }
}

/**
 * Get weather settings for saving
 */
function getWeatherSettings() {
    return {
        windSpeed: weather.windSpeed,
        windDirection: weather.windDirection === 1 ? 'right' : 'left',
        smokeEnabled: weather.smokeEnabled,
        smokeDensity: weather.smokeDensity
    };
}

/**
 * Load weather settings
 */
function loadWeatherSettings(settings) {
    if (!settings) return;

    weather.windSpeed = settings.windSpeed || 0;
    weather.windDirection = settings.windDirection === 'left' ? -1 : 1;
    weather.smokeEnabled = settings.smokeEnabled || false;
    weather.smokeDensity = settings.smokeDensity || 3;

    // Update UI
    const windSpeedSlider = document.getElementById('wind-speed');
    const windSpeedLabel = document.getElementById('wind-speed-label');
    const windDirectionSelect = document.getElementById('wind-direction');
    const smokeEnabledCheck = document.getElementById('smoke-enabled');
    const smokeDensitySlider = document.getElementById('smoke-density');
    const smokeControl = document.querySelector('.smoke-control');

    if (windSpeedSlider) {
        windSpeedSlider.value = weather.windSpeed;
        windSpeedLabel.textContent = weather.windSpeed + '%';
    }
    if (windDirectionSelect) {
        windDirectionSelect.value = weather.windDirection === 1 ? 'right' : 'left';
    }
    if (smokeEnabledCheck) {
        smokeEnabledCheck.checked = weather.smokeEnabled;
    }
    if (smokeDensitySlider) {
        smokeDensitySlider.value = weather.smokeDensity;
    }
    if (smokeControl) {
        smokeControl.style.display = weather.smokeEnabled ? 'flex' : 'none';
    }
}
