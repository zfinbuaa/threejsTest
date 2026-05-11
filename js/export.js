import * as THREE from 'three';
import { AnnotationRenderer } from './annotation.js';

export class ExportManager {
  constructor(sceneManager, annotationRenderer) {
    this.sceneManager = sceneManager;
    this.annotationRenderer = annotationRenderer;
  }

  async exportPositionMap(numberedParts) {
    return this._composeAndExport(() => {
      this.annotationRenderer.renderAnnotations(numberedParts, true);
    });
  }

  async exportExplosionView(numberedParts, explosionData) {
    return this._composeAndExport(() => {
      if (explosionData && explosionData.length > 0) {
        this.annotationRenderer.drawThrustLines(explosionData);
      }
      this.annotationRenderer.renderAnnotations(numberedParts, true);
    });
  }

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

    // Render to the main canvas
    renderer.render(scene, camera);

    // Read pixels directly from the WebGL framebuffer
    const gl = renderer.getContext();
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Create a 2D canvas for compositing
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');

    // Swap annotation renderer to offscreen canvas first (resize will match sizes)
    const origCtx = this.annotationRenderer.ctx;
    const origCanvas = this.annotationRenderer.canvas;
    this.annotationRenderer.ctx = offCtx;
    this.annotationRenderer.canvas = offCanvas;

    // Resize annotation renderer (sets offCanvas size, clears it - which is fine
    // because we'll write the 3D pixels next)
    this.annotationRenderer.resize();
    this.annotationRenderer.clear();

    // Write 3D render pixels to the (now cleared) offscreen canvas
    const imgData = offCtx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const srcRow = (h - 1 - y) * w * 4;
      const dstRow = y * w * 4;
      imgData.data.set(pixels.subarray(srcRow, srcRow + w * 4), dstRow);
    }
    offCtx.putImageData(imgData, 0, 0);

    // Draw annotations on top of the 3D render
    try {
      drawAnnotationsFn();
    } catch (e) {
      console.error('Annotation drawing error:', e);
    }

    // Restore original context
    this.annotationRenderer.ctx = origCtx;
    this.annotationRenderer.canvas = origCanvas;

    return offCanvas.toDataURL('image/png');
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
