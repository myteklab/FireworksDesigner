/**
 * Particle Class - Individual particle with physics and rendering
 * Extended from ParticleFX with trail support for fireworks
 */
class Particle {
    constructor(config) {
        // Position
        this.x = config.x || 0;
        this.y = config.y || 0;

        // Velocity
        this.vx = config.vx || 0;
        this.vy = config.vy || 0;

        // Physics
        this.gravity = config.gravity !== undefined ? config.gravity : 50;
        this.friction = config.friction !== undefined ? config.friction : 0.99;

        // Lifecycle
        this.lifetime = config.lifetime || 2;
        this.age = 0;

        // Appearance
        this.colorStart = config.colorStart || '#ffffff';
        this.colorEnd = config.colorEnd || '#888888';
        this.sizeStart = config.sizeStart || 4;
        this.sizeEnd = config.sizeEnd || 1;
        this.opacityStart = config.opacityStart !== undefined ? config.opacityStart : 1;
        this.opacityEnd = config.opacityEnd !== undefined ? config.opacityEnd : 0;

        // Shape
        this.shape = config.shape || 'circle';

        // Trail (for sparkle effects)
        this.trailLength = config.trailLength || 0;
        this.trail = [];

        // Rotation (for variety)
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 2;

        // Twinkle effect for stars
        this.twinkle = config.twinkle || false;
        this.twinkleSpeed = Math.random() * 5 + 2;

        // Strobe effect (on/off flashing)
        this.strobe = config.strobe || false;
        this.strobeSpeed = config.strobeSpeed || 15;
        this.strobePhase = Math.random() * Math.PI * 2; // Random phase offset
    }

    /**
     * Update particle physics
     * @param {number} dt - Delta time in seconds
     * @returns {boolean} - True if particle is still alive
     */
    update(dt) {
        // Track trail positions
        if (this.trailLength > 0) {
            this.trail.unshift({ x: this.x, y: this.y });
            if (this.trail.length > this.trailLength) {
                this.trail.pop();
            }
        }

        // Apply gravity
        this.vy += this.gravity * dt;

        // Apply wind (if weather system is loaded)
        if (typeof getWindForce === 'function') {
            const windForce = getWindForce();
            // Wind affects lighter/slower particles more
            const windInfluence = 1 - Math.min(Math.abs(this.vx) + Math.abs(this.vy), 200) / 400;
            this.vx += windForce * dt * windInfluence;
        }

        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Update position
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Update rotation
        this.rotation += this.rotationSpeed * dt;

        // Update age
        this.age += dt;

        // Return true if still alive
        return this.age < this.lifetime;
    }

    /**
     * Draw particle on canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        // Calculate interpolation factor (0 to 1)
        const t = Math.min(this.age / this.lifetime, 1);

        // Interpolate properties
        const size = this.lerp(this.sizeStart, this.sizeEnd, t);
        const opacity = this.lerp(this.opacityStart, this.opacityEnd, t);
        const color = this.lerpColor(this.colorStart, this.colorEnd, t);

        // Apply twinkle effect
        let finalOpacity = opacity;
        if (this.twinkle) {
            finalOpacity *= 0.5 + 0.5 * Math.sin(this.age * this.twinkleSpeed);
        }

        // Apply strobe effect (hard on/off)
        if (this.strobe) {
            const strobeValue = Math.sin(this.age * this.strobeSpeed + this.strobePhase);
            finalOpacity = strobeValue > 0 ? opacity : 0;
        }

        // Draw trail first (behind particle)
        if (this.trail.length > 0) {
            this.drawTrail(ctx, color, size, finalOpacity);
        }

        // Draw main particle
        ctx.save();
        ctx.globalAlpha = finalOpacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        this.drawShape(ctx, size, color);

        ctx.restore();
    }

    /**
     * Draw particle trail
     */
    drawTrail(ctx, color, size, opacity) {
        for (let i = 0; i < this.trail.length; i++) {
            const point = this.trail[i];
            const trailT = i / this.trail.length;
            const trailSize = size * (1 - trailT * 0.8);
            const trailOpacity = opacity * (1 - trailT);

            ctx.save();
            ctx.globalAlpha = trailOpacity * 0.5;
            ctx.translate(point.x, point.y);

            ctx.beginPath();
            ctx.arc(0, 0, trailSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * Draw the particle shape
     */
    drawShape(ctx, size, color) {
        ctx.fillStyle = color;

        switch (this.shape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'square':
                ctx.fillRect(-size / 2, -size / 2, size, size);
                break;

            case 'star':
                this.drawStar(ctx, size / 2);
                break;

            case 'spark':
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, -size / 2);
                ctx.lineTo(0, size / 2);
                ctx.stroke();
                break;

            case 'ring':
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.stroke();
                break;

            default:
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
        }
    }

    /**
     * Draw a 5-pointed star
     */
    drawStar(ctx, radius) {
        const spikes = 5;
        const outerRadius = radius;
        const innerRadius = radius * 0.5;

        ctx.beginPath();

        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    /**
     * Color interpolation (hex colors)
     */
    lerpColor(colorA, colorB, t) {
        const a = this.hexToRgb(colorA);
        const b = this.hexToRgb(colorB);

        const r = Math.round(this.lerp(a.r, b.r, t));
        const g = Math.round(this.lerp(a.g, b.g, t));
        const bl = Math.round(this.lerp(a.b, b.b, t));

        return `rgb(${r}, ${g}, ${bl})`;
    }

    /**
     * Convert hex color to RGB object
     */
    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Handle shorthand hex
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }
}
