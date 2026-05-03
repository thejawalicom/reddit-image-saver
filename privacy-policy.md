# Privacy Policy - Reddit Image Saver

**Last Updated:** May 2, 2026

## Overview

Reddit Image Saver is a browser extension that helps users view and save Reddit images in their original quality. This extension is committed to protecting your privacy.

## Data Collection

**We do not collect any data.** Specifically:

- No personal information is collected
- No browsing history is tracked
- No usage analytics are gathered
- No data is transmitted to external servers
- No cookies are set by this extension
- No user accounts are required

## How the Extension Works

Reddit Image Saver operates entirely within your browser. It:

1. Modifies HTTP request headers for Reddit image domains to bypass preview pages
2. Redirects Reddit media wrapper URLs to direct image URLs
3. Stores your extension settings locally using Chrome's built-in storage API
4. Communicates only with Reddit's servers to fetch image data and post metadata (for gallery detection)

All processing happens locally in your browser. No data leaves your device except the standard HTTP requests to Reddit's servers that your browser would make anyway.

## Permissions Explained

- **declarativeNetRequest**: Modify request headers to bypass Reddit's image preview pages
- **activeTab**: Access the current tab to detect images and inject UI elements
- **contextMenus**: Add "Save Original HD Image" to the right-click menu
- **downloads**: Download images to your computer
- **storage**: Save your extension settings locally
- **webNavigation**: Detect navigation to Reddit media pages for automatic redirection
- **Host permissions (*.redd.it, *.reddit.com)**: Required to intercept and modify requests to Reddit image servers

## Third-Party Services

This extension does not use any third-party services, analytics, or tracking tools.

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.
