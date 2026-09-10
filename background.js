/**
 * CleanMark - Background Service Worker
 * Handles context menu actions, opening Studio tabs, and passing media payloads.
 */

chrome.runtime.onInstalled.addListener(() => {
  // Context menu for images
  chrome.contextMenus.create({
    id: 'cleanmark-image',
    title: 'CleanMark: Remove Watermark from Image',
    contexts: ['image']
  });

  // Context menu for videos
  chrome.contextMenus.create({
    id: 'cleanmark-video',
    title: 'CleanMark: Remove Watermark from Video',
    contexts: ['video']
  });

  // Context menu for general page
  chrome.contextMenus.create({
    id: 'cleanmark-open-studio',
    title: 'CleanMark: Open Watermark Remover Studio',
    contexts: ['page']
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cleanmark-image' && info.srcUrl) {
    openStudioWithMedia('image', info.srcUrl);
  } else if (info.menuItemId === 'cleanmark-video' && info.srcUrl) {
    openStudioWithMedia('video', info.srcUrl);
  } else if (info.menuItemId === 'cleanmark-open-studio') {
    openStudio();
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_STUDIO') {
    if (message.mediaType && message.mediaUrl) {
      openStudioWithMedia(message.mediaType, message.mediaUrl);
    } else {
      openStudio();
    }
    sendResponse({ success: true });
  }
  return true;
});

function openStudio() {
  const url = chrome.runtime.getURL('studio/studio.html');
  chrome.tabs.create({ url });
}

function openStudioWithMedia(type, url) {
  // Store media payload in chrome.storage.local so large URLs / blob keys are safe
  const payloadKey = 'cleanmark_pending_media';
  chrome.storage.local.set({
    [payloadKey]: {
      type,
      url,
      timestamp: Date.now()
    }
  }, () => {
    const studioUrl = chrome.runtime.getURL('studio/studio.html?source=context');
    chrome.tabs.create({ url: studioUrl });
  });
}
