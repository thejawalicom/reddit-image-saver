/**
 * Reddit Image Saver - URL Utilities
 * URL parsing, transformation, and upgrade logic.
 */

const UrlUtils = {
  /**
   * Check if a URL is a Reddit image URL (any domain).
   * @param {string} url
   * @returns {boolean}
   */
  isRedditImageUrl(url) {
    try {
      const parsed = new URL(url);
      return REDDIT_IMAGE_DOMAINS.some(domain => parsed.hostname === domain);
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL is a Reddit media wrapper page.
   * @param {string} url
   * @returns {boolean}
   */
  isMediaWrapperUrl(url) {
    return URL_PATTERNS.MEDIA_WRAPPER.test(url);
  },

  /**
   * Check if a URL is a preview URL (not original).
   * @param {string} url
   * @returns {boolean}
   */
  isPreviewUrl(url) {
    try {
      const parsed = new URL(url);
      return ['preview.redd.it', 'external-preview.redd.it', 'cf.preview.redd.it']
        .includes(parsed.hostname);
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL is an original i.redd.it URL.
   * @param {string} url
   * @returns {boolean}
   */
  isOriginalUrl(url) {
    return URL_PATTERNS.ORIGINAL.test(url);
  },

  /**
   * Extract the direct image URL from a Reddit media wrapper URL.
   * www.reddit.com/media?url={encoded_url} → {decoded_url}
   * @param {string} url
   * @returns {string|null}
   */
  extractFromMediaWrapper(url) {
    const match = url.match(URL_PATTERNS.MEDIA_WRAPPER);
    if (!match) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  },

  /**
   * Upgrade a preview.redd.it URL to the original i.redd.it URL.
   * preview.redd.it/{id}-{hash}.{ext}?params → i.redd.it/{id}.{ext}
   * @param {string} url
   * @returns {string|null} The original URL, or null if not upgradeable.
   */
  upgradeToOriginal(url) {
    try {
      const parsed = new URL(url);

      // Only upgrade preview.redd.it and cf.preview.redd.it
      if (parsed.hostname !== 'preview.redd.it' && parsed.hostname !== 'cf.preview.redd.it') {
        return null;
      }

      // Extract filename from path (e.g., /abc123-somehash.jpg)
      const filename = parsed.pathname.split('/').pop();
      if (!filename) return null;

      const idMatch = filename.match(URL_PATTERNS.PREVIEW_IMAGE_ID);
      if (!idMatch) return null;

      const [, imageId, ext] = idMatch;
      // Map common format variations
      const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;

      return `https://i.redd.it/${imageId}.${normalizedExt}`;
    } catch {
      return null;
    }
  },

  /**
   * Strip quality-degrading query parameters from a URL.
   * Removes: width, height, format, auto, crop, s
   * @param {string} url
   * @returns {string}
   */
  stripQualityParams(url) {
    try {
      const parsed = new URL(url);
      QUALITY_DEGRADING_PARAMS.forEach(param => {
        parsed.searchParams.delete(param);
      });
      return parsed.toString();
    } catch {
      return url;
    }
  },

  /**
   * Get the best possible URL for an image.
   * Tries to upgrade to original, falls back to stripping params.
   * @param {string} url
   * @returns {string}
   */
  getBestUrl(url) {
    // If it's a media wrapper, extract the real URL first
    if (this.isMediaWrapperUrl(url)) {
      const extracted = this.extractFromMediaWrapper(url);
      if (extracted) {
        url = extracted;
      }
    }

    // If it's already an original URL, return as-is
    if (this.isOriginalUrl(url)) {
      return url;
    }

    // Try to upgrade preview to original
    const upgraded = this.upgradeToOriginal(url);
    if (upgraded) {
      return upgraded;
    }

    // Fall back to stripping quality params
    return this.stripQualityParams(url);
  },

  /**
   * Extract filename from a URL for download purposes.
   * @param {string} url
   * @returns {string}
   */
  getFilename(url) {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      if (filename && filename.includes('.')) {
        return filename;
      }
      return 'reddit-image.jpg';
    } catch {
      return 'reddit-image.jpg';
    }
  },

  /**
   * Get the file extension from a URL.
   * @param {string} url
   * @returns {string}
   */
  getExtension(url) {
    const filename = this.getFilename(url);
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  },

  /**
   * Get image format info from URL.
   * @param {string} url
   * @returns {{ format: string, isOriginal: boolean, domain: string }}
   */
  getImageInfo(url) {
    try {
      const parsed = new URL(url);
      return {
        format: this.getExtension(url),
        isOriginal: parsed.hostname === 'i.redd.it',
        domain: parsed.hostname
      };
    } catch {
      return { format: 'unknown', isOriginal: false, domain: 'unknown' };
    }
  }
};
