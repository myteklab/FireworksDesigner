/**
 * FireworksDesigner History Manager
 * Handles undo/redo, event selection, and copy/paste
 */

// Undo/Redo state
let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;
let isUndoRedoAction = false;

// Selection state
let selectedEventIds = new Set();
let lastSelectedEventId = null; // For shift-click range selection

// Copy/Paste buffer
let copiedEvents = [];

/**
 * Deep clone the current state for undo/redo
 */
function deepCloneState() {
    return {
        timestamp: Date.now(),
        events: show.events.map(e => ({
            id: e.id,
            time: e.time,
            launcherId: e.launcherId,
            type: e.type,
            primaryColor: e.primaryColor,
            secondaryColor: e.secondaryColor,
            size: e.size,
            height: e.height,
            trail: e.trail
        })),
        launchers: launcherManager.launchers.map(l => ({
            id: l.id,
            x: l.x,
            enabled: l.enabled
        })),
        duration: show.duration
    };
}

/**
 * Save current state to undo stack before making changes
 * @param {string} actionName - Description of the action for UI feedback
 */
function saveState(actionName) {
    // Don't save state during undo/redo operations
    if (isUndoRedoAction) return;

    const state = deepCloneState();
    state.actionName = actionName;

    undoStack.push(state);

    // Limit stack size
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }

    // Clear redo stack when new action is performed
    redoStack = [];

    // Update UI
    updateUndoRedoButtons();
}

/**
 * Restore state from a snapshot
 */
function restoreState(state) {
    // Restore events
    show.events = state.events.map(e => ({
        ...e,
        triggered: false
    }));

    // Restore launchers
    state.launchers.forEach((savedLauncher, index) => {
        if (launcherManager.launchers[index]) {
            launcherManager.launchers[index].x = savedLauncher.x;
            launcherManager.launchers[index].enabled = savedLauncher.enabled;
        }
    });

    // Adjust launcher count if needed
    while (launcherManager.launchers.length > state.launchers.length) {
        launcherManager.launchers.pop();
    }
    while (launcherManager.launchers.length < state.launchers.length) {
        const savedLauncher = state.launchers[launcherManager.launchers.length];
        launcherManager.addLauncher();
        const newLauncher = launcherManager.launchers[launcherManager.launchers.length - 1];
        newLauncher.x = savedLauncher.x;
        newLauncher.enabled = savedLauncher.enabled;
    }

    // Restore duration
    show.duration = state.duration;

    // Clear selection
    clearSelection();

    // Refresh UI
    refreshEventList();
    updateLauncherCount();
    updateLauncherSelectButtons();
    updateTimeDisplay(show.currentTime, show.duration);
}

/**
 * Undo the last action
 */
function undo() {
    if (!canUndo()) return;

    isUndoRedoAction = true;

    // Save current state to redo stack
    const currentState = deepCloneState();
    currentState.actionName = undoStack[undoStack.length - 1]?.actionName || 'Action';
    redoStack.push(currentState);

    // Pop and restore previous state
    const previousState = undoStack.pop();
    restoreState(previousState);

    // Show feedback
    showToast(`Undo: ${previousState.actionName}`, 'info');

    isUndoRedoAction = false;
    updateUndoRedoButtons();
    markDirty();
}

/**
 * Redo the last undone action
 */
function redo() {
    if (!canRedo()) return;

    isUndoRedoAction = true;

    // Save current state to undo stack
    const currentState = deepCloneState();
    currentState.actionName = redoStack[redoStack.length - 1]?.actionName || 'Action';
    undoStack.push(currentState);

    // Pop and restore redo state
    const redoState = redoStack.pop();
    restoreState(redoState);

    // Show feedback
    showToast(`Redo: ${redoState.actionName}`, 'info');

    isUndoRedoAction = false;
    updateUndoRedoButtons();
    markDirty();
}

/**
 * Check if undo is available
 */
function canUndo() {
    return undoStack.length > 0;
}

/**
 * Check if redo is available
 */
function canRedo() {
    return redoStack.length > 0;
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) {
        undoBtn.disabled = !canUndo();
        undoBtn.title = canUndo()
            ? `Undo: ${undoStack[undoStack.length - 1]?.actionName} (Ctrl+Z)`
            : 'Nothing to undo (Ctrl+Z)';
    }

    if (redoBtn) {
        redoBtn.disabled = !canRedo();
        redoBtn.title = canRedo()
            ? `Redo: ${redoStack[redoStack.length - 1]?.actionName} (Ctrl+Y)`
            : 'Nothing to redo (Ctrl+Y)';
    }
}

// ============================================
// SELECTION FUNCTIONS
// ============================================

/**
 * Select a single event (clears other selections unless addToSelection is true)
 * @param {string} eventId - Event ID to select
 * @param {boolean} addToSelection - If true, toggle selection without clearing others
 */
function selectEvent(eventId, addToSelection = false) {
    if (addToSelection) {
        // Toggle selection (Ctrl+Click behavior)
        if (selectedEventIds.has(eventId)) {
            selectedEventIds.delete(eventId);
        } else {
            selectedEventIds.add(eventId);
        }
    } else {
        // Single selection (clear others)
        selectedEventIds.clear();
        selectedEventIds.add(eventId);
    }

    lastSelectedEventId = eventId;
    updateEventListSelection();
}

/**
 * Select a range of events (Shift+Click behavior)
 * @param {string} toEventId - End of range
 */
function selectRange(toEventId) {
    if (!lastSelectedEventId) {
        selectEvent(toEventId);
        return;
    }

    const events = show.getEventList();
    const fromIndex = events.findIndex(e => e.id === lastSelectedEventId);
    const toIndex = events.findIndex(e => e.id === toEventId);

    if (fromIndex === -1 || toIndex === -1) {
        selectEvent(toEventId);
        return;
    }

    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    // Add all events in range to selection
    for (let i = startIndex; i <= endIndex; i++) {
        selectedEventIds.add(events[i].id);
    }

    updateEventListSelection();
}

/**
 * Select all events
 */
function selectAllEvents() {
    const events = show.getEventList();
    events.forEach(e => selectedEventIds.add(e.id));
    updateEventListSelection();

    if (events.length > 0) {
        showToast(`Selected ${events.length} event${events.length > 1 ? 's' : ''}`, 'info');
    }
}

/**
 * Clear all selections
 */
function clearSelection() {
    selectedEventIds.clear();
    lastSelectedEventId = null;
    updateEventListSelection();
}

/**
 * Get array of selected event objects
 */
function getSelectedEvents() {
    return show.events.filter(e => selectedEventIds.has(e.id));
}

/**
 * Check if an event is selected
 */
function isEventSelected(eventId) {
    return selectedEventIds.has(eventId);
}

/**
 * Update visual selection state in event list
 */
function updateEventListSelection() {
    const eventItems = document.querySelectorAll('.event-item');
    eventItems.forEach(item => {
        const eventId = item.dataset.eventId;
        if (selectedEventIds.has(eventId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// ============================================
// COPY/PASTE FUNCTIONS
// ============================================

/**
 * Copy selected events to clipboard buffer
 */
function copySelectedEvents() {
    const selected = getSelectedEvents();

    if (selected.length === 0) {
        showToast('No events selected to copy', 'error');
        return;
    }

    // Deep clone selected events (without IDs - will be regenerated on paste)
    copiedEvents = selected.map(e => ({
        time: e.time,
        launcherId: e.launcherId,
        type: e.type,
        primaryColor: e.primaryColor,
        secondaryColor: e.secondaryColor,
        size: e.size,
        height: e.height,
        trail: e.trail
    }));

    showToast(`Copied ${copiedEvents.length} event${copiedEvents.length > 1 ? 's' : ''} (Ctrl+V to paste)`, 'success');
}

/**
 * Paste events from clipboard buffer
 */
function pasteEvents() {
    if (copiedEvents.length === 0) {
        showToast('Nothing to paste - copy events first (Ctrl+C)', 'error');
        return;
    }

    // Save state before paste
    saveState('Paste Events');

    // Find the latest time among copied events to calculate offset
    const maxCopiedTime = Math.max(...copiedEvents.map(e => e.time));
    const timeOffset = 1000; // Offset pasted events by 1 second

    // Clear current selection
    clearSelection();

    // Paste each event with new ID and offset time
    const pastedIds = [];
    copiedEvents.forEach(e => {
        const newEvent = show.addEvent({
            time: e.time + timeOffset,
            launcherId: e.launcherId,
            type: e.type,
            primaryColor: e.primaryColor,
            secondaryColor: e.secondaryColor,
            size: e.size,
            height: e.height,
            trail: e.trail
        });
        pastedIds.push(newEvent.id);
    });

    // Select the pasted events
    pastedIds.forEach(id => selectedEventIds.add(id));

    // Refresh UI
    refreshEventList();
    markDirty();

    showToast(`Pasted ${copiedEvents.length} event${copiedEvents.length > 1 ? 's' : ''}`, 'success');
}

/**
 * Duplicate selected events (copy + paste in one action)
 */
function duplicateSelectedEvents() {
    const selected = getSelectedEvents();

    if (selected.length === 0) {
        showToast('No events selected to duplicate', 'error');
        return;
    }

    // Save state before duplicate
    saveState('Duplicate Events');

    const timeOffset = 1000; // 1 second offset

    // Clear selection
    clearSelection();

    // Create duplicates
    const duplicatedIds = [];
    selected.forEach(e => {
        const newEvent = show.addEvent({
            time: e.time + timeOffset,
            launcherId: e.launcherId,
            type: e.type,
            primaryColor: e.primaryColor,
            secondaryColor: e.secondaryColor,
            size: e.size,
            height: e.height,
            trail: e.trail
        });
        duplicatedIds.push(newEvent.id);
    });

    // Select duplicated events
    duplicatedIds.forEach(id => selectedEventIds.add(id));

    // Refresh UI
    refreshEventList();
    markDirty();

    showToast(`Duplicated ${selected.length} event${selected.length > 1 ? 's' : ''}`, 'success');
}

// ============================================
// DELETE SELECTED
// ============================================

/**
 * Delete all selected events
 */
function deleteSelectedEvents() {
    const selected = getSelectedEvents();

    if (selected.length === 0) {
        showToast('No events selected to delete', 'error');
        return;
    }

    // Save state before delete
    saveState('Delete Events');

    // Remove each selected event
    selected.forEach(e => {
        show.removeEvent(e.id);
    });

    // Clear selection
    clearSelection();

    // Refresh UI
    refreshEventList();
    markDirty();

    showToast(`Deleted ${selected.length} event${selected.length > 1 ? 's' : ''}`, 'info');
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Initialize keyboard shortcuts
 */
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Check if user is typing in an input field
        const activeElement = document.activeElement;
        const isTyping = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable
        );

        // Allow Escape even when typing (to close modals)
        if (e.key === 'Escape') {
            clearSelection();
            return;
        }

        // Don't process shortcuts when typing (except Escape above)
        if (isTyping) return;

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        // Ctrl+Z - Undo
        if (ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }

        // Ctrl+Y or Ctrl+Shift+Z - Redo
        if (ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
            e.preventDefault();
            redo();
            return;
        }

        // Ctrl+C - Copy
        if (ctrlKey && e.key === 'c') {
            e.preventDefault();
            copySelectedEvents();
            return;
        }

        // Ctrl+V - Paste
        if (ctrlKey && e.key === 'v') {
            e.preventDefault();
            pasteEvents();
            return;
        }

        // Ctrl+D - Duplicate
        if (ctrlKey && e.key === 'd') {
            e.preventDefault();
            duplicateSelectedEvents();
            return;
        }

        // Ctrl+A - Select All
        if (ctrlKey && e.key === 'a') {
            e.preventDefault();
            selectAllEvents();
            return;
        }

        // Delete or Backspace - Delete selected
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedEventIds.size > 0) {
                e.preventDefault();
                deleteSelectedEvents();
            }
            return;
        }
    });
}

/**
 * Initialize the history system
 */
function initHistory() {
    initKeyboardShortcuts();
    updateUndoRedoButtons();

    // Set up undo/redo button click handlers
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) {
        undoBtn.addEventListener('click', undo);
    }

    if (redoBtn) {
        redoBtn.addEventListener('click', redo);
    }
}
