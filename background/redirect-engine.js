/**
 * Reddit Image Saver - Redirect Engine
 * Handles URL interception and transformation.
 *
 * Two main redirect types:
 * 1. Media wrapper redirect: reddit.com/media?url=X → X (via webNavigation)
 * 2. Preview upgrade: preview.redd.it → i.redd.it (via webNavigation)
 *
 * We use webNavigation.onBeforeNavigate + chrome.tabs.update because
 * declarativeNetRequest cannot URL-decode query parameters.
 */

const RedirectEngine = {
  /** Track if listeners are already registered */
  _initialized: false,

  /**
   * Initialize the redirect engine.
   * Sets up webNavigation listener for media wrapper and preview upgrades.
   * @param {object} settings - Current extension settings
   */
  init(settings) {
    if (this._initialized) return;
    this._initialized = true;

    // Always register the listener — we check settings inside the handler
    chrome.webNavigation.onBeforeNavigate.addListener(
      (details) => this._handleNavigation(details),
      {
        url: [
          { hostEquals: 'www.reddit.com', pathPrefix: '/media' },
          { hostEquals: 'preview.redd.it' },
          { hostEquals: 'cf.preview.redd.it' },
          { hostEquals: 'external-preview.redd.it' }
        ]
      }
    );
  },

  /**
   * Handle navigation events for URL transformation.
   * @param {object} details - Navigation details from webNavigation API
   */
  async _handleNavigation(details) {
    // Only handle top-level navigation
    if (details.frameId !== 0) return;

    // Check settings each time (they may have changed)
    let settings;
    try {
      settings = await new Promise((resolve) => {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
          resolve({ ...DEFAULT_SETTINGS, ...result });
        });
      });
    } catch {
      return;
    }

    if (!settings.enabled || !settings.autoRedirect) return;

    const url = details.url;
    let redirectUrl = null;

    // 1. Media wrapper: www.reddit.com/media?url=X → X
    if (url.includes('www.reddit.com/media')) {
      redirectUrl = this._resolveMediaWrapper(url, settings);
    }
    // 2. Preview upgrade: preview.redd.it → i.redd.it
    else if (settings.preferOriginal && this._isPreviewUrl(url)) {
      redirectUrl = this._upgradePreviewUrl(url);
    }

    if (redirectUrl && redirectUrl !== url) {
      try {
        chrome.tabs.update(details.tabId, { url: redirectUrl });
      } catch (err) {
        console.error('[Reddit Image Saver] Redirect failed:', err);
      }
    }
  },

  /**
   * Resolve a media wrapper URL to the direct image URL.
   * www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fxyz.jpg → https://i.redd.it/xyz.jpg
   * @param {string} url
   * @param {object} settings
   * @returns {string|null}
   */
  _resolveMediaWrapper(url, settings) {
    try {
      const parsed = new URL(url);
      const encodedImageUrl = parsed.searchParams.get('url');
      if (!encodedImageUrl) return null;

      let imageUrl;
      try {
        imageUrl = decodeURIComponent(encodedImageUrl);
      } catch {
        imageUrl = encodedImageUrl;
      }

      // If preferOriginal is on, try to upgrade the extracted URL too
      if (settings.preferOriginal) {
        const upgraded = this._upgradePreviewUrl(imageUrl);
        if (upgraded) return upgraded;
      }

      return imageUrl;
    } catch {
      return null;
    }
  },

  /**
   * Upgrade a preview URL to original i.redd.it URL.
   * preview.redd.it/{id}-{hash}.{ext}?params → i.redd.it/{id}.{ext}
   * @param {string} url
   * @returns {string|null}
   */
  _upgradePreviewUrl(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      if (hostname !== 'preview.redd.it' && hostname !== 'cf.preview.redd.it') {
        return null;
      }

      // Extract filename from path (e.g., /abc123def-somehash.jpg)
      const filename = parsed.pathname.split('/').pop();
      if (!filename) return null;

      // Match pattern: {id}.{ext} or {id}-{hash}.{ext}
      // Reddit image IDs are alphanumeric, typically 10-13 chars
      const match = filename.match(/^([a-zA-Z0-9]+)(?:-[a-zA-Z0-9]+)?\.(\w+)/);
      if (!match) return null;

      const [, imageId, ext] = match;
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;

      return `https://i.redd.it/${imageId}.${normalizedExt}`;
    } catch {
      return null;
    }
  },

  /**
   * Check if URL is a preview URL that can be upgraded.
   * @param {string} url
   * @returns {boolean}
   */
  _isPreviewUrl(url) {
    try {
      const parsed = new URL(url);
      return ['preview.redd.it', 'cf.preview.redd.it']
        .includes(parsed.hostname);
    } catch {
      return false;
    }
  }
};
