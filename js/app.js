import { SceneManager } from './scene-manager.js';
import { ModelLoader } from './model-loader.js';
import { PositionMap } from './position-map.js';
import { ExplosionView } from './explosion-view.js';
import { AnnotationRenderer } from './annotation.js';
import { ExportManager } from './export.js';

class App {
  constructor() {
    // Canvas elements
    this.threeCanvas = document.getElementById('three-canvas');
    this.annotationCanvas = document.getElementById('annotation-canvas');

    // UI elements for position map
    this.positionUI = {
      btnLoadShell: document.getElementById('btn-load-shell'),
      btnLoadParts: document.getElementById('btn-load-parts'),
      shellSelector: document.getElementById('shell-selector'),
      shellList: document.getElementById('shell-list'),
      partTreePosition: document.getElementById('part-tree-position'),
      colorPickerContainer: document.getElementById('color-picker-container'),
      partColorPicker: document.getElementById('part-color-picker'),
      selectedPartName: document.getElementById('selected-part-name'),
      btnApplyColor: document.getElementById('btn-apply-color'),
      btnExportPosition: document.getElementById('btn-export-position'),
    };

    // UI elements for explosion view
    this.explosionUI = {
      btnLoadPartsExplosion: document.getElementById('btn-load-parts-explosion'),
      partTreeExplosion: document.getElementById('part-tree-explosion'),
      btnAutoExplode: document.getElementById('btn-auto-explode'),
      btnResetExplosion: document.getElementById('btn-reset-explosion'),
      explosionDistanceSlider: document.getElementById('explosion-distance'),
      explosionDistanceLabel: document.getElementById('explosion-distance-label'),
      btnEnterDrag: document.getElementById('btn-enter-drag'),
      btnExitDrag: document.getElementById('btn-exit-drag'),
      dragHint: document.getElementById('drag-hint'),
      btnExportExplosion: document.getElementById('btn-export-explosion'),
    };

    // Mode state
    this.currentMode = 'position'; // 'position' | 'explosion'

    this._init().catch((err) => {
      console.error('App init failed:', err);
      const statusEl = document.getElementById('status-text');
      if (statusEl) statusEl.textContent = '初始化失败: ' + (err.message || err);
    });
  }

  async _init() {
    this._setStatus('正在初始化...');

    try {
      // Initialize scene manager
      this.sceneManager = new SceneManager(this.threeCanvas);

      // Initialize annotation renderer
      this.annotationRenderer = new AnnotationRenderer(this.annotationCanvas, this.sceneManager);

      // Initialize export manager
      this.exportManager = new ExportManager(this.sceneManager, this.annotationRenderer);

      // Initialize position map
      this.positionMap = new PositionMap(this.sceneManager, this.positionUI);

      // Initialize explosion view
      this.explosionView = new ExplosionView(this.sceneManager, this.explosionUI);

      // Wire up export for position map
      this.positionUI.btnExportPosition.addEventListener('click', async () => {
        await this._exportPositionMap();
      });

      // Wire up export for explosion view
      this.explosionUI.btnExportExplosion.addEventListener('click', async () => {
        await this._exportExplosionView();
      });

      // Mode switching
      this._setupModeSwitching();

      // Electron API
      this._setupElectronAPI();

      // Load placeholder models for demo
      try {
        await this._loadPlaceholders();
      } catch (err) {
        console.error('Placeholder load failed:', err);
        this._setStatus('示例模型加载失败，可手动加载VRML文件');
      }

      // Handle resize
      this._onResize = () => {
        this.annotationRenderer.resize();
      };
      window.addEventListener('resize', this._onResize);

      this._setStatus('就绪');
    } catch (err) {
      console.error('Init error:', err);
      this._setStatus('初始化错误: ' + (err.message || err));
    }
  }

  _setupModeSwitching() {
    const tabPosition = document.getElementById('tab-position');
    const tabExplosion = document.getElementById('tab-explosion');
    const positionPanel = document.getElementById('position-panel');
    const explosionPanel = document.getElementById('explosion-panel');

    tabPosition.addEventListener('click', () => this._switchMode('position'));
    tabExplosion.addEventListener('click', () => this._switchMode('explosion'));

    if (window.electronAPI) {
      window.electronAPI.onSwitchMode((mode) => this._switchMode(mode));
    }
  }

  _switchMode(mode) {
    this.currentMode = mode;

    const tabPosition = document.getElementById('tab-position');
    const tabExplosion = document.getElementById('tab-explosion');
    const positionPanel = document.getElementById('position-panel');
    const explosionPanel = document.getElementById('explosion-panel');

    if (mode === 'position') {
      tabPosition.classList.add('active');
      tabExplosion.classList.remove('active');
      positionPanel.classList.add('active');
      explosionPanel.classList.remove('active');

      // Exit drag mode if in explosion
      if (this.explosionView.isDragging) {
        this.explosionView.exitDragMode();
      }

      // Show position-mode models, hide explosion-mode models
      this.positionMap.partModels.forEach((pm) => { pm.root.visible = true; });
      this.positionMap.shellModels.forEach((sm) => { sm.root.visible = sm.active; });
      this.explosionView.partModels.forEach((pm) => { pm.root.visible = false; });
    } else {
      tabExplosion.classList.add('active');
      tabPosition.classList.remove('active');
      explosionPanel.classList.add('active');
      positionPanel.classList.remove('active');

      // Show explosion-mode models, hide position-mode models
      this.positionMap.partModels.forEach((pm) => { pm.root.visible = false; });
      this.positionMap.shellModels.forEach((sm) => { sm.root.visible = false; });
      this.explosionView.partModels.forEach((pm) => { pm.root.visible = true; });
    }
  }

  _setupElectronAPI() {
    if (!window.electronAPI) return;

    window.electronAPI.onResetCamera(() => {
      this.sceneManager.resetCamera();
    });
    window.electronAPI.onViewFront(() => {
      this.sceneManager.viewFront();
    });
    window.electronAPI.onViewTop(() => {
      this.sceneManager.viewTop();
    });
    window.electronAPI.onViewSide(() => {
      this.sceneManager.viewSide();
    });
    window.electronAPI.onSwitchMode((mode) => {
      this._switchMode(mode);
    });
  }

  async _loadPlaceholders() {
    this._setStatus('正在加载示例模型...');

    // Create placeholder car body
    const shellGroup = ModelLoader.createPlaceholderCarBody();
    const loader = new ModelLoader();
    const shellData = loader._processModel(shellGroup, '示例车壳.wrl');
    shellData.fileName = '示例车壳';
    shellData._isShell = true;

    // Set transparency
    ModelLoader.setModelTransparency(shellData.root, 0.7, true);

    this.positionMap.shellModels.push(shellData);
    this.sceneManager.addModel(shellData.root);
    shellData.active = true;
    this.positionMap.activeShellIndex = 0;
    this.positionMap._updateShellList();

    // Create placeholder target parts
    const partsGroup = ModelLoader.createPlaceholderParts();
    const partsData = loader._processModel(partsGroup, '示例部件.wrl');
    partsData.fileName = '示例部件';
    partsData._isPart = true;

    // Position map parts
    this.positionMap.partModels.push(partsData);
    const partMeshesPos = ModelLoader.getAllMeshes(partsData.root);
    this.positionMap.partMeshes.push(...partMeshesPos);

    // Create separate copy for explosion view
    const partsGroup2 = ModelLoader.createPlaceholderParts();
    const partsData2 = loader._processModel(partsGroup2, '示例部件.wrl');
    partsData2.fileName = '示例部件';
    partsData2._isPart = true;

    this.explosionView.partModels.push(partsData2);
    const partMeshesExp = ModelLoader.getAllMeshes(partsData2.root);
    partMeshesExp.forEach((mesh) => {
      this.explosionView.partMeshes.push(mesh);
      const pos = ModelLoader.getMeshWorldCenter(mesh);
      this.explosionView.originalPositions.set(mesh, pos.clone());
      this.explosionView.explodedPositions.set(mesh, pos.clone());
    });

    this.sceneManager.addModel(partsData.root);
    this.sceneManager.addModel(partsData2.root);

    // Initially hide explosion parts
    partsData2.root.visible = false;

    this.positionMap._updatePartTree();
    this.explosionView._updatePartTree();

    // Focus camera on models
    this.sceneManager.focusOn(this.sceneManager.getModelContainer());

    this._setStatus('示例模型加载完成。可通过菜单加载VRML文件或直接操作。');
  }

  async _exportPositionMap() {
    const numberedParts = this.positionMap.getNumberedParts();

    if (numberedParts.length === 0) {
      alert('未找到带序号的部件！\n\n请在左侧结构树中为各部件输入序号（1,2,3...），留空的部件将不标注。');
      this._setStatus('未找到带序号的部件，请在结构树中为部件设置序号');
      return;
    }

    try {
      this._setStatus('正在导出位置图...');
      const dataUrl = await this.exportManager.exportPositionMap(numberedParts);
      const result = await this.exportManager.downloadPNG(dataUrl, '位置图.png');
      if (result) {
        this._setStatus(`位置图已导出: ${result}`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败: ' + (err.message || err));
      this._setStatus(`导出失败: ${err.message}`);
    }
  }

  async _exportExplosionView() {
    const numberedParts = this.explosionView.getNumberedParts();

    if (numberedParts.length === 0) {
      alert('未找到带序号的部件！\n\n请在左侧结构树中为各部件输入序号（1,2,3...），留空的部件将不标注。');
      this._setStatus('未找到带序号的部件，请在结构树中为部件设置序号');
      return;
    }

    try {
      this._setStatus('正在导出爆炸图...');
      const explosionData = this.explosionView.getExplosionData();
      const dataUrl = await this.exportManager.exportExplosionView(numberedParts, explosionData);
      const result = await this.exportManager.downloadPNG(dataUrl, '爆炸图.png');
      if (result) {
        this._setStatus(`爆炸图已导出: ${result}`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('导出失败: ' + (err.message || err));
      this._setStatus(`导出失败: ${err.message}`);
    }
  }

  _setStatus(msg) {
    const statusEl = document.getElementById('status-text');
    if (statusEl) statusEl.textContent = msg;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
