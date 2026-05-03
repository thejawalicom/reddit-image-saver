/**
 * Reddit Image Saver - Background Service Worker (Single File)
 * 
 * All background logic consolidated into one file to avoid importScripts
 * path resolution issues in MV3 service workers.
 * 
 * IMPORTANT: In MV3, all event listeners MUST be registered synchronously
 * at the top level of the service worker.
 */

// ============================================================
// CONSTANTS (from shared/constants.js)
// ============================================================

const REDDIT_IMAGE_DOMAINS = [
  'i.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'cf.preview.redd.it'
];

const DEFAULT_SETTINGS = {
  enabled: true,
  preferOriginal: true,
  autoRedirect: true,
  preventWebP: true,
  showHDBadge: true,
  showDownloadButton: true,
  downloadFormat: 'original',
  galleryAutoDetect: true
};

const CONTEXT_MENU_IDS = {
  SAVE_ORIGINAL: 'reddit-image-saver-save-original',
  SAVE_ALL_GALLERY: 'reddit-image-saver-save-all-gallery'
};

const MESSAGE_TYPES = {
  GET_PAGE_IMAGES: 'getPageImages',
  PAGE_IMAGES_RESULT: 'pageImagesResult',
  DOWNLOAD_IMAGE: 'downloadImage',
  DOWNLOAD_ALL_GALLERY: 'downloadAllGallery',
  GET_GALLERY_IMAGES: 'getGalleryImages',
  GALLERY_IMAGES_RESULT: 'galleryImagesResult',
  GET_SETTINGS: 'getSettings',
  SETTINGS_RESULT: 'settingsResult',
  UPDATE_SETTINGS: 'updateSettings',
  TOGGLE_EXTENSION: 'toggleExtension',
  GET_IMAGE_INFO: 'getImageInfo',
  IMAGE_INFO_RESULT: 'imageInfoResult'
};

// ============================================================
// STORAGE HELPERS
// ============================================================

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...result });
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

// ============================================================
// DECLARATIVE NET REQUEST RULES
// ============================================================

const ACCEPT_HEADER_RULES = [
  {
    id: 1, priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'remove' }] },
    condition: { urlFilter: 'i.redd.it', resourceTypes: ['main_frame', 'sub_frame'] }
  },
  {
    id: 2, priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'remove' }] },
    condition: { urlFilter: 'preview.redd.it', resourceTypes: ['main_frame', 'sub_frame'] }
  },
  {
    id: 3, priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'remove' }] },
    condition: { urlFilter: 'external-preview.redd.it', resourceTypes: ['main_frame', 'sub_frame'] }
  },
  {
    id: 4, priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'remove' }] },
    condition: { urlFilter: 'cf.preview.redd.it', resourceTypes: ['main_frame', 'sub_frame'] }
  }
];

const WEBP_PREVENTION_RULES = [
  {
    id: 11, priority: 2,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'set', value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5' }] },
    condition: { urlFilter: 'i.redd.it', resourceTypes: ['image', 'xmlhttprequest'] }
  },
  {
    id: 12, priority: 2,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'set', value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5' }] },
    condition: { urlFilter: 'preview.redd.it', resourceTypes: ['image', 'xmlhttprequest'] }
  },
  {
    id: 13, priority: 2,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'set', value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5' }] },
    condition: { urlFilter: 'external-preview.redd.it', resourceTypes: ['image', 'xmlhttprequest'] }
  },
  {
    id: 14, priority: 2,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept', operation: 'set', value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5' }] },
    condition: { urlFilter: 'cf.preview.redd.it', resourceTypes: ['image', 'xmlhttprequest'] }
  }
];

const ALL_RULE_IDS = [1, 2, 3, 4, 11, 12, 13, 14];

// ============================================================
// URL HELPERS
// ============================================================

function upgradePreviewUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'preview.redd.it' && parsed.hostname !== 'cf.preview.redd.it') {
      return null;
    }
    // Replace the domain with i.redd.it but KEEP the full path AND query params.
    // The 's' query param is a signature token required by i.redd.it (403 without it).
    // preview.redd.it/filename.jpeg?width=1080&...&s=abc → i.redd.it/filename.jpeg?width=1080&...&s=abc
    // Note: i.redd.it ignores width/crop/auto params and always serves full resolution.
    return `https://i.redd.it${parsed.pathname}${parsed.search}`;
  } catch { return null; }
}

function resolveMediaWrapper(url, settings) {
  try {
    const parsed = new URL(url);
    const encodedImageUrl = parsed.searchParams.get('url');
    if (!encodedImageUrl) return null;
    let imageUrl;
    try { imageUrl = decodeURIComponent(encodedImageUrl); }
    catch { imageUrl = encodedImageUrl; }
    if (settings.preferOriginal) {
      const upgraded = upgradePreviewUrl(imageUrl);
      if (upgraded) return upgraded;
    }
    return imageUrl;
  } catch { return null; }
}

function getBestDownloadUrl(url) {
  // Step 1: Handle media wrapper
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.reddit.com' && parsed.pathname === '/media') {
      const encodedUrl = parsed.searchParams.get('url');
      if (encodedUrl) url = decodeURIComponent(encodedUrl);
    }
  } catch {}
  // Step 2: Upgrade preview to original
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'preview.redd.it' || parsed.hostname === 'cf.preview.redd.it') {
      const upgraded = upgradePreviewUrl(url);
      if (upgraded) return upgraded;
    }
    if (parsed.hostname === 'i.redd.it') {
      return parsed.origin + parsed.pathname;
    }
  } catch {}
  return url;
}

function getFilenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').pop();
    if (filename && filename.includes('.')) return filename;
  } catch {}
  return 'reddit-image.jpg';
}

// ============================================================
// DOWNLOAD MANAGER
// ============================================================

/**
 * Download a single image. The URL should already be the correct i.redd.it
 * URL with query params (content script handles the transformation).
 */
async function downloadImage(url, filename) {
  // If the URL is still a preview URL, do the simple domain swap here too
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'preview.redd.it' || parsed.hostname === 'cf.preview.redd.it') {
      url = `https://i.redd.it${parsed.pathname}${parsed.search}`;
    }
  } catch {}

  const downloadFilename = filename || getFilenameFromUrl(url);
  console.log('[Reddit Image Saver] Downloading:', url, 'as', downloadFilename);

  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename: downloadFilename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Reddit Image Saver] Download error:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

async function downloadAll(images) {
  const results = [];
  for (const img of images) {
    try {
      if (results.length > 0) await new Promise(r => setTimeout(r, 500));
      const id = await downloadImage(img.url, img.filename);
      results.push(id);
    } catch (err) {
      console.error('[Reddit Image Saver] Download failed:', img.url, err);
    }
  }
  return results;
}

// ============================================================
// APPLY RULES
// ============================================================

async function applyRules(settings) {
  const rulesToAdd = [];
  if (settings.enabled) {
    rulesToAdd.push(...ACCEPT_HEADER_RULES);
    if (settings.preventWebP) rulesToAdd.push(...WEBP_PREVENTION_RULES);
  }
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ALL_RULE_IDS,
      addRules: rulesToAdd
    });
    console.log('[Reddit Image Saver] Rules applied:', rulesToAdd.length);
  } catch (err) {
    console.error('[Reddit Image Saver] Failed to apply rules:', err);
  }
}

// ============================================================
// EVENT LISTENERS (all registered at top level for MV3)
// ============================================================

// 1. Install/Update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Reddit Image Saver] Installed:', details.reason);
  const settings = await getSettings();
  await applyRules(settings);
  // Context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SAVE_ORIGINAL,
      title: 'Save Original HD Image',
      contexts: ['image'],
      documentUrlPatterns: [
        '*://www.reddit.com/*', '*://old.reddit.com/*',
        '*://new.reddit.com/*', '*://sh.reddit.com/*',
        '*://i.redd.it/*', '*://preview.redd.it/*',
        '*://external-preview.redd.it/*', '*://cf.preview.redd.it/*'
      ]
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.SAVE_ALL_GALLERY,
      title: 'Save All Gallery Images (HD)',
      contexts: ['page'],
      documentUrlPatterns: [
        '*://www.reddit.com/r/*/comments/*', '*://old.reddit.com/r/*/comments/*',
        '*://new.reddit.com/r/*/comments/*', '*://sh.reddit.com/r/*/comments/*'
      ]
    });
  });
});

// 2. Startup
chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await applyRules(settings);
});

// 3. Web Navigation - redirect media wrappers and upgrade previews
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.frameId !== 0) return;
    let settings;
    try { settings = await getSettings(); } catch { return; }
    if (!settings.enabled || !settings.autoRedirect) return;

    const url = details.url;
    let redirectUrl = null;

    if (url.includes('www.reddit.com/media')) {
      redirectUrl = resolveMediaWrapper(url, settings);
    } else if (settings.preferOriginal) {
      redirectUrl = upgradePreviewUrl(url);
    }

    if (redirectUrl && redirectUrl !== url) {
      console.log('[Reddit Image Saver] Redirecting:', url, '→', redirectUrl);
      try { await chrome.tabs.update(details.tabId, { url: redirectUrl }); }
      catch (err) { console.error('[Reddit Image Saver] Redirect failed:', err); }
    }
  },
  { url: [
    { hostEquals: 'www.reddit.com', pathPrefix: '/media' },
    { hostEquals: 'preview.redd.it' },
    { hostEquals: 'cf.preview.redd.it' }
  ]}
);

// 4. Context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_IDS.SAVE_ORIGINAL && info.srcUrl) {
    try { await downloadImage(info.srcUrl); }
    catch (err) { console.error('[Reddit Image Saver] Context menu download failed:', err); }
  } else if (info.menuItemId === CONTEXT_MENU_IDS.SAVE_ALL_GALLERY) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_GALLERY_IMAGES });
      if (response?.images?.length > 0) await downloadAll(response.images);
    } catch (err) { console.error('[Reddit Image Saver] Gallery download failed:', err); }
  }
});

// 5. Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case MESSAGE_TYPES.DOWNLOAD_IMAGE:
          const dlId = await downloadImage(message.url, message.filename);
          sendResponse({ success: true, downloadId: dlId });
          break;
        case MESSAGE_TYPES.DOWNLOAD_ALL_GALLERY:
          const dlIds = await downloadAll(message.images);
          sendResponse({ success: true, downloadIds: dlIds });
          break;
        case MESSAGE_TYPES.GET_SETTINGS:
          sendResponse({ success: true, settings: await getSettings() });
          break;
        case MESSAGE_TYPES.UPDATE_SETTINGS:
          await saveSettings(message.settings);
          const updated = await getSettings();
          await applyRules(updated);
          sendResponse({ success: true, settings: updated });
          break;
        case MESSAGE_TYPES.TOGGLE_EXTENSION:
          const cur = await getSettings();
          const newEnabled = !cur.enabled;
          await saveSettings({ enabled: newEnabled });
          await applyRules(await getSettings());
          sendResponse({ success: true, enabled: newEnabled });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err) {
      console.error('[Reddit Image Saver] Message error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});

// 6. Settings change listener
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    getSettings().then(s => applyRules(s));
  }
});

console.log('[Reddit Image Saver] Service worker loaded successfully');
