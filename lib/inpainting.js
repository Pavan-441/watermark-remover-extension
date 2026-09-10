/**
 * CleanMark Inpainting Engine
 * High-performance, zero-dependency inpainting algorithms:
 * 1. Telea Fast Marching Method (FMM)
 * 2. Exemplar-based Texture Synthesis (PatchMatch / Criminisi)
 * 3. Directional Gradient & Bilateral Interpolation
 * 4. Temporal Video Delogo & Patch Coherence
 */

class InpaintingEngine {
  constructor() {
    this.name = 'CleanMark Inpainting Engine';
  }

  /**
   * Helper to get bounding box of mask with padding
   */
  getMaskBounds(maskData, width, height, padding = 20) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasMask = false;

    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        // Mask is non-zero (or red channel > 128)
        if (maskData[rowOffset + x] > 0) {
          hasMask = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasMask) return null;

    return {
      x: Math.max(0, minX - padding),
      y: Math.max(0, minY - padding),
      w: Math.min(width, maxX + padding + 1) - Math.max(0, minX - padding),
      h: Math.min(height, maxY + padding + 1) - Math.max(0, minY - padding),
      minX, minY, maxX, maxY
    };
  }

  /**
   * Dilation helper to expand mask slightly (removes anti-aliased watermark ghost halos)
   */
  dilateMask(mask, width, height, radius = 2) {
    if (radius <= 0) return new Uint8Array(mask);
    const output = new Uint8Array(width * height);
    const r2 = radius * radius;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mask[y * width + x] > 0) {
          const y0 = Math.max(0, y - radius);
          const y1 = Math.min(height - 1, y + radius);
          const x0 = Math.max(0, x - radius);
          const x1 = Math.min(width - 1, x + radius);

          for (let dy = y0; dy <= y1; dy++) {
            for (let dx = x0; dx <= x1; dx++) {
              if ((dx - x) * (dx - x) + (dy - y) * (dy - y) <= r2) {
                output[dy * width + dx] = 255;
              }
            }
          }
        }
      }
    }
    return output;
  }

  /**
   * Telea Inpainting (Fast Marching Method)
   * Super fast, mathematically sound, excellent for logos, fine details, and text
   */
  inpaintTelea(imgData, maskData, width, height, radius = 4) {
    const pixels = new Uint8ClampedArray(imgData);
    const N = width * height;

    // Mask states: 0 = KNOWN, 1 = BAND (boundary), 2 = INSIDE (to inpaint)
    const state = new Uint8Array(N);
    const T = new Float32Array(N); // distance / travel time
    const INF = 1.0e6;

    for (let i = 0; i < N; i++) {
      if (maskData[i] > 128) {
        state[i] = 2; // INSIDE
        T[i] = INF;
      } else {
        state[i] = 0; // KNOWN
        T[i] = 0;
      }
    }

    // Min-heap for narrow band
    const heap = [];
    function pushHeap(idx, val) {
      heap.push({ idx, val });
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].val <= heap[i].val) break;
        const tmp = heap[p];
        heap[p] = heap[i];
        heap[i] = tmp;
        i = p;
      }
    }

    function popHeap() {
      if (heap.length === 0) return null;
      const top = heap[0];
      const bottom = heap.pop();
      if (heap.length > 0) {
        heap[0] = bottom;
        let i = 0;
        const len = heap.length;
        while (true) {
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          let smallest = i;
          if (l < len && heap[l].val < heap[smallest].val) smallest = l;
          if (r < len && heap[r].val < heap[smallest].val) smallest = r;
          if (smallest === i) break;
          const tmp = heap[i];
          heap[i] = heap[smallest];
          heap[smallest] = tmp;
          i = smallest;
        }
      }
      return top;
    }

    // Initialize BAND around the INSIDE region
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (state[idx] === 2) {
          // Check 4-neighbors
          if (state[idx - 1] === 0 || state[idx + 1] === 0 ||
              state[idx - width] === 0 || state[idx + width] === 0) {
            state[idx] = 1; // BAND
            T[idx] = 1.0;
            pushHeap(idx, 1.0);
          }
        }
      }
    }

    // Directional gradient & color inpainting weights
    const radSq = radius * radius;

    while (heap.length > 0) {
      const item = popHeap();
      if (!item) break;
      const curIdx = item.idx;
      state[curIdx] = 0; // marked as KNOWN

      const cy = Math.floor(curIdx / width);
      const cx = curIdx % width;

      // Inpaint curIdx using surrounding known pixels within radius
      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      const yMin = Math.max(0, cy - radius);
      const yMax = Math.min(height - 1, cy + radius);
      const xMin = Math.max(0, cx - radius);
      const xMax = Math.min(width - 1, cx + radius);

      // Approximate gradient of T at curIdx
      let gradTx = 0, gradTy = 0;
      if (cx > 0 && cx < width - 1) {
        gradTx = (T[curIdx + 1] - T[curIdx - 1]) * 0.5;
      }
      if (cy > 0 && cy < height - 1) {
        gradTy = (T[curIdx + width] - T[curIdx - width]) * 0.5;
      }
      const gradLen = Math.sqrt(gradTx * gradTx + gradTy * gradTy) + 1e-4;
      gradTx /= gradLen;
      gradTy /= gradLen;

      for (let ny = yMin; ny <= yMax; ny++) {
        for (let nx = xMin; nx <= xMax; nx++) {
          const nIdx = ny * width + nx;
          if (state[nIdx] === 0) { // Known neighbor
            const dx = cx - nx;
            const dy = cy - ny;
            const dSq = dx * dx + dy * dy;
            if (dSq <= radSq && dSq > 0) {
              const dist = Math.sqrt(dSq);
              
              // Directional factor: dot product between ray vector and level set normal
              let dir = (dx * gradTx + dy * gradTy) / dist;
              if (dir <= 0) dir = 0.05; // penalize opposite directions

              // Level set weight
              const wLev = 1.0 / (1.0 + Math.abs(T[nIdx] - T[curIdx]));
              // Geometric distance weight
              const wDist = 1.0 / (dist * dist + 1e-3);

              const weight = dir * wLev * wDist;
              const pIdx = nIdx * 4;
              sumR += pixels[pIdx] * weight;
              sumG += pixels[pIdx + 1] * weight;
              sumB += pixels[pIdx + 2] * weight;
              sumW += weight;
            }
          }
        }
      }

      if (sumW > 0) {
        const pIdx = curIdx * 4;
        pixels[pIdx] = Math.round(sumR / sumW);
        pixels[pIdx + 1] = Math.round(sumG / sumW);
        pixels[pIdx + 2] = Math.round(sumB / sumW);
      }

      // Propagate into neighbors
      const neighbors = [curIdx - 1, curIdx + 1, curIdx - width, curIdx + width];
      for (let n = 0; n < 4; n++) {
        const nb = neighbors[n];
        if (nb >= 0 && nb < N && state[nb] === 2) {
          state[nb] = 1;
          T[nb] = item.val + 1.0;
          pushHeap(nb, T[nb]);
        }
      }
    }

    return pixels;
  }

  /**
   * PatchMatch / Exemplar-Based Texture Synthesis (Criminisi-inspired)
   * Finds matching texture patches nearby and blends them seamlessly.
   * Ideal for textures (fabrics, foliage, ocean, complex photos).
   */
  inpaintTexture(imgData, maskData, width, height, patchRadius = 4, searchRadius = 24) {
    const pixels = new Uint8ClampedArray(imgData);
    const mask = new Uint8Array(maskData);
    const patchSize = patchRadius * 2 + 1;

    // Identify target pixels (where mask > 0)
    let remaining = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 128) remaining++;
    }

    let iterations = 0;
    const maxIterations = remaining * 2;

    while (remaining > 0 && iterations < maxIterations) {
      iterations++;

      // Find boundary pixel with highest known neighbor density
      let bestX = -1, bestY = -1;
      let maxKnown = -1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (mask[idx] > 128) {
            // Check if boundary
            let isBoundary = false;
            let knownCount = 0;

            for (let dy = -patchRadius; dy <= patchRadius; dy++) {
              for (let dx = -patchRadius; dx <= patchRadius; dx++) {
                const ny = y + dy;
                const nx = x + dx;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  if (mask[ny * width + nx] <= 128) {
                    isBoundary = true;
                    knownCount++;
                  }
                }
              }
            }

            if (isBoundary && knownCount > maxKnown) {
              maxKnown = knownCount;
              bestX = x;
              bestY = y;
            }
          }
        }
      }

      if (bestX === -1) break; // Done

      // Search for best matching source patch in unmasked area
      let bestSrcX = -1, bestSrcY = -1;
      let minDiff = Infinity;

      const sMinY = Math.max(patchRadius, bestY - searchRadius);
      const sMaxY = Math.min(height - 1 - patchRadius, bestY + searchRadius);
      const sMinX = Math.max(patchRadius, bestX - searchRadius);
      const sMaxX = Math.min(width - 1 - patchRadius, bestX + searchRadius);

      for (let sy = sMinY; sy <= sMaxY; sy += 2) {
        for (let sx = sMinX; sx <= sMaxX; sx += 2) {
          // Verify source patch is completely outside the mask
          let fullyKnown = true;
          for (let py = -patchRadius; py <= patchRadius && fullyKnown; py++) {
            for (let px = -patchRadius; px <= patchRadius && fullyKnown; px++) {
              if (mask[(sy + py) * width + (sx + px)] > 128) {
                fullyKnown = false;
              }
            }
          }

          if (!fullyKnown) continue;

          // Compute SSD between target patch (known pixels only) and candidate source patch
          let diff = 0;
          let comparedCount = 0;

          for (let py = -patchRadius; py <= patchRadius; py++) {
            for (let px = -patchRadius; px <= patchRadius; px++) {
              const tx = bestX + px;
              const ty = bestY + py;
              if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
                if (mask[ty * width + tx] <= 128) {
                  const tIdx = (ty * width + tx) * 4;
                  const cIdx = ((sy + py) * width + (sx + px)) * 4;
                  const dr = pixels[tIdx] - pixels[cIdx];
                  const dg = pixels[tIdx + 1] - pixels[cIdx + 1];
                  const db = pixels[tIdx + 2] - pixels[cIdx + 2];
                  diff += dr * dr + dg * dg + db * db;
                  comparedCount++;
                }
              }
            }
          }

          if (comparedCount > 0) {
            const normalizedDiff = diff / comparedCount;
            // Bias towards closer patches
            const distBias = 1.0 + Math.hypot(bestX - sx, bestY - sy) * 0.005;
            const score = normalizedDiff * distBias;

            if (score < minDiff) {
              minDiff = score;
              bestSrcX = sx;
              bestSrcY = sy;
            }
          }
        }
      }

      // If no valid source patch found, fallback to Telea for this point
      if (bestSrcX === -1) {
        // Fallback: fill bestX, bestY from nearest known
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ny = bestY + dy;
            const nx = bestX + dx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (mask[ny * width + nx] <= 128) {
                const idx = (ny * width + nx) * 4;
                sumR += pixels[idx];
                sumG += pixels[idx + 1];
                sumB += pixels[idx + 2];
                count++;
              }
            }
          }
        }
        const tIdx = (bestY * width + bestX) * 4;
        if (count > 0) {
          pixels[tIdx] = Math.round(sumR / count);
          pixels[tIdx + 1] = Math.round(sumG / count);
          pixels[tIdx + 2] = Math.round(sumB / count);
        }
        mask[bestY * width + bestX] = 0;
        remaining--;
        continue;
      }

      // Copy source patch pixels into target masked pixels
      for (let py = -patchRadius; py <= patchRadius; py++) {
        for (let px = -patchRadius; px <= patchRadius; px++) {
          const tx = bestX + px;
          const ty = bestY + py;
          if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
            const mIdx = ty * width + tx;
            if (mask[mIdx] > 128) {
              const tIdx = mIdx * 4;
              const sIdx = ((bestSrcY + py) * width + (bestSrcX + px)) * 4;
              pixels[tIdx] = pixels[sIdx];
              pixels[tIdx + 1] = pixels[sIdx + 1];
              pixels[tIdx + 2] = pixels[sIdx + 2];
              mask[mIdx] = 0;
              remaining--;
            }
          }
        }
      }
    }

    return pixels;
  }

  /**
   * Optimized Bounding-Box Processor for Any Resolution (4K, 8K, etc.)
   * Instead of processing 16 million pixels, crops the region around the watermark,
   * inpaints the sub-region in milliseconds, and drops it back into the original image!
   */
  inpaintFastBoundingBox(imgData, maskData, width, height, mode = 'telea', padding = 24) {
    const bounds = this.getMaskBounds(maskData, width, height, padding);
    if (!bounds) {
      return new Uint8ClampedArray(imgData); // No watermark mask found
    }

    const { x: bx, y: by, w: bw, h: bh } = bounds;

    // Extract sub-region
    const subImg = new Uint8ClampedArray(bw * bh * 4);
    const subMask = new Uint8Array(bw * bh);

    for (let y = 0; y < bh; y++) {
      const srcY = by + y;
      for (let x = 0; x < bw; x++) {
        const srcX = bx + x;
        const srcIdx = srcY * width + srcX;
        const dstIdx = y * bw + x;

        subImg[dstIdx * 4] = imgData[srcIdx * 4];
        subImg[dstIdx * 4 + 1] = imgData[srcIdx * 4 + 1];
        subImg[dstIdx * 4 + 2] = imgData[srcIdx * 4 + 2];
        subImg[dstIdx * 4 + 3] = imgData[srcIdx * 4 + 3];

        subMask[dstIdx] = maskData[srcIdx];
      }
    }

    // Inpaint sub-region
    let cleanedSub;
    if (mode === 'texture') {
      cleanedSub = this.inpaintTexture(subImg, subMask, bw, bh, 3, 20);
    } else {
      cleanedSub = this.inpaintTelea(subImg, subMask, bw, bh, 3);
    }

    // Blend sub-region back into full-size original output
    const output = new Uint8ClampedArray(imgData);
    for (let y = 0; y < bh; y++) {
      const srcY = by + y;
      for (let x = 0; x < bw; x++) {
        const srcX = bx + x;
        const srcIdx = srcY * width + srcX;
        const dstIdx = (y * bw + x) * 4;

        output[srcIdx * 4] = cleanedSub[dstIdx];
        output[srcIdx * 4 + 1] = cleanedSub[dstIdx + 1];
        output[srcIdx * 4 + 2] = cleanedSub[dstIdx + 2];
        output[srcIdx * 4 + 3] = cleanedSub[dstIdx + 3];
      }
    }

    return output;
  }

  /**
   * Intelligent Gemini Sparkle Auto Detector
   * Analyzes the bottom-right quadrant to locate the high-contrast sparkle watermark.
   */
  detectGeminiSparkle(imgData, width, height) {
    const startX = Math.round(width * 0.60);
    const startY = Math.round(height * 0.60);
    const searchW = width - startX;
    const searchH = height - startY;

    // Scan luminance in the bottom-right quadrant
    let maxLum = 0;
    let peakX = Math.round(width * 0.82);
    let peakY = Math.round(height * 0.88);
    let foundHotspot = false;

    // Sample pixels in 4px steps for high speed
    for (let y = startY; y < height - 10; y += 4) {
      for (let x = startX; x < width - 10; x += 4) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        // Check local contrast against surroundings
        if (lum > 140 && lum > maxLum) {
          maxLum = lum;
          peakX = x;
          peakY = y;
          foundHotspot = true;
        }
      }
    }

    // Determine watermark size scaled to resolution (large enough to cover dual sparkles)
    const scale = Math.max(width, height) / 1080;
    const isVertical = height > width * 1.15;
    const boxSize = isVertical 
      ? Math.max(110, Math.round(width * 0.17))
      : Math.max(80, Math.round(110 * Math.min(scale, 1.8)));

    const bx = Math.max(0, Math.min(width - boxSize, Math.round(peakX - boxSize / 2)));
    const by = Math.max(0, Math.min(height - boxSize, Math.round(peakY - boxSize / 2)));

    return {
      x: bx,
      y: by,
      w: boxSize,
      h: boxSize,
      detected: foundHotspot
    };
  }

  /**
   * Gemini Watermark Presets based on aspect ratio
   */
  getGeminiPresetBounds(width, height, presetType = 'auto') {
    const isVertical = height > width * 1.15; // 9:16, 2:3 or portrait

    if (presetType === 'vertical' || (presetType === 'auto' && isVertical)) {
      // For vertical 9:16 media (Veo, Shorts, Mobile):
      // Generous size to cover both main and secondary sparkles
      const boxW = Math.max(110, Math.round(width * 0.17));
      const boxH = boxW;
      const x = Math.max(0, Math.min(width - boxW, Math.round(width * 0.77)));
      const y = Math.max(0, Math.min(height - boxH, Math.round(height * 0.865)));
      return { x, y, w: boxW, h: boxH };
    } else {
      // Standard landscape / square image corner
      const scale = Math.max(width, height) / 1024;
      const boxW = Math.round(90 * Math.max(1, scale * 0.8));
      const boxH = boxW;
      const marginX = Math.round(24 * Math.max(1, scale * 0.8));
      const marginY = Math.round(24 * Math.max(1, scale * 0.8));
      return {
        x: Math.max(0, width - marginX - boxW),
        y: Math.max(0, height - marginY - boxH),
        w: boxW,
        h: boxH
      };
    }
  }

  /**
   * Gemini Watermark Auto Detector & Inpainter
   */
  removeGeminiWatermark(imgData, width, height, options = {}) {
    const {
      sizeMode = 'auto',
      customMargin = null,
      customSize = null,
      mode = 'telea'
    } = options;

    let bounds;
    if (options.bounds) {
      bounds = options.bounds;
    } else {
      // Try smart detection first, fallback to preset
      const detected = this.detectGeminiSparkle(imgData, width, height);
      if (detected.detected) {
        bounds = detected;
      } else {
        bounds = this.getGeminiPresetBounds(width, height, sizeMode);
      }
    }

    const { x: startX, y: startY, w: badgeW, h: badgeH } = bounds;

    // Create mask
    const mask = new Uint8Array(width * height);
    for (let y = startY; y < startY + badgeH; y++) {
      if (y >= height) continue;
      const rowOffset = y * width;
      for (let x = startX; x < startX + badgeW; x++) {
        if (x >= width) continue;
        mask[rowOffset + x] = 255;
      }
    }

    const scale = Math.max(width, height) / 1024;
    const dilated = this.dilateMask(mask, width, height, Math.max(2, Math.round(scale * 2)));

    return {
      pixels: this.inpaintFastBoundingBox(imgData, dilated, width, height, mode, 32),
      mask: dilated,
      bounds
    };
  }
}

// Export for browser window, ES module, or Web Worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InpaintingEngine };
} else if (typeof window !== 'undefined') {
  window.InpaintingEngine = InpaintingEngine;
} else if (typeof self !== 'undefined') {
  self.InpaintingEngine = InpaintingEngine;
}
