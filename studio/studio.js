/**
 * CleanMark Studio Application Logic
 * Full-featured workstation for high-resolution watermark removal from images and videos.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const emptyPrompt = document.getElementById('emptyPrompt');
  const promptUploadBtn = document.getElementById('promptUploadBtn');
  const uploadNewBtn = document.getElementById('uploadNewBtn');
  const mediaUploadInput = document.getElementById('mediaUploadInput');
  const geminiQuickBtn = document.getElementById('geminiQuickBtn');
  const compareToggleBtn = document.getElementById('compareToggleBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  const fileInfoBar = document.getElementById('fileInfoBar');
  const fileTypeBadge = document.getElementById('fileTypeBadge');
  const fileResolution = document.getElementById('fileResolution');
  const fileQualityBadge = document.getElementById('fileQualityBadge');

  const viewport = document.getElementById('viewport');
  const canvasWrapper = document.getElementById('canvasWrapper');
  const baseCanvas = document.getElementById('baseCanvas');
  const cleanCanvas = document.getElementById('cleanCanvas');
  const maskCanvas = document.getElementById('maskCanvas');
  const overlayCanvas = document.getElementById('overlayCanvas');
  const compareSplitBar = document.getElementById('compareSplitBar');

  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  const cleanCtx = cleanCanvas.getContext('2d', { willReadFrequently: true });
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const overlayCtx = overlayCanvas.getContext('2d');

  const toolGemini = document.getElementById('toolGemini');
  const toolBox = document.getElementById('toolBox');
  const toolBrush = document.getElementById('toolBrush');
  const toolEraser = document.getElementById('toolEraser');
  const brushSizeGroup = document.getElementById('brushSizeGroup');
  const brushSizeInput = document.getElementById('brushSizeInput');
  const brushSizeVal = document.getElementById('brushSizeVal');
  const toggleMaskVisibilityBtn = document.getElementById('toggleMaskVisibilityBtn');
  const maskVisibilityLabel = document.getElementById('maskVisibilityLabel');
  const clearMaskBtn = document.getElementById('clearMaskBtn');

  const presetSelect = document.getElementById('presetSelect');
  const badgeSizeInput = document.getElementById('badgeSizeInput');
  const badgeSizeVal = document.getElementById('badgeSizeVal');
  const featherInput = document.getElementById('featherInput');
  const featherVal = document.getElementById('featherVal');
  const algoSelect = document.getElementById('algoSelect');
  const processImageBtn = document.getElementById('processImageBtn');

  // Video elements & Bottom Deck
  const sourceVideo = document.getElementById('sourceVideo');
  const videoSidebarSection = document.getElementById('videoSidebarSection');
  const studioBottomDeck = document.getElementById('studioBottomDeck');
  const deckPlaybackSection = document.getElementById('deckPlaybackSection');
  const deckTimelineSection = document.getElementById('deckTimelineSection');
  const videoTimeline = document.getElementById('videoTimeline');
  const videoTimeDisplay = document.getElementById('videoTimeDisplay');
  const vPlayPauseBtn = document.getElementById('vPlayPauseBtn');
  const vPlayIcon = document.getElementById('vPlayIcon');
  const vPauseIcon = document.getElementById('vPauseIcon');
  const vPrevFrameBtn = document.getElementById('vPrevFrameBtn');
  const vNextFrameBtn = document.getElementById('vNextFrameBtn');
  const exportVideoBtn = document.getElementById('exportVideoBtn');
  const videoBitrateSelect = document.getElementById('videoBitrateSelect');

  // Zoom controls
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const zoomLabel = document.getElementById('zoomLabel');

  // Modal
  const progressModal = document.getElementById('progressModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressDetails = document.getElementById('progressDetails');
  const cancelProcessBtn = document.getElementById('cancelProcessBtn');

  // Engines
  const inpaintingEngine = new InpaintingEngine();
  let videoProcessor = null;

  // State
  let mediaType = null; // 'image' | 'video'
  let currentFileName = 'media';
  let nativeWidth = 0;
  let nativeHeight = 0;
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0, startPanY = 0;

  let currentTool = 'gemini';
  let isDrawing = false;
  let boxStartX = 0, boxStartY = 0;
  let activeWatermarkBounds = null;
  let hasCleanResult = false;
  let isMaskVisible = true;

  let isComparing = false;
  let compareSplitRatio = 0.5;
  let isDraggingSplit = false;

  let currentImageElement = null;

  // Check initial pending media
  checkPendingMedia();

  function checkPendingMedia() {
    chrome.storage.local.get(['cleanmark_pending_media'], (res) => {
      if (res && res.cleanmark_pending_media) {
        const item = res.cleanmark_pending_media;
        chrome.storage.local.remove(['cleanmark_pending_media']);
        loadMediaFromUrl(item.type, item.url, item.name || 'web_media');
      }
    });
  }

  // Upload Event Listeners
  promptUploadBtn.addEventListener('click', () => mediaUploadInput.click());
  uploadNewBtn.addEventListener('click', () => mediaUploadInput.click());
  emptyPrompt.addEventListener('click', (e) => {
    if (e.target !== promptUploadBtn) mediaUploadInput.click();
  });

  mediaUploadInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      loadMediaFromFile(e.target.files[0]);
    }
  });

  // Viewport Drag and Drop
  viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
    viewport.style.borderColor = 'var(--primary)';
  });
  viewport.addEventListener('dragleave', () => {
    viewport.style.borderColor = '';
  });
  viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    viewport.style.borderColor = '';
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      loadMediaFromFile(e.dataTransfer.files[0]);
    }
  });

  function loadMediaFromFile(file) {
    const isVid = file.type.startsWith('video/');
    const isImg = file.type.startsWith('image/');

    if (!isVid && !isImg) {
      alert('Unsupported file format. Please choose an image or video.');
      return;
    }

    const url = URL.createObjectURL(file);
    loadMediaFromUrl(isVid ? 'video' : 'image', url, file.name, file);
  }

  function loadMediaFromUrl(type, url, name, fileObject = null) {
    mediaType = type;
    currentFileName = name || 'media';
    hasCleanResult = false;
    activeWatermarkBounds = null;
    isComparing = false;
    compareSplitBar.style.display = 'none';

    if (type === 'image') {
      videoSidebarSection.style.display = 'none';
      deckPlaybackSection.style.display = 'none';
      deckTimelineSection.style.display = 'none';
      sourceVideo.pause();

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        currentImageElement = img;
        nativeWidth = img.naturalWidth;
        nativeHeight = img.naturalHeight;
        setupCanvases(nativeWidth, nativeHeight);
        baseCtx.drawImage(img, 0, 0);
        cleanCtx.drawImage(img, 0, 0); // Initially copy to cleanCanvas so nothing is blank

        updateHeaderInfo('IMAGE', nativeWidth, nativeHeight);
        showWorkspace();
        autoDetectAndSetWatermark();
      };
      img.src = url;
    } else if (type === 'video') {
      videoSidebarSection.style.display = 'block';
      deckPlaybackSection.style.display = 'flex';
      deckTimelineSection.style.display = 'flex';

      sourceVideo.src = url;
      sourceVideo.onloadedmetadata = () => {
        nativeWidth = sourceVideo.videoWidth;
        nativeHeight = sourceVideo.videoHeight;
        setupCanvases(nativeWidth, nativeHeight);

        videoProcessor = new VideoWatermarkProcessor(sourceVideo, inpaintingEngine);
        videoProcessor.setSource(fileObject || url);
        videoTimeline.max = sourceVideo.duration;

        updateHeaderInfo('VIDEO', nativeWidth, nativeHeight);
        showWorkspace();

        sourceVideo.currentTime = 0;
      };

      sourceVideo.onseeked = () => {
        baseCtx.drawImage(sourceVideo, 0, 0, nativeWidth, nativeHeight);
        updateVideoTimeDisplay();
        if (activeWatermarkBounds) {
          previewVideoFrameClean();
        }
      };

      sourceVideo.ontimeupdate = () => {
        videoTimeline.value = sourceVideo.currentTime;
        updateVideoTimeDisplay();
        baseCtx.drawImage(sourceVideo, 0, 0, nativeWidth, nativeHeight);
        if (activeWatermarkBounds) {
          previewVideoFrameClean();
        }
      };

      // When first frame is loaded, auto detect
      sourceVideo.onloadeddata = () => {
        baseCtx.drawImage(sourceVideo, 0, 0, nativeWidth, nativeHeight);
        cleanCtx.drawImage(sourceVideo, 0, 0, nativeWidth, nativeHeight);
        autoDetectAndSetWatermark();
      };
    }
  }

  function updateHeaderInfo(type, w, h) {
    fileInfoBar.style.display = 'flex';
    fileTypeBadge.textContent = type;
    let resLabel = `${w} × ${h}`;
    if (w >= 3840 || h >= 3840) resLabel += ' (4K UHD)';
    else if (w >= 1920 || h >= 1080) resLabel += ' (1080p FHD)';
    else if (h > w) resLabel += ' (Portrait)';
    fileResolution.textContent = resLabel;
    fileQualityBadge.textContent = '100% Native Quality';
  }

  function showWorkspace() {
    emptyPrompt.style.display = 'none';
    canvasWrapper.style.display = 'block';
    studioBottomDeck.style.display = 'flex';
    fitToScreen();
  }

  function setupCanvases(w, h) {
    const list = [baseCanvas, cleanCanvas, maskCanvas, overlayCanvas];
    list.forEach(c => {
      c.width = w;
      c.height = h;
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.position = 'absolute';
      c.style.top = '0';
      c.style.left = '0';
    });

    clearCanvas(cleanCtx);
    clearCanvas(maskCtx);
    clearCanvas(overlayCtx);
  }

  function clearCanvas(ctx) {
    ctx.clearRect(0, 0, nativeWidth, nativeHeight);
  }

  // Exact Layout Scaling (Guarantees zero cropping on any image or video!)
  function updateTransform() {
    const displayW = Math.round(nativeWidth * zoom);
    const displayH = Math.round(nativeHeight * zoom);

    canvasWrapper.style.width = `${displayW}px`;
    canvasWrapper.style.height = `${displayH}px`;
    canvasWrapper.style.transform = `translate(${panX}px, ${panY}px)`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitToScreen() {
    const pad = 48;
    const vw = viewport.clientWidth - pad;
    const vh = viewport.clientHeight - pad;
    const scaleX = vw / nativeWidth;
    const scaleY = vh / nativeHeight;
    zoom = Math.min(scaleX, scaleY, 1.0); // Exact fit: 100% of media is visible!
    panX = 0;
    panY = 0;
    updateTransform();
  }

  zoomInBtn.addEventListener('click', () => {
    zoom = Math.min(6.0, zoom * 1.25);
    updateTransform();
  });

  zoomOutBtn.addEventListener('click', () => {
    zoom = Math.max(0.05, zoom / 1.25);
    updateTransform();
  });

  zoomFitBtn.addEventListener('click', fitToScreen);

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoom = Math.max(0.05, Math.min(6.0, zoom * factor));
    updateTransform();
  }, { passive: false });

  // Panning
  let isSpacePressed = false;
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
      isSpacePressed = true;
      viewport.style.cursor = 'grab';
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      viewport.style.cursor = 'default';
    }
  });

  viewport.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      isPanning = true;
      startPanX = e.clientX - panX;
      startPanY = e.clientY - panY;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panX = e.clientX - startPanX;
      panY = e.clientY - startPanY;
      updateTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      viewport.style.cursor = isSpacePressed ? 'grab' : 'default';
    }
  });

  // Tool Switching
  function setActiveTool(tool) {
    currentTool = tool;
    [toolGemini, toolBox, toolBrush, toolEraser].forEach(b => b.classList.remove('active'));
    brushSizeGroup.style.display = (tool === 'brush' || tool === 'eraser') ? 'block' : 'none';

    if (tool === 'gemini') {
      toolGemini.classList.add('active');
      presetSelect.value = 'gemini-auto';
      autoDetectAndSetWatermark();
    } else if (tool === 'box') {
      toolBox.classList.add('active');
      presetSelect.value = 'custom';
    } else if (tool === 'brush') {
      toolBrush.classList.add('active');
      presetSelect.value = 'custom';
    } else if (tool === 'eraser') {
      toolEraser.classList.add('active');
    }
  }

  toolGemini.addEventListener('click', () => setActiveTool('gemini'));
  toolBox.addEventListener('click', () => setActiveTool('box'));
  toolBrush.addEventListener('click', () => setActiveTool('brush'));
  toolEraser.addEventListener('click', () => setActiveTool('eraser'));

  brushSizeInput.addEventListener('input', () => {
    brushSizeVal.textContent = `${brushSizeInput.value}px`;
  });

  badgeSizeInput.addEventListener('input', () => {
    badgeSizeVal.textContent = `${badgeSizeInput.value}px`;
    if (activeWatermarkBounds) {
      const sz = parseInt(badgeSizeInput.value, 10);
      const cx = activeWatermarkBounds.x + activeWatermarkBounds.w / 2;
      const cy = activeWatermarkBounds.y + activeWatermarkBounds.h / 2;
      setMaskBox(Math.round(cx - sz / 2), Math.round(cy - sz / 2), sz, sz);
    }
  });

  featherInput.addEventListener('input', () => {
    featherVal.textContent = `${featherInput.value}px`;
    if (activeWatermarkBounds && mediaType === 'video') {
      previewVideoFrameClean();
    }
  });

  // Mask Visibility Toggle
  toggleMaskVisibilityBtn.addEventListener('click', () => {
    isMaskVisible = !isMaskVisible;
    if (isMaskVisible) {
      maskCanvas.classList.remove('hidden');
      overlayCanvas.style.display = 'block';
      maskVisibilityLabel.textContent = 'Hide Mask (See Clean)';
    } else {
      maskCanvas.classList.add('hidden');
      overlayCanvas.style.display = 'none';
      maskVisibilityLabel.textContent = 'Show Mask Selection';
    }
  });

  clearMaskBtn.addEventListener('click', () => {
    clearCanvas(maskCtx);
    clearCanvas(overlayCtx);
    activeWatermarkBounds = null;
    clearCanvas(cleanCtx);
    if (mediaType === 'image' && currentImageElement) {
      cleanCtx.drawImage(currentImageElement, 0, 0);
    }
    hasCleanResult = false;
    downloadBtn.disabled = true;
  });

  // Intelligent Watermark Detection & Presets
  function autoDetectAndSetWatermark() {
    if (!nativeWidth || !nativeHeight) return;

    const frameData = baseCtx.getImageData(0, 0, nativeWidth, nativeHeight);
    const detected = inpaintingEngine.detectGeminiSparkle(frameData.data, nativeWidth, nativeHeight);

    let bounds;
    if (detected.detected) {
      bounds = detected;
    } else {
      bounds = inpaintingEngine.getGeminiPresetBounds(nativeWidth, nativeHeight, 'auto');
    }

    badgeSizeInput.value = bounds.w;
    badgeSizeVal.textContent = `${bounds.w}px`;
    setMaskBox(bounds.x, bounds.y, bounds.w, bounds.h);

    if (mediaType === 'video') {
      previewVideoFrameClean();
    }
  }

  function setMaskBox(x, y, w, h) {
    clearCanvas(maskCtx);
    clearCanvas(overlayCtx);

    const clampedX = Math.max(0, Math.min(nativeWidth - w, x));
    const clampedY = Math.max(0, Math.min(nativeHeight - h, y));

    activeWatermarkBounds = { x: clampedX, y: clampedY, w, h };

    // Fill mask in maskCanvas with semi-transparent red
    maskCtx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    maskCtx.fillRect(clampedX, clampedY, w, h);

    // Draw clean bounding box outline on overlayCanvas
    overlayCtx.strokeStyle = '#38bdf8';
    overlayCtx.lineWidth = Math.max(2, Math.round(Math.max(nativeWidth, nativeHeight) / 500));
    overlayCtx.strokeRect(clampedX, clampedY, w, h);

    // Corner handles
    const handleSize = overlayCtx.lineWidth * 3;
    overlayCtx.fillStyle = '#ffffff';
    overlayCtx.fillRect(clampedX - handleSize/2, clampedY - handleSize/2, handleSize, handleSize);
    overlayCtx.fillRect(clampedX + w - handleSize/2, clampedY - handleSize/2, handleSize, handleSize);
    overlayCtx.fillRect(clampedX - handleSize/2, clampedY + h - handleSize/2, handleSize, handleSize);
    overlayCtx.fillRect(clampedX + w - handleSize/2, clampedY + h - handleSize/2, handleSize, handleSize);

    downloadBtn.disabled = false;

    if (mediaType === 'video') {
      previewVideoFrameClean();
    }
  }

  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (!nativeWidth || !nativeHeight) return;

    if (val === 'gemini-auto') {
      autoDetectAndSetWatermark();
    } else if (val === 'gemini-vertical') {
      const b = inpaintingEngine.getGeminiPresetBounds(nativeWidth, nativeHeight, 'vertical');
      badgeSizeInput.value = b.w;
      badgeSizeVal.textContent = `${b.w}px`;
      setMaskBox(b.x, b.y, b.w, b.h);
    } else if (val === 'gemini-corner') {
      const b = inpaintingEngine.getGeminiPresetBounds(nativeWidth, nativeHeight, 'corner');
      badgeSizeInput.value = b.w;
      badgeSizeVal.textContent = `${b.w}px`;
      setMaskBox(b.x, b.y, b.w, b.h);
    } else if (val === 'bottom-right') {
      const sz = parseInt(badgeSizeInput.value, 10);
      setMaskBox(nativeWidth - sz - 20, nativeHeight - sz - 20, sz, sz);
    } else if (val === 'bottom-left') {
      const sz = parseInt(badgeSizeInput.value, 10);
      setMaskBox(20, nativeHeight - sz - 20, sz, sz);
    } else if (val === 'top-right') {
      const sz = parseInt(badgeSizeInput.value, 10);
      setMaskBox(nativeWidth - sz - 20, 20, sz, sz);
    } else if (val === 'top-left') {
      const sz = parseInt(badgeSizeInput.value, 10);
      setMaskBox(20, 20, sz, sz);
    }
  });

  // Pixel-accurate mouse coordinates mapping
  function getCanvasCoords(e) {
    const rect = canvasWrapper.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(nativeWidth, Math.round(relX * nativeWidth))),
      y: Math.max(0, Math.min(nativeHeight, Math.round(relY * nativeHeight)))
    };
  }

  // Interactive Drawing & Box Selection
  overlayCanvas.addEventListener('mousedown', (e) => {
    if (isPanning || isSpacePressed) return;
    isDrawing = true;
    const coords = getCanvasCoords(e);

    if (currentTool === 'box') {
      boxStartX = coords.x;
      boxStartY = coords.y;
    } else if (currentTool === 'brush') {
      drawBrushStroke(coords.x, coords.y);
    } else if (currentTool === 'eraser') {
      drawEraserStroke(coords.x, coords.y);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);

    if (currentTool === 'box') {
      clearCanvas(overlayCtx);
      const bx = Math.min(boxStartX, coords.x);
      const by = Math.min(boxStartY, coords.y);
      const bw = Math.abs(coords.x - boxStartX);
      const bh = Math.abs(coords.y - boxStartY);

      overlayCtx.strokeStyle = '#38bdf8';
      overlayCtx.lineWidth = 2;
      overlayCtx.strokeRect(bx, by, bw, bh);
      overlayCtx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      overlayCtx.fillRect(bx, by, bw, bh);
    } else if (currentTool === 'brush') {
      drawBrushStroke(coords.x, coords.y);
    } else if (currentTool === 'eraser') {
      drawEraserStroke(coords.x, coords.y);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const coords = getCanvasCoords(e);

    if (currentTool === 'box') {
      clearCanvas(overlayCtx);
      const bx = Math.min(boxStartX, coords.x);
      const by = Math.min(boxStartY, coords.y);
      const bw = Math.abs(coords.x - boxStartX);
      const bh = Math.abs(coords.y - boxStartY);

      if (bw > 6 && bh > 6) {
        setMaskBox(bx, by, bw, bh);
      }
    }
  });

  function drawBrushStroke(x, y) {
    const radius = parseInt(brushSizeInput.value, 10);
    maskCtx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    activeWatermarkBounds = null;
    downloadBtn.disabled = false;
  }

  function drawEraserStroke(x, y) {
    const radius = parseInt(brushSizeInput.value, 10);
    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.restore();
  }

  // 1-Click Gemini Watermark Removal
  geminiQuickBtn.addEventListener('click', () => {
    if (!nativeWidth) {
      alert('Please open an image or video first.');
      return;
    }
    setActiveTool('gemini');
    autoDetectAndSetWatermark();
    if (mediaType === 'image') {
      processWatermarkRemoval();
    } else {
      previewVideoFrameClean();
      exportCleanVideo();
    }
  });

  processImageBtn.addEventListener('click', processWatermarkRemoval);

  // Image Inpainting Processing
  function processWatermarkRemoval() {
    if (!nativeWidth || !nativeHeight) return;

    showModal('Erasing Watermark...', 'Synthesizing seamless background with zero quality loss...');

    setTimeout(() => {
      try {
        const mode = algoSelect.value;
        const feather = parseInt(featherInput.value, 10);

        const baseImgData = baseCtx.getImageData(0, 0, nativeWidth, nativeHeight);
        const maskImgData = maskCtx.getImageData(0, 0, nativeWidth, nativeHeight);
        let maskData = new Uint8Array(nativeWidth * nativeHeight);

        let hasAnyMask = false;
        for (let i = 0; i < maskData.length; i++) {
          if (maskImgData.data[i * 4 + 3] > 20) {
            maskData[i] = 255;
            hasAnyMask = true;
          }
        }

        if (!hasAnyMask && activeWatermarkBounds) {
          const { x, y, w, h } = activeWatermarkBounds;
          for (let row = y; row < y + h; row++) {
            if (row >= nativeHeight) continue;
            const rOff = row * nativeWidth;
            for (let col = x; col < x + w; col++) {
              if (col >= nativeWidth) continue;
              maskData[rOff + col] = 255;
            }
          }
        }

        if (feather > 0) {
          maskData = inpaintingEngine.dilateMask(maskData, nativeWidth, nativeHeight, feather);
        }

        const cleanedPixels = inpaintingEngine.inpaintFastBoundingBox(
          baseImgData.data,
          maskData,
          nativeWidth,
          nativeHeight,
          mode,
          32
        );

        const outputImageData = new ImageData(cleanedPixels, nativeWidth, nativeHeight);
        cleanCtx.putImageData(outputImageData, 0, 0);

        // Hide mask automatically so user immediately sees the crystal-clear cleaned result!
        isMaskVisible = false;
        maskCanvas.classList.add('hidden');
        overlayCanvas.style.display = 'none';
        maskVisibilityLabel.textContent = 'Show Mask Selection';

        hasCleanResult = true;
        downloadBtn.disabled = false;
        compareToggleBtn.style.display = 'inline-flex';

        hideModal();
      } catch (err) {
        console.error('Inpainting error:', err);
        hideModal();
        alert('An error occurred during inpainting: ' + err.message);
      }
    }, 50);
  }

  // Before / After Split Slider
  compareToggleBtn.addEventListener('click', () => {
    isComparing = !isComparing;
    compareSplitBar.style.display = isComparing ? 'block' : 'none';
    if (isComparing) {
      compareSplitRatio = 0.5;
      updateSplitView();
    } else {
      cleanCanvas.style.clipPath = '';
    }
  });

  function updateSplitView() {
    if (!isComparing) return;
    const splitPixel = nativeWidth * compareSplitRatio;
    compareSplitBar.style.left = `${Math.round(splitPixel * zoom)}px`;
    cleanCanvas.style.clipPath = `polygon(0 0, ${splitPixel}px 0, ${splitPixel}px 100%, 0 100%)`;
  }

  compareSplitBar.addEventListener('mousedown', (e) => {
    isDraggingSplit = true;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingSplit) return;
    const coords = getCanvasCoords(e);
    compareSplitRatio = Math.max(0.01, Math.min(0.99, coords.x / nativeWidth));
    updateSplitView();
  });

  window.addEventListener('mouseup', () => {
    isDraggingSplit = false;
  });

  // Real-time Video Frame Inpainting Preview
  function previewVideoFrameClean() {
    if (!activeWatermarkBounds || !videoProcessor) return;
    videoProcessor.processFrame(activeWatermarkBounds, algoSelect.value);
    cleanCtx.drawImage(videoProcessor.canvas, 0, 0);
    hasCleanResult = true;
  }

  function updateVideoTimeDisplay() {
    const cur = formatTime(sourceVideo.currentTime);
    const dur = formatTime(sourceVideo.duration || 0);
    videoTimeDisplay.textContent = `${cur} / ${dur}`;
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // Video Playback Controls
  vPlayPauseBtn.addEventListener('click', () => {
    if (sourceVideo.paused) {
      sourceVideo.play();
      vPlayIcon.style.display = 'none';
      vPauseIcon.style.display = 'block';
    } else {
      sourceVideo.pause();
      vPlayIcon.style.display = 'block';
      vPauseIcon.style.display = 'none';
    }
  });

  videoTimeline.addEventListener('input', () => {
    sourceVideo.currentTime = parseFloat(videoTimeline.value);
  });

  vPrevFrameBtn.addEventListener('click', () => {
    sourceVideo.currentTime = Math.max(0, sourceVideo.currentTime - 1/30);
  });

  vNextFrameBtn.addEventListener('click', () => {
    sourceVideo.currentTime = Math.min(sourceVideo.duration, sourceVideo.currentTime + 1/30);
  });

  // Video Export (Hardware Accelerated Frame-by-Frame WebCodecs MP4 Export)
  exportVideoBtn.addEventListener('click', exportCleanVideo);

  async function exportCleanVideo() {
    if (!videoProcessor || !activeWatermarkBounds) {
      alert('Please select or specify the watermark region first.');
      return;
    }

    sourceVideo.pause();
    vPlayIcon.style.display = 'block';
    vPauseIcon.style.display = 'none';

    showModal('Exporting Clean Video...', 'Hardware-accelerated GPU export at 100% native quality...');
    cancelProcessBtn.style.display = 'inline-block';

    const bitrate = parseInt(videoBitrateSelect.value, 10);

    try {
      const result = await videoProcessor.exportCleanVideo(
        activeWatermarkBounds,
        {
          bitrate,
          fps: 24, // Matches source video
          mode: algoSelect.value
        },
        (progress) => {
          progressBarFill.style.width = `${progress.percent}%`;
          progressPercent.textContent = `${progress.percent}%`;
          progressDetails.textContent = `Frame ${progress.currentFrame} / ${progress.totalFrames} (${formatTime(progress.currentTime)})`;
        }
      );

      hideModal();

      // Download clean MP4 video immediately
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = currentFileName.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_clean.${result.extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      hideModal();
      if (err.message !== 'Export cancelled by user') {
        alert('Video export failed: ' + err.message);
      }
    }
  }

  cancelProcessBtn.addEventListener('click', () => {
    if (videoProcessor) videoProcessor.cancelExport();
    hideModal();
  });

  // Download Clean Image Media
  downloadBtn.addEventListener('click', () => {
    if (mediaType === 'image') {
      // Auto-inpaint if user hasn't pressed the button yet
      if (!hasCleanResult) {
        processWatermarkRemoval();
      }

      cleanCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const baseName = currentFileName.replace(/\.[^/.]+$/, '');
        a.download = `${baseName}_clean.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } else if (mediaType === 'video') {
      exportCleanVideo();
    }
  });

  // Modal helpers
  function showModal(title, desc) {
    modalTitle.textContent = title;
    modalDesc.textContent = desc;
    progressBarFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressDetails.textContent = 'Starting...';
    cancelProcessBtn.style.display = 'none';
    progressModal.classList.add('active');
  }

  function hideModal() {
    progressModal.classList.remove('active');
  }
});
