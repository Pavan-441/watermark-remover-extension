/**
 * CleanMark Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const openStudioBtn = document.getElementById('openStudioBtn');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const scanBtn = document.getElementById('scanBtn');
  const mediaGrid = document.getElementById('mediaGrid');

  // Open Studio Tab
  openStudioBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'OPEN_STUDIO' });
  });

  // Dropzone interactions
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFile(fileInput.files[0]);
    }
  });

  function handleFile(file) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please select an image or video file.');
      return;
    }

    // Convert file to DataURL or store in IndexedDB / storage for Studio
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      chrome.storage.local.set({
        cleanmark_pending_media: {
          type: isImage ? 'image' : 'video',
          url: dataUrl,
          name: file.name,
          timestamp: Date.now()
        }
      }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('studio/studio.html?source=upload') });
      });
    };
    reader.readAsDataURL(file);
  }

  // Scan current active tab for images & videos
  function scanCurrentTab() {
    mediaGrid.innerHTML = '<div class="empty-state">Scanning active tab...</div>';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        mediaGrid.innerHTML = '<div class="empty-state">No active tab found.</div>';
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
        mediaGrid.innerHTML = '<div class="empty-state">Cannot scan browser internal pages. Drop a file above!</div>';
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'SCAN_PAGE_MEDIA' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.media || response.media.length === 0) {
          mediaGrid.innerHTML = '<div class="empty-state">No media found on this page. Try dropping an image/video above.</div>';
          return;
        }

        renderMediaGrid(response.media);
      });
    });
  }

  function renderMediaGrid(items) {
    mediaGrid.innerHTML = '';
    items.slice(0, 15).forEach((item) => {
      const el = document.createElement('div');
      el.className = 'media-item';
      el.title = `Click to Clean Watermark (${item.width}x${item.height})`;

      if (item.type === 'video') {
        el.innerHTML = `
          <video src="${item.url}" muted></video>
          <span class="media-badge">VID</span>
        `;
      } else {
        el.innerHTML = `
          <img src="${item.url}" alt="media" loading="lazy">
          <span class="media-badge">${item.width}x${item.height}</span>
        `;
      }

      el.addEventListener('click', () => {
        chrome.storage.local.set({
          cleanmark_pending_media: {
            type: item.type,
            url: item.url,
            timestamp: Date.now()
          }
        }, () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('studio/studio.html?source=page') });
        });
      });

      mediaGrid.appendChild(el);
    });
  }

  scanBtn.addEventListener('click', scanCurrentTab);
  scanCurrentTab();
});
