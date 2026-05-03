/**
 * Reddit Image Saver - Storage Wrapper
 * Chrome storage API wrapper for persisting user settings.
 */

const Storage = {
  /**
   * Get all settings, merged with defaults.
   * @returns {Promise<object>}
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
        resolve({ ...DEFAULT_SETTINGS, ...result });
      });
    });
  },

  /**
   * Save settings (partial update).
   * @param {object} settings - Key-value pairs to save.
   * @returns {Promise<void>}
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(settings, resolve);
    });
  },

  /**
   * Get a single setting value.
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(key) {
    const settings = await this.getSettings();
    return settings[key];
  },

  /**
   * Set a single setting value.
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return this.saveSettings({ [key]: value });
  },

  /**
   * Reset all settings to defaults.
   * @returns {Promise<void>}
   */
  async resetToDefaults() {
    return new Promise((resolve) => {
      chrome.storage.sync.clear(() => {
        chrome.storage.sync.set(DEFAULT_SETTINGS, resolve);
      });
    });
  },

  /**
   * Listen for settings changes.
   * @param {function} callback - Called with (changes, areaName)
   */
  onChanged(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        callback(changes);
      }
    });
  }
};
