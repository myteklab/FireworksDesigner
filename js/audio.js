/**
 * FireworksDesigner Audio Manager
 * Handles sound effects for firework launches, bursts, and crowd ambience
 */

// Global audio state
const audio = {
    enabled: true,
    volume: 50,           // 0-100
    crowdEnabled: true
};

// Audio context and nodes
let audioContext = null;
let masterGain = null;
let crowdGain = null;
let crowdSource = null;
let crowdBuffer = null;

// Sound file cache (for MP3 fallback)
const soundCache = {};

// Sound file paths (can be replaced with actual MP3 files)
const SOUND_FILES = {
    whoosh: 'assets/sounds/whoosh.mp3',
    boom1: 'assets/sounds/boom1.mp3',
    boom2: 'assets/sounds/boom2.mp3',
    boom3: 'assets/sounds/boom3.mp3',
    crackle: 'assets/sounds/crackle.mp3',
    crowdMurmur: 'assets/sounds/crowd-murmur.mp3',
    crowdCheer: 'assets/sounds/crowd-cheer.mp3'
};

// Track if we're using synthetic sounds (fallback)
let useSynthetic = true;

/**
 * Initialize the audio system
 */
function initAudio() {
    // Create AudioContext
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create master gain node
        masterGain = audioContext.createGain();
        masterGain.connect(audioContext.destination);
        updateMasterVolume();

        // Create crowd gain node (separate for crowd sounds)
        crowdGain = audioContext.createGain();
        crowdGain.connect(masterGain);
        crowdGain.gain.value = 0.3; // Crowd is quieter

        // Try to load MP3 files, fall back to synthetic if not available
        tryLoadSoundFiles();

    } catch (e) {
        console.warn('Web Audio API not supported:', e);
    }

    // Set up UI event listeners
    initAudioUI();

    // Resume audio context on user interaction (browser requirement)
    document.addEventListener('click', resumeAudioContext, { once: true });
    document.addEventListener('keydown', resumeAudioContext, { once: true });
}

/**
 * Resume audio context (required by browsers after user interaction)
 */
function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

/**
 * Try to load MP3 sound files
 */
function tryLoadSoundFiles() {
    // For now, use synthetic sounds
    // MP3 files can be added later for higher quality
    useSynthetic = true;

    // Uncomment below to enable MP3 loading:
    /*
    const testFile = SOUND_FILES.boom1;
    fetch(testFile, { method: 'HEAD' })
        .then(response => {
            if (response.ok) {
                useSynthetic = false;
                preloadSounds();
            }
        })
        .catch(() => {
            useSynthetic = true;
        });
    */
}

/**
 * Preload all sound files
 */
function preloadSounds() {
    Object.entries(SOUND_FILES).forEach(([name, path]) => {
        loadSoundFile(name, path);
    });
}

/**
 * Load a sound file into the cache
 */
function loadSoundFile(name, path) {
    fetch(path)
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .then(decodedBuffer => {
            soundCache[name] = decodedBuffer;
        })
        .catch(err => {
            console.warn(`Failed to load sound: ${name}`, err);
        });
}

/**
 * Update master volume from audio.volume
 */
function updateMasterVolume() {
    if (masterGain) {
        masterGain.gain.value = audio.enabled ? (audio.volume / 100) : 0;
    }
}

/**
 * Initialize audio UI controls
 */
function initAudioUI() {
    const soundToggle = document.getElementById('sound-enabled');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeLabel = document.getElementById('volume-label');
    const crowdToggle = document.getElementById('crowd-enabled');
    const soundControls = document.querySelectorAll('.sound-control');

    // Sound toggle
    if (soundToggle) {
        soundToggle.checked = audio.enabled;
        soundToggle.addEventListener('change', function() {
            audio.enabled = this.checked;
            updateMasterVolume();

            // Show/hide volume controls
            soundControls.forEach(el => {
                el.style.display = this.checked ? 'flex' : 'none';
            });

            // Stop crowd if sound disabled
            if (!this.checked) {
                stopCrowdAmbience();
            }

            if (typeof markDirty === 'function') markDirty();
        });
    }

    // Volume slider
    if (volumeSlider) {
        volumeSlider.value = audio.volume;
        if (volumeLabel) volumeLabel.textContent = audio.volume + '%';

        volumeSlider.addEventListener('input', function() {
            audio.volume = parseInt(this.value);
            if (volumeLabel) volumeLabel.textContent = this.value + '%';
            updateMasterVolume();
            if (typeof markDirty === 'function') markDirty();
        });
    }

    // Crowd toggle
    if (crowdToggle) {
        crowdToggle.checked = audio.crowdEnabled;
        crowdToggle.addEventListener('change', function() {
            audio.crowdEnabled = this.checked;
            if (!this.checked) {
                stopCrowdAmbience();
            }
            if (typeof markDirty === 'function') markDirty();
        });
    }

    // Initial visibility of sound controls
    if (soundControls.length > 0) {
        soundControls.forEach(el => {
            el.style.display = audio.enabled ? 'flex' : 'none';
        });
    }
}

/**
 * Play a sound effect
 * @param {string} name - Sound name (whoosh, boom1, boom2, boom3, crackle, crowdCheer)
 * @param {number} volumeMultiplier - Volume multiplier (0-1)
 */
function playSound(name, volumeMultiplier = 1.0) {
    if (!audio.enabled || !audioContext) return;

    // Resume context if needed
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    if (useSynthetic) {
        playSyntheticSound(name, volumeMultiplier);
    } else {
        playBufferedSound(name, volumeMultiplier);
    }
}

/**
 * Play a buffered (MP3) sound
 */
function playBufferedSound(name, volumeMultiplier) {
    const buffer = soundCache[name];
    if (!buffer) {
        // Fallback to synthetic
        playSyntheticSound(name, volumeMultiplier);
        return;
    }

    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();

    source.buffer = buffer;
    gain.gain.value = volumeMultiplier;

    source.connect(gain);
    gain.connect(masterGain);

    source.start(0);
}

/**
 * Play a synthetic sound using Web Audio API
 */
function playSyntheticSound(name, volumeMultiplier) {
    const now = audioContext.currentTime;

    switch(name) {
        case 'whoosh':
            createWhooshSound(now, volumeMultiplier);
            break;
        case 'boom1':
            createBoomSound(now, volumeMultiplier, 'deep');
            break;
        case 'boom2':
            createBoomSound(now, volumeMultiplier, 'sharp');
            break;
        case 'boom3':
            createBoomSound(now, volumeMultiplier, 'rolling');
            break;
        case 'crackle':
            createCrackleSound(now, volumeMultiplier);
            break;
        case 'crowdCheer':
            createCheerSound(now, volumeMultiplier);
            break;
    }
}

/**
 * Create a whoosh/launch sound
 */
function createWhooshSound(startTime, volume) {
    const duration = 0.6;

    // White noise filtered for whoosh
    const bufferSize = audioContext.sampleRate * duration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Bandpass filter for whoosh character
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, startTime);
    filter.frequency.exponentialRampToValueAtTime(2000, startTime + duration * 0.7);
    filter.Q.value = 1;

    // Envelope
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
}

/**
 * Create a boom/explosion sound
 */
function createBoomSound(startTime, volume, type) {
    let basePitch, duration, noiseAmount;

    switch(type) {
        case 'deep':
            basePitch = 60;
            duration = 1.0;
            noiseAmount = 0.6;
            break;
        case 'sharp':
            basePitch = 100;
            duration = 0.6;
            noiseAmount = 0.8;
            break;
        case 'rolling':
            basePitch = 50;
            duration = 1.4;
            noiseAmount = 0.5;
            break;
        default:
            basePitch = 80;
            duration = 0.8;
            noiseAmount = 0.7;
    }

    // Low frequency oscillator for the "boom"
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(basePitch * 2, startTime);
    osc.frequency.exponentialRampToValueAtTime(basePitch, startTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, startTime + duration);

    const oscGain = audioContext.createGain();
    oscGain.gain.setValueAtTime(volume * 0.7, startTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    // Noise burst for texture
    const bufferSize = audioContext.sampleRate * duration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // Low pass filter
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, startTime);
    filter.frequency.exponentialRampToValueAtTime(200, startTime + duration);

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(volume * noiseAmount, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration * 0.8);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
}

/**
 * Create a crackle/pop sound
 */
function createCrackleSound(startTime, volume) {
    // Multiple quick pops
    const popCount = 4 + Math.floor(Math.random() * 4);

    for (let i = 0; i < popCount; i++) {
        const popTime = startTime + (i * 0.05) + (Math.random() * 0.03);
        createSinglePop(popTime, volume * (0.5 + Math.random() * 0.5));
    }
}

/**
 * Create a single pop sound
 */
function createSinglePop(startTime, volume) {
    const duration = 0.08;

    // Short noise burst
    const bufferSize = audioContext.sampleRate * duration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    // High pass for snap
    const filter = audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(volume * 0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
}

/**
 * Create a crowd cheer sound
 */
function createCheerSound(startTime, volume) {
    const duration = 1.5;

    // Multiple "voice-like" oscillators
    for (let i = 0; i < 5; i++) {
        const freq = 300 + Math.random() * 400;
        const osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.setValueAtTime(freq * 1.2, startTime + 0.2);
        osc.frequency.linearRampToValueAtTime(freq * 0.8, startTime + duration);

        // Tremolo for crowd feel
        const tremolo = audioContext.createOscillator();
        tremolo.type = 'sine';
        tremolo.frequency.value = 3 + Math.random() * 3;

        const tremoloGain = audioContext.createGain();
        tremoloGain.gain.value = 0.3;

        const voiceGain = audioContext.createGain();
        voiceGain.gain.setValueAtTime(0, startTime);
        voiceGain.gain.linearRampToValueAtTime(volume * 0.15, startTime + 0.1);
        voiceGain.gain.setValueAtTime(volume * 0.15, startTime + 0.5);
        voiceGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        tremolo.connect(tremoloGain);
        tremoloGain.connect(voiceGain.gain);

        osc.connect(voiceGain);
        voiceGain.connect(crowdGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
        tremolo.start(startTime);
        tremolo.stop(startTime + duration);
    }

    // Add some noise for texture
    const bufferSize = audioContext.sampleRate * duration;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 0.5;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0, startTime);
    noiseGain.gain.linearRampToValueAtTime(volume * 0.1, startTime + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(crowdGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
}

/**
 * Start crowd ambient murmur
 * NOTE: Synthetic crowd sounds disabled - requires real audio files
 */
function playCrowdAmbience() {
    if (!audio.enabled || !audio.crowdEnabled || !audioContext) return;
    if (crowdSource) return; // Already playing

    // Only play if we have real audio files loaded
    if (useSynthetic) {
        // Synthetic crowd sounds are disabled - they sound too artificial
        // To enable: add crowd-murmur.mp3 to assets/sounds/
        return;
    }

    // Real audio file playback would go here
    // playBufferedSound('crowdMurmur', 0.3);
}

/**
 * Stop crowd ambient murmur
 */
function stopCrowdAmbience() {
    if (crowdSource) {
        try {
            crowdSource.stop();
        } catch (e) {
            // Already stopped
        }
        crowdSource = null;
    }
}

/**
 * Trigger crowd cheer after a burst
 * NOTE: Synthetic crowd sounds disabled - requires real audio files
 * @param {string} size - Firework size (small, medium, large)
 */
function triggerCrowdCheer(size) {
    if (!audio.enabled || !audio.crowdEnabled) return;

    // Only play if we have real audio files loaded
    if (useSynthetic) {
        // Synthetic crowd sounds are disabled - they sound too artificial
        // To enable: add crowd-cheer.mp3 to assets/sounds/
        return;
    }

    let intensity;
    switch(size) {
        case 'large': intensity = 1.0; break;
        case 'medium': intensity = 0.7; break;
        case 'small': intensity = 0.4; break;
        default: intensity = 0.6;
    }

    // Add slight random delay for realism (0-200ms)
    const delay = Math.random() * 0.2;

    setTimeout(() => {
        playSound('crowdCheer', intensity);
    }, delay * 1000);
}

/**
 * Get audio settings for saving
 */
function getAudioSettings() {
    return {
        enabled: audio.enabled,
        volume: audio.volume,
        crowdEnabled: audio.crowdEnabled
    };
}

/**
 * Load audio settings from saved data
 */
function loadAudioSettings(settings) {
    if (!settings) return;

    audio.enabled = settings.enabled !== undefined ? settings.enabled : true;
    audio.volume = settings.volume !== undefined ? settings.volume : 50;
    audio.crowdEnabled = settings.crowdEnabled !== undefined ? settings.crowdEnabled : true;

    // Update volume
    updateMasterVolume();

    // Sync UI with loaded state
    const soundToggle = document.getElementById('sound-enabled');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeLabel = document.getElementById('volume-label');
    const crowdToggle = document.getElementById('crowd-enabled');
    const soundControls = document.querySelectorAll('.sound-control');

    if (soundToggle) {
        soundToggle.checked = audio.enabled;
    }

    if (volumeSlider) {
        volumeSlider.value = audio.volume;
    }

    if (volumeLabel) {
        volumeLabel.textContent = audio.volume + '%';
    }

    if (crowdToggle) {
        crowdToggle.checked = audio.crowdEnabled;
    }

    // Update control visibility
    if (soundControls.length > 0) {
        soundControls.forEach(el => {
            el.style.display = audio.enabled ? 'flex' : 'none';
        });
    }
}
