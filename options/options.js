/**
 * Reddit Image Saver - Options Page Script
 * Handles full settings page with all configuration options.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Setting elements mapped to storage keys
  const settingMap = {
    'opt-enabled': 'enabled',
    'opt-prefer-original': 'preferOriginal',
    'opt-auto-redirect': 'autoRedirect',
    'opt-prevent-webp': 'preventWebP',
    'opt-show-hd-badge': 'showHDBadge',
    'opt-show-download-btn': 'showDownloadButton',
    'opt-gallery-auto-detect': 'galleryAutoDetect'
  };

  const toast = document.getElementById('toast');
  const btnReset = document.getElementById('btn-reset');

  /**
   * Load current settings into the form.
   */
  async function loadSettings() {
    const settings = await Storage.getSettings();
    for (const [elementId, settingKey] of Object.entries(settingMap)) {
      const el = document.getElementById(elementId);
      if (el) {
        el.checked = settings[settingKey];
      }
    }
  }

  /**
   * Save a setting and show toast.
   * @param {string} key
   * @param {any} value
   */
  async function saveSetting(key, value) {
    await Storage.saveSettings({ [key]: value });
    // Notify background to re-apply rules
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.UPDATE_SETTINGS,
      settings: { [key]: value }
    });
    showToast('Settings saved');
  }

  /**
   * Show a brief toast notification.
   * @param {string} message
   */
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.hidden = true;
    }, 2000);
  }

  // Bind change events to all setting toggles
  for (const [elementId, settingKey] of Object.entries(settingMap)) {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('change', () => {
        saveSetting(settingKey, el.checked);
      });
    }
  }

  // Reset to defaults
  btnReset.addEventListener('click', async () => {
    await Storage.resetToDefaults();
    await loadSettings();
    showToast('Settings reset to defaults');
  });

  // Initialize
  await loadSettings();
});
