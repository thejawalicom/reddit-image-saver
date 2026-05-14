/**
 * Reddit Image Saver - Gallery Detector
 * Detects Reddit gallery posts and extracts original-resolution image URLs.
 */

const GalleryDetector = {
  /**
   * Check if the current page is a Reddit gallery post.
   * @returns {boolean}
   */
  isGalleryPost() {
    // Check for gallery indicators in the DOM
    const hasGalleryCarousel = document.querySelector(
      '[data-testid="gallery-carousel"], .gallery-carousel, .media-gallery'
    );
    const hasGalleryNav = document.querySelector(
      '.gallery-nav, [aria-label="Gallery navigation"]'
    );
    // Check URL pattern for gallery
    const isGalleryUrl = /\/gallery\//.test(window.location.pathname);

    return !!(hasGalleryCarousel || hasGalleryNav || isGalleryUrl);
  },

  /**
   * Extract the post ID from the current URL.
   * @returns {string|null}
   */
  getPostId() {
    const match = window.location.href.match(URL_PATTERNS.GALLERY_POST);
    if (match) return match[1];

    // Also try gallery URL pattern: /gallery/{id}
    const galleryMatch = window.location.pathname.match(/\/gallery\/([a-zA-Z0-9]+)/);
    if (galleryMatch) return galleryMatch[1];

    return null;
  },

  /**
   * Extract gallery images purely from the DOM (zero network requests).
   * Scans gallery carousel elements for all rendered images, extracts URLs,
   * and upgrades them to original i.redd.it format.
   *
   * On modern Reddit, the gallery carousel renders ALL slides in the DOM
   * (hidden with CSS), so all image URLs are available without API calls.
   *
   * Falls back to embedded JSON in <script> tags for old Reddit.
   *
   * @param {string} [postId] - Post ID for context (unused in DOM mode, kept for API compatibility)
   * @returns {Array<{url: string, filename: string, mediaId: string}>}
   */
  extractGalleryFromDOM(postId) {
    const images = [];
    const seen = new Set();

    // Find the gallery carousel (supports multiple Reddit UI variants)
    const carouselSelectors = [
      'gallery-carousel',
      '[data-testid="gallery-carousel"]',
      '.gallery-carousel',
      '.media-gallery'
    ];

    let carousel = null;
    for (const sel of carouselSelectors) {
      carousel = document.querySelector(sel);
      if (carousel) break;
    }

    // Method 1: Extract from gallery carousel <img> elements (new Reddit)
    if (carousel) {
      // All slides are rendered in the DOM — query all img elements
      const imgElements = carousel.querySelectorAll('img[src*="redd.it"]');

      for (const img of imgElements) {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (!src || seen.has(src)) continue;

        const result = this._urlToGalleryItem(src);
        if (result) {
          seen.add(src);
          images.push(result);
        }
      }

      // Also check <source> elements with srcset
      const sourceElements = carousel.querySelectorAll('source[srcset*="redd.it"]');
      for (const source of sourceElements) {
        const srcset = source.getAttribute('srcset');
        if (!srcset) continue;
        // Parse srcset: take the highest-resolution URL (last in the list)
        const parts = srcset.split(',');
        const lastPart = parts[parts.length - 1].trim().split(' ')[0];
        if (lastPart && !seen.has(lastPart)) {
          const result = this._urlToGalleryItem(lastPart);
          if (result) {
            seen.add(lastPart);
            images.push(result);
          }
        }
      }

      if (images.length > 0) {
        console.log('[Reddit Image Saver] Extracted', images.length, 'gallery images from DOM carousel');
        return images;
      }
    }

    // Method 2: Try embedded JSON data in <script> tags (old Reddit fallback)
    const scriptImages = this._extractFromEmbeddedJSON();
    if (scriptImages.length > 0) {
      console.log('[Reddit Image Saver] Extracted', scriptImages.length, 'gallery images from embedded JSON');
      return scriptImages;
    }

    // Method 3: Scan all Reddit images on the page as last resort
    const pageImages = this.scanPageImages();
    for (const img of pageImages) {
      const result = this._urlToGalleryItem(img.originalUrl);
      if (result && !seen.has(result.url)) {
        seen.add(result.url);
        images.push(result);
      }
    }

    console.log('[Reddit Image Saver] Extracted', images.length, 'gallery images from page scan');
    return images;
  },

  /**
   * Try to extract gallery images from embedded JSON in <script> tags.
   * Reddit sometimes embeds post data in the initial page HTML.
   * @returns {Array<{url: string, filename: string, mediaId: string}>}
   */
  _extractFromEmbeddedJSON() {
    const images = [];

    // Look for <script id="data" type="application/json"> (old Reddit)
    const dataScript = document.getElementById('data');
    if (dataScript && dataScript.type === 'application/json') {
      try {
        return this._parseEmbeddedRedditJSON(dataScript.textContent);
      } catch (e) {
        // Ignore parse errors, try next method
      }
    }

    // Look for <script> tags containing window.___r or __INITIAL_STATE__
    const scripts = document.querySelectorAll('script:not([src])');
    for (const script of scripts) {
      const text = script.textContent || '';
      // Check for window.___r = {...} pattern (old Reddit)
      const rMatch = text.match(/window\.___r\s*=\s*(\{.+?\});/s);
      if (rMatch) {
        try {
          return this._parseEmbeddedRedditJSON(rMatch[1]);
        } catch (e) {
          // Ignore parse errors
        }
      }
      // Check for __INITIAL_STATE__ pattern
      const stateMatch = text.match(/__INITIAL_STATE__\s*=\s*(\{.+?\});/s);
      if (stateMatch) {
        try {
          return this._parseEmbeddedRedditJSON(stateMatch[1]);
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    return images;
  },

  /**
   * Parse Reddit's embedded JSON data structure and extract gallery image URLs.
   * Handles both old and new Reddit data formats.
   * @param {string} jsonText - Raw JSON string
   * @returns {Array<{url: string, filename: string, mediaId: string}>}
   */
  _parseEmbeddedRedditJSON(jsonText) {
    const images = [];
    const data = JSON.parse(jsonText);
    const seen = new Set();

    // New Reddit format: look for gallery_data and media_metadata anywhere in the tree
    const findGalleryData = (obj, depth) => {
      if (!obj || typeof obj !== 'object' || depth > 10) return;
      if (Array.isArray(obj)) {
        obj.forEach(item => findGalleryData(item, depth + 1));
        return;
      }

      if (obj.gallery_data && obj.media_metadata) {
        const items = obj.gallery_data.items || [];
        for (const item of items) {
          const mediaId = item.media_id;
          const metadata = obj.media_metadata[mediaId];
          if (!metadata) continue;

          const imageUrl = this._getOriginalFromMetadata(metadata, mediaId);
          if (imageUrl && !seen.has(imageUrl)) {
            seen.add(imageUrl);
            images.push({
              url: imageUrl,
              filename: this._buildFilename(mediaId, imageUrl),
              mediaId
            });
          }
        }
      }

      // Recurse into children
      for (const key of Object.keys(obj)) {
        findGalleryData(obj[key], depth + 1);
      }
    };

    findGalleryData(data, 0);
    return images;
  },

  /**
   * Convert an image URL to a gallery item object.
   * Extracts media ID, builds filename, and upgrades to original URL.
   * @param {string} url - Raw image URL (preview or original)
   * @returns {{url: string, filename: string, mediaId: string}|null}
   */
  _urlToGalleryItem(url) {
    if (!url || !UrlUtils.isRedditImageUrl(url)) return null;

    try {
      // Upgrade preview URL to original i.redd.it URL
      const bestUrl = UrlUtils.getBestUrl(url);

      // Extract media ID from the URL pathname
      // e.g., https://i.redd.it/abc123def456.jpg → abc123def456
      const parsed = new URL(bestUrl);
      const filename = parsed.pathname.split('/').pop();
      const mediaId = filename ? filename.split('.')[0] : 'unknown';

      return {
        url: bestUrl,
        filename: this._buildFilename(mediaId, bestUrl),
        mediaId
      };
    } catch {
      return null;
    }
  },

  /**
   * Extract image URLs from post data.
   * @param {object} post - Reddit post data object
   * @returns {Array<{url: string, filename: string, mediaId: string}>}
   */
  _extractGalleryUrls(post) {
    const images = [];

    // Method 1: gallery_data + media_metadata (standard gallery posts)
    if (post.gallery_data && post.media_metadata) {
      const items = post.gallery_data.items || [];
      for (const item of items) {
        const mediaId = item.media_id;
        const metadata = post.media_metadata[mediaId];
        if (!metadata) continue;

        const imageUrl = this._getOriginalFromMetadata(metadata, mediaId);
        if (imageUrl) {
          images.push({
            url: imageUrl,
            filename: this._buildFilename(mediaId, imageUrl),
            mediaId
          });
        }
      }
    }
    // Method 2: Single image post
    else if (post.url && this._isImageUrl(post.url)) {
      const bestUrl = UrlUtils.getBestUrl(post.url);
      images.push({
        url: bestUrl,
        filename: UrlUtils.getFilename(bestUrl),
        mediaId: null
      });
    }

    return images;
  },

  /**
   * Get the original image URL from media metadata.
   * @param {object} metadata - Media metadata from Reddit API
   * @param {string} mediaId - The media ID
   * @returns {string|null}
   */
  _getOriginalFromMetadata(metadata, mediaId) {
    // Prefer the source (original) image
    if (metadata.s) {
      // s.u is the URL (HTML-encoded), s.gif for animated
      const url = metadata.s.u || metadata.s.gif;
      if (url) {
        // Decode HTML entities (&amp; → &)
        const decoded = url.replace(/&amp;/g, '&');
        // Try to upgrade to i.redd.it original
        const upgraded = UrlUtils.upgradeToOriginal(decoded);
        return upgraded || decoded;
      }
    }

    // Fallback: construct i.redd.it URL from media ID
    const ext = metadata.m ? metadata.m.split('/')[1] : 'jpg';
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    return `https://i.redd.it/${mediaId}.${normalizedExt}`;
  },

  /**
   * Build a filename for a gallery image.
   * @param {string} mediaId
   * @param {string} url
   * @returns {string}
   */
  _buildFilename(mediaId, url) {
    const ext = UrlUtils.getExtension(url) || 'jpg';
    return `${mediaId}.${ext}`;
  },

  /**
   * Check if a URL points to an image.
   * @param {string} url
   * @returns {boolean}
   */
  _isImageUrl(url) {
    try {
      const parsed = new URL(url);
      const ext = parsed.pathname.split('.').pop().toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    } catch {
      return false;
    }
  },

  /**
   * Scan the current page DOM for Reddit image elements.
   * Returns all image URLs found on the page.
   * @returns {Array<{url: string, originalUrl: string, element: Element}>}
   */
  scanPageImages() {
    const results = [];
    const seen = new Set();

    // Find all img elements with Reddit image sources
    const images = document.querySelectorAll('img[src]');
    for (const img of images) {
      const src = img.src;
      if (!src || seen.has(src)) continue;
      if (!UrlUtils.isRedditImageUrl(src)) continue;

      seen.add(src);
      const originalUrl = UrlUtils.getBestUrl(src);
      results.push({
        url: src,
        originalUrl,
        element: img
      });
    }

    // Also check background images and source elements
    const sources = document.querySelectorAll('source[srcset]');
    for (const source of sources) {
      const srcset = source.srcset;
      if (!srcset) continue;
      // Parse srcset (may contain multiple URLs)
      const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
      for (const url of urls) {
        if (!url || seen.has(url)) continue;
        if (!UrlUtils.isRedditImageUrl(url)) continue;

        seen.add(url);
        results.push({
          url,
          originalUrl: UrlUtils.getBestUrl(url),
          element: source
        });
      }
    }

    return results;
  }
};
