/**
 * Reddit Image Saver - Image Enhancer
 * Places download buttons ABOVE each Reddit image post's media container.
 * For gallery posts: shows "Download HD" (current image) + "Download All" buttons.
 * For single image posts: shows only "Download HD" button.
 */

const ImageEnhancer = {
  /** Track which post containers we've already enhanced */
  _enhanced: new WeakSet(),

  /**
   * Initialize the image enhancer.
   * @param {object} settings - Current extension settings
   */
  init(settings) {
    if (!settings.enabled || !settings.showDownloadButton) return;
    this._enhanceAll();
    this._observeMutations();
  },

  /**
   * Find and enhance all Reddit image posts on the page.
   */
  _enhanceAll() {
    // Find all post media containers on new Reddit
    const mediaContainers = document.querySelectorAll(
      '[slot="post-media-container"]'
    );
    for (const container of mediaContainers) {
      this._enhancePost(container);
    }

    // Also find standalone Reddit images (old reddit, direct image pages)
    const standaloneImages = document.querySelectorAll(
      'img[src*="preview.redd.it"], img[src*="i.redd.it"]'
    );
    for (const img of standaloneImages) {
      if (!img.closest('[data-ris-enhanced]')) {
        this._enhanceStandaloneImage(img);
      }
    }
  },

  /**
   * Enhance a post's media container with download button(s).
   * @param {Element} container - The [slot="post-media-container"] element
   */
  _enhancePost(container) {
    if (this._enhanced.has(container)) return;
    this._enhanced.add(container);
    container.setAttribute('data-ris-enhanced', 'true');

    // Skip video posts - download button should not be shown on videos
    if (this._isVideoPost(container)) {
      console.log('[Reddit Image Saver] Skipping video post');
      return;
    }

    // Find the best image info from this post
    const { url: imageUrl, element: imgElement } = this._findBestImageInfo(container);
    if (!imageUrl) return;

    // Check if this is a gallery post (has carousel/navigation)
    const isGallery = this._isGalleryPost(container);

    // Extract post ID for gallery API calls
    const postId = this._extractPostId(container);

    // Build the i.redd.it download URL for current image
    const downloadUrl = this._buildDownloadUrl(imageUrl);
    const filename = downloadUrl.split('/').pop().split('?')[0] || 'reddit-image.jpg';

    // Create the download button bar ABOVE the media container
    const btnBar = document.createElement('div');
    btnBar.className = 'ris-download-bar';

    // Dimension display (left side)
    const dimDisplay = document.createElement('span');
    dimDisplay.className = 'ris-dimensions';
    btnBar.appendChild(dimDisplay);

    // Button 1: Download current image (always shown)
    // For gallery posts, label as "Download 1st image" to clarify it only downloads the first image
    const dlBtn = this._createDownloadButton(
      isGallery ? 'Download 1st image' : 'Download',
      downloadUrl,
      filename
    );
    btnBar.appendChild(dlBtn);

    // Button 2: Download All (only for gallery posts)
    if (isGallery && postId) {
      const dlAllBtn = this._createDownloadAllButton(postId, container);
      btnBar.appendChild(dlAllBtn);
    }

    // Insert the button bar BEFORE the media container
    container.parentNode.insertBefore(btnBar, container);

    // Populate dimensions
    console.log('[Reddit Image Saver] Post enhanced - isGallery:', isGallery, 'postId:', postId, 'url:', imageUrl);
    if (isGallery && postId) {
      this._getGalleryDimensions(postId).then(dims => {
        console.log('[Reddit Image Saver] Gallery dimensions result:', dims);
        if (dims.length > 0) {
          dims.forEach((d, i) => {
            const badge = document.createElement('span');
            badge.className = 'ris-dim-badge';
            badge.textContent = d ? `${i + 1}. ${d.width}×${d.height}` : `${i + 1}. ?`;
            dimDisplay.appendChild(badge);
          });
        }
      }).catch(err => {
        console.error('[Reddit Image Saver] Gallery dimensions promise rejected:', err);
      });
    } else {
      // Single image: use element dimensions if already loaded, else load
      if (imgElement && imgElement.naturalWidth > 0) {
        const badge = document.createElement('span');
        badge.className = 'ris-dim-badge';
        badge.textContent = `${imgElement.naturalWidth}×${imgElement.naturalHeight}`;
        dimDisplay.appendChild(badge);
      } else {
        this._getImageDimensions(downloadUrl).then(dim => {
          if (dim) {
            const badge = document.createElement('span');
            badge.className = 'ris-dim-badge';
            badge.textContent = `${dim.width}×${dim.height}`;
            dimDisplay.appendChild(badge);
          }
        });
      }
    }

    // For gallery posts, update the "Download This" button when user swipes
    if (isGallery) {
      this._observeGallerySlide(container, dlBtn);
    }
  },

  /**
   * Create a single-image download button.
   * @param {string} label - Button text
   * @param {string} downloadUrl - The i.redd.it URL
   * @param {string} filename - Download filename
   * @returns {HTMLButtonElement}
   */
  _createDownloadButton(label, downloadUrl, filename) {
    const btn = document.createElement('button');
    btn.className = 'ris-download-btn-visible';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>${label}</span>
    `;
    btn.title = 'Download original HD image';
    btn.dataset.downloadUrl = downloadUrl;
    btn.dataset.filename = filename;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const url = btn.dataset.downloadUrl;
      const fname = btn.dataset.filename;
      console.log('[Reddit Image Saver] Download clicked:', url);

      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.DOWNLOAD_IMAGE,
        url: url,
        filename: fname
      });

      const span = btn.querySelector('span');
      btn.classList.add('ris-download-btn-visible--done');
      if (span) span.textContent = 'Downloading...';
      setTimeout(() => {
        btn.classList.remove('ris-download-btn-visible--done');
        if (span) span.textContent = label;
      }, 2000);
    }, true);

    return btn;
  },

  /**
   * Create a "Download All" button for gallery posts.
   * Fetches all gallery images via Reddit JSON API and downloads them.
   * @param {string} postId - Reddit post ID
   * @param {Element} container - The media container element
   * @returns {HTMLButtonElement}
   */
  _createDownloadAllButton(postId, container) {
    const btn = document.createElement('button');
    btn.className = 'ris-download-btn-visible ris-download-all-btn';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>Download All</span>
    `;
    btn.title = 'Download all gallery images in HD';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const span = btn.querySelector('span');
      btn.classList.add('ris-download-btn-visible--done');
      if (span) span.textContent = 'Fetching...';

      try {
        // Fetch gallery images from Reddit JSON API
        const images = await this._fetchGalleryImages(postId);
        if (images.length === 0) {
          if (span) span.textContent = 'No images found';
          setTimeout(() => {
            btn.classList.remove('ris-download-btn-visible--done');
            if (span) span.textContent = 'Download All';
          }, 2000);
          return;
        }

        if (span) span.textContent = `Downloading ${images.length}...`;

        // Send all images to background for download
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.DOWNLOAD_ALL_GALLERY,
          images: images
        });

        setTimeout(() => {
          btn.classList.remove('ris-download-btn-visible--done');
          if (span) span.textContent = `Download All (${images.length})`;
        }, 3000);
      } catch (err) {
        console.error('[Reddit Image Saver] Gallery download error:', err);
        if (span) span.textContent = 'Error';
        setTimeout(() => {
          btn.classList.remove('ris-download-btn-visible--done');
          if (span) span.textContent = 'Download All';
        }, 2000);
      }
    }, true);

    return btn;
  },

  /**
   * Fetch all gallery images from Reddit's JSON API.
   * @param {string} postId
   * @returns {Promise<Array<{url: string, filename: string}>>}
   */
  async _fetchGalleryImages(postId) {
    const response = await fetch(
      `https://www.reddit.com/comments/${postId}.json`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) return [];

    const data = await response.json();
    const post = data[0]?.data?.children?.[0]?.data;
    if (!post) return [];

    const images = [];

    if (post.gallery_data && post.media_metadata) {
      const items = post.gallery_data.items || [];
      for (const item of items) {
        const mediaId = item.media_id;
        const metadata = post.media_metadata[mediaId];
        if (!metadata) continue;

        // Get the source URL from metadata
        let imageUrl = null;
        if (metadata.s) {
          const rawUrl = metadata.s.u || metadata.s.gif;
          if (rawUrl) {
            imageUrl = rawUrl.replace(/&/g, '&');
          }
        }

        // Build i.redd.it URL
        if (imageUrl) {
          const dlUrl = this._buildDownloadUrl(imageUrl);
          const ext = metadata.m ? metadata.m.split('/')[1] : 'jpg';
          const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
          images.push({
            url: dlUrl,
            filename: `${mediaId}.${normalizedExt}`
          });
        } else {
          // Fallback: construct URL from media ID
          const ext = metadata.m ? metadata.m.split('/')[1] : 'jpg';
          const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
          images.push({
            url: `https://i.redd.it/${mediaId}.${normalizedExt}`,
            filename: `${mediaId}.${normalizedExt}`
          });
        }
      }
    }

    return images;
  },

  /**
   * Check if a post container is a gallery (multiple images).
   * @param {Element} container
   * @returns {boolean}
   */
  _isGalleryPost(container) {
    // Check for gallery carousel indicators
    const post = container.closest('shreddit-post, [data-testid="post-container"], article');
    const searchArea = post || container.parentElement;
    if (!searchArea) return false;

    return !!(
      searchArea.querySelector('gallery-carousel, [data-testid="gallery-carousel"]') ||
      searchArea.querySelector('[aria-label*="gallery"], [aria-label*="Gallery"]') ||
      searchArea.querySelector('button[aria-label="Next slide"], button[aria-label="Previous slide"]') ||
      searchArea.querySelector('.gallery-nav-icon, .icon-gallery') ||
      container.querySelector('gallery-carousel')
    );
  },

  /**
   * Check if the post is a video post.
   * @param {Element} container - The media container element
   * @returns {boolean}
   */
  _isVideoPost(container) {
    // Find the parent post element
    const post = container.closest('shreddit-post, [data-testid="post-container"], article');
    const searchArea = post || container.parentElement;
    if (!searchArea) return false;

    // Check shreddit-post element attributes directly
    if (post?.tagName === 'SHREDDIT-POST') {
      const postType = post.getAttribute('post-type');
      const linkFlair = post.getAttribute('link-flair');
      const media = post.getAttribute('media');
      
      // Check for video post type or media attribute
      if (postType === 'video' ||
          postType === 'Hosted:video' ||
          postType === 'RichVideo' ||
          media === 'true' ||
          media === 'video' ||
          (linkFlair && linkFlair.toLowerCase().includes('video'))) {
        return true;
      }
    }

    // Check for video indicators
    return !!(
      // HTML5 video element
      searchArea.querySelector('video') ||
      // Reddit's video player component
      searchArea.querySelector('shreddit-player, video-player, [data-testid="video-player"]') ||
      // Video indicator in post metadata
      searchArea.querySelector('[data-testid="post-video-indicator"], .video-indicator') ||
      // Check for v.redd.it URLs in the post
      searchArea.querySelector('a[href*="v.redd.it"]') ||
      // Check for playable video in data attributes
      container.querySelector('[data-playable="true"][data-type="video"]') ||
      container.dataset?.type === 'video' ||
      container.dataset?.mediaType === 'video' ||
      // Check for video source elements
      container.querySelector('video source, [src*=".mp4"], [src*=".webm"]') ||
      // Check container's own attributes
      container.getAttribute?.('content-type') === 'video' ||
      container.getAttribute?.('slot')?.includes('video') ||
      // Check for video-related classes
      container.classList?.contains('video-container') ||
      container.classList?.contains('post-video')
    );
  },

  /**
   * Extract the post ID from a container's surrounding elements.
   * @param {Element} container
   * @returns {string|null}
   */
  _extractPostId(container) {
    // Try shreddit-post element
    const shredditPost = container.closest('shreddit-post');
    if (shredditPost) {
      const id = shredditPost.getAttribute('id');
      if (id) return id.replace('t3_', '');
      const permalink = shredditPost.getAttribute('permalink');
      if (permalink) {
        const match = permalink.match(/\/comments\/([a-zA-Z0-9]+)/);
        if (match) return match[1];
      }
    }

    // Try finding post link in parent
    const postLink = container.closest('article, [data-testid="post-container"]');
    if (postLink) {
      const link = postLink.querySelector('a[href*="/comments/"]');
      if (link) {
        const match = link.href.match(/\/comments\/([a-zA-Z0-9]+)/);
        if (match) return match[1];
      }
    }

    // Try current page URL
    const urlMatch = window.location.href.match(/\/comments\/([a-zA-Z0-9]+)/);
    if (urlMatch) return urlMatch[1];

    return null;
  },

  /**
   * Observe gallery slide changes to update the "Download This" button URL.
   * @param {Element} container
   * @param {HTMLButtonElement} dlBtn
   */
  _observeGallerySlide(container, dlBtn) {
    const observer = new MutationObserver(() => {
      const newUrl = this._findBestImageUrl(container);
      if (newUrl) {
        const downloadUrl = this._buildDownloadUrl(newUrl);
        const filename = downloadUrl.split('/').pop().split('?')[0] || 'reddit-image.jpg';
        dlBtn.dataset.downloadUrl = downloadUrl;
        dlBtn.dataset.filename = filename;
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset']
    });
  },

  /**
   * Enhance a standalone image (not inside a post media container).
   * @param {Element} img
   */
  _enhanceStandaloneImage(img) {
    if (this._enhanced.has(img)) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return;

    // Skip video thumbnails - check if this is a video-related image
    const parent = img.closest('article, .post, [data-testid="post-container"]');
    if (parent) {
      const isVideoPost = parent.querySelector('video, shreddit-player, [data-testid="video-player"], a[href*="v.redd.it"]');
      if (isVideoPost) {
        console.log('[Reddit Image Saver] Skipping video post thumbnail');
        return;
      }
    }

    this._enhanced.add(img);
    img.setAttribute('data-ris-enhanced', 'true');

    const imageUrl = img.src;
    if (!imageUrl) return;

    const downloadUrl = this._buildDownloadUrl(imageUrl);
    const filename = downloadUrl.split('/').pop().split('?')[0] || 'reddit-image.jpg';

    const btnBar = document.createElement('div');
    btnBar.className = 'ris-download-bar';

    // Dimension display
    const dimDisplay = document.createElement('span');
    dimDisplay.className = 'ris-dimensions';
    btnBar.appendChild(dimDisplay);

    btnBar.appendChild(this._createDownloadButton('Download', downloadUrl, filename));

    const target = img.closest('a') || img;
    target.parentNode.insertBefore(btnBar, target);

    // Show dimensions
    if (img.naturalWidth > 0) {
      const badge = document.createElement('span');
      badge.className = 'ris-dim-badge';
      badge.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
      dimDisplay.appendChild(badge);
    } else {
      this._getImageDimensions(downloadUrl).then(dim => {
        if (dim) {
          const badge = document.createElement('span');
          badge.className = 'ris-dim-badge';
          badge.textContent = `${dim.width}×${dim.height}`;
          dimDisplay.appendChild(badge);
        }
      });
    }
  },

  /**
   * Find the best image info (URL + element) from a post container.
   * @param {Element} container
   * @returns {{url: string|null, element: Element|null}}
   */
  _findBestImageInfo(container) {
    // Priority 1: Main post image (not background blur)
    const mainImg = container.querySelector(
      'img.preview-img, img.media-lightbox-img:not(.post-background-image-filter)'
    );
    if (mainImg?.src) return { url: mainImg.src, element: mainImg };

    // Priority 2: Any redd.it img (not background)
    const imgs = container.querySelectorAll('img[src*="redd.it"]');
    for (const img of imgs) {
      if (!img.classList.contains('post-background-image-filter') && img.src) {
        return { url: img.src, element: img };
      }
    }

    // Priority 3: Highest res from srcset
    const imgWithSrcset = container.querySelector('img[srcset]');
    if (imgWithSrcset?.srcset) {
      const parts = imgWithSrcset.srcset.split(',');
      const last = parts[parts.length - 1].trim().split(' ')[0];
      if (last) return { url: last, element: imgWithSrcset };
    }

    return { url: null, element: null };
  },

  /**
   * Find the best image URL from a post container.
   * @param {Element} container
   * @returns {string|null}
   */
  _findBestImageUrl(container) {
    return this._findBestImageInfo(container).url;
  },

  /**
   * Get image dimensions by loading it.
   * @param {string} url
   * @returns {Promise<{width: number, height: number}|null>}
   */
  async _getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  },

  /**
   * Get dimensions for all gallery images from Reddit API.
   * @param {string} postId
   * @returns {Promise<Array<{width: number, height: number}|null>>}
   */
  async _getGalleryDimensions(postId) {
    try {
      const response = await fetch(
        `https://www.reddit.com/comments/${postId}.json`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) {
        console.warn('[Reddit Image Saver] Gallery dimensions fetch failed:', response.status);
        return [];
      }

      const data = await response.json();
      const post = data[0]?.data?.children?.[0]?.data;
      if (!post?.gallery_data || !post?.media_metadata) {
        console.warn('[Reddit Image Saver] No gallery_data or media_metadata for post', postId, 'post keys:', Object.keys(post || {}));
        return [];
      }

      const items = post.gallery_data.items || [];
      const dimensions = [];
      for (const item of items) {
        const metadata = post.media_metadata[item.media_id];
        if (metadata?.s) {
          dimensions.push({ width: metadata.s.x, height: metadata.s.y });
        } else {
          dimensions.push(null);
        }
      }
      console.log('[Reddit Image Saver] Gallery dimensions for', postId, ':', dimensions);
      return dimensions;
    } catch (err) {
      console.error('[Reddit Image Saver] Gallery dimensions error:', err);
      return [];
    }
  },

  /**
   * Build the i.redd.it download URL from any Reddit image URL.
   * @param {string} imageUrl
   * @returns {string}
   */
  _buildDownloadUrl(imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.hostname === 'preview.redd.it' || parsed.hostname === 'cf.preview.redd.it') {
        return `https://i.redd.it${parsed.pathname}${parsed.search}`;
      }
    } catch {}
    return imageUrl;
  },

  /**
   * Watch for DOM changes and enhance new posts.
   */
  _observeMutations() {
    const observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.querySelector?.('[slot="post-media-container"]') ||
                  node.matches?.('[slot="post-media-container"]') ||
                  node.querySelector?.('img[src*="redd.it"]')) {
                hasNewContent = true;
                break;
              }
            }
          }
        }
        if (hasNewContent) break;
      }

      if (hasNewContent) {
        clearTimeout(this._enhanceTimeout);
        this._enhanceTimeout = setTimeout(() => this._enhanceAll(), 300);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
};
