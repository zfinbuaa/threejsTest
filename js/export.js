import { AnnotationRenderer } from './annotation.js';

export class ExportManager {
  constructor(sceneManager, annotationRenderer) {
    this.sceneManager = sceneManager;
    this.annotationRenderer = annotationRenderer;
  }

  async exportPositionMap(numberedParts) {
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    return this._composite(() => {
      this.annotationRenderer.renderAnnotations(numberedParts);
    });
  }

  async exportExplosionView(numberedParts, explosionData) {
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    return this._composite(() => {
      if (explosionData && explosionData.length > 0) {
        this.annotationRenderer.drawThrustLines(explosionData);
      }
      this.annotationRenderer.renderAnnotations(numberedParts);
    });
  }

  _composite(drawFn) {
    const r = this.annotationRenderer;
    r.resize();
    r.clear();

    // Draw 3D render directly from the WebGL canvas
    r.ctx.drawImage(
      this.sceneManager.renderer.domElement,
      0, 0,
      r.canvas.width, r.canvas.height
    );

    // Draw annotations/thrust lines
    drawFn();

    // Get composite
    const result = r.canvas.toDataURL('image/png');

    // Clean up
    r.clear();

    return result;
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
