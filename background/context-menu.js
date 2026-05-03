/**
 * Reddit Image Saver - Context Menu Handler
 * Sets up right-click context menu items for saving Reddit images.
 */

const ContextMenu = {
  /**
   * Initialize context menu items.
   * Called on extension install/update.
   */
  setup() {
    // Remove existing items first to avoid duplicates
    chrome.contextMenus.removeAll(() => {
      // "Save Original HD Image" - appears on images within Reddit pages
      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SAVE_ORIGINAL,
        title: 'Save Original HD Image',
        contexts: ['image'],
        documentUrlPatterns: [
          '*://www.reddit.com/*',
          '*://old.reddit.com/*',
          '*://new.reddit.com/*',
          '*://sh.reddit.com/*',
          '*://i.redd.it/*',
          '*://preview.redd.it/*',
          '*://external-preview.redd.it/*',
          '*://cf.preview.redd.it/*'
        ]
      });

      // "Save All Gallery Images" - appears on Reddit pages
      chrome.contextMenus.create({
        id: CONTEXT_MENU_IDS.SAVE_ALL_GALLERY,
        title: 'Save All Gallery Images (HD)',
        contexts: ['page'],
        documentUrlPatterns: [
          '*://www.reddit.com/r/*/comments/*',
          '*://old.reddit.com/r/*/comments/*',
          '*://new.reddit.com/r/*/comments/*',
          '*://sh.reddit.com/r/*/comments/*'
        ]
      });
    });
  },

  /**
   * Handle context menu click events.
   * @param {object} info - Click info from chrome.contextMenus.onClicked
   * @param {object} tab - Tab where the click occurred
   */
  async handleClick(info, tab) {
    switch (info.menuItemId) {
      case CONTEXT_MENU_IDS.SAVE_ORIGINAL:
        await this._handleSaveOriginal(info, tab);
        break;
      case CONTEXT_MENU_IDS.SAVE_ALL_GALLERY:
        await this._handleSaveAllGallery(info, tab);
        break;
    }
  },

  /**
   * Handle "Save Original HD Image" click.
   * @param {object} info
   * @param {object} tab
   */
  async _handleSaveOriginal(info, tab) {
    const imageUrl = info.srcUrl;
    if (!imageUrl) return;

    try {
      await DownloadManager.downloadImage(imageUrl);
    } catch (err) {
      console.error('[Reddit Image Saver] Failed to save original:', err);
    }
  },

  /**
   * Handle "Save All Gallery Images" click.
   * Sends message to content script to detect gallery images.
   * @param {object} info
   * @param {object} tab
   */
  async _handleSaveAllGallery(info, tab) {
    try {
      // Ask content script for gallery images
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: MESSAGE_TYPES.GET_GALLERY_IMAGES
      });

      if (response && response.images && response.images.length > 0) {
        await DownloadManager.downloadAll(response.images);
      } else {
        console.log('[Reddit Image Saver] No gallery images found on this page');
      }
    } catch (err) {
      console.error('[Reddit Image Saver] Failed to get gallery images:', err);
    }
  }
};
