# CleanMark AI — Ultimate Watermark Remover Extension

> **High-Fidelity AI Watermark Remover for Images & Videos of Any Size**  
> Specially optimized for **Google Gemini / Imagen 3 / Veo watermarks**, stock photo marks, timestamps, and custom logos with **zero quality loss**.

---

## 🌟 Key Features

1. **✨ 1-Click Google Gemini Watermark Removal**
   - Specifically engineered preset and auto-detection for the Google Gemini / Imagen / Veo bottom-right sparkle badge.
   - Dynamic scaling automatically calculates badge coordinates and boundary glow across any resolution (512x512, 1024x1024, 2K, 4K, 8K).

2. **🎞️ Free Size (Any Size Media: Images & Videos)**
   - **No size caps or downscaling**: Works at 100% full native resolution (e.g. 1080p, 4K UHD, 8K, vertical 9:16 Shorts/Reels).
   - **Optimized Bounding Box Processing**: Processes watermark areas in high-speed sub-regions so even massive 40-megapixel images finish in milliseconds without freezing your browser.

3. **💎 Zero Quality Loss (Lossless Download)**
   - **Images**: Download as 100% Lossless PNG or max-quality JPEG without compression artifacts.
   - **Videos**: High-bitrate encoding (up to 45 Mbps) with full native frame-rate preservation.
   - **Audio Preservation**: Retains original audio tracks and synchronized high-fidelity sound.

4. **🛠️ Powerful Removal Tools**
   - **Gemini Auto**: 1-click automatic removal of corner sparkle marks.
   - **Box Select**: Click and drag rectangular boxes over any logo or corner watermark.
   - **Magic Brush**: Freehand brush with adjustable size and feathering.
   - **Mask Eraser**: Fine-tune and carve out selection masks.
   - **Before / After Split Slider**: Interactive comparison bar to inspect cleaned pixels vs original.

5. **🌐 Seamless In-Page Integration**
   - **Right-Click Context Menu**: Right-click any image or video across the web (`CleanMark: Remove Watermark`).
   - **Floating In-Page Button**: Hover over media to see an elegant quick-clean badge.
   - **Tab Media Scanner**: Popup scans the current tab (e.g. `gemini.google.com`) and lets you import any media with a single click.

6. **🔒 100% Client-Side & Private**
   - Runs entirely in your browser using HTML5 Canvas, Web Audio API, and high-performance TypedArray algorithms.
   - No external servers, no subscriptions, no watermarking on the output, no telemetry.

---

## 🚀 How to Install in Google Chrome or Microsoft Edge

1. Open your browser:
   - For **Google Chrome**: Go to `chrome://extensions/`
   - For **Microsoft Edge**: Go to `edge://extensions/`
   - For **Brave**: Go to `brave://extensions/`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button in the top-left corner.
4. Select the folder:
   ```
   D:\watermark-remover-extension
   ```
5. The **CleanMark AI** extension is now installed and active! Pin it to your browser toolbar for instant access.

---

## 📖 How to Use

### Method A: 1-Click on Google Gemini Images / Videos
1. Go to `gemini.google.com` or any AI generator site.
2. Right-click on the generated image or video, and choose:  
   **"CleanMark: Remove Watermark from Image"** (or Video).
3. The **CleanMark Studio** opens automatically with the Gemini watermark selected.
4. Click **"✨ 1-Click Remove Gemini Watermark"**.
5. Click **"Download Clean Media"** — your image or video is saved at 100% native quality!

### Method B: Upload Any Image or Video
1. Click the **CleanMark** icon in your browser toolbar or open `studio/studio.html`.
2. Drag & drop your image or video into the workstation.
3. Choose your tool:
   - For Gemini watermarks: Click **"Gemini Auto"**.
   - For other watermarks (e.g., text, logos): Use **"Box Select"** or **"Magic Brush"**.
4. Click **"Remove Watermark Now"** (or **"Process & Export Clean Video"** for videos).
5. Inspect with the **Before / After** slider and download.

---

## 📂 Project Structure

```
D:\watermark-remover-extension/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service worker handling context menus and tabs
├── content/
│   ├── content.js             # In-page hover overlay & page media scanner
│   └── content.css            # Styling for hover badges
├── popup/
│   ├── popup.html             # Extension toolbar popup interface
│   ├── popup.css              # Glassmorphic popup styling
│   └── popup.js               # Quick dropzone and tab scanner logic
├── studio/
│   ├── studio.html            # Full-featured Studio Workstation
│   ├── studio.css             # Dark-mode professional editor UI
│   └── studio.js              # Canvas rendering, brush, video timeline, export
├── lib/
│   ├── inpainting.js          # Fast Marching (Telea) & Texture Synthesis algorithms
│   ├── inpainting.worker.js   # Background worker for multi-megapixel images
│   └── video-processor.js     # Native-resolution video processor with audio preservation
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚙️ Technical Specifications

| Feature | Specification |
| :--- | :--- |
| **Manifest Version** | Chrome Manifest V3 |
| **Supported Image Formats** | PNG, JPEG, WebP, AVIF, SVG, BMP, GIF |
| **Supported Video Formats** | MP4 (H.264), WebM (VP9/VP8) |
| **Resolution Limit** | Free Size (Arbitrary resolution: 720p, 1080p, 2K, 4K, 8K) |
| **Output Image Quality** | Lossless (PNG) / 1.0 (JPEG) |
| **Output Video Quality** | Up to 45 Mbps Ultra Bitrate with native frame rates |
| **Audio Preservation** | Web Audio API MediaStream synchronization |
