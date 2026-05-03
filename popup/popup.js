/**
 * Reddit Image Saver - Popup Script
 * Handles popup UI interactions, settings management, and page info display.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM elements
  const toggleEnabled = document.getElementById('toggle-enabled');
  const statusDot = document.querySelector('.status__dot');
  const statusText = document.getElementById('status-text');
  const imageCount = document.getElementById('image-count');
  const galleryStatus = document.getElementById('gallery-status');
  const btnDownloadAll = document.getElementById('btn-download-all');
  const linkOptions = document.getElementById('link-options');
  const popup = document.querySelector('.popup');

  // Setting checkboxes
  const settingElements = {
    preferOriginal: document.getElementById('setting-prefer-original'),
    autoRedirect: document.getElementById('setting-auto-redirect'),
    preventWebP: document.getElementById('setting-prevent-webp'),
    showHDBadge: document.getElementById('setting-show-hd-badge'),
    showDownloadButton: document.getElementById('setting-show-download-btn')
  };

  // Gallery images cache
  let cachedGalleryImages = [];

  /**
   * Load and display current settings.
   */
  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS
      });
      const settings = response?.settings || DEFAULT_SETTINGS;

      // Update toggle
      toggleEnabled.checked = settings.enabled;
      updateStatusDisplay(settings.enabled);

      // Update setting checkboxes
      settingElements.preferOriginal.checked = settings.preferOriginal;
      settingElements.autoRedirect.checked = settings.autoRedirect;
      settingElements.preventWebP.checked = settings.preventWebP;
      settingElements.showHDBadge.checked = settings.showHDBadge;
      settingElements.showDownloadButton.checked = settings.showDownloadButton;

      // Update disabled state
      if (!settings.enabled) {
        popup.classList.add('popup--disabled');
      }
    } catch (err) {
      console.error('[Reddit Image Saver] Failed to load settings:', err);
    }
  }

  /**
   * Update the status bar display.
   * @param {boolean} enabled
   */
  function updateStatusDisplay(enabled) {
    statusDot.className = 'status__dot ' + (enabled ? 'status__dot--active' : 'status__dot--inactive');
    statusText.textContent = enabled ? 'Active' : 'Disabled';
  }

  /**
   * Load page info from the active tab's content script.
   */
  async function loadPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      // Check if we're on a Reddit page
      const isRedditPage = /reddit\.com/.test(tab.url);
      if (!isRedditPage) {
        imageCount.textContent = 'N/A';
        galleryStatus.textContent = 'Not Reddit';
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.GET_IMAGE_INFO
      });

      if (response) {
        imageCount.textContent = response.totalImages || '0';

        if (response.isGallery) {
          galleryStatus.textContent = `Yes (${response.galleryCount} images)`;
          btnDownloadAll.disabled = response.galleryCount === 0;

          // Fetch gallery images for download
          const galleryResponse = await chrome.tabs.sendMessage(tab.id, {
            type: MESSAGE_TYPES.GET_GALLERY_IMAGES
          });
          if (galleryResponse?.images) {
            cachedGalleryImages = galleryResponse.images;
          }
        } else {
          galleryStatus.textContent = 'No';
          // Enable download all if there are images
          btnDownloadAll.disabled = (response.totalImages || 0) === 0;
          if (response.images) {
            cachedGalleryImages = response.images.map(img => ({
              url: img.originalUrl,
              filename: null
            }));
          }
        }
      }
    } catch (err) {
      // Content script may not be loaded (non-Reddit page)
      imageCount.textContent = '—';
      galleryStatus.textContent = '—';
    }
  }

  /**
   * Save a setting change.
   * @param {string} key
   * @param {any} value
   */
  async function saveSetting(key, value) {
    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.UPDATE_SETTINGS,
        settings: { [key]: value }
      });
    } catch (err) {
      console.error('[Reddit Image Saver] Failed to save setting:', err);
    }
  }

  // Event: Master toggle
  toggleEnabled.addEventListener('change', async () => {
    const enabled = toggleEnabled.checked;
    await saveSetting('enabled', enabled);
    updateStatusDisplay(enabled);

    if (enabled) {
      popup.classList.remove('popup--disabled');
    } else {
      popup.classList.add('popup--disabled');
    }
  });

  // Event: Setting checkboxes
  settingElements.preferOriginal.addEventListener('change', () => {
    saveSetting('preferOriginal', settingElements.preferOriginal.checked);
  });
  settingElements.autoRedirect.addEventListener('change', () => {
    saveSetting('autoRedirect', settingElements.autoRedirect.checked);
  });
  settingElements.preventWebP.addEventListener('change', () => {
    saveSetting('preventWebP', settingElements.preventWebP.checked);
  });
  settingElements.showHDBadge.addEventListener('change', () => {
    saveSetting('showHDBadge', settingElements.showHDBadge.checked);
  });
  settingElements.showDownloadButton.addEventListener('change', () => {
    saveSetting('showDownloadButton', settingElements.showDownloadButton.checked);
  });

  // Event: Download All button
  btnDownloadAll.addEventListener('click', async () => {
    if (cachedGalleryImages.length === 0) return;

    btnDownloadAll.disabled = true;
    btnDownloadAll.textContent = 'Downloading...';

    try {
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DOWNLOAD_ALL_GALLERY,
        images: cachedGalleryImages
      });
      btnDownloadAll.textContent = 'Downloaded!';
      setTimeout(() => {
        btnDownloadAll.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download All HD Images`;
        btnDownloadAll.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('[Reddit Image Saver] Download all failed:', err);
      btnDownloadAll.textContent = 'Download failed';
      btnDownloadAll.disabled = false;
    }
  });

  // Event: Options link
  linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Initialize
  await loadSettings();
  await loadPageInfo();
});
