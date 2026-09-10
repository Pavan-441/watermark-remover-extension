/**
 * CleanMark Web Worker
 * Executes heavy inpainting computations asynchronously in the background.
 */

importScripts('inpainting.js');

const engine = new InpaintingEngine();

self.onmessage = function(e) {
  const { type, payload } = e.data;

  try {
    if (type === 'INPAINT_BOUNDS') {
      const { imgBuffer, maskBuffer, width, height, mode, padding } = payload;
      const imgData = new Uint8ClampedArray(imgBuffer);
      const maskData = new Uint8Array(maskBuffer);

      const result = engine.inpaintFastBoundingBox(imgData, maskData, width, height, mode, padding);

      self.postMessage({
        type: 'INPAINT_SUCCESS',
        resultBuffer: result.buffer
      }, [result.buffer]);
    } else if (type === 'GEMINI_AUTO') {
      const { imgBuffer, width, height, options } = payload;
      const imgData = new Uint8ClampedArray(imgBuffer);

      const { pixels, mask, bounds } = engine.removeGeminiWatermark(imgData, width, height, options);

      self.postMessage({
        type: 'GEMINI_AUTO_SUCCESS',
        resultBuffer: pixels.buffer,
        maskBuffer: mask.buffer,
        bounds
      }, [pixels.buffer, mask.buffer]);
    }
  } catch (err) {
    self.postMessage({
      type: 'INPAINT_ERROR',
      error: err.message
    });
  }
};
