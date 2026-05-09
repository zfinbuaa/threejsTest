import { AnnotationRenderer } from './annotation.js';

export class ExportManager {
  constructor(sceneManager, annotationRenderer) {
    this.sceneManager = sceneManager;
    this.annotationRenderer = annotationRenderer;
  }

  /**
   * Export position map with annotations.
   * @param {Array} numberedParts - from AnnotationRenderer.collectNumberedParts()
   */
  async exportPositionMap(numberedParts) {
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    const threeDataUrl = this.sceneManager.renderer.domElement.toDataURL('image/png');

    const compositeDataUrl = await this.annotationRenderer.compositeWithRender(
      threeDataUrl,
      () => {
        this.annotationRenderer.renderAnnotations(numberedParts);
      }
    );
    return compositeDataUrl;
  }

  /**
   * Export explosion view with annotations and thrust lines.
   * @param {Array} numberedParts
   * @param {Array} explosionData
   */
  async exportExplosionView(numberedParts, explosionData) {
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    const threeDataUrl = this.sceneManager.renderer.domElement.toDataURL('image/png');

    const compositeDataUrl = await this.annotationRenderer.compositeWithRender(
      threeDataUrl,
      () => {
        if (explosionData && explosionData.length > 0) {
          this.annotationRenderer.drawThrustLines(explosionData);
        }
        this.annotationRenderer.renderAnnotations(numberedParts);
      }
    );
    return compositeDataUrl;
  }

  async downloadPNG(dataUrl, filename = 'output.png') {
    if (window.electronAPI) {
      const savedPath = await window.electronAPI.savePNG(dataUrl);
      return savedPath;
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
