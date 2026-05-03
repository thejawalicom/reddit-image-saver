/**
 * Reddit Image Saver - Main Content Script
 * Entry point for content scripts running on Reddit pages.
 * Coordinates gallery detection, image enhancement, and messaging.
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__redditImageSaverInit) return;
  window.__redditImageSaverInit = true;

  /**
   * Initialize the content script.
   */
  async function init() {
    try {
      // Get current settings from background
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_SETTINGS
      });

      const settings = response?.settings || DEFAULT_SETTINGS;
      if (!settings.enabled) return;

      // Initialize image enhancer (HD badges, download buttons)
      ImageEnhancer.init(settings);

      // Set up message listener for background/popup communication
      setupMessageListener();

      console.log('[Reddit Image Saver] Content script initialized');
    } catch (err) {
      console.error('[Reddit Image Saver] Init error:', err);
    }
  }

  /**
   * Set up listener for messages from background script and popup.
   */
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sendResponse);
      return true; // async response
    });
  }

  /**
   * Handle incoming messages.
   * @param {object} message
   * @param {function} sendResponse
   */
  async function handleMessage(message, sendResponse) {
    switch (message.type) {
      case MESSAGE_TYPES.GET_PAGE_IMAGES: {
        const images = GalleryDetector.scanPageImages();
        sendResponse({
          type: MESSAGE_TYPES.PAGE_IMAGES_RESULT,
          images: images.map(img => ({
            url: img.url,
            originalUrl: img.originalUrl,
            info: UrlUtils.getImageInfo(img.url)
          }))
        });
        break;
      }

      case MESSAGE_TYPES.GET_GALLERY_IMAGES: {
        const galleryImages = await GalleryDetector.fetchGalleryImages();
        sendResponse({
          type: MESSAGE_TYPES.GALLERY_IMAGES_RESULT,
          images: galleryImages,
          isGallery: GalleryDetector.isGalleryPost()
        });
        break;
      }

      case MESSAGE_TYPES.GET_IMAGE_INFO: {
        const pageImages = GalleryDetector.scanPageImages();
        const isGallery = GalleryDetector.isGalleryPost();
        let galleryCount = 0;

        if (isGallery) {
          const galleryImages = await GalleryDetector.fetchGalleryImages();
          galleryCount = galleryImages.length;
        }

        sendResponse({
          type: MESSAGE_TYPES.IMAGE_INFO_RESULT,
          totalImages: pageImages.length,
          isGallery,
          galleryCount,
          images: pageImages.slice(0, 20).map(img => ({
            url: img.url,
            originalUrl: img.originalUrl,
            info: UrlUtils.getImageInfo(img.url)
          }))
        });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
