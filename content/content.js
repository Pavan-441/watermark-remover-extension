/**
 * CleanMark Content Script
 * Silent page scanner for Extension Popup.
 * Zero DOM mutation, zero hover overlays, zero styles injected.
 */

(function() {
  // Handle messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCAN_PAGE_MEDIA') {
      const mediaList = [];
      const seen = new Set();

      // Collect images
      document.querySelectorAll('img').forEach((img) => {
        const src = img.currentSrc || img.src;
        if (src && !seen.has(src) && img.naturalWidth > 120 && img.naturalHeight > 120) {
          seen.add(src);
          mediaList.push({
            type: 'image',
            url: src,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        }
      });

      // Collect videos
      document.querySelectorAll('video').forEach((vid) => {
        let src = vid.currentSrc || vid.src;
        if (!src && vid.querySelector('source')) {
          src = vid.querySelector('source').src;
        }
        if (src && !seen.has(src)) {
          seen.add(src);
          mediaList.push({
            type: 'video',
            url: src,
            width: vid.videoWidth || 640,
            height: vid.videoHeight || 360
          });
        }
      });

      sendResponse({ media: mediaList });
    }
    return true;
  });
})();
