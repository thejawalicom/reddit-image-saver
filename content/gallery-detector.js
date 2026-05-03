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
   * Fetch gallery images from Reddit's JSON API.
   * @param {string} [postId] - Post ID, auto-detected if not provided
   * @returns {Promise<Array<{url: string, filename: string, mediaId: string}>>}
   */
  async fetchGalleryImages(postId) {
    postId = postId || this.getPostId();
    if (!postId) return [];

    try {
      // Fetch post data from Reddit JSON API
      const response = await fetch(
        `https://www.reddit.com/comments/${postId}.json`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const post = data[0]?.data?.children?.[0]?.data;
      if (!post) return [];

      return this._extractGalleryUrls(post);
    } catch (err) {
      console.error('[Reddit Image Saver] Gallery fetch error:', err);
      return [];
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
