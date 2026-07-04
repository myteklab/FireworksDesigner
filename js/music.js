/**
 * Music - soundtrack playback synced to the show timeline.
 *
 * Tracks are public domain recordings bundled with the app (see
 * assets/music/CREDITS.md). Audio routes through the master gain, so
 * video exports capture the soundtrack automatically. The waveform is
 * rendered behind the timeline so launches can be placed on the music.
 */

const MUSIC_TRACKS = [
    { id: 'stars-and-stripes', name: 'Stars and Stripes Forever (Sousa)', file: 'assets/music/stars-and-stripes.mp3' },
    { id: 'washington-post', name: 'The Washington Post March (Sousa)', file: 'assets/music/washington-post.mp3' },
    { id: 'semper-fidelis', name: 'Semper Fidelis (Sousa)', file: 'assets/music/semper-fidelis.mp3' },
    { id: 'liberty-bell', name: 'The Liberty Bell (Sousa)', file: 'assets/music/liberty-bell.mp3' },
    { id: 'william-tell-finale', name: 'William Tell Overture - Finale (Rossini)', file: 'assets/music/william-tell-finale.mp3' },
    { id: '1812-finale', name: '1812 Overture - Finale (Tchaikovsky)', file: 'assets/music/1812-finale.mp3' }
];

const music = {
    trackId: null,
    volume: 70,
    element: null,     // Persistent <audio> element
    sourceNode: null,  // MediaElementSource (creatable only once per element)
    gain: null,
    durationMs: 0,
    waveform: null,    // Peak buckets for the timeline
    loadSeq: 0
};

function getMusicTrack(id) {
    return MUSIC_TRACKS.find(t => t.id === id) || null;
}

/**
 * Wire up the settings UI and the persistent audio element
 */
function initMusic() {
    const select = document.getElementById('music-track');
    if (select) {
        MUSIC_TRACKS.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
        select.addEventListener('change', function () {
            setMusicTrack(this.value || null);
            markDirty();
        });
    }

    const slider = document.getElementById('music-volume');
    if (slider) {
        slider.addEventListener('input', function () {
            music.volume = parseInt(this.value, 10);
            const label = document.getElementById('music-volume-label');
            if (label) label.textContent = music.volume + '%';
            if (music.gain) music.gain.gain.value = music.volume / 100;
            markDirty();
        });
    }
}

/**
 * Ensure the audio element exists and routes through the master gain
 * (so exports record the music). Falls back to plain element playback
 * if the audio graph is unavailable.
 */
function ensureMusicElement() {
    if (music.element) return;

    music.element = new Audio();
    music.element.preload = 'auto';

    if (audioContext && masterGain) {
        try {
            music.gain = audioContext.createGain();
            music.gain.gain.value = music.volume / 100;
            music.sourceNode = audioContext.createMediaElementSource(music.element);
            music.sourceNode.connect(music.gain);
            music.gain.connect(masterGain);
        } catch (err) {
            music.gain = null; // Element plays directly; volume set on element
        }
    }
}

/**
 * Select a soundtrack (or null for none). Loads the audio, decodes the
 * waveform for the timeline, and extends the show duration to the song.
 */
function setMusicTrack(trackId) {
    const track = getMusicTrack(trackId);
    music.trackId = track ? track.id : null;
    music.durationMs = 0;
    music.waveform = null;
    const seq = ++music.loadSeq;

    // Sync the settings UI
    const select = document.getElementById('music-track');
    if (select && select.value !== (music.trackId || '')) {
        select.value = music.trackId || '';
    }

    if (!track) {
        if (music.element) {
            music.element.pause();
            music.element.removeAttribute('src');
            music.element.load();
        }
        if (typeof show !== 'undefined' && show) {
            show.updateDuration();
        }
        drawTimelineWaveform();
        return;
    }

    ensureMusicElement();
    music.element.src = track.file;
    if (!music.gain) music.element.volume = music.volume / 100;

    music.element.addEventListener('loadedmetadata', function onMeta() {
        music.element.removeEventListener('loadedmetadata', onMeta);
        if (seq !== music.loadSeq) return;
        music.durationMs = music.element.duration * 1000;
        if (typeof show !== 'undefined' && show) {
            show.updateDuration();
            // If the show is mid-playback, join in at the current position
            if (show.isPlaying) musicPlay(show.currentTime);
        }
        if (typeof updateTimelineMarkers === 'function') updateTimelineMarkers();
    });

    // Decode peaks for the timeline waveform
    fetch(track.file)
        .then(r => r.arrayBuffer())
        .then(buf => audioContext ? audioContext.decodeAudioData(buf) : null)
        .then(decoded => {
            if (!decoded || seq !== music.loadSeq) return;
            const data = decoded.getChannelData(0);
            const buckets = 700;
            const step = Math.floor(data.length / buckets);
            const peaks = new Array(buckets);
            for (let i = 0; i < buckets; i++) {
                let max = 0;
                const start = i * step;
                for (let j = 0; j < step; j += 16) {
                    const v = Math.abs(data[start + j]);
                    if (v > max) max = v;
                }
                peaks[i] = max;
            }
            music.waveform = peaks;
            drawTimelineWaveform();
        })
        .catch(() => { /* No waveform; playback still works */ });
}

/**
 * The soundtrack's length in ms (0 when no track)
 */
function getMusicDurationMs() {
    return music.trackId ? music.durationMs : 0;
}

// ── Playback sync (called from Show) ────────────────────────────────

function musicPlay(fromMs) {
    if (!music.trackId || !music.element || window.PREVIEW_MUTED) return;
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    const pos = (fromMs || 0) / 1000;
    if (pos < (music.element.duration || Infinity)) {
        music.element.currentTime = pos;
        music.element.play().catch(() => { /* Autoplay policy; user gesture will resume */ });
    }
}

function musicPause() {
    if (music.element) music.element.pause();
}

function musicStop() {
    if (music.element) {
        music.element.pause();
        try { music.element.currentTime = 0; } catch (err) { /* not loaded */ }
    }
}

function musicSeek(ms) {
    if (!music.trackId || !music.element) return;
    const pos = ms / 1000;
    try {
        if (pos >= (music.element.duration || 0)) {
            music.element.pause();
        } else {
            music.element.currentTime = pos;
        }
    } catch (err) { /* not loaded yet */ }
}

function musicSetRate(rate) {
    if (music.element) {
        try { music.element.playbackRate = rate; } catch (err) { /* unsupported rate */ }
    }
}

// ── Timeline waveform ───────────────────────────────────────────────

/**
 * Draw the soundtrack's waveform behind the timeline track. The song
 * occupies its true share of the show duration.
 */
function drawTimelineWaveform() {
    const canvas = document.getElementById('timeline-waveform');
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);

    if (!music.waveform || !music.durationMs || typeof show === 'undefined' || !show || !show.duration) {
        return;
    }

    const fraction = Math.min(1, music.durationMs / show.duration);
    const W = canvas.width * fraction;
    const H = canvas.height;
    const mid = H / 2;
    const buckets = music.waveform.length;

    ctx2.fillStyle = 'rgba(155, 89, 182, 0.35)';
    const barW = W / buckets;
    for (let i = 0; i < buckets; i++) {
        const h = Math.max(1, music.waveform[i] * (H - 4));
        ctx2.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.3), h);
    }
}

// ── Serialization ───────────────────────────────────────────────────

function getMusicSettings() {
    return { track: music.trackId, volume: music.volume };
}

function loadMusicSettings(settings) {
    music.volume = (settings && typeof settings.volume === 'number') ? settings.volume : 70;
    const slider = document.getElementById('music-volume');
    if (slider) slider.value = music.volume;
    const label = document.getElementById('music-volume-label');
    if (label) label.textContent = music.volume + '%';
    if (music.gain) music.gain.gain.value = music.volume / 100;

    setMusicTrack((settings && settings.track) || null);
}
