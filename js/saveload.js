/**
 * SaveLoad Module - Platform integration
 */

let currentProjectId = null;
let isDirty = false;

/**
 * Serialize project data for platform save
 */
window.serializeProjectData = function () {
    return getShowData();
};

/**
 * Load project data from platform
 */
window.loadProjectData = function (data) {
    if (data && typeof data === 'object') {
        show.fromJSON(data);
        refreshEventList();
        updateTimeDisplay(0, show.duration);
        updateLauncherCount();
        updateLauncherSelectButtons();
    }
};
