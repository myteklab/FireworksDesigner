/**
 * UI Module - Controls, modals, and event list management
 */

// Current editing state
let currentEditingEventId = null;
let currentEditingOriginalTime = null;
let selectedLauncherId = 1;

/**
 * Initialize UI event listeners
 */
function initUI() {
    // Toolbar buttons
    document.getElementById('btn-play').addEventListener('click', () => show.play());
    document.getElementById('btn-pause').addEventListener('click', () => show.pause());
    document.getElementById('btn-stop').addEventListener('click', () => show.stop());

    // Schedule buttons
    document.getElementById('btn-add-launch').addEventListener('click', openAddLaunchModal);
    document.getElementById('btn-add-finale').addEventListener('click', addFinale);
    document.getElementById('btn-clear-all').addEventListener('click', clearAllEvents);

    // Playback controls
    document.getElementById('playback-speed').addEventListener('change', (e) => {
        show.setSpeed(parseFloat(e.target.value));
    });

    document.getElementById('loop-checkbox').addEventListener('change', (e) => {
        show.setLoop(e.target.checked);
    });

    // Timeline click to seek
    document.getElementById('timeline-track').addEventListener('click', handleTimelineClick);

    // Playhead dragging
    setupPlayheadDrag();

    // Note: Launcher selection buttons in modal are created dynamically
    // See updateLauncherSelectButtons() in engine.js

    // Initialize finale modal event listeners
    initFinaleModal();

    // Text-firework input visibility follows the type dropdown
    const typeSelect = document.getElementById('firework-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', updateTextRowVisibility);
    }

    // Shell studio (not present on preview pages)
    if (document.getElementById('shell-studio-modal')) {
        initShellStudio();
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Close modals on outside click
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboard(e) {
    // Ctrl+S handled by platform adapter
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return;
    }

    // Space to play/pause
    if (e.key === ' ' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        if (show.isPlaying) {
            show.pause();
        } else {
            show.play();
        }
        return;
    }

    // Arrow keys to nudge the playhead (Shift for bigger steps)
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        const step = (e.shiftKey ? 5000 : 1000) * (e.key === 'ArrowLeft' ? -1 : 1);
        show.seek(show.currentTime + step);
        return;
    }

    // Escape to close modals
    if (e.key === 'Escape') {
        closeLaunchModal();
        closeShareModal();
        closeFinaleModal();
        closeSettingsModal();
        if (document.getElementById('shell-studio-modal')) {
            closeShellStudio();
        }
    }
}

/**
 * Handle timeline click for seeking
 */
function handleTimelineClick(e) {
    // Ignore the click that follows a marker drag
    if (suppressTrackClick) {
        suppressTrackClick = false;
        return;
    }

    const track = document.getElementById('timeline-track');
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * show.duration;

    show.seek(time);
}

/**
 * Setup playhead dragging
 */
function setupPlayheadDrag() {
    const playhead = document.getElementById('playhead');
    const track = document.getElementById('timeline-track');
    let isDragging = false;

    playhead.addEventListener('pointerdown', (e) => {
        isDragging = true;
        e.preventDefault();
        playhead.setPointerCapture(e.pointerId);
    });

    playhead.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const rect = track.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * show.duration;

        show.seek(time);
    });

    const endDrag = () => { isDragging = false; };
    playhead.addEventListener('pointerup', endDrag);
    playhead.addEventListener('pointercancel', endDrag);
}

/**
 * Open add launch modal (time defaults to the current playhead position)
 */
function openAddLaunchModal() {
    currentEditingEventId = null;

    // Update launcher buttons first
    updateLauncherSelectButtons();

    // Reset form. Default the launch time to the playhead position.
    const playheadSeconds = Math.round((show ? show.currentTime : 0) / 1000);
    document.getElementById('launch-modal-title').textContent = 'Add Firework Launch';
    document.getElementById('launch-time-min').value = Math.floor(playheadSeconds / 60);
    document.getElementById('launch-time-sec').value = playheadSeconds % 60;
    updateShellOptions();
    document.getElementById('firework-type').value = 'chrysanthemum';
    document.getElementById('firework-text').value = '';
    updateTextRowVisibility();
    document.getElementById('primary-color').value = '#ff0000';
    document.getElementById('secondary-color').value = '#ffaa00';
    document.getElementById('firework-size').value = 'medium';
    document.getElementById('firework-height').value = 'high';
    document.getElementById('firework-trail').value = 'sparkle';

    // Reset launcher selection to first available
    const container = document.getElementById('launcher-select');
    container.querySelectorAll('.launcher-btn').forEach(b => b.classList.remove('active'));
    const firstBtn = container.querySelector('.launcher-btn');
    if (firstBtn) {
        firstBtn.classList.add('active');
        selectedLauncherId = parseInt(firstBtn.dataset.launcher);
    }

    // Update save button
    document.querySelector('#launch-modal .modal-footer .btn-primary').textContent = 'Add Launch';

    // Show modal
    document.getElementById('launch-modal').style.display = 'flex';
}

/**
 * Open add launch modal prefilled from a click on the canvas sky.
 * Picks the nearest launcher and maps the click height to a burst height.
 */
function openAddLaunchModalAt(x, y) {
    openAddLaunchModal();

    // Nearest launcher to the click
    let nearest = null;
    let nearestDist = Infinity;
    launcherManager.launchers.forEach(l => {
        const dist = Math.abs(l.x - x);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = l;
        }
    });

    if (nearest) {
        const container = document.getElementById('launcher-select');
        container.querySelectorAll('.launcher-btn').forEach(b => b.classList.remove('active'));
        const btn = container.querySelector(`.launcher-btn[data-launcher="${nearest.id}"]`);
        if (btn) {
            btn.classList.add('active');
            selectedLauncherId = nearest.id;
        }
    }

    // Map click height to the closest burst height
    let bestHeight = 'high';
    let bestDist = Infinity;
    Object.keys(HEIGHT_CONFIGS).forEach(h => {
        const dist = Math.abs(HEIGHT_CONFIGS[h].burstY - y);
        if (dist < bestDist) {
            bestDist = dist;
            bestHeight = h;
        }
    });
    document.getElementById('firework-height').value = bestHeight;
}

/**
 * Open edit launch modal
 */
function openEditLaunchModal(eventId) {
    const event = show.events.find(e => e.id === eventId);
    if (!event) return;

    currentEditingEventId = eventId;
    currentEditingOriginalTime = event.time;

    // Update launcher buttons first
    updateLauncherSelectButtons();

    // Populate form with event data
    document.getElementById('launch-modal-title').textContent = 'Edit Firework Launch';

    const totalSeconds = Math.floor(event.time / 1000);
    document.getElementById('launch-time-min').value = Math.floor(totalSeconds / 60);
    document.getElementById('launch-time-sec').value = totalSeconds % 60;

    updateShellOptions();
    const typeSelect = document.getElementById('firework-type');
    if (event.type === 'custom' && event.shellId) {
        typeSelect.value = 'custom:' + event.shellId;
        if (typeSelect.value !== 'custom:' + event.shellId) {
            typeSelect.value = 'chrysanthemum'; // Shell was deleted
        }
    } else {
        typeSelect.value = event.type;
    }
    document.getElementById('firework-text').value = event.text || '';
    updateTextRowVisibility();
    document.getElementById('primary-color').value = event.primaryColor;
    document.getElementById('secondary-color').value = event.secondaryColor;
    document.getElementById('firework-size').value = event.size;
    document.getElementById('firework-height').value = event.height;
    document.getElementById('firework-trail').value = event.trail;

    // Set launcher selection
    const container = document.getElementById('launcher-select');
    container.querySelectorAll('.launcher-btn').forEach(b => b.classList.remove('active'));
    const targetBtn = container.querySelector(`.launcher-btn[data-launcher="${event.launcherId}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
        selectedLauncherId = event.launcherId;
    } else {
        // Launcher was removed, select first available
        const firstBtn = container.querySelector('.launcher-btn');
        if (firstBtn) {
            firstBtn.classList.add('active');
            selectedLauncherId = parseInt(firstBtn.dataset.launcher);
        }
    }

    // Update save button
    document.querySelector('#launch-modal .modal-footer .btn-primary').textContent = 'Save Changes';

    // Show modal
    document.getElementById('launch-modal').style.display = 'flex';
}

/**
 * Close launch modal
 */
function closeLaunchModal() {
    const modal = document.getElementById('launch-modal');
    modal.style.display = 'none';
    modal.classList.remove('peek');
    currentEditingEventId = null;
    currentEditingOriginalTime = null;
}

/**
 * Save launch event from modal
 */
function saveLaunchEvent() {
    const minutes = parseInt(document.getElementById('launch-time-min').value) || 0;
    const seconds = parseInt(document.getElementById('launch-time-sec').value) || 0;
    let time = parseTime(minutes, seconds);

    // If editing and the time inputs weren't changed, keep the exact original
    // time so sub-second precision (from marker drags or finales) survives
    if (currentEditingEventId && currentEditingOriginalTime !== null &&
        Math.floor(currentEditingOriginalTime / 1000) === minutes * 60 + seconds) {
        time = currentEditingOriginalTime;
    }

    // Resolve type: plain type name, 'text', or 'custom:{shellId}'
    const rawType = document.getElementById('firework-type').value;
    let type = rawType;
    let shellId = null;
    let text = null;
    if (rawType.startsWith('custom:')) {
        type = 'custom';
        shellId = rawType.slice(7);
    } else if (rawType === 'text') {
        text = document.getElementById('firework-text').value.trim();
        if (!isValidFireworkText(text)) {
            showToast('Enter 1-14 letters or numbers for your text firework', 'error');
            return;
        }
    }

    const eventData = {
        time: time,
        launcherId: selectedLauncherId,
        type: type,
        text: text,
        shellId: shellId,
        primaryColor: document.getElementById('primary-color').value,
        secondaryColor: document.getElementById('secondary-color').value,
        size: document.getElementById('firework-size').value,
        height: document.getElementById('firework-height').value,
        trail: document.getElementById('firework-trail').value
    };

    if (currentEditingEventId) {
        // Save state before update
        if (typeof saveState === 'function') saveState('Edit Launch');
        // Update existing event
        show.updateEvent(currentEditingEventId, eventData);
        showToast('Firework updated!', 'success');
    } else {
        // Save state before add
        if (typeof saveState === 'function') saveState('Add Launch');
        // Add new event
        show.addEvent(eventData);
        showToast('Firework added!', 'success');
    }

    closeLaunchModal();
    refreshEventList();
    markDirty();
}

/**
 * Test fire the firework currently configured in the launch modal.
 * The modal fades out while the firework flies so you can watch it.
 */
function testFireLaunch() {
    const launcher = launcherManager.getLauncherById(selectedLauncherId) || launcherManager.launchers[0];
    if (!launcher) return;

    const launchPos = launcher.getLaunchPosition();

    // Resolve type the same way saveLaunchEvent does
    const rawType = document.getElementById('firework-type').value;
    let type = rawType;
    let shellId = null;
    let text = null;
    if (rawType.startsWith('custom:')) {
        type = 'custom';
        shellId = rawType.slice(7);
    } else if (rawType === 'text') {
        text = document.getElementById('firework-text').value.trim();
        if (!isValidFireworkText(text)) {
            showToast('Enter 1-14 letters or numbers first', 'error');
            return;
        }
    }

    testFireFirework({
        launchX: launchPos.x,
        launchY: launchPos.y,
        launcherId: launcher.id,
        type: type,
        text: text,
        shellId: shellId,
        primaryColor: document.getElementById('primary-color').value,
        secondaryColor: document.getElementById('secondary-color').value,
        size: document.getElementById('firework-size').value,
        height: document.getElementById('firework-height').value,
        trail: document.getElementById('firework-trail').value
    });

    // Fade the modal so the firework is visible behind it
    document.getElementById('launch-modal').classList.add('peek');
}

/**
 * Show the text input row only when the Text type is selected
 */
function updateTextRowVisibility() {
    const row = document.getElementById('text-firework-row');
    if (row) {
        row.style.display = document.getElementById('firework-type').value === 'text' ? '' : 'none';
    }
}

/**
 * Rebuild the "My Shells" optgroup in the type dropdown
 */
function updateShellOptions() {
    const group = document.getElementById('my-shells-optgroup');
    if (!group) return;

    group.innerHTML = '';
    customShells.forEach(shell => {
        const opt = document.createElement('option');
        opt.value = 'custom:' + shell.id;
        opt.textContent = shell.name + ' - your design';
        group.appendChild(opt);
    });
    group.style.display = customShells.length > 0 ? '' : 'none';
}

/**
 * Display name for an event's firework type
 */
function eventTypeName(event) {
    if (event.type === 'text') {
        return '"' + (event.text || '?') + '"';
    }
    if (event.type === 'custom') {
        const shell = typeof getShellById === 'function' ? getShellById(event.shellId) : null;
        return shell ? shell.name : 'Custom Shell';
    }
    const typeConfig = FIREWORK_TYPES[event.type];
    return typeConfig ? typeConfig.name : event.type;
}

/**
 * Called by the engine when all test fireworks have finished
 */
function onTestFireworksDone() {
    document.getElementById('launch-modal').classList.remove('peek');
    const studio = document.getElementById('shell-studio-modal');
    if (studio) studio.classList.remove('peek');
}

// ============================================
// SHELL STUDIO (design your own firework)
// ============================================

const SHELL_GRID = 24;
const SHELL_CELL = 12; // Canvas pixels per cell
let shellGrid = new Set(); // Painted cell indices (row * SHELL_GRID + col)
let shellEditingId = null; // Shell being edited, or null for a new one
let shellEraseMode = false;
let shellPainting = false;

function openShellStudio() {
    shellGrid = new Set();
    shellEditingId = null;
    shellEraseMode = false;
    document.getElementById('shell-name').value = '';
    document.getElementById('shell-studio-list').value = '';
    updateShellEraseButton();
    refreshShellStudioList();
    drawShellGrid();
    document.getElementById('shell-studio-modal').style.display = 'flex';
}

function closeShellStudio() {
    const modal = document.getElementById('shell-studio-modal');
    modal.style.display = 'none';
    modal.classList.remove('peek');
}

/**
 * Populate the existing-shells dropdown in the studio
 */
function refreshShellStudioList() {
    const select = document.getElementById('shell-studio-list');
    const current = shellEditingId || '';
    select.innerHTML = '<option value="">New shell...</option>';
    customShells.forEach(shell => {
        const opt = document.createElement('option');
        opt.value = shell.id;
        opt.textContent = shell.name;
        select.appendChild(opt);
    });
    select.value = current;
}

/**
 * Load an existing shell into the grid for editing
 */
function loadShellIntoStudio(shellId) {
    shellGrid = new Set();
    shellEditingId = null;
    document.getElementById('shell-name').value = '';

    const shell = getShellById(shellId);
    if (shell) {
        shellEditingId = shell.id;
        document.getElementById('shell-name').value = shell.name;
        const half = (SHELL_GRID - 1) / 2;
        shell.points.forEach(p => {
            const col = Math.round(p.x * half + half);
            const row = Math.round(p.y * half + half);
            if (col >= 0 && col < SHELL_GRID && row >= 0 && row < SHELL_GRID) {
                shellGrid.add(row * SHELL_GRID + col);
            }
        });
    }
    drawShellGrid();
}

/**
 * Render the studio grid canvas
 */
function drawShellGrid() {
    const c = document.getElementById('shell-grid-canvas');
    if (!c) return;
    const cx = c.getContext('2d');

    cx.fillStyle = '#0a0a1a';
    cx.fillRect(0, 0, c.width, c.height);

    // Grid dots
    cx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let row = 0; row < SHELL_GRID; row++) {
        for (let col = 0; col < SHELL_GRID; col++) {
            cx.beginPath();
            cx.arc(col * SHELL_CELL + SHELL_CELL / 2, row * SHELL_CELL + SHELL_CELL / 2, 1, 0, Math.PI * 2);
            cx.fill();
        }
    }

    // Center crosshair
    cx.strokeStyle = 'rgba(155, 89, 182, 0.25)';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(c.width / 2, 0);
    cx.lineTo(c.width / 2, c.height);
    cx.moveTo(0, c.height / 2);
    cx.lineTo(c.width, c.height / 2);
    cx.stroke();

    // Painted cells
    cx.fillStyle = '#ffd700';
    cx.shadowColor = '#ffaa00';
    cx.shadowBlur = 5;
    shellGrid.forEach(index => {
        const row = Math.floor(index / SHELL_GRID);
        const col = index % SHELL_GRID;
        cx.beginPath();
        cx.arc(col * SHELL_CELL + SHELL_CELL / 2, row * SHELL_CELL + SHELL_CELL / 2, 3.5, 0, Math.PI * 2);
        cx.fill();
    });
    cx.shadowBlur = 0;

    // Point count
    const count = document.getElementById('shell-point-count');
    if (count) count.textContent = shellGrid.size + ' points';
}

function shellCellFromEvent(e) {
    const c = document.getElementById('shell-grid-canvas');
    const rect = c.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) * (c.width / rect.width) / SHELL_CELL);
    const row = Math.floor((e.clientY - rect.top) * (c.height / rect.height) / SHELL_CELL);
    if (col < 0 || col >= SHELL_GRID || row < 0 || row >= SHELL_GRID) return null;
    return row * SHELL_GRID + col;
}

function paintShellCell(e) {
    const cell = shellCellFromEvent(e);
    if (cell === null) return;
    if (shellEraseMode) {
        shellGrid.delete(cell);
    } else {
        shellGrid.add(cell);
    }
    drawShellGrid();
}

function updateShellEraseButton() {
    const btn = document.getElementById('btn-shell-erase');
    if (btn) {
        btn.classList.toggle('active', shellEraseMode);
        btn.textContent = shellEraseMode ? 'Erasing...' : 'Eraser';
    }
}

/**
 * Convert painted cells to normalized shell points
 */
function shellGridPoints() {
    const half = (SHELL_GRID - 1) / 2;
    const points = [];
    shellGrid.forEach(index => {
        const row = Math.floor(index / SHELL_GRID);
        const col = index % SHELL_GRID;
        points.push({
            x: (col - half) / half,
            y: (row - half) / half
        });
    });
    return points;
}

/**
 * Save the studio grid as a shell (updates the loaded shell, or creates new)
 */
function saveShellFromStudio() {
    if (shellGrid.size < 5) {
        showToast('Paint at least 5 points first', 'error');
        return;
    }

    let name = document.getElementById('shell-name').value.trim().slice(0, 20);
    if (!name) {
        name = 'My Shell ' + (customShells.length + 1);
    }

    const points = shellGridPoints();
    if (shellEditingId && getShellById(shellEditingId)) {
        const shell = getShellById(shellEditingId);
        shell.name = name;
        shell.points = points;
        showToast(`Shell "${name}" updated!`, 'success');
    } else {
        const shell = addCustomShell(name, points);
        shellEditingId = shell.id;
        showToast(`Shell "${name}" saved! Find it under Firework Type.`, 'success');
    }

    refreshShellStudioList();
    updateShellOptions();
    markDirty();
}

/**
 * Delete the shell loaded in the studio
 */
function deleteShellFromStudio() {
    if (!shellEditingId || !getShellById(shellEditingId)) {
        showToast('Load a saved shell first', 'info');
        return;
    }

    const used = show.events.filter(e => e.shellId === shellEditingId).length;
    if (used > 0) {
        showToast(`This shell is used by ${used} launch${used > 1 ? 'es' : ''}. Remove those first.`, 'error');
        return;
    }

    const shell = getShellById(shellEditingId);
    if (confirm(`Delete shell "${shell.name}"?`)) {
        removeCustomShell(shellEditingId);
        shellEditingId = null;
        shellGrid = new Set();
        document.getElementById('shell-name').value = '';
        refreshShellStudioList();
        updateShellOptions();
        drawShellGrid();
        markDirty();
        showToast('Shell deleted', 'info');
    }
}

/**
 * Test fire the design currently painted in the studio
 */
function testFireShellStudio() {
    if (shellGrid.size < 5) {
        showToast('Paint at least 5 points first', 'error');
        return;
    }

    const launcher = launcherManager.launchers[Math.floor(launcherManager.launchers.length / 2)];
    if (!launcher) return;
    const pos = launcher.getLaunchPosition();

    testFireFirework({
        launchX: pos.x,
        launchY: pos.y,
        launcherId: launcher.id,
        type: 'custom',
        shellPoints: shellGridPoints(),
        primaryColor: '#ffd700',
        secondaryColor: '#ffffff',
        size: 'medium',
        height: 'high',
        trail: 'sparkle'
    });

    document.getElementById('shell-studio-modal').classList.add('peek');
}

/**
 * Wire up shell studio events (only when its modal exists on the page)
 */
function initShellStudio() {
    const grid = document.getElementById('shell-grid-canvas');

    grid.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        shellPainting = true;
        grid.setPointerCapture(e.pointerId);
        paintShellCell(e);
    });
    grid.addEventListener('pointermove', (e) => {
        if (shellPainting) paintShellCell(e);
    });
    const stop = () => { shellPainting = false; };
    grid.addEventListener('pointerup', stop);
    grid.addEventListener('pointercancel', stop);

    document.getElementById('btn-shell-erase').addEventListener('click', () => {
        shellEraseMode = !shellEraseMode;
        updateShellEraseButton();
    });
    document.getElementById('btn-shell-clear').addEventListener('click', () => {
        shellGrid = new Set();
        drawShellGrid();
    });
    document.getElementById('shell-studio-list').addEventListener('change', (e) => {
        loadShellIntoStudio(e.target.value);
    });
}

/**
 * Duplicate a single launch event (1 second later, same design)
 */
function duplicateEvent(eventId) {
    const event = show.events.find(e => e.id === eventId);
    if (!event) return;

    if (typeof saveState === 'function') saveState('Duplicate Launch');

    const newEvent = show.addEvent({
        time: event.time + 1000,
        launcherId: event.launcherId,
        type: event.type,
        text: event.text || null,
        shellId: event.shellId || null,
        primaryColor: event.primaryColor,
        secondaryColor: event.secondaryColor,
        size: event.size,
        height: event.height,
        trail: event.trail
    });

    if (typeof selectEvent === 'function') {
        selectEvent(newEvent.id, false);
    }

    refreshEventList();
    markDirty();
    showToast('Firework duplicated (+1s)', 'success');
}

/**
 * Delete a launch event
 */
function deleteEvent(eventId) {
    if (confirm('Delete this firework launch?')) {
        // Save state before delete
        if (typeof saveState === 'function') saveState('Delete Launch');
        show.removeEvent(eventId);
        // Clear selection for this event
        if (typeof selectedEventIds !== 'undefined') {
            selectedEventIds.delete(eventId);
        }
        refreshEventList();
        markDirty();
        showToast('Firework deleted', 'info');
    }
}

/**
 * Open finale settings modal
 */
function addFinale() {
    // Reset form to defaults
    document.getElementById('finale-duration').value = '10000';
    document.getElementById('finale-count').value = '30';
    document.querySelector('input[name="finale-intensity"][value="gradual"]').checked = true;
    document.querySelector('input[name="finale-pattern"][value="sweep"]').checked = true;
    document.querySelector('input[name="finale-theme"][value="random"]').checked = true;
    document.getElementById('finale-grand-ending').checked = true;
    document.getElementById('custom-colors-section').style.display = 'none';

    // Default start time: 2s after the last scheduled event
    const defaultStart = show.events.length > 0
        ? Math.max(...show.events.map(e => e.time)) + 2000
        : 5000;
    const startSeconds = Math.round(defaultStart / 1000);
    document.getElementById('finale-start-min').value = Math.floor(startSeconds / 60);
    document.getElementById('finale-start-sec').value = startSeconds % 60;

    // Reset type checkboxes to all checked
    document.querySelectorAll('.type-checkbox-grid input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });

    // Show modal
    document.getElementById('finale-modal').style.display = 'flex';
}

/**
 * Close finale modal
 */
function closeFinaleModal() {
    document.getElementById('finale-modal').style.display = 'none';
}

/**
 * Generate finale with selected options
 */
function generateFinale() {
    // Gather options from modal
    const duration = parseInt(document.getElementById('finale-duration').value);
    const count = parseInt(document.getElementById('finale-count').value);
    const intensity = document.querySelector('input[name="finale-intensity"]:checked').value;
    const pattern = document.querySelector('input[name="finale-pattern"]:checked').value;
    const grandEnding = document.getElementById('finale-grand-ending').checked;
    const theme = document.querySelector('input[name="finale-theme"]:checked').value;

    // Start time from the modal inputs
    const startMin = parseInt(document.getElementById('finale-start-min').value) || 0;
    const startSec = parseInt(document.getElementById('finale-start-sec').value) || 0;
    const startTime = parseTime(startMin, startSec);

    // Get custom colors if theme is custom
    let customColors = [];
    if (theme === 'custom') {
        customColors = [
            document.getElementById('custom-color-1').value,
            document.getElementById('custom-color-2').value,
            document.getElementById('custom-color-3').value,
            document.getElementById('custom-color-4').value
        ];
    }

    // Get selected firework types
    const selectedTypes = [];
    document.querySelectorAll('.type-checkbox-grid input[type="checkbox"]:checked').forEach(cb => {
        selectedTypes.push(cb.value);
    });

    // Validate at least one type selected
    if (selectedTypes.length === 0) {
        showToast('Please select at least one firework type', 'error');
        return;
    }

    // Save state before finale
    if (typeof saveState === 'function') saveState('Add Finale');

    // Generate finale
    const result = show.addFinaleWithOptions({
        startTime: startTime,
        duration: duration,
        count: count,
        intensity: intensity,
        pattern: pattern,
        grandEnding: grandEnding,
        theme: theme,
        customColors: customColors,
        types: selectedTypes
    });

    // Close modal and update UI
    closeFinaleModal();
    refreshEventList();
    markDirty();
    showToast(`Finale added! ${result.count} fireworks scheduled.`, 'success');

    // Jump just before the finale and play it so you see it right away
    show.seek(Math.max(0, result.startTime - 1000));
    show.play();
}

/**
 * Delete an entire event group (finale)
 */
function deleteGroup(groupId) {
    const members = show.events.filter(e => e.group === groupId);
    if (members.length === 0) return;

    if (confirm(`Delete this finale (${members.length} fireworks)?`)) {
        if (typeof saveState === 'function') saveState('Delete Finale');
        members.forEach(e => {
            show.removeEvent(e.id);
            if (typeof selectedEventIds !== 'undefined') {
                selectedEventIds.delete(e.id);
            }
        });
        expandedGroups.delete(groupId);
        refreshEventList();
        markDirty();
        showToast('Finale deleted', 'info');
    }
}

/**
 * Toggle all firework type checkboxes
 */
function toggleAllTypes(checked) {
    document.querySelectorAll('.type-checkbox-grid input[type="checkbox"]').forEach(cb => {
        cb.checked = checked;
    });
}

/**
 * Initialize finale modal event listeners
 */
function initFinaleModal() {
    // Toggle custom colors section when custom theme selected
    document.querySelectorAll('input[name="finale-theme"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const customSection = document.getElementById('custom-colors-section');
            if (this.value === 'custom') {
                customSection.style.display = 'block';
            } else {
                customSection.style.display = 'none';
            }
        });
    });
}

/**
 * Clear all events
 */
function clearAllEvents() {
    if (show.events.length === 0) {
        showToast('No events to clear', 'info');
        return;
    }

    if (confirm('Clear all firework launches?')) {
        // Save state before clear
        if (typeof saveState === 'function') saveState('Clear All');
        show.clearEvents();
        // Clear selection
        if (typeof clearSelection === 'function') clearSelection();
        refreshEventList();
        markDirty();
        showToast('All events cleared', 'info');
    }
}

// Groups the user has expanded in the schedule list (collapsed by default)
const expandedGroups = new Set();

/**
 * Render a single event row
 */
function renderEventRow(event, inGroup) {
    const timeStr = formatTimeDetailed(event.time);
    const typeName = eventTypeName(event);
    const isSelected = typeof isEventSelected === 'function' && isEventSelected(event.id);

    return `
        <div class="event-item${isSelected ? ' selected' : ''}${inGroup ? ' in-group' : ''}" data-event-id="${event.id}" title="${typeName} &middot; ${event.size} &middot; ${event.height} &middot; launcher ${event.launcherId}">
            <span class="event-time">${timeStr}</span>
            <span class="event-launcher">${event.launcherId}</span>
            <span class="event-color" style="background: linear-gradient(135deg, ${event.primaryColor} 50%, ${event.secondaryColor} 50%)"></span>
            <span class="event-type">${typeName}</span>
            <span class="event-size">(${event.size})</span>
            <div class="event-actions">
                <button class="event-action-btn" onclick="event.stopPropagation(); duplicateEvent('${event.id}')" title="Duplicate (+1s)">&#10697;</button>
                <button class="event-action-btn" onclick="event.stopPropagation(); openEditLaunchModal('${event.id}')" title="Edit">&#9998;</button>
                <button class="event-action-btn delete" onclick="event.stopPropagation(); deleteEvent('${event.id}')" title="Delete">&#128465;</button>
            </div>
        </div>
    `;
}

/**
 * Refresh the event list UI
 */
function refreshEventList() {
    const eventList = document.getElementById('event-list');
    const events = show.getEventList();

    if (events.length === 0) {
        eventList.innerHTML = `
            <div class="empty-state">
                <p>No fireworks scheduled yet!</p>
                <p class="hint">Click the sky or "Add Launch" to schedule your first firework.</p>
            </div>
        `;
        // Still refresh the timeline so stale markers are removed
        updateTimelineMarkers();
        return;
    }

    // Collect grouped events (finales); the group renders as one collapsible row
    // positioned where its first event occurs
    const groups = {};
    const sequence = [];
    events.forEach(event => {
        if (event.group) {
            if (!groups[event.group]) {
                groups[event.group] = { label: event.groupLabel || 'Group', events: [] };
                sequence.push({ kind: 'group', groupId: event.group });
            }
            groups[event.group].events.push(event);
        } else {
            sequence.push({ kind: 'event', event: event });
        }
    });

    let html = '';
    sequence.forEach(item => {
        if (item.kind === 'event') {
            html += renderEventRow(item.event, false);
            return;
        }

        const group = groups[item.groupId];
        const first = group.events[0];
        const last = group.events[group.events.length - 1];
        const expanded = expandedGroups.has(item.groupId);

        html += `
            <div class="event-group-header" data-group-id="${item.groupId}" title="${group.events.length} fireworks from ${formatTimeDetailed(first.time)} to ${formatTimeDetailed(last.time)} &middot; click to ${expanded ? 'collapse' : 'expand'}">
                <span class="group-chevron">${expanded ? '&#9662;' : '&#9656;'}</span>
                <span class="event-time">${formatTimeDetailed(first.time)}</span>
                <span class="group-label">&#127878; ${group.label}</span>
                <span class="group-count">${group.events.length} &middot; to ${formatTimeDetailed(last.time)}</span>
                <div class="event-actions">
                    <button class="event-action-btn delete" onclick="event.stopPropagation(); deleteGroup('${item.groupId}')" title="Delete entire finale">&#128465;</button>
                </div>
            </div>
        `;

        if (expanded) {
            group.events.forEach(event => {
                html += renderEventRow(event, true);
            });
        }
    });

    eventList.innerHTML = html;

    // Group header click toggles expand/collapse
    eventList.querySelectorAll('.event-group-header').forEach(header => {
        header.addEventListener('click', function (e) {
            if (e.target.closest('.event-actions')) return;
            const groupId = this.dataset.groupId;
            if (expandedGroups.has(groupId)) {
                expandedGroups.delete(groupId);
            } else {
                expandedGroups.add(groupId);
            }
            refreshEventList();
        });
    });

    // Add click handlers for selection
    eventList.querySelectorAll('.event-item').forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't handle if clicking on action buttons
            if (e.target.closest('.event-actions')) return;

            const eventId = this.dataset.eventId;

            if (e.shiftKey && typeof selectRange === 'function') {
                // Shift+Click: Range selection
                selectRange(eventId);
            } else if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+Click: Toggle selection
                if (typeof selectEvent === 'function') {
                    selectEvent(eventId, true);
                }
            } else {
                // Normal click: Single selection
                if (typeof selectEvent === 'function') {
                    selectEvent(eventId, false);
                }
            }
        });

        // Double-click to edit
        item.addEventListener('dblclick', function(e) {
            if (e.target.closest('.event-actions')) return;
            const eventId = this.dataset.eventId;
            openEditLaunchModal(eventId);
        });
    });

    // Update timeline markers
    updateTimelineMarkers();
}

/**
 * Update timeline event markers
 */
function updateTimelineMarkers() {
    const track = document.getElementById('timeline-track');

    // Remove existing markers
    track.querySelectorAll('.event-marker').forEach(m => m.remove());

    // Add new markers
    show.events.forEach(event => {
        const percentage = (event.time / show.duration) * 100;
        const marker = document.createElement('div');
        marker.className = 'event-marker';
        marker.style.left = percentage + '%';
        marker.style.backgroundColor = event.primaryColor;
        marker.title = `${formatTimeDetailed(event.time)} - ${eventTypeName(event)} (drag to move)`;
        marker.dataset.eventId = event.id;
        marker.addEventListener('pointerdown', onMarkerPointerDown);
        track.appendChild(marker);
    });

    // Update timeline ruler
    updateTimelineRuler();
}

// Marker drag state
let markerDrag = null;
let suppressTrackClick = false;

/**
 * Start dragging a timeline event marker to retime it
 */
function onMarkerPointerDown(e) {
    const marker = e.currentTarget;
    const event = show.events.find(ev => ev.id === marker.dataset.eventId);
    if (!event) return;

    e.preventDefault();
    marker.setPointerCapture(e.pointerId);

    markerDrag = {
        marker: marker,
        eventId: event.id,
        startClientX: e.clientX,
        startTime: event.time,
        newTime: event.time,
        moved: false
    };

    marker.addEventListener('pointermove', onMarkerPointerMove);
    marker.addEventListener('pointerup', onMarkerPointerUp);
    marker.addEventListener('pointercancel', onMarkerPointerUp);
}

function onMarkerPointerMove(e) {
    if (!markerDrag) return;

    const track = document.getElementById('timeline-track');
    const rect = track.getBoundingClientRect();
    const deltaMs = ((e.clientX - markerDrag.startClientX) / rect.width) * show.duration;

    if (Math.abs(e.clientX - markerDrag.startClientX) > 3) {
        markerDrag.moved = true;
    }

    // Snap to tenths of a second
    markerDrag.newTime = Math.round(Math.max(0, Math.min(markerDrag.startTime + deltaMs, show.duration)) / 100) * 100;
    markerDrag.marker.style.left = ((markerDrag.newTime / show.duration) * 100) + '%';
    markerDrag.marker.title = formatTimeDetailed(markerDrag.newTime);
}

function onMarkerPointerUp(e) {
    if (!markerDrag) return;

    const drag = markerDrag;
    markerDrag = null;

    drag.marker.removeEventListener('pointermove', onMarkerPointerMove);
    drag.marker.removeEventListener('pointerup', onMarkerPointerUp);
    drag.marker.removeEventListener('pointercancel', onMarkerPointerUp);

    if (drag.moved && drag.newTime !== drag.startTime) {
        // Swallow the click the track would otherwise receive after this drag
        suppressTrackClick = true;

        if (typeof saveState === 'function') saveState('Move Launch');
        show.updateEvent(drag.eventId, { time: drag.newTime });
        refreshEventList();
        markDirty();
        showToast('Moved to ' + formatTimeDetailed(drag.newTime), 'success');
    }
}

/**
 * Update timeline ruler marks
 */
function updateTimelineRuler() {
    const ruler = document.querySelector('.timeline-ruler');
    const duration = show.duration;

    // Calculate appropriate interval
    let interval = 5000; // 5 seconds default
    if (duration > 60000) interval = 10000;
    if (duration > 120000) interval = 30000;
    if (duration > 300000) interval = 60000;

    // Marks are positioned at their true percentage along the track
    let html = '';
    let lastTime = 0;
    for (let time = 0; time <= duration; time += interval) {
        const pct = (time / duration) * 100;
        const shift = pct > 96 ? ';transform:translateX(-100%)' : '';
        html += `<span class="time-mark" style="left:${pct.toFixed(2)}%${shift}">${formatTimeDetailed(time)}</span>`;
        lastTime = time;
    }

    // Label the end of the show if it isn't already marked nearby
    if ((duration - lastTime) / duration > 0.07) {
        html += `<span class="time-mark" style="left:100%;transform:translateX(-100%)">${formatTimeDetailed(duration)}</span>`;
    }

    ruler.innerHTML = html;
}

/**
 * Show share modal
 */
function openShareModal(shareUrl) {
    document.getElementById('share-url').textContent = shareUrl;
    document.getElementById('share-modal').style.display = 'flex';
}

/**
 * Close share modal
 */
function closeShareModal() {
    document.getElementById('share-modal').style.display = 'none';
}

/**
 * Open settings modal
 */
function openSettingsModal() {
    document.getElementById('settings-modal').style.display = 'flex';
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

/**
 * Copy share link to clipboard
 */
function copyShareLink() {
    const shareUrl = document.getElementById('share-url').textContent;
    navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Link copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Failed to copy link', 'error');
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remove after delay
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', initUI);
