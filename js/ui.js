/**
 * UI Module - Controls, modals, and event list management
 */

// Current editing state
let currentEditingEventId = null;
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

    // Escape to close modals
    if (e.key === 'Escape') {
        closeLaunchModal();
        closeShareModal();
        closeFinaleModal();
        closeSettingsModal();
    }
}

/**
 * Handle timeline click for seeking
 */
function handleTimelineClick(e) {
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

    playhead.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = track.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * show.duration;

        show.seek(time);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
}

/**
 * Open add launch modal
 */
function openAddLaunchModal() {
    currentEditingEventId = null;

    // Update launcher buttons first
    updateLauncherSelectButtons();

    // Reset form
    document.getElementById('launch-modal-title').textContent = 'Add Firework Launch';
    document.getElementById('launch-time-min').value = 0;
    document.getElementById('launch-time-sec').value = 0;
    document.getElementById('firework-type').value = 'chrysanthemum';
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
 * Open edit launch modal
 */
function openEditLaunchModal(eventId) {
    const event = show.events.find(e => e.id === eventId);
    if (!event) return;

    currentEditingEventId = eventId;

    // Update launcher buttons first
    updateLauncherSelectButtons();

    // Populate form with event data
    document.getElementById('launch-modal-title').textContent = 'Edit Firework Launch';

    const totalSeconds = Math.floor(event.time / 1000);
    document.getElementById('launch-time-min').value = Math.floor(totalSeconds / 60);
    document.getElementById('launch-time-sec').value = totalSeconds % 60;

    document.getElementById('firework-type').value = event.type;
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
    document.getElementById('launch-modal').style.display = 'none';
    currentEditingEventId = null;
}

/**
 * Save launch event from modal
 */
function saveLaunchEvent() {
    const minutes = parseInt(document.getElementById('launch-time-min').value) || 0;
    const seconds = parseInt(document.getElementById('launch-time-sec').value) || 0;
    const time = parseTime(minutes, seconds);

    const eventData = {
        time: time,
        launcherId: selectedLauncherId,
        type: document.getElementById('firework-type').value,
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
    document.querySelector('input[name="finale-theme"][value="random"]').checked = true;
    document.getElementById('custom-colors-section').style.display = 'none';

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
    const theme = document.querySelector('input[name="finale-theme"]:checked').value;

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
    const finaleCount = show.addFinaleWithOptions({
        duration: duration,
        count: count,
        intensity: intensity,
        theme: theme,
        customColors: customColors,
        types: selectedTypes
    });

    // Close modal and update UI
    closeFinaleModal();
    refreshEventList();
    markDirty();
    showToast(`Finale added! ${finaleCount} fireworks scheduled.`, 'success');
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
                <p class="hint">Click "Add Launch" to schedule your first firework.</p>
            </div>
        `;
        return;
    }

    let html = '';
    events.forEach(event => {
        const timeStr = formatTimeDetailed(event.time);
        const typeConfig = FIREWORK_TYPES[event.type];
        const typeName = typeConfig ? typeConfig.name : event.type;
        const isSelected = typeof isEventSelected === 'function' && isEventSelected(event.id);

        html += `
            <div class="event-item${isSelected ? ' selected' : ''}" data-event-id="${event.id}">
                <span class="event-time">${timeStr}</span>
                <span class="event-launcher">${event.launcherId}</span>
                <span class="event-color" style="background-color: ${event.primaryColor}"></span>
                <span class="event-type">${typeName}</span>
                <span class="event-size">(${event.size})</span>
                <div class="event-actions">
                    <button class="event-action-btn" onclick="event.stopPropagation(); openEditLaunchModal('${event.id}')" title="Edit">&#9998;</button>
                    <button class="event-action-btn delete" onclick="event.stopPropagation(); deleteEvent('${event.id}')" title="Delete">&#128465;</button>
                </div>
            </div>
        `;
    });

    eventList.innerHTML = html;

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
        marker.title = `${formatTimeDetailed(event.time)} - ${FIREWORK_TYPES[event.type]?.name || event.type}`;
        track.appendChild(marker);
    });

    // Update timeline ruler
    updateTimelineRuler();
}

/**
 * Update timeline ruler marks
 */
function updateTimelineRuler() {
    const ruler = document.querySelector('.timeline-ruler');
    const duration = show.duration;

    // Calculate appropriate interval
    let interval = 10000; // 10 seconds default
    if (duration > 120000) interval = 30000;
    if (duration > 300000) interval = 60000;

    let html = '';
    for (let time = 0; time <= duration; time += interval) {
        html += `<span class="time-mark">${formatTimeDetailed(time)}</span>`;
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
