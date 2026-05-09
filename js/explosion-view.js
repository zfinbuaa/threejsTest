import * as THREE from 'three';
import { ModelLoader } from './model-loader.js';
import { TreeView } from './tree-view.js';
import { AnnotationRenderer } from './annotation.js';

export class ExplosionView {
  constructor(sceneManager, uiElements) {
    this.sceneManager = sceneManager;
    this.ui = uiElements;

    this.partModels = [];
    this.partMeshes = [];
    this.originalPositions = new Map(); // mesh -> Vector3
    this.explodedPositions = new Map(); // mesh -> Vector3
    this.isExploded = false;
    this.explosionDistance = 1.0;
    this.isDragging = false;
    this.transformControls = null;
    this.selectedDragMesh = null;

    this.partTreeView = new TreeView(uiElements.partTreeExplosion, {
      onNodeClick: (node) => this._onPartNodeClick(node),
    });

    this._setupUI();
  }

  _setupUI() {
    // Load parts button
    this.ui.btnLoadPartsExplosion.addEventListener('click', () => {
      if (window.electronAPI) {
        this._setStatus('请通过 文件→加载目标部件 菜单加载');
      } else {
        this._createFileInput('.wrl', true, (files) => this.loadPartModels(files));
      }
    });

    // Auto explode
    this.ui.btnAutoExplode.addEventListener('click', () => {
      this.autoExplode();
    });

    // Reset
    this.ui.btnResetExplosion.addEventListener('click', () => {
      this.resetPositions();
    });

    // Explosion distance slider
    this.ui.explosionDistanceSlider.addEventListener('input', () => {
      this.explosionDistance = parseFloat(this.ui.explosionDistanceSlider.value);
      this.ui.explosionDistanceLabel.textContent = this.explosionDistance.toFixed(1);
    });

    // Enter drag mode
    this.ui.btnEnterDrag.addEventListener('click', async () => {
      await this.enterDragMode();
    });

    // Exit drag mode
    this.ui.btnExitDrag.addEventListener('click', () => {
      this.exitDragMode();
    });

    // Export is handled by app.js via ExportManager

    // Electron API
    if (window.electronAPI) {
      window.electronAPI.onLoadPartModels((paths) => {
        this.loadPartModels(paths);
      });
    }

    // Keyboard for drag mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && this.isDragging && this.transformControls) {
        e.preventDefault();
        const mode = this.transformControls.mode;
        this.transformControls.mode = mode === 'translate' ? 'rotate' : 'translate';
        this._setStatus(`拖动模式: ${this.transformControls.mode === 'translate' ? '平移' : '旋转'}`);
      }
      if (e.code === 'Escape' && this.isDragging) {
        this.exitDragMode();
      }
    });
  }

  _createFileInput(accept, multiple, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      callback(Array.from(input.files));
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  async loadPartModels(paths) {
    this._setStatus('正在加载目标部件...');
    const loader = new ModelLoader();

    for (const path of paths) {
      try {
        const fileObj = typeof path === 'string'
          ? { path, name: path.split(/[\\/]/).pop() }
          : { path: URL.createObjectURL(path), name: path.name };
        const data = await loader.loadVRML(fileObj.path);
        data.fileName = fileObj.name.replace(/\.(wrl|vrml)$/i, '');
        data._isPart = true;

        this.partModels.push(data);
        this.sceneManager.addModel(data.root);

        const meshes = ModelLoader.getAllMeshes(data.root);
        meshes.forEach((mesh) => {
          this.partMeshes.push(mesh);
          // Store original world position
          const pos = ModelLoader.getMeshWorldCenter(mesh);
          this.originalPositions.set(mesh, pos.clone());
          this.explodedPositions.set(mesh, pos.clone());
        });

        this._setStatus(`部件 "${data.fileName}" 加载完成`);
      } catch (err) {
        console.error('Failed to load part:', path, err);
        this._setStatus(`加载失败: ${err.message}`);
      }
    }

    this._updatePartTree();
    if (this.partMeshes.length > 0) {
      this.sceneManager.focusOn(this.sceneManager.getModelContainer());
    }
  }

  /**
   * Auto-explode parts along principal axes
   */
  autoExplode() {
    if (this.partMeshes.length === 0) {
      this._setStatus('请先加载目标部件');
      return;
    }

    // Calculate overall center
    const overallCenter = new THREE.Vector3();
    this.partMeshes.forEach((mesh) => {
      const center = this.originalPositions.get(mesh);
      if (center) overallCenter.add(center);
    });
    overallCenter.divideScalar(this.partMeshes.length);

    // For each mesh, determine direction and distance
    this.partMeshes.forEach((mesh) => {
      const origPos = this.originalPositions.get(mesh);
      if (!origPos) return;

      const relPos = origPos.clone().sub(overallCenter);
      const absX = Math.abs(relPos.x);
      const absY = Math.abs(relPos.y);
      const absZ = Math.abs(relPos.z);

      // Determine primary axis
      let dir = new THREE.Vector3();
      if (absX >= absY && absX >= absZ) {
        dir.set(Math.sign(relPos.x), 0, 0);
      } else if (absY >= absX && absY >= absZ) {
        dir.set(0, Math.sign(relPos.y), 0);
      } else {
        dir.set(0, 0, Math.sign(relPos.z));
      }

      // If the part is at center, use a default direction
      if (dir.length() < 0.01) {
        dir.set(1, 0, 0);
      }

      // Calculate distance based on bounding box size and multiplier
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      const partRadius = size.length() * 0.3;

      const distance = partRadius * this.explosionDistance * 3;

      const newPos = origPos.clone().add(dir.multiplyScalar(distance));
      this.explodedPositions.set(mesh, newPos.clone());

      // Move the mesh
      this._moveMeshTo(mesh, newPos);
    });

    this.isExploded = true;
    this._setStatus('自动爆炸完成');
  }

  /**
   * Move a mesh to a new world position by adjusting its parent-relative position
   */
  _moveMeshTo(mesh, worldPos) {
    // Get parent's world matrix inverse
    const parent = mesh.parent;
    if (!parent) {
      mesh.position.copy(worldPos);
      return;
    }

    const invMatrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const localPos = worldPos.clone().applyMatrix4(invMatrix);
    mesh.position.copy(localPos);
  }

  /**
   * Reset all parts to original positions
   */
  resetPositions() {
    this.partMeshes.forEach((mesh) => {
      const origPos = this.originalPositions.get(mesh);
      if (origPos) {
        this._moveMeshTo(mesh, origPos);
        this.explodedPositions.set(mesh, origPos.clone());
      }
    });
    this.isExploded = false;
    this._setStatus('已复位');
  }

  /**
   * Enter manual drag mode using TransformControls
   */
  async enterDragMode() {
    if (this.transformControls) {
      this.transformControls.dispose();
    }

    // Lazy-load TransformControls
    const mod = await import('three/addons/controls/TransformControls.js');
    const TransformControls = mod.TransformControls;

    this.transformControls = new TransformControls(
      this.sceneManager.camera,
      this.sceneManager.renderer.domElement
    );

    this.transformControls.addEventListener('dragging-changed', (event) => {
      this.sceneManager.controls.enabled = !event.value;
      if (!event.value && this.selectedDragMesh) {
        const worldPos = ModelLoader.getMeshWorldCenter(this.selectedDragMesh);
        this.explodedPositions.set(this.selectedDragMesh, worldPos.clone());
        this.isExploded = true;
      }
    });

    this.transformControls.addEventListener('change', () => {
      if (this.selectedDragMesh) {
        const worldPos = ModelLoader.getMeshWorldCenter(this.selectedDragMesh);
        this.explodedPositions.set(this.selectedDragMesh, worldPos.clone());
      }
    });

    this.sceneManager.scene.add(this.transformControls);
    this.isDragging = true;

    this.ui.btnEnterDrag.style.display = 'none';
    this.ui.btnExitDrag.style.display = 'block';
    this.ui.dragHint.style.display = 'block';

    this._setStatus('拖动模式已激活 - 点击结构树中的部件进行拖动');
  }

  exitDragMode() {
    if (this.transformControls) {
      this.transformControls.detach();
      this.transformControls.dispose();
      this.transformControls = null;
    }
    this.selectedDragMesh = null;
    this.isDragging = false;
    this.sceneManager.controls.enabled = true;

    this.ui.btnEnterDrag.style.display = 'block';
    this.ui.btnExitDrag.style.display = 'none';
    this.ui.dragHint.style.display = 'none';

    this._setStatus('拖动模式已退出');
  }

  _onPartNodeClick(node) {
    if (!node.isMesh || !node.object3D) return;

    if (this.isDragging && this.transformControls) {
      this.selectedDragMesh = node.object3D;
      this.transformControls.attach(node.object3D);
      this._setStatus(`正在拖动: ${node.name}`);
    }
  }

  _updatePartTree() {
    if (this.partModels.length === 0) {
      this.partTreeView.clear();
      return;
    }

    const rootNode = {
      id: 'parts_root_exp',
      name: '目标部件',
      fullPath: '目标部件',
      isMesh: false,
      isGroup: true,
      object3D: null,
      children: this.partModels.map((pm) => pm.hierarchy),
    };

    this.partTreeView.render(rootNode);
    this.partTreeView.expandAll();
  }

  /**
   * Get explosion data for thrust lines
   */
  getExplosionData() {
    const data = [];
    this.partMeshes.forEach((mesh) => {
      const origPos = this.originalPositions.get(mesh);
      const explPos = this.explodedPositions.get(mesh);
      if (origPos && explPos && !origPos.equals(explPos)) {
        data.push({
          mesh,
          from: origPos.clone(),
          to: explPos.clone(),
        });
      }
    });
    return data;
  }

  getNumberedParts() {
    const parts = [];
    this.partModels.forEach((pm) => {
      const numbered = AnnotationRenderer.collectNumberedParts(pm.hierarchy, []);
      parts.push(...numbered);
    });
    return parts;
  }

  _setStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = msg;
  }
}
