import { AnnotationRenderer } from './annotation.js';

export class ExportManager {
  constructor(sceneManager, annotationRenderer) {
    this.sceneManager = sceneManager;
    this.annotationRenderer = annotationRenderer;
  }

  /**
   * Export position map with annotations
   * @param {THREE.Mesh[]} targetParts
   * @returns {Promise<string>} data URL
   */
  async exportPositionMap(targetParts) {
    // Render the scene
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);

    // Get the 3D canvas data
    const threeDataUrl = this.sceneManager.renderer.domElement.toDataURL('image/png');

    // Composite with annotations
    const compositeDataUrl = await this.annotationRenderer.compositeWithRender(
      threeDataUrl,
      (ctx) => {
        // Draw annotations
        this.annotationRenderer.renderAnnotations(targetParts);
      }
    );

    return compositeDataUrl;
  }

  /**
   * Export explosion view with annotations and thrust lines
   * @param {THREE.Mesh[]} targetParts
   * @param {Array} explosionData
   * @returns {Promise<string>} data URL
   */
  async exportExplosionView(targetParts, explosionData) {
    // Render the scene
    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);

    // Get the 3D canvas data
    const threeDataUrl = this.sceneManager.renderer.domElement.toDataURL('image/png');

    // Composite with annotations and thrust lines
    const compositeDataUrl = await this.annotationRenderer.compositeWithRender(
      threeDataUrl,
      (ctx) => {
        // Draw thrust lines first (behind annotations)
        if (explosionData && explosionData.length > 0) {
          this.annotationRenderer.drawThrustLines(explosionData);
        }
        // Draw annotations on top
        this.annotationRenderer.renderAnnotations(targetParts);
      }
    );

    return compositeDataUrl;
  }

  /**
   * Download a data URL as a PNG file
   */
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
