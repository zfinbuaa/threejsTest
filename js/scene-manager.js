import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0f0f0);
    this.scene.fog = new THREE.Fog(0xf0f0f0, 20, 100);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(8, 5, 10);
    this.camera.lookAt(0, 0, 0);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;
    this.controls.update();

    // Lighting
    this._setupLights();

    // Grid
    this.gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xe0e0e0);
    this.scene.add(this.gridHelper);

    // Ground plane for shadows
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    ground.name = '__ground__';
    this.scene.add(ground);

    // Axes helper (small)
    this.axesHelper = new THREE.AxesHelper(3);
    this.scene.add(this.axesHelper);

    // Container for loaded models
    this.modelContainer = new THREE.Group();
    this.modelContainer.name = '__model_container__';
    this.scene.add(this.modelContainer);

    // Animation loop
    this._animate = this._animate.bind(this);
    this._animate();

    // Resize
    this._onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  _setupLights() {
    // Ambient light - base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    ambient.name = '__ambient__';
    this.scene.add(ambient);

    // Hemisphere light - sky/ground
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.name = '__hemi__';
    this.scene.add(hemiLight);

    // Main directional light with shadows
    this.mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.mainLight.position.set(10, 15, 10);
    this.mainLight.castShadow = true;
    this.mainLight.shadow.mapSize.width = 2048;
    this.mainLight.shadow.mapSize.height = 2048;
    this.mainLight.shadow.camera.near = 0.5;
    this.mainLight.shadow.camera.far = 100;
    this.mainLight.shadow.camera.left = -20;
    this.mainLight.shadow.camera.right = 20;
    this.mainLight.shadow.camera.top = 20;
    this.mainLight.shadow.camera.bottom = -20;
    this.mainLight.shadow.bias = -0.0001;
    this.mainLight.name = '__main_light__';
    this.scene.add(this.mainLight);

    // Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 3, -5);
    fillLight.name = '__fill_light__';
    this.scene.add(fillLight);
  }

  _animate() {
    requestAnimationFrame(this._animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  addModel(model) {
    this.modelContainer.add(model);
  }

  removeModel(model) {
    this.modelContainer.remove(model);
  }

  clearModels() {
    while (this.modelContainer.children.length > 0) {
      this.modelContainer.remove(this.modelContainer.children[0]);
    }
  }

  getModelContainer() {
    return this.modelContainer;
  }

  resetCamera() {
    this.camera.position.set(8, 5, 10);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  viewFront() {
    this.camera.position.set(0, 0, 12);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  viewTop() {
    this.camera.position.set(0, 12, 0.01);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  viewSide() {
    this.camera.position.set(12, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  focusOn(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2;

    this.controls.target.copy(center);
    this.camera.position.set(center.x + distance * 0.7, center.y + distance * 0.5, center.z + distance * 0.7);
    this.controls.update();
  }
}
