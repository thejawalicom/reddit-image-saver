/**
 * Reddit Image Saver - declarativeNetRequest Rules
 * Defines rules for Accept header removal, WebP prevention, and URL redirects.
 *
 * Rule ID ranges:
 *   1-10:  Accept header removal (bypass preview pages)
 *   11-20: WebP prevention (strip image/webp from Accept)
 *   21-30: URL redirect rules (media wrapper → direct image)
 */

/**
 * Accept header removal rules.
 * When Reddit sees Accept: text/html, it serves an HTML wrapper page
 * instead of the raw image. Removing the Accept header forces the
 * raw image response.
 *
 * Uses plain domain strings matching the approach from the working
 * Reddit Image Opener extension (not || prefix syntax).
 */
const ACCEPT_HEADER_RULES = [
  {
    id: 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'remove'
      }]
    },
    condition: {
      urlFilter: 'i.redd.it',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  },
  {
    id: 2,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'remove'
      }]
    },
    condition: {
      urlFilter: 'preview.redd.it',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  },
  {
    id: 3,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'remove'
      }]
    },
    condition: {
      urlFilter: 'external-preview.redd.it',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  },
  {
    id: 4,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'remove'
      }]
    },
    condition: {
      urlFilter: 'cf.preview.redd.it',
      resourceTypes: ['main_frame', 'sub_frame']
    }
  }
];

/**
 * WebP prevention rules.
 * Sets Accept header to exclude image/webp, forcing Reddit CDN
 * to serve original PNG/JPEG instead of WebP conversion.
 */
const WEBP_PREVENTION_RULES = [
  {
    id: 11,
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'set',
        value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5'
      }]
    },
    condition: {
      urlFilter: 'i.redd.it',
      resourceTypes: ['image', 'xmlhttprequest']
    }
  },
  {
    id: 12,
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'set',
        value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5'
      }]
    },
    condition: {
      urlFilter: 'preview.redd.it',
      resourceTypes: ['image', 'xmlhttprequest']
    }
  },
  {
    id: 13,
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'set',
        value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5'
      }]
    },
    condition: {
      urlFilter: 'external-preview.redd.it',
      resourceTypes: ['image', 'xmlhttprequest']
    }
  },
  {
    id: 14,
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{
        header: 'Accept',
        operation: 'set',
        value: 'image/png,image/jpeg,image/gif,image/*;q=0.8,*/*;q=0.5'
      }]
    },
    condition: {
      urlFilter: 'cf.preview.redd.it',
      resourceTypes: ['image', 'xmlhttprequest']
    }
  }
];

/** All rule IDs managed by this module */
const ALL_RULE_IDS = [
  ...ACCEPT_HEADER_RULES.map(r => r.id),
  ...WEBP_PREVENTION_RULES.map(r => r.id)
];
