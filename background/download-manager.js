/**
 * Reddit Image Saver - Download Manager
 * Handles downloading images with original quality and filenames.
 * 
 * Key insight: i.redd.it always serves raw images regardless of Accept headers.
 * The trick is to resolve all URLs to i.redd.it before downloading.
 * preview.redd.it and media wrapper pages are what serve HTML.
 */

const DownloadManager = {
  /**
   * Download a single image from its best available URL.
   * Resolves to i.redd.it original URL first, then downloads directly.
   * @param {string} url - The image URL (may be preview or original)
   * @param {string} [filename] - Optional filename override
   * @returns {Promise<number>} Download ID
   */
  async downloadImage(url, filename) {
    // Resolve to best URL (upgrade preview → i.redd.it)
    const bestUrl = this._getBestUrl(url);
    const downloadFilename = filename || this._getFilename(bestUrl);

    console.log('[Reddit Image Saver] Downloading:', bestUrl, 'as', downloadFilename);

    // i.redd.it URLs always serve raw images, so direct download works
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: bestUrl,
        filename: downloadFilename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[Reddit Image Saver] Download error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log('[Reddit Image Saver] Download started, ID:', downloadId);
          resolve(downloadId);
        }
      });
    });
  },

  /**
   * Download multiple images (for gallery posts).
   * @param {Array<{url: string, filename?: string}>} images
   * @returns {Promise<number[]>} Array of download IDs
   */
  async downloadAll(images) {
    const results = [];
    for (const img of images) {
      try {
        // Small delay between downloads to avoid overwhelming the browser
        if (results.length > 0) {
          await this._delay(500);
        }
        const id = await this.downloadImage(img.url, img.filename);
        results.push(id);
      } catch (err) {
        console.error('[Reddit Image Saver] Download failed:', img.url, err);
      }
    }
    return results;
  },

  /**
   * Get the best URL for an image (upgrade preview to original).
   * Always tries to resolve to i.redd.it which serves raw images.
   * @param {string} url
   * @returns {string}
   */
  _getBestUrl(url) {
    // Step 1: Handle media wrapper: www.reddit.com/media?url=X → X
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'www.reddit.com' && parsed.pathname === '/media') {
        const encodedUrl = parsed.searchParams.get('url');
        if (encodedUrl) {
          url = decodeURIComponent(encodedUrl);
        }
      }
    } catch { /* ignore */ }

    // Step 2: Try upgrade preview to original i.redd.it
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'preview.redd.it' || parsed.hostname === 'cf.preview.redd.it') {
        const filename = parsed.pathname.split('/').pop();
        if (filename) {
          const match = filename.match(/^([a-zA-Z0-9]+)(?:-[a-zA-Z0-9]+)?\.(\w+)/);
          if (match) {
            const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
            return `https://i.redd.it/${match[1]}.${ext}`;
          }
        }
      }
      // For i.redd.it URLs, strip any query params to get clean URL
      if (parsed.hostname === 'i.redd.it') {
        return `${parsed.origin}${parsed.pathname}`;
      }
    } catch { /* ignore */ }

    return url;
  },

  /**
   * Extract filename from URL.
   * @param {string} url
   * @returns {string}
   */
  _getFilename(url) {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      if (filename && filename.includes('.')) {
        return filename;
      }
    } catch { /* ignore */ }
    return 'reddit-image.jpg';
  },

  /**
   * Simple delay helper.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
