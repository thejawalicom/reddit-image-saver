/**
 * Reddit Image Saver - Constants
 * Domain lists, regex patterns, and default settings.
 */

// Reddit image domains that serve images
const REDDIT_IMAGE_DOMAINS = [
  'i.redd.it',
  'preview.redd.it',
  'external-preview.redd.it',
  'cf.preview.redd.it'
];

// Reddit domains where content scripts run
const REDDIT_SITE_DOMAINS = [
  'www.reddit.com',
  'old.reddit.com',
  'new.reddit.com',
  'sh.reddit.com'
];

// Supported image extensions
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];

// URL patterns for matching
const URL_PATTERNS = {
  // Matches i.redd.it/{id}.{ext}
  ORIGINAL: /^https?:\/\/i\.redd\.it\/([a-zA-Z0-9]+)\.(\w+)$/,

  // Matches preview.redd.it/{filename}?params
  PREVIEW: /^https?:\/\/preview\.redd\.it\/([^?]+)/,

  // Matches external-preview.redd.it/{filename}?params
  EXTERNAL_PREVIEW: /^https?:\/\/external-preview\.redd\.it\/([^?]+)/,

  // Matches cf.preview.redd.it/{filename}?params
  CF_PREVIEW: /^https?:\/\/cf\.preview\.redd\.it\/([^?]+)/,

  // Matches www.reddit.com/media?url={encoded_url}
  MEDIA_WRAPPER: /^https?:\/\/www\.reddit\.com\/media\?url=(.+)/,

  // Matches Reddit gallery post URLs
  GALLERY_POST: /^https?:\/\/(?:www|old|new|sh)\.reddit\.com\/r\/[^/]+\/comments\/([a-zA-Z0-9]+)\//,

  // Extracts image ID from preview URL filename: {id}-{hash}.{ext} or {id}.{ext}
  PREVIEW_IMAGE_ID: /^([a-zA-Z0-9]+)(?:-[a-zA-Z0-9]+)?\.(\w+)/
};

// Query parameters that degrade image quality
const QUALITY_DEGRADING_PARAMS = ['width', 'height', 'format', 'auto', 'crop', 's'];

// Default extension settings
const DEFAULT_SETTINGS = {
  enabled: true,
  preferOriginal: true,
  autoRedirect: true,
  preventWebP: true,
  showHDBadge: true,
  showDownloadButton: true,
  downloadFormat: 'original', // 'original', 'png', 'jpg'
  galleryAutoDetect: true
};

// Context menu IDs
const CONTEXT_MENU_IDS = {
  SAVE_ORIGINAL: 'reddit-image-saver-save-original',
  SAVE_ALL_GALLERY: 'reddit-image-saver-save-all-gallery'
};

// Message types for communication between background and content scripts
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
