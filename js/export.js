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

  _composeAndExport(drawAnnotationsFn) {
    const renderer = this.sceneManager.renderer;
    const camera = this.sceneManager.camera;
    const scene = this.sceneManager.scene;

    // Force a render so the WebGL canvas has the latest frame
    renderer.render(scene, camera);

    // Get the 3D render as a data URL
    const renderDataUrl = renderer.domElement.toDataURL('image/png');

    const w = renderer.domElement.width;
    const h = renderer.domElement.height;

    // Create an offscreen canvas for compositing
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');

    // Draw 3D render to offscreen canvas via Image
    const img = new Image();

    const doComposite = () => {
      offCtx.drawImage(img, 0, 0, w, h);

      // Temporarily point the annotation renderer at the offscreen canvas
      const origCtx = this.annotationRenderer.ctx;
      const origCanvas = this.annotationRenderer.canvas;
      this.annotationRenderer.ctx = offCtx;
      this.annotationRenderer.canvas = offCanvas;

      try {
        drawAnnotationsFn();
      } catch (e) {
        console.error('Annotation drawing error:', e);
      }

      // Restore original context
      this.annotationRenderer.ctx = origCtx;
      this.annotationRenderer.canvas = origCanvas;

      return offCanvas.toDataURL('image/png');
    };

    return new Promise((resolve, reject) => {
      img.onload = () => resolve(doComposite());

      img.onerror = () => {
        console.error('Failed to load render data URL');
        reject(new Error('无法加载渲染图像'));
      };

      // Set src AFTER setting handlers, and check for immediate load
      img.src = renderDataUrl;

      // Data URLs may load synchronously; if already loaded, resolve now
      if (img.complete) {
        img.onload = null;
        img.onerror = null;
        resolve(doComposite());
      }
    });
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
