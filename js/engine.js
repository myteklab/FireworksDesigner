/**
 * Engine - Render loop and canvas management
 */

// Global references
let canvas, ctx;
let launcherManager, show;
let lastTime = 0;
let stars = [];

// Logical coordinate space. All game logic and saved data use these dimensions.
// The canvas buffer is scaled up to match the display size for crisp rendering.
const LOGIC_WIDTH = 800;
const LOGIC_HEIGHT = 500;
let renderScale = 1;

// Settings
let showStars = true;
let backgroundColor = '#0a0a1a';

// Track selected launcher for removal
let selectedLauncherForRemoval = null;

// Test fireworks (fired from the launch modal, run outside show playback)
let testFireworks = [];

/**
 * Initialize the engine
 */
function initEngine() {
    // Get canvas
    canvas = document.getElementById('fireworks-canvas');
    ctx = canvas.getContext('2d');

    // Initialize managers
    launcherManager = new LauncherManager(LOGIC_WIDTH, LOGIC_HEIGHT);
    show = new Show(launcherManager);

    // Size canvas to fill the available space
    fitCanvasToContainer();
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(fitCanvasToContainer).observe(canvas.parentElement);
    } else {
        window.addEventListener('resize', fitCanvasToContainer);
    }

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
 * Fit the canvas to its container, keeping the 8:5 aspect ratio.
 * The buffer is scaled by devicePixelRatio (capped) so fireworks stay crisp.
 */
function fitCanvasToContainer() {
    const container = canvas.parentElement;
    if (!container) return;

    const pad = 24;
    const availW = container.clientWidth - pad;
    const availH = container.clientHeight - pad;
    if (availW <= 0 || availH <= 0) return;

    const scale = Math.min(availW / LOGIC_WIDTH, availH / LOGIC_HEIGHT);
    const cssW = Math.max(320, Math.round(LOGIC_WIDTH * scale));
    const cssH = Math.round(cssW * (LOGIC_HEIGHT / LOGIC_WIDTH));

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    // Cap buffer scale at 2x to bound fill cost on large/high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    renderScale = Math.min(2, (cssW / LOGIC_WIDTH) * dpr);

    const bufferW = Math.round(LOGIC_WIDTH * renderScale);
    if (canvas.width !== bufferW) {
        canvas.width = bufferW;
        canvas.height = Math.round(LOGIC_HEIGHT * renderScale);
    }
}

/**
 * Convert a pointer event to logical canvas coordinates
 */
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (LOGIC_WIDTH / rect.width),
        y: (e.clientY - rect.top) * (LOGIC_HEIGHT / rect.height)
    };
}

/**
 * Set up canvas pointer events for launcher dragging and sky clicks.
 * Pointer events cover both mouse and touch.
 */
function setupCanvasMouseEvents() {
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('pointermove', onCanvasPointerMove);
    canvas.addEventListener('pointerup', onCanvasPointerUp);
    canvas.addEventListener('pointercancel', onCanvasPointerUp);
}

// Pending sky click (waiting to see if it becomes a drag)
let pendingSkyClick = null;

/**
 * Handle pointer down on canvas
 */
function onCanvasPointerDown(e) {
    const pos = getCanvasCoords(e);

    // Check if pressing on a launcher
    const launcher = launcherManager.getLauncherAtPoint(pos.x, pos.y);
    if (launcher) {
        // Save state before moving launcher
        if (typeof saveState === 'function') saveState('Move Launcher');
        launcherManager.startDrag(launcher);
        selectedLauncherForRemoval = launcher;
        canvas.classList.add('dragging');
        canvas.setPointerCapture(e.pointerId);
        markDirty();
        return;
    }

    // Pressing on the sky: remember it, add a launch here on release
    if (pos.y < LOGIC_HEIGHT - 60) {
        pendingSkyClick = { x: pos.x, y: pos.y, clientX: e.clientX, clientY: e.clientY };
    }
}

/**
 * Handle pointer move on canvas
 */
function onCanvasPointerMove(e) {
    const pos = getCanvasCoords(e);

    if (launcherManager.isDragging()) {
        launcherManager.updateDrag(pos.x);
    } else {
        // Update cursor based on hover
        const launcher = launcherManager.getLauncherAtPoint(pos.x, pos.y);
        if (launcher) {
            canvas.classList.add('can-drag');
        } else {
            canvas.classList.remove('can-drag');
        }
    }
}

/**
 * Handle pointer up on canvas
 */
function onCanvasPointerUp(e) {
    if (launcherManager.isDragging()) {
        launcherManager.endDrag();
        canvas.classList.remove('dragging');
        pendingSkyClick = null;
        return;
    }

    // Sky click: open the Add Launch modal prefilled from the click position,
    // as long as the pointer didn't move far (that would be a drag, not a click)
    if (pendingSkyClick) {
        const moved = Math.hypot(e.clientX - pendingSkyClick.clientX, e.clientY - pendingSkyClick.clientY);
        if (moved < 8 && typeof openAddLaunchModalAt === 'function') {
            openAddLaunchModalAt(pendingSkyClick.x, pendingSkyClick.y);
        }
        pendingSkyClick = null;
    }
}

/**
 * Fire a one-off test firework immediately (used by the launch modal).
 * Runs independently of show playback.
 */
function testFireFirework(config) {
    const firework = new Firework(config);
    testFireworks.push(firework);

    if (config.launcherId) {
        launcherManager.triggerLaunch(config.launcherId);
    }
}

/**
 * Set up launcher add/remove buttons
 */
function setupLauncherButtons() {
    const addBtn = document.getElementById('btn-add-launcher');
    const removeBtn = document.getElementById('btn-remove-launcher');
    const distributeBtn = document.getElementById('btn-distribute-launchers');

    if (addBtn) {
        addBtn.addEventListener('click', addNewLauncher);
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', removeSelectedLauncher);
    }

    if (distributeBtn) {
        distributeBtn.addEventListener('click', distributeLaunchers);
    }
}

/**
 * Space all launchers evenly across the canvas
 */
function distributeLaunchers() {
    if (typeof saveState === 'function') saveState('Distribute Launchers');
    launcherManager.distributeEvenly();
    markDirty();
    showToast('Launchers evenly spaced', 'success');
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
            x: Math.random() * LOGIC_WIDTH,
            y: Math.random() * (LOGIC_HEIGHT - 100), // Keep stars above launchers
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

    // Scale all drawing from logical coordinates to the buffer size
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, LOGIC_WIDTH, LOGIC_HEIGHT);

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

    // Update and draw test fireworks (run even while the show is stopped)
    if (testFireworks.length > 0) {
        testFireworks.forEach(fw => fw.update(cappedDt));
        testFireworks = testFireworks.filter(fw => fw.phase !== 'done');
        testFireworks.forEach(fw => fw.draw(ctx));
        if (testFireworks.length === 0 && typeof onTestFireworksDone === 'function') {
            onTestFireworksDone();
        }
    }

    // Update and draw launchers (always, so flash/spark effects animate
    // regardless of playback state)
    launcherManager.update(cappedDt);
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
    const groundGradient = ctx.createLinearGradient(0, LOGIC_HEIGHT - 50, 0, LOGIC_HEIGHT);
    groundGradient.addColorStop(0, 'transparent');
    groundGradient.addColorStop(1, 'rgba(30, 30, 50, 0.8)');

    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, LOGIC_HEIGHT - 50, LOGIC_WIDTH, 50);

    // Horizon line
    ctx.strokeStyle = 'rgba(100, 100, 150, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, LOGIC_HEIGHT - 45);
    ctx.lineTo(LOGIC_WIDTH, LOGIC_HEIGHT - 45);
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
 * Format time in m:ss.t format for event list (tenths shown when nonzero)
 */
function formatTimeDetailed(ms) {
    const tenthsTotal = Math.round(ms / 100);
    const tenths = tenthsTotal % 10;
    const totalSeconds = Math.floor(tenthsTotal / 10);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const base = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    return tenths > 0 ? `${base}.${tenths}` : base;
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
