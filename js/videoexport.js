/**
 * Video Export - record the show (canvas + audio) to a webm video.
 *
 * On the platform, the finished video is saved to the user's Files via
 * window.saveExportedVideo (provided by the platform adapter). Standalone,
 * it downloads in the browser.
 */

const videoExport = {
    recording: false,
    stopping: false,
    cancelled: false,
    recorder: null,
    chunks: [],
    audioDest: null,
    pollTimer: null,
    prevLoop: false,
    prevSpeed: 1
};

function isVideoExportSupported() {
    return typeof MediaRecorder !== 'undefined' &&
           canvas && typeof canvas.captureStream === 'function';
}

/**
 * Start recording: plays the show from the beginning at 1x and records
 * until it finishes (or the user stops/cancels).
 */
function startVideoExport() {
    if (videoExport.recording) return;

    if (show.events.length === 0) {
        showToast('Add some fireworks first!', 'info');
        return;
    }
    if (!isVideoExportSupported()) {
        showToast('Video export is not supported in this browser', 'error');
        return;
    }

    const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ].find(m => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
        showToast('Video recording is not supported in this browser', 'error');
        return;
    }

    // Canvas video + a tap on the master audio bus
    const stream = canvas.captureStream(30);
    try {
        if (typeof audioContext !== 'undefined' && audioContext &&
            typeof masterGain !== 'undefined' && masterGain) {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            videoExport.audioDest = audioContext.createMediaStreamDestination();
            masterGain.connect(videoExport.audioDest);
            videoExport.audioDest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        }
    } catch (err) {
        videoExport.audioDest = null; // Record video-only
    }

    videoExport.chunks = [];
    videoExport.cancelled = false;
    videoExport.stopping = false;
    videoExport.recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
    });
    videoExport.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) videoExport.chunks.push(e.data);
    };
    videoExport.recorder.onstop = finishVideoExport;

    // Record at 1x from the start, no looping
    videoExport.prevLoop = show.loop;
    videoExport.prevSpeed = show.playbackSpeed;
    show.setLoop(false);
    show.setSpeed(1);
    show.stop();
    show.seek(0);

    videoExport.recording = true;
    updateExportOverlay(true);
    videoExport.recorder.start(1000);
    show.play();

    // The show calls stop() on its own when it finishes (including the
    // fade-out of the last fireworks). Give the launcher glow a beat to
    // settle, then finalize. A manual Stop/pause also ends the recording.
    videoExport.pollTimer = setInterval(() => {
        updateExportOverlayTime();
        if (!show.isPlaying && videoExport.recording && !videoExport.stopping) {
            videoExport.stopping = true;
            setTimeout(() => {
                if (videoExport.recorder && videoExport.recorder.state !== 'inactive') {
                    videoExport.recorder.stop();
                }
            }, 1200);
        }
    }, 250);
}

/**
 * Cancel: discard whatever was recorded
 */
function cancelVideoExport() {
    if (!videoExport.recording) return;
    videoExport.cancelled = true;
    videoExport.stopping = true;
    show.stop();
    if (videoExport.recorder && videoExport.recorder.state !== 'inactive') {
        videoExport.recorder.stop();
    }
}

/**
 * Recorder stopped: restore playback settings and save/download
 */
function finishVideoExport() {
    clearInterval(videoExport.pollTimer);
    videoExport.recording = false;
    videoExport.stopping = false;
    updateExportOverlay(false);

    // Restore playback settings and their UI controls
    show.setLoop(videoExport.prevLoop);
    show.setSpeed(videoExport.prevSpeed);
    const loopBox = document.getElementById('loop-checkbox');
    if (loopBox) loopBox.checked = videoExport.prevLoop;
    const speedSel = document.getElementById('playback-speed');
    if (speedSel) speedSel.value = String(videoExport.prevSpeed);

    // Disconnect the audio tap
    if (videoExport.audioDest) {
        try { masterGain.disconnect(videoExport.audioDest); } catch (err) { /* already gone */ }
        videoExport.audioDest = null;
    }

    if (videoExport.cancelled) {
        videoExport.chunks = [];
        showToast('Export cancelled', 'info');
        return;
    }

    const blob = new Blob(videoExport.chunks, { type: 'video/webm' });
    videoExport.chunks = [];
    if (blob.size === 0) {
        showToast('Nothing was recorded', 'error');
        return;
    }

    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = 'fireworks-show-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                     '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.webm';

    if (typeof window.saveExportedVideo === 'function') {
        showToast('Saving your video (' + Math.round(blob.size / 1048576 * 10) / 10 + ' MB)...', 'info');
        window.saveExportedVideo(blob, filename)
            .then(() => showToast('Video saved to your Files!', 'success'))
            .catch((err) => {
                showToast('Could not save to Files, downloading instead', 'error');
                console.error('Video save failed:', err);
                downloadVideoBlob(blob, filename);
            });
    } else {
        downloadVideoBlob(blob, filename);
        showToast('Video downloaded!', 'success');
    }
}

function downloadVideoBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── Recording overlay ───────────────────────────────────────────────

function updateExportOverlay(visible) {
    let overlay = document.getElementById('export-overlay');
    if (!visible) {
        if (overlay) overlay.remove();
        return;
    }
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'export-overlay';
        overlay.innerHTML = `
            <span class="export-dot"></span>
            <span id="export-overlay-time">Recording... 0:00</span>
            <button class="btn btn-sm btn-secondary" onclick="cancelVideoExport()">Cancel</button>
        `;
        document.body.appendChild(overlay);
    }
    updateExportOverlayTime();
}

function updateExportOverlayTime() {
    const el = document.getElementById('export-overlay-time');
    if (el && videoExport.recording) {
        el.textContent = 'Recording... ' + formatTime(show.currentTime) + ' / ' + formatTime(show.duration);
    }
}

// Wire up the export button when present
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-export-video');
    if (btn) {
        btn.addEventListener('click', startVideoExport);
    }
});
