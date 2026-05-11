import * as THREE from 'three';
import { AnnotationRenderer } from './annotation.js';

export class ExportManager {
  constructor(sceneManager, annotationRenderer) {
    this.sceneManager = sceneManager;
    this.annotationRenderer = annotationRenderer;
  }

  async exportPositionMap(numberedParts) {
    return this._composeAndExport(() => {
      this.annotationRenderer.renderAnnotations(numberedParts);
    });
  }

  async exportExplosionView(numberedParts, explosionData) {
    return this._composeAndExport(() => {
      if (explosionData && explosionData.length > 0) {
        this.annotationRenderer.drawThrustLines(explosionData);
      }
      this.annotationRenderer.renderAnnotations(numberedParts);
    });
  }

  /**
   * Render scene to render target, read pixels, composite with annotations.
   * This bypasses any toDataURL issues with WebGL canvases.
   */
  _composeAndExport(drawAnnotationsFn) {
    const renderer = this.sceneManager.renderer;
    const camera = this.sceneManager.camera;
    const scene = this.sceneManager.scene;

    const canvasEl = renderer.domElement;
    const w = canvasEl.width || canvasEl.clientWidth || 800;
    const h = canvasEl.height || canvasEl.clientHeight || 600;

    if (w === 0 || h === 0) {
      throw new Error('Canvas has zero size');
    }

    // Create a render target matching the main canvas
    const renderTarget = new THREE.WebGLRenderTarget(w, h, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
    });

    try {
      // Render scene to the offscreen render target
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Read pixels from the render target
      const pixelBuffer = new Uint8Array(w * h * 4);
      renderer.readRenderTargetPixels(renderTarget, 0, 0, w, h, pixelBuffer);

      // Create a 2D canvas and write pixels (flip Y: WebGL bottom-left → Canvas top-left)
      const offCanvas = document.createElement('canvas');
      offCanvas.width = w;
      offCanvas.height = h;
      const offCtx = offCanvas.getContext('2d');
      const imgData = offCtx.createImageData(w, h);

      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        const dstRow = y * w * 4;
        imgData.data.set(
          pixelBuffer.subarray(srcRow, srcRow + w * 4),
          dstRow
        );
      }
      offCtx.putImageData(imgData, 0, 0);

      // Draw annotations on top
      const origCtx = this.annotationRenderer.ctx;
      const origCanvas = this.annotationRenderer.canvas;
      this.annotationRenderer.ctx = offCtx;
      this.annotationRenderer.canvas = offCanvas;

      try {
        drawAnnotationsFn();
      } catch (e) {
        console.error('Annotation drawing error:', e);
      }

      this.annotationRenderer.ctx = origCtx;
      this.annotationRenderer.canvas = origCanvas;

      const result = offCanvas.toDataURL('image/png');
      return result;
    } finally {
      renderTarget.dispose();
    }
  }

  async downloadPNG(dataUrl, filename = 'output.png') {
    if (window.electronAPI) {
      return await window.electronAPI.savePNG(dataUrl);
    } else {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return filename;
    }
  }
}
