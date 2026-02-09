/**
 * Firework Type Definitions
 * Each type defines how particles are spawned and behave during burst
 */
const FIREWORK_TYPES = {
    chrysanthemum: {
        name: 'Chrysanthemum',
        description: 'Classic spherical burst with trailing sparks',
        particleCount: { small: 60, medium: 100, large: 150 },
        spread: 360,
        speed: { min: 80, max: 150 },
        gravity: 40,
        lifetime: { min: 1.5, max: 2.5 },
        shape: 'circle',
        sizeStart: 4,
        sizeEnd: 1,
        trailLength: 8,
        hasSecondaryBurst: false
    },

    willow: {
        name: 'Willow',
        description: 'Drooping trails that fall gracefully',
        particleCount: { small: 50, medium: 80, large: 120 },
        spread: 360,
        speed: { min: 60, max: 100 },
        gravity: 80, // Higher gravity for drooping effect
        lifetime: { min: 2.5, max: 3.5 },
        shape: 'spark',
        sizeStart: 3,
        sizeEnd: 1,
        trailLength: 15,
        hasSecondaryBurst: false
    },

    palm: {
        name: 'Palm',
        description: 'Upward palm-shaped burst',
        particleCount: { small: 35, medium: 50, large: 70 },
        spread: 120, // Narrower spread for palm shape
        spreadOffset: -90, // Point upward
        speed: { min: 100, max: 180 },
        gravity: 50,
        lifetime: { min: 1.8, max: 2.5 },
        shape: 'spark',
        sizeStart: 3,
        sizeEnd: 1,
        trailLength: 12,
        hasSecondaryBurst: false
    },

    peony: {
        name: 'Peony',
        description: 'Dense round burst without trails',
        particleCount: { small: 80, medium: 120, large: 180 },
        spread: 360,
        speed: { min: 70, max: 130 },
        gravity: 35,
        lifetime: { min: 1.2, max: 2.0 },
        shape: 'circle',
        sizeStart: 5,
        sizeEnd: 2,
        trailLength: 0,
        hasSecondaryBurst: false
    },

    crackle: {
        name: 'Crackle',
        description: 'Burst with secondary mini-explosions',
        particleCount: { small: 40, medium: 60, large: 90 },
        spread: 360,
        speed: { min: 80, max: 140 },
        gravity: 45,
        lifetime: { min: 1.0, max: 1.8 },
        shape: 'circle',
        sizeStart: 4,
        sizeEnd: 2,
        trailLength: 5,
        hasSecondaryBurst: true,
        secondaryDelay: 0.5,
        secondaryCount: 3
    },

    ring: {
        name: 'Ring',
        description: 'Circular ring formation',
        particleCount: { small: 30, medium: 40, large: 60 },
        spread: 360,
        speed: { min: 100, max: 110 }, // Uniform speed for ring shape
        gravity: 20, // Low gravity to maintain shape
        lifetime: { min: 1.5, max: 2.0 },
        shape: 'ring',
        sizeStart: 4,
        sizeEnd: 2,
        trailLength: 3,
        uniformSpeed: true,
        hasSecondaryBurst: false
    },

    heart: {
        name: 'Heart',
        description: 'Heart-shaped burst pattern',
        particleCount: { small: 40, medium: 60, large: 80 },
        spread: 360,
        speed: { min: 80, max: 120 },
        gravity: 30,
        lifetime: { min: 1.8, max: 2.5 },
        shape: 'circle',
        sizeStart: 4,
        sizeEnd: 1,
        trailLength: 6,
        customPattern: 'heart',
        hasSecondaryBurst: false
    },

    comet: {
        name: 'Comet',
        description: 'Single rising trail with long tail',
        particleCount: { small: 1, medium: 1, large: 1 },
        spread: 0,
        speed: { min: 200, max: 250 },
        gravity: 60,
        lifetime: { min: 2.0, max: 3.0 },
        shape: 'circle',
        sizeStart: 8,
        sizeEnd: 3,
        trailLength: 25,
        isComet: true,
        hasSecondaryBurst: false
    },

    // === NEW TYPES (Phase 3) ===

    crossette: {
        name: 'Crossette',
        description: 'Splits into crossing trails mid-flight',
        particleCount: { small: 20, medium: 30, large: 45 },
        spread: 360,
        speed: { min: 100, max: 140 },
        gravity: 35,
        lifetime: { min: 2.0, max: 2.8 },
        shape: 'circle',
        sizeStart: 4,
        sizeEnd: 2,
        trailLength: 8,
        hasSecondaryBurst: false,
        hasSplit: true,
        splitDelay: 0.4,
        splitCount: 4
    },

    brocade: {
        name: 'Brocade',
        description: 'Shimmering gold/silver glitter cascade',
        particleCount: { small: 80, medium: 120, large: 180 },
        spread: 360,
        speed: { min: 60, max: 100 },
        gravity: 70,
        lifetime: { min: 2.5, max: 3.5 },
        shape: 'star',
        sizeStart: 3,
        sizeEnd: 1,
        trailLength: 4,
        twinkle: true,
        hasSecondaryBurst: false,
        forceGold: true
    },

    strobe: {
        name: 'Strobe',
        description: 'Flashing on/off effect',
        particleCount: { small: 50, medium: 70, large: 100 },
        spread: 360,
        speed: { min: 80, max: 130 },
        gravity: 40,
        lifetime: { min: 2.0, max: 3.0 },
        shape: 'circle',
        sizeStart: 5,
        sizeEnd: 3,
        trailLength: 0,
        hasSecondaryBurst: false,
        strobe: true,
        strobeSpeed: 15
    },

    waterfall: {
        name: 'Waterfall',
        description: 'Cascading sparks falling like water',
        particleCount: { small: 60, medium: 90, large: 130 },
        spread: 60,
        spreadOffset: 90, // Point downward initially, then gravity takes over
        speed: { min: 40, max: 80 },
        gravity: 120,
        lifetime: { min: 2.5, max: 4.0 },
        shape: 'spark',
        sizeStart: 3,
        sizeEnd: 1,
        trailLength: 12,
        hasSecondaryBurst: false
    },

    saturn: {
        name: 'Saturn',
        description: 'Ring around central burst',
        particleCount: { small: 60, medium: 80, large: 110 },
        spread: 360,
        speed: { min: 80, max: 120 },
        gravity: 35,
        lifetime: { min: 1.8, max: 2.5 },
        shape: 'circle',
        sizeStart: 4,
        sizeEnd: 1,
        trailLength: 6,
        hasSecondaryBurst: false,
        customPattern: 'saturn'
    },

    spider: {
        name: 'Spider',
        description: 'Long burning legs radiating outward',
        particleCount: { small: 8, medium: 12, large: 16 },
        spread: 360,
        speed: { min: 60, max: 80 },
        gravity: 15,
        lifetime: { min: 3.0, max: 4.5 },
        shape: 'spark',
        sizeStart: 4,
        sizeEnd: 2,
        trailLength: 30,
        uniformSpeed: true,
        hasSecondaryBurst: false
    }
};

/**
 * Size multipliers for particle counts and spread
 */
const SIZE_MULTIPLIERS = {
    small: { particles: 0.6, spread: 0.7, speed: 0.8 },
    medium: { particles: 1.0, spread: 1.0, speed: 1.0 },
    large: { particles: 1.4, spread: 1.3, speed: 1.2 }
};

/**
 * Height configurations for burst altitude
 */
const HEIGHT_CONFIGS = {
    low: { burstY: 350, launchSpeed: 300 },    // Lower burst
    medium: { burstY: 250, launchSpeed: 400 }, // Middle burst
    high: { burstY: 150, launchSpeed: 500 }    // Higher burst
};

/**
 * Trail effect configurations
 */
const TRAIL_CONFIGS = {
    none: { trailMultiplier: 0 },
    sparkle: { trailMultiplier: 1.0 },
    comet: { trailMultiplier: 2.0 }
};

/**
 * Predefined color palettes for finale
 */
const COLOR_PALETTES = [
    { primary: '#ff0000', secondary: '#ffaa00' }, // Red-Orange
    { primary: '#00ff00', secondary: '#00ffaa' }, // Green-Cyan
    { primary: '#0088ff', secondary: '#00ffff' }, // Blue-Cyan
    { primary: '#ff00ff', secondary: '#ff88ff' }, // Magenta-Pink
    { primary: '#ffff00', secondary: '#ffffff' }, // Yellow-White
    { primary: '#ff6600', secondary: '#ffcc00' }, // Orange-Gold
    { primary: '#9900ff', secondary: '#ff00ff' }, // Purple-Magenta
    { primary: '#ffffff', secondary: '#aaddff' }, // White-Ice
    { primary: '#ff0066', secondary: '#ff6699' }, // Hot Pink
    { primary: '#00ffaa', secondary: '#aaffff' }  // Teal-Aqua
];

/**
 * Color themes for finale customization
 */
const COLOR_THEMES = {
    random: null, // Will use random palettes
    patriotic: [
        { primary: '#bf0a30', secondary: '#ffffff' }, // Red
        { primary: '#ffffff', secondary: '#aaccff' }, // White
        { primary: '#002868', secondary: '#4477cc' }  // Blue
    ],
    golden: [
        { primary: '#ffd700', secondary: '#ffffff' }, // Gold
        { primary: '#ff8c00', secondary: '#ffcc00' }, // Dark Orange
        { primary: '#ff4500', secondary: '#ff8c00' }, // Orange Red
        { primary: '#ffb347', secondary: '#ffd700' }  // Pastel Orange
    ],
    ocean: [
        { primary: '#00ced1', secondary: '#7fffd4' }, // Dark Turquoise
        { primary: '#1e90ff', secondary: '#00bfff' }, // Dodger Blue
        { primary: '#000080', secondary: '#4169e1' }, // Navy
        { primary: '#40e0d0', secondary: '#afeeee' }  // Turquoise
    ],
    sunset: [
        { primary: '#ff6b6b', secondary: '#ffd93d' }, // Coral
        { primary: '#ffa502', secondary: '#ffbe76' }, // Orange
        { primary: '#ff4757', secondary: '#ff6b81' }, // Red-Pink
        { primary: '#ff9f43', secondary: '#feca57' }  // Mango
    ],
    forest: [
        { primary: '#2ed573', secondary: '#7bed9f' }, // Lime
        { primary: '#17a854', secondary: '#2ed573' }, // Green
        { primary: '#1e7a40', secondary: '#27ae60' }, // Forest
        { primary: '#00d2d3', secondary: '#54a0ff' }  // Accent cyan
    ],
    candy: [
        { primary: '#ff6b81', secondary: '#ffcccc' }, // Pink
        { primary: '#a55eea', secondary: '#d6a2f9' }, // Purple
        { primary: '#4b7bec', secondary: '#a5c9ff' }, // Blue
        { primary: '#fd79a8', secondary: '#fab1a0' }  // Salmon Pink
    ]
};

/**
 * Get a random color palette
 */
function getRandomColorPalette() {
    return COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
}

/**
 * Get a palette from a specific theme
 */
function getThemePalette(themeName) {
    if (themeName === 'random' || !COLOR_THEMES[themeName]) {
        return getRandomColorPalette();
    }
    const theme = COLOR_THEMES[themeName];
    return theme[Math.floor(Math.random() * theme.length)];
}

/**
 * Get a palette from custom colors
 */
function getCustomPalette(colors) {
    // colors is an array of hex strings
    const primary = colors[Math.floor(Math.random() * colors.length)];
    let secondary = colors[Math.floor(Math.random() * colors.length)];
    // Try to pick a different secondary color
    if (colors.length > 1 && secondary === primary) {
        const others = colors.filter(c => c !== primary);
        secondary = others[Math.floor(Math.random() * others.length)];
    }
    return { primary, secondary };
}

/**
 * Get a random firework type
 */
function getRandomFireworkType() {
    const types = Object.keys(FIREWORK_TYPES);
    // Exclude comet from random selection (it's special)
    const filteredTypes = types.filter(t => t !== 'comet');
    return filteredTypes[Math.floor(Math.random() * filteredTypes.length)];
}
