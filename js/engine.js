/**
 * Engine - Render loop and canvas management
 */

// Global references
let canvas, ctx;
let launcherManager, show;
let lastTime = 0;
let stars = [];

// Settings
let showStars = true;
let backgroundColor = '#0a0a1a';

// Track selected launcher for removal
let selectedLauncherForRemoval = null;

/**
 * Initialize the engine
 */
function initEngine() {
    // Get canvas
    canvas = document.getElementById('fireworks-canvas');
    ctx = canvas.getContext('2d');

    // Initialize managers
    launcherManager = new LauncherManager(canvas.width, canvas.height);
    show = new Show(launcherManager);

    // Set up show callbacks
    show.onTimeUpdate = updateTimeDisplay;
    show.onPlayStateChange = updatePlayButton;

    // Set up launcher changed callback
    launcherManager.onLaunchersChanged = onLaunchersChanged;

    // Set up canvas mouse events for launcher dragging
    setupCanvasMouseEvents();

    // Set up launcher management buttons
    setupLauncherButtons();

    // Generate background stars
    generateStars();

    // Initialize weather system (if available)
    if (typeof initWeather === 'function') {
        initWeather();
    }

    // Initialize audio system (if available)
    if (typeof initAudio === 'function') {
        initAudio();
    }

    // Initialize history system (undo/redo, selection, copy/paste)
    if (typeof initHistory === 'function') {
        initHistory();
    }

    // Load initial data
    loadInitialData();

    // Update launcher count display
    updateLauncherCount();

    // Start render loop
    requestAnimationFrame(render);
}

/**
 * Set up canvas mouse events for launcher interaction
 */
function setupCanvasMouseEvents() {
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseup', onCanvasMouseUp);
    canvas.addEventListener('mouseleave', onCanvasMouseUp);
}

/**
 * Handle mouse down on canvas
 */
function onCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Check if clicking on a launcher
    const launcher = launcherManager.getLauncherAtPoint(x, y);
    if (launcher) {
        // Save state before moving launcher
        if (typeof saveState === 'function') saveState('Move Launcher');
        launcherManager.startDrag(launcher);
        selectedLauncherForRemoval = launcher;
        canvas.classList.add('dragging');
        markDirty();
    }
}

/**
 * Handle mouse move on canvas
 */
function onCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (launcherManager.isDragging()) {
        launcherManager.updateDrag(x);
    } else {
        // Update cursor based on hover
        const launcher = launcherManager.getLauncherAtPoint(x, y);
        if (launcher) {
            canvas.classList.add('can-drag');
        } else {
            canvas.classList.remove('can-drag');
        }
    }
}

/**
 * Handle mouse up on canvas
 */
function onCanvasMouseUp(e) {
    if (launcherManager.isDragging()) {
        launcherManager.endDrag();
        canvas.classList.remove('dragging');
    }
}

/**
 * Set up launcher add/remove buttons
 */
function setupLauncherButtons() {
    const addBtn = document.getElementById('btn-add-launcher');
    const removeBtn = document.getElementById('btn-remove-launcher');

    if (addBtn) {
        addBtn.addEventListener('click', addNewLauncher);
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', removeSelectedLauncher);
    }
}

/**
 * Add a new launcher
 */
function addNewLauncher() {
    // Check if we can add before saving state
    if (launcherManager.launchers.length >= launcherManager.maxLaunchers) {
        showToast('Maximum launchers reached (10)', 'error');
        return;
    }
    // Save state before adding launcher
    if (typeof saveState === 'function') saveState('Add Launcher');
    const launcher = launcherManager.addLauncher();
    if (launcher) {
        showToast('Launcher ' + launcher.id + ' added!', 'success');
        markDirty();
    }
}

/**
 * Remove the selected launcher
 */
function removeSelectedLauncher() {
    if (!selectedLauncherForRemoval) {
        showToast('Click a launcher first to select it', 'info');
        return;
    }

    // Check if we can remove before saving state
    if (launcherManager.launchers.length <= launcherManager.minLaunchers) {
        showToast('Must keep at least one launcher', 'error');
        return;
    }

    const id = selectedLauncherForRemoval.id;
    // Save state before removing launcher
    if (typeof saveState === 'function') saveState('Remove Launcher');
    if (launcherManager.removeLauncher(id)) {
        showToast('Launcher ' + id + ' removed', 'info');
        selectedLauncherForRemoval = null;
        markDirty();
    }
}

/**
 * Called when launchers change (add/remove/reposition)
 */
function onLaunchersChanged() {
    updateLauncherCount();
    updateLauncherSelectButtons();
}

/**
 * Update launcher count display
 */
function updateLauncherCount() {
    const countEl = document.getElementById('launcher-count');
    if (countEl) {
        countEl.textContent = launcherManager.launchers.length + ' / ' + launcherManager.maxLaunchers;
    }

    // Update add button disabled state
    const addBtn = document.getElementById('btn-add-launcher');
    if (addBtn) {
        addBtn.disabled = launcherManager.launchers.length >= launcherManager.maxLaunchers;
    }

    // Update remove button disabled state
    const removeBtn = document.getElementById('btn-remove-launcher');
    if (removeBtn) {
        removeBtn.disabled = launcherManager.launchers.length <= launcherManager.minLaunchers;
    }
}

/**
 * Update launcher select buttons in modal
 */
function updateLauncherSelectButtons() {
    const container = document.getElementById('launcher-select');
    if (!container) return;

    container.innerHTML = '';

    launcherManager.launchers.forEach((launcher, index) => {
        const btn = document.createElement('button');
        btn.className = 'launcher-btn' + (index === 0 ? ' active' : '');
        btn.dataset.launcher = launcher.id;
        btn.textContent = launcher.id;
        btn.addEventListener('click', function() {
            container.querySelectorAll('.launcher-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedLauncherId = launcher.id;
        });
        container.appendChild(btn);
    });

    // Reset selectedLauncherId to first launcher if current doesn't exist
    if (!launcherManager.getLauncherById(selectedLauncherId)) {
        selectedLauncherId = launcherManager.launchers.length > 0 ? launcherManager.launchers[0].id : 1;
    }
}

/**
 * Generate random stars for background
 */
function generateStars() {
    stars = [];
    const starCount = 100;

    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 100), // Keep stars above launchers
            size: Math.random() * 1.5 + 0.5,
            brightness: Math.random(),
            twinkleSpeed: Math.random() * 2 + 1
        });
    }
}

/**
 * Load initial project data
 */
function loadInitialData() {
    if (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA && typeof INITIAL_DATA === 'object') {
        show.fromJSON(INITIAL_DATA);

        // Update UI
        refreshEventList();
        updateTimeDisplay(0, show.duration);
        updateLauncherCount();
        updateLauncherSelectButtons();
    }
}

/**
 * Main render loop
 */
function render(timestamp) {
    // Calculate delta time
    const dt = lastTime ? (timestamp - lastTime) / 1000 : 0;
    lastTime = timestamp;

    // Cap delta time to prevent huge jumps
    const cappedDt = Math.min(dt, 0.1);

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background stars
    if (showStars) {
        drawStars(timestamp);
    }

    // Draw ground/horizon
    drawGround();

    // Update smoke (if weather system is loaded)
    if (typeof smokeManager !== 'undefined' && smokeManager) {
        smokeManager.update(cappedDt);
    }

    // Draw smoke behind fireworks (if weather system is loaded)
    if (typeof smokeManager !== 'undefined' && smokeManager) {
        smokeManager.draw(ctx);
    }

    // Update and draw show
    show.update(cappedDt);
    show.draw(ctx);

    // Draw launchers
    launcherManager.draw(ctx);

    // Continue render loop
    requestAnimationFrame(render);
}

/**
 * Draw twinkling stars
 */
function drawStars(timestamp) {
    stars.forEach(star => {
        const twinkle = 0.5 + 0.5 * Math.sin(timestamp / 1000 * star.twinkleSpeed);
        const alpha = star.brightness * twinkle;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

/**
 * Draw ground/horizon line
 */
function drawGround() {
    // Gradient for ground
    const groundGradient = ctx.createLinearGradient(0, canvas.height - 50, 0, canvas.height);
    groundGradient.addColorStop(0, 'transparent');
    groundGradient.addColorStop(1, 'rgba(30, 30, 50, 0.8)');

    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    // Horizon line
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 45);
    ctx.lineTo(canvas.width, canvas.height - 45);
    ctx.stroke();
}

/**
 * Update time display in toolbar
 */
function updateTimeDisplay(currentTime, duration) {
    const currentFormatted = formatTime(currentTime);
    const durationFormatted = formatTime(duration);

    document.getElementById('time-display').textContent =
        `${currentFormatted} / ${durationFormatted}`;

    // Update timeline progress
    const progress = (currentTime / duration) * 100;
    document.getElementById('timeline-progress').style.width = progress + '%';
    document.getElementById('playhead').style.left = progress + '%';
}

/**
 * Update play/pause button state
 */
function updatePlayButton(isPlaying) {
    const playBtn = document.getElementById('btn-play');
    const pauseBtn = document.getElementById('btn-pause');

    if (isPlaying) {
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
    } else {
        playBtn.style.display = 'flex';
        pauseBtn.style.display = 'none';
    }
}

/**
 * Format time in mm:ss format
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format time in mm:ss.ms format for event list
 */
function formatTimeDetailed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Parse time from mm:ss format to milliseconds
 */
function parseTime(minutes, seconds) {
    return (parseInt(minutes) * 60 + parseInt(seconds)) * 1000;
}

/**
 * Get show data for saving
 */
function getShowData() {
    return show.toJSON();
}

/**
 * Mark project as dirty (unsaved changes)
 */
function markDirty() {
    if (typeof isDirty !== 'undefined') {
        isDirty = true;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initEngine);
