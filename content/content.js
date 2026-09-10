/**
 * CleanMark Content Script
 * Attaches a sleek in-page remover button when hovering images/videos,
 * and allows scanning current page media for the extension popup.
 */

(function() {
  let activeElement = null;
  let hoverBtn = null;
  let hideTimeout = null;

  // Create floating button element
  function createHoverButton() {
    if (hoverBtn) return hoverBtn;

    hoverBtn = document.createElement('button');
    hoverBtn.className = 'cleanmark-hover-btn';
    hoverBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.06 3.47l-1.77-1.77 1.41-1.41 1.77 1.77-1.41 1.41z"/>
      </svg>
      <span>Clean Watermark</span>
    `;

    hoverBtn.addEventListener('mouseenter', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    });

    hoverBtn.addEventListener('mouseleave', () => {
      hideHoverButton();
    });

    hoverBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!activeElement) return;

      let type = 'image';
      let url = null;

      if (activeElement.tagName.toLowerCase() === 'img') {
        type = 'image';
        url = activeElement.currentSrc || activeElement.src;
      } else if (activeElement.tagName.toLowerCase() === 'video') {
        type = 'video';
        url = activeElement.currentSrc || activeElement.src;
        if (!url && activeElement.querySelector('source')) {
          url = activeElement.querySelector('source').src;
        }
      }

      if (url) {
        chrome.runtime.sendMessage({
          action: 'OPEN_STUDIO',
          mediaType: type,
          mediaUrl: url
        });
      }
    });

    document.body.appendChild(hoverBtn);
    return hoverBtn;
  }

  function positionButton(target) {
    const btn = createHoverButton();
    const rect = target.getBoundingClientRect();

    // Check visibility and reasonable size (ignore icons, tiny avatars)
    if (rect.width < 140 || rect.height < 140) {
      hideHoverButton();
      return;
    }

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    btn.style.top = `${scrollY + rect.top + 8}px`;
    btn.style.left = `${scrollX + rect.right - btn.offsetWidth - 8}px`;
    btn.classList.add('visible');
    activeElement = target;
  }

  function hideHoverButton() {
    if (hoverBtn) {
      hoverBtn.classList.remove('visible');
    }
    activeElement = null;
  }

  // Hover detection using event delegation
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (!target) return;

    if (target === hoverBtn || (hoverBtn && hoverBtn.contains(target))) {
      if (hideTimeout) clearTimeout(hideTimeout);
      return;
    }

    const isImage = target.tagName === 'IMG';
    const isVideo = target.tagName === 'VIDEO';

    if (isImage || isVideo) {
      if (hideTimeout) clearTimeout(hideTimeout);
      positionButton(target);
    }
  }, true);

  document.addEventListener('mouseout', (e) => {
    const target = e.target;
    if (target === activeElement) {
      hideTimeout = setTimeout(() => {
        hideHoverButton();
      }, 300);
    }
  }, true);

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
