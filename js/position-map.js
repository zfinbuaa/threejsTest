import { ModelLoader } from './model-loader.js';
import { TreeView } from './tree-view.js';
import { AnnotationRenderer } from './annotation.js';

export class PositionMap {
  constructor(sceneManager, uiElements) {
    this.sceneManager = sceneManager;
    this.ui = uiElements;

    this.shellModels = [];       // { root, meshes, hierarchy, fileName, active }
    this.partModels = [];        // { root, meshes, hierarchy, fileName }
    this.activeShellIndex = -1;
    this.partMeshes = [];        // Flat list of target part meshes for annotation
    this.partColorMap = new Map(); // mesh path -> hex color

    this.partTreeView = new TreeView(uiElements.partTreePosition, {
      onNodeClick: (node) => this._onPartNodeClick(node),
    });

    this._setupUI();
  }

  _setupUI() {
    // Load shell button
    this.ui.btnLoadShell.addEventListener('click', () => {
      // Trigger via Electron API if available, otherwise use file input
      if (window.electronAPI) {
        // Handled by main process menu
        this._setStatus('请通过 文件→加载车壳模型 菜单加载');
      } else {
        this._createFileInput('.wrl', true, (files) => this.loadShellModels(files));
      }
    });

    // Load parts button
    this.ui.btnLoadParts.addEventListener('click', () => {
      if (window.electronAPI) {
        this._setStatus('请通过 文件→加载目标部件 菜单加载');
      } else {
        this._createFileInput('.wrl', true, (files) => this.loadPartModels(files));
      }
    });

    // Shell selector
    this.ui.shellSelector.addEventListener('change', () => {
      const index = parseInt(this.ui.shellSelector.value);
      if (index >= 0) {
        this.switchShell(index);
      }
    });

    // Color picker
    this.ui.btnApplyColor.addEventListener('click', () => {
      this._applyColorToSelected();
    });

    // Export is handled by app.js via ExportManager

    // Electron API events
    if (window.electronAPI) {
      window.electronAPI.onLoadShellModels((paths) => {
        this.loadShellModels(paths);
      });
      window.electronAPI.onLoadPartModels((paths) => {
        this.loadPartModels(paths);
      });
    }
  }

  _createFileInput(accept, multiple, callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = Array.from(input.files);
      callback(files);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  }

  /**
   * Load shell (car body) models
   */
  async loadShellModels(paths) {
    this._setStatus('正在加载车壳模型...');
    const loader = new ModelLoader();

    for (const path of paths) {
      try {
        const fileObj = typeof path === 'string' ? { path, name: path.split(/[\\/]/).pop() } : { path: URL.createObjectURL(path), name: path.name };
        const data = await loader.loadVRML(fileObj.path);
        data.fileName = fileObj.name.replace(/\.(wrl|vrml)$/i, '');
        data._isShell = true;

        // Set transparency to 0.7
        ModelLoader.setModelTransparency(data.root, 0.7, true);

        this.shellModels.push(data);
        this.sceneManager.addModel(data.root);

        // Initially hide all except first
        const isFirst = this.shellModels.length === 1;
        data.root.visible = isFirst;
        data.active = isFirst;

        if (isFirst) {
          this.activeShellIndex = 0;
        }

        this._setStatus(`车壳 "${data.fileName}" 加载完成`);
      } catch (err) {
        console.error('Failed to load shell:', path, err);
        this._setStatus(`加载失败: ${err.message}`);
      }
    }

    this._updateShellList();
  }

  /**
   * Load target part models
   */
  async loadPartModels(paths) {
    this._setStatus('正在加载目标部件...');
    const loader = new ModelLoader();

    for (const path of paths) {
      try {
        const fileObj = typeof path === 'string' ? { path, name: path.split(/[\\/]/).pop() } : { path: URL.createObjectURL(path), name: path.name };
        const data = await loader.loadVRML(fileObj.path);
        data.fileName = fileObj.name.replace(/\.(wrl|vrml)$/i, '');
        data._isPart = true;

        // Parts should be opaque
        this.partModels.push(data);
        this.sceneManager.addModel(data.root);

        // Collect all meshes for annotation
        const meshes = ModelLoader.getAllMeshes(data.root);
        this.partMeshes.push(...meshes);

        this._setStatus(`部件 "${data.fileName}" 加载完成`);
      } catch (err) {
        console.error('Failed to load part:', path, err);
        this._setStatus(`加载失败: ${err.message}`);
      }
    }

    this._updatePartTree();
    this.sceneManager.focusOn(this.sceneManager.getModelContainer());
  }

  /**
   * Switch active shell model
   */
  switchShell(index) {
    if (index < 0 || index >= this.shellModels.length) return;

    // Hide current shell
    if (this.activeShellIndex >= 0) {
      this.shellModels[this.activeShellIndex].root.visible = false;
      this.shellModels[this.activeShellIndex].active = false;
    }

    // Show new shell
    this.shellModels[index].root.visible = true;
    this.shellModels[index].active = true;
    this.activeShellIndex = index;

    this.ui.shellSelector.value = index;
    this._updateShellList();
    this._setStatus(`切换到车壳: ${this.shellModels[index].fileName}`);
  }

  _updateShellList() {
    this.ui.shellList.innerHTML = '';
    this.ui.shellSelector.innerHTML = '<option value="">-- 选择车壳 --</option>';

    if (this.shellModels.length === 0) {
      this.ui.shellSelector.style.display = 'none';
      this.ui.shellList.innerHTML = '<div style="color:#666;font-size:11px;padding:4px;">未加载车壳</div>';
      return;
    }

    this.ui.shellSelector.style.display = 'block';

    this.shellModels.forEach((shell, index) => {
      // Selector option
      const option = document.createElement('option');
      option.value = index;
      option.textContent = shell.fileName;
      if (index === this.activeShellIndex) {
        option.selected = true;
      }
      this.ui.shellSelector.appendChild(option);

      // List item
      const item = document.createElement('div');
      item.className = 'shell-item';
      if (index === this.activeShellIndex) {
        item.classList.add('active');
      }
      item.innerHTML = `
        <span class="shell-radio"></span>
        <span>${shell.fileName}</span>
      `;
      item.addEventListener('click', () => this.switchShell(index));
      this.ui.shellList.appendChild(item);
    });
  }

  _updatePartTree() {
    if (this.partModels.length === 0) {
      this.partTreeView.clear();
      return;
    }

    // Create combined hierarchy
    const rootNode = {
      id: 'parts_root',
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

  _onPartNodeClick(node) {
    if (!node.isMesh || !node.object3D) return;

    this._selectedPart = node;
    this.ui.colorPickerContainer.style.display = 'flex';
    this.ui.selectedPartName.textContent = node.name;

    const mat = Array.isArray(node.object3D.material)
      ? node.object3D.material[0]
      : node.object3D.material;
    if (mat && mat.color) {
      this.ui.partColorPicker.value = '#' + mat.color.getHexString();
    }
  }

  _applyColorToSelected() {
    if (!this._selectedPart || !this._selectedPart.object3D) return;

    const color = parseInt(this.ui.partColorPicker.value.slice(1), 16);
    ModelLoader.setMeshColor(this._selectedPart.object3D, color);
    this._selectedPart.object3D.userData._customColor = color;

    this._setStatus(`"${this._selectedPart.name}" 颜色已更新`);
    this._updatePartTree();
  }

  _setStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = msg;
  }

  /**
   * Get numbered parts from the hierarchy tree for annotation.
   */
  getNumberedParts() {
    const parts = [];
    this.partModels.forEach((pm) => {
      const numbered = AnnotationRenderer.collectNumberedParts(pm.hierarchy, []);
      parts.push(...numbered);
    });
    return parts;
  }
}
