import * as THREE from 'three';

export class AnnotationRenderer {
  constructor(canvas, sceneManager) {
    this.canvas = canvas;
    this.sceneManager = sceneManager;
    this.ctx = canvas.getContext('2d');
  }

  resize() {
    const threeCanvas = this.sceneManager.renderer.domElement;
    this.canvas.width = threeCanvas.width;
    this.canvas.height = threeCanvas.height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Build numbered parts list from hierarchy tree nodes.
   * Returns [{mesh, seqNumber, worldPos}] sorted by seqNumber.
   */
  static collectNumberedParts(hierarchyRoot, meshes) {
    const numbered = [];

    function walk(node) {
      if (node.isMesh && node._seqNumber != null && node._seqNumber > 0 && node.object3D) {
        const mesh = node.object3D;
        if (mesh.visible !== false) {
          const box = new THREE.Box3().setFromObject(mesh);
          const center = new THREE.Vector3();
          box.getCenter(center);
          numbered.push({
            mesh,
            seqNumber: node._seqNumber,
            worldPos: center,
            name: node.name,
          });
        }
      }
      if (node.children) {
        node.children.forEach(walk);
      }
    }

    walk(hierarchyRoot);

    // Sort by sequence number
    numbered.sort((a, b) => a.seqNumber - b.seqNumber);
    return numbered;
  }

  /**
   * Render horizontal annotations: circles aligned in vertical columns on left/right.
   */
  renderAnnotations(numberedParts, skipResizeAndClear = false) {
    if (!skipResizeAndClear) {
      this.resize();
      this.clear();
    }

    if (numberedParts.length === 0) return [];

    const camera = this.sceneManager.camera;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ctx = this.ctx;

    // Project all parts to screen
    const items = [];
    numberedParts.forEach((p) => {
      const screenPos = p.worldPos.clone().project(camera);
      if (screenPos.z > 1) return; // behind camera

      const sx = (screenPos.x * 0.5 + 0.5) * cw;
      const sy = (-screenPos.y * 0.5 + 0.5) * ch;

      if (sx < -50 || sx > cw + 50 || sy < -50 || sy > ch + 50) return;

      items.push({ ...p, screenX: sx, screenY: sy });
    });

    if (items.length === 0) return [];

    // Sort by screen Y (top to bottom) for alternating
    items.sort((a, b) => a.screenY - b.screenY);

    // Margin from canvas edges for annotations
    const marginX = 50;
    const leftColumnX = marginX;
    const rightColumnX = cw - marginX;

    // Circle properties
    const circleRadius = 13;
    const minCircleSpacing = circleRadius * 2 + 6;

    // Assign sides: alternate to distribute evenly
    const leftItems = [];
    const rightItems = [];
    items.forEach((item, i) => {
      if (i % 2 === 0) {
        item.side = 'left';
        leftItems.push(item);
      } else {
        item.side = 'right';
        rightItems.push(item);
      }
    });

    // Resolve Y overlaps within each column
    this._resolveYOverlaps(leftItems, minCircleSpacing, ch);
    this._resolveYOverlaps(rightItems, minCircleSpacing, ch);

    const annotations = [];

    // Draw left column
    leftItems.forEach((item) => {
      this._drawHorizontalAnnotation(ctx, item, leftColumnX, circleRadius, 'right');
      annotations.push(item);
    });

    // Draw right column
    rightItems.forEach((item) => {
      this._drawHorizontalAnnotation(ctx, item, rightColumnX, circleRadius, 'left');
      annotations.push(item);
    });

    return annotations;
  }

  /**
   * Adjust Y positions to avoid overlapping circles within a column.
   */
  _resolveYOverlaps(items, minSpacing, canvasHeight) {
    if (items.length <= 1) return;

    // Attempt to keep original Y, but push apart if too close
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      const gap = curr.screenY - prev.screenY;
      if (gap < minSpacing) {
        curr.screenY = prev.screenY + minSpacing;
      }
    }

    // Clamp to canvas
    items.forEach((item) => {
      item.screenY = Math.max(18, Math.min(canvasHeight - 18, item.screenY));
    });
  }

  /**
   * Draw a horizontal annotation: line + circle + number.
   * @param {'left'|'right'} lineDir - which way the line goes from circle to part
   */
  _drawHorizontalAnnotation(ctx, item, columnX, radius, lineDir) {
    const partX = item.screenX;
    const partY = item.screenY;
    const circleX = columnX;
    const circleY = item.screenY;

    // Connecting line: from circle edge to part
    const lineStartX = lineDir === 'right' ? circleX + radius : circleX - radius;
    const lineEndX = partX;

    ctx.beginPath();
    ctx.moveTo(lineStartX, circleY);
    ctx.lineTo(lineEndX, partY);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Small dot at part center
    ctx.beginPath();
    ctx.arc(partX, partY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // Black circle with white fill
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Outer white border ring
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Number
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(String(item.seqNumber), circleX, circleY + 1);
  }

  /**
   * Draw explosion thrust lines.
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

      this.ctx.beginPath();
      this.ctx.setLineDash([8, 4]);
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.strokeStyle = '#e94560';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      this.ctx.setLineDash([]);

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

  /**
   * Composite 3D render with annotations and return data URL.
   */
  compositeWithRender(dataUrl, renderAnnotationsFn) {
    this.resize();
    this.clear();

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);

        if (renderAnnotationsFn) {
          renderAnnotationsFn(this.ctx);
        }

        const compositeDataUrl = this.canvas.toDataURL('image/png');
        this.clear();
        resolve(compositeDataUrl);
      };
      img.onerror = () => {
        console.error('Failed to load render image for compositing');
        this.clear();
        resolve(dataUrl); // Fallback to raw render
      };
      img.src = dataUrl;
    });
  }
}
