import * as THREE from 'three';

/**
 * Annotation renderer for 2D overlay
 * Style: Arabic numeral + black circle + white border + black connecting line
 */
export class AnnotationRenderer {
  constructor(canvas, sceneManager) {
    this.canvas = canvas;
    this.sceneManager = sceneManager;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Resize the annotation canvas to match the 3D canvas
   */
  resize() {
    const threeCanvas = this.sceneManager.renderer.domElement;
    this.canvas.width = threeCanvas.width;
    this.canvas.height = threeCanvas.height;
  }

  /**
   * Clear the annotation canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render annotations for target parts
   * @param {THREE.Mesh[]} parts - Array of target meshes
   * @param {THREE.Camera} camera
   * @returns {Array<{screenX, screenY, number}>} annotation positions
   */
  renderAnnotations(parts) {
    this.resize();
    this.clear();

    const camera = this.sceneManager.camera;
    const annotations = [];

    // First pass: project all positions to screen
    const screenPositions = [];
    parts.forEach((mesh, index) => {
      const worldPos = this._getMeshWorldCenter(mesh);
      const screenPos = worldPos.clone().project(camera);

      // Check if in front of camera and within viewport
      if (screenPos.z > 1) return;

      const x = (screenPos.x * 0.5 + 0.5) * this.canvas.width;
      const y = (-screenPos.y * 0.5 + 0.5) * this.canvas.height;

      if (x < -50 || x > this.canvas.width + 50 || y < -50 || y > this.canvas.height + 50) return;

      screenPositions.push({
        index: index + 1,
        x,
        y,
        worldPos,
        mesh,
      });
    });

    if (screenPositions.length === 0) return [];

    // Sort by position to assign anchor directions and avoid overlap
    const occupiedAreas = [];

    screenPositions.forEach((item) => {
      const result = this._drawAnnotation(item, occupiedAreas);
      if (result) {
        annotations.push(result);
        occupiedAreas.push({
          x: result.screenX,
          y: result.screenY,
          radius: result.radius || 25,
        });
      }
    });

    return annotations;
  }

  /**
   * Draw a single annotation
   */
  _drawAnnotation(item, occupiedAreas) {
    const { index, x, y } = item;
    const ctx = this.ctx;

    // Determine anchor direction (which side to place the circle)
    // Default: place circle to the upper-right of the point
    const directions = [
      { dx: 1, dy: -1, name: 'top-right' },
      { dx: -1, dy: -1, name: 'top-left' },
      { dx: 1, dy: 1, name: 'bottom-right' },
      { dx: -1, dy: 1, name: 'bottom-left' },
      { dx: 0, dy: -1, name: 'top' },
      { dx: 1, dy: 0, name: 'right' },
      { dx: -1, dy: 0, name: 'left' },
      { dx: 0, dy: 1, name: 'bottom' },
    ];

    // Try each direction until we find one without overlapping
    const lineLength = 45;
    const circleRadius = 14;
    const circleDiameter = circleRadius * 2;

    let bestDir = directions[0];
    for (const dir of directions) {
      const circleX = x + dir.dx * lineLength;
      const circleY = y + dir.dy * lineLength;

      const hasOverlap = occupiedAreas.some((area) => {
        const dist = Math.sqrt((circleX - area.x) ** 2 + (circleY - area.y) ** 2);
        return dist < (circleRadius + (area.radius || 25) + 4);
      });

      if (!hasOverlap) {
        bestDir = dir;
        break;
      }
    }

    const circleX = x + bestDir.dx * lineLength;
    const circleY = y + bestDir.dy * lineLength;

    // Clamp to canvas bounds
    const clampedX = Math.max(circleRadius + 4, Math.min(this.canvas.width - circleRadius - 4, circleX));
    const clampedY = Math.max(circleRadius + 4, Math.min(this.canvas.height - circleRadius - 4, circleY));

    // Draw connecting line from part center to circle
    const lineEndX = clampedX - bestDir.dx * circleRadius * 0.8;
    const lineEndY = clampedY - bestDir.dy * circleRadius * 0.8;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw white border circle
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Another thin white ring outside the black border
    ctx.beginPath();
    ctx.arc(clampedX, clampedY, circleRadius + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw number
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(String(index), clampedX, clampedY + 1);

    return {
      index,
      screenX: clampedX,
      screenY: clampedY,
      partX: x,
      partY: y,
      radius: circleRadius,
      mesh: item.mesh,
      worldPos: item.worldPos,
    };
  }

  /**
   * Draw explosion thrust lines
   * @param {Array} explosionData - Array of {from: Vector3, to: Vector3}
   */
  drawThrustLines(explosionData) {
    const camera = this.sceneManager.camera;

    explosionData.forEach(({ from, to }) => {
      const fromScreen = from.clone().project(camera);
      const toScreen = to.clone().project(camera);

      if (fromScreen.z > 1 || toScreen.z > 1) return;

      const x1 = (fromScreen.x * 0.5 + 0.5) * this.canvas.width;
      const y1 = (-fromScreen.y * 0.5 + 0.5) * this.canvas.height;
      const x2 = (toScreen.x * 0.5 + 0.5) * this.canvas.width;
      const y2 = (-toScreen.y * 0.5 + 0.5) * this.canvas.height;

      // Draw dashed line
      this.ctx.beginPath();
      this.ctx.setLineDash([8, 4]);
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = '#e94560';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Draw arrow at the end (exploded position)
      this._drawArrow(x1, y1, x2, y2);
    });
  }

  _drawArrow(fromX, fromY, toX, toY) {
    const ctx = this.ctx;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLength = 10;
    const arrowWidth = 6;

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle - Math.PI / 6),
      toY - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - arrowLength * Math.cos(angle + Math.PI / 6),
      toY - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = '#e94560';
    ctx.fill();
  }

  _getMeshWorldCenter(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }

  /**
   * Composite the 3D render with annotations and return final data URL
   */
  compositeWithRender(dataUrl, renderAnnotationsFn) {
    this.resize();
    this.clear();

    const img = new Image();
    return new Promise((resolve) => {
      img.onload = () => {
        // Draw the 3D render onto the annotation canvas
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

        // Draw annotations on top
        if (renderAnnotationsFn) {
          renderAnnotationsFn(this.ctx);
        }

        // Get composite result
        const compositeDataUrl = this.canvas.toDataURL('image/png');

        // Clear the annotation canvas so live view is not affected
        this.clear();

        resolve(compositeDataUrl);
      };
      img.src = dataUrl;
    });
  }
}
