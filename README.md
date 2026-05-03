# Reddit Image Saver

A Chrome extension that saves Reddit images in their original format and full resolution. Bypasses Reddit's preview pages, stops WebP conversion, and automatically upgrades to HD originals.

## The Problem

Reddit compresses and downgrades images uploaded by users:
- **HTML wrapper pages** (`reddit.com/media?url=...`) instead of raw images
- **WebP conversion** and resolution caps on `preview.redd.it` URLs
- **No easy way** to download the original HD image the OP uploaded

This is especially painful for editing subreddits where people need the original quality photo.

## Features

### Core
- **Accept header bypass** — Removes the Accept header for all Reddit image domains (`i.redd.it`, `preview.redd.it`, `external-preview.redd.it`, `cf.preview.redd.it`) so images load directly instead of HTML wrapper pages
- **Media page redirect** — Automatically redirects `reddit.com/media?url=X` to the direct image URL
- **Preview → Original upgrade** — Upgrades `preview.redd.it` URLs to original `i.redd.it` URLs
- **WebP prevention** — Strips `image/webp` from Accept headers, forcing Reddit to serve original PNG/JPEG

### Download
- **Context menu** — Right-click any Reddit image → "Save Original HD Image"
- **Download button overlay** — Hover over any Reddit image to see a download button
- **Gallery batch download** — Download all images from gallery posts at once
- **Original filenames** — Downloads use the original filename from the URL

### UI Enhancements
- **HD badge** — Shows an "HD" indicator on images where original quality is available
- **Popup dashboard** — View image count, gallery status, and quick settings
- **Full options page** — Configure all features with detailed descriptions

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)
1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `reddit-image-saver` folder
6. The extension icon should appear in your toolbar

## How It Works

### URL Transformation
```
preview.redd.it/{id}-{hash}.jpg?width=960  →  i.redd.it/{id}.jpg
www.reddit.com/media?url={encoded_url}      →  {decoded_url} (direct image)
```

### Technical Approach
- **Manifest V3** with `declarativeNetRequest` for performant header/URL rules
- **Background service worker** handles rules, redirects, downloads, and context menus
- **Content script** injects download buttons, HD badges, and gallery detection
- **Zero dependencies** — pure vanilla JS, no build step, no data collection

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Prefer Original | ✅ On | Upgrade preview URLs to i.redd.it originals |
| Auto-Redirect | ✅ On | Redirect media wrapper pages automatically |
| Prevent WebP | ✅ On | Force original PNG/JPEG over WebP |
| Show HD Badges | ✅ On | Display HD indicator on upgradeable images |
| Show Download Buttons | ✅ On | Overlay download button on hover |
| Gallery Auto-Detect | ✅ On | Detect gallery posts for batch download |

## Supported Reddit Domains

- `i.redd.it` — Original images
- `preview.redd.it` — Preview/compressed images
- `external-preview.redd.it` — External image previews
- `cf.preview.redd.it` — Cloudflare CDN previews
- `www.reddit.com/media` — Media wrapper pages

## Project Structure

```
reddit-image-saver/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   ├── service-worker.js      # Main background script
│   ├── rules.js               # declarativeNetRequest rules
│   ├── redirect-engine.js     # URL transformation logic
│   ├── download-manager.js    # Download handling
│   └── context-menu.js        # Right-click menu
├── content/
│   ├── content.js             # Main content script
│   ├── gallery-detector.js    # Gallery post detection
│   ├── image-enhancer.js      # HD badges, download buttons
│   └── content.css            # Injected UI styles
├── popup/
│   ├── popup.html             # Extension popup
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── options/
│   ├── options.html           # Full settings page
│   ├── options.js             # Options logic
│   └── options.css            # Options styles
├── shared/
│   ├── constants.js           # Domain lists, patterns
│   ├── url-utils.js           # URL parsing utilities
│   └── storage.js             # Chrome storage wrapper
├── icons/                     # Extension icons
├── privacy-policy.md          # Privacy policy
└── README.md                  # This file
```

## Privacy

This extension does not collect any user data. All processing happens locally in your browser. See [privacy-policy.md](privacy-policy.md) for details.

## License

MIT

## Acknowledgments

Inspired by existing extensions:
- [Reddit Image Opener](https://github.com/denarnold/Reddit-Image-Opener)
- [View Reddit Images Directly](https://chromewebstore.google.com/detail/view-reddit-images-direct/ifcbbmfoblmmckaacfoeillbkchclfpe)
- [Display Reddit Images Natively](https://chromewebstore.google.com/detail/display-reddit-images-nat/imiakeaigofbcfdjajmgjfnohjlekndg)
