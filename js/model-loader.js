import * as THREE from 'three';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js';

const vrmlLoader = new VRMLLoader();

export class ModelLoader {
  constructor() {
    this._idCounter = 0;
  }

  /**
   * Load a single VRML file
   * @param {string} filePath - Absolute file path
   * @returns {Promise<{root: THREE.Object3D, meshes: Map<string, THREE.Mesh>, hierarchy: TreeNode}>}
   */
  async loadVRML(filePath) {
    return new Promise((resolve, reject) => {
      vrmlLoader.load(
        filePath,
        (object) => {
          const data = this._processModel(object, filePath);
          resolve(data);
        },
        (progress) => {
          console.log(`Loading: ${progress.loaded}/${progress.total}`);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Process loaded model, extract meshes and build hierarchy
   */
  _processModel(object, filePath) {
    // Extract filename for display
    const fileName = filePath.split(/[\\/]/).pop().replace(/\.(wrl|vrml)$/i, '');

    const meshes = new Map();
    const hierarchy = this._buildHierarchy(object, meshes, '', fileName);

    return {
      root: object,
      meshes,
      hierarchy,
      fileName,
    };
  }

  /**
   * Recursively build tree structure
   */
  _buildHierarchy(node, meshes, path, fileName) {
    const id = `node_${this._idCounter++}`;
    const name = node.name || node.type || 'Node';
    const displayName = name === fileName ? fileName : name;
    const fullPath = path ? `${path}/${displayName}` : displayName;

    const treeNode = {
      id,
      name: displayName,
      fullPath,
      isMesh: node.isMesh || node.type === 'Mesh',
      isGroup: node.isGroup || node.isObject3D,
      object3D: node,
      _seqNumber: null,
      children: [],
    };

    if (node.isMesh) {
      meshes.set(fullPath, node);

      // Store original material properties for reset
      node.userData._originalMaterial = {
        color: node.material.color ? node.material.color.getHex() : 0xcccccc,
        opacity: node.material.opacity !== undefined ? node.material.opacity : 1.0,
        transparent: node.material.transparent || false,
      };
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childNode = this._buildHierarchy(child, meshes, fullPath, fileName);
        treeNode.children.push(childNode);
      }
    }

    return treeNode;
  }

  /**
   * Set transparency on all meshes of a model
   */
  static setModelTransparency(root, opacity, depthWrite = true) {
    root.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          mat.transparent = true;
          mat.opacity = opacity;
          mat.depthWrite = depthWrite;
          mat.needsUpdate = true;
        });
      }
    });
  }

  /**
   * Set color on a specific mesh
   */
  static setMeshColor(mesh, hexColor) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      if (mat.color) {
        mat.color.setHex(hexColor);
        mat.needsUpdate = true;
      }
    });
  }

  /**
   * Reset mesh to original color
   */
  static resetMeshColor(mesh) {
    if (mesh.userData._originalMaterial) {
      const orig = mesh.userData._originalMaterial;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        if (mat.color) {
          mat.color.setHex(orig.color);
        }
        if (mat.opacity !== undefined && orig.opacity !== undefined) {
          mat.opacity = orig.opacity;
          mat.transparent = orig.transparent;
        }
        mat.needsUpdate = true;
      });
    }
  }

  /**
   * Get world position of a mesh (center of bounding box)
   */
  static getMeshWorldCenter(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }

  /**
   * Get all meshes from a model root
   */
  static getAllMeshes(root) {
    const meshes = [];
    root.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child);
      }
    });
    return meshes;
  }

  /**
   * Create a placeholder model for testing
   */
  static createPlaceholderCarBody() {
    const group = new THREE.Group();
    group.name = '车壳_示例';

    // Main body
    const bodyGeo = new THREE.BoxGeometry(4, 1.5, 2, 4, 4, 4);
    // Slightly deform to look more car-like
    const positions = bodyGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      // Round the top
      if (y > 0.3) {
        positions.setY(i, y * (1 - Math.abs(x) / 4) * 0.8 + 0.3);
      }
    }
    bodyGeo.computeVertexNormals();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x4488cc,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.7,
      depthWrite: true,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.name = '车身';

    group.add(bodyMesh);

    // Roof
    const roofGeo = new THREE.BoxGeometry(1.8, 0.3, 1.6);
    const roofMesh = new THREE.Mesh(roofGeo, bodyMat.clone());
    roofMesh.position.set(-0.3, 1.0, 0);
    roofMesh.name = '车顶';
    group.add(roofMesh);

    // Windows (as separate meshes so they get transparency)
    const windowGeo = new THREE.PlaneGeometry(1.2, 0.5);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const frontWindow = new THREE.Mesh(windowGeo, windowMat);
    frontWindow.position.set(0.8, 0.8, 0.01);
    frontWindow.name = '前挡风';
    group.add(frontWindow);

    const rearWindow = new THREE.Mesh(windowGeo, windowMat);
    rearWindow.position.set(-1.5, 0.8, 0.01);
    rearWindow.name = '后挡风';
    group.add(rearWindow);

    return group;
  }

  /**
   * Create placeholder target parts for testing
   */
  static createPlaceholderParts() {
    const group = new THREE.Group();
    group.name = '目标部件_示例';

    // Engine block
    const engineGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 16);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0xdd4444,
      roughness: 0.4,
      metalness: 0.8,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(0.8, 0.1, 0);
    engine.rotation.z = Math.PI / 2;
    engine.name = '发动机';
    group.add(engine);

    // Transmission
    const transGeo = new THREE.BoxGeometry(0.6, 0.5, 0.5);
    const transMat = new THREE.MeshStandardMaterial({
      color: 0x44dd44,
      roughness: 0.4,
      metalness: 0.8,
    });
    const transmission = new THREE.Mesh(transGeo, transMat);
    transmission.position.set(0, 0, 0);
    transmission.name = '变速箱';
    group.add(transmission);

    // Radiator
    const radGeo = new THREE.BoxGeometry(0.3, 0.6, 1.0);
    const radMat = new THREE.MeshStandardMaterial({
      color: 0x4444dd,
      roughness: 0.4,
      metalness: 0.8,
    });
    const radiator = new THREE.Mesh(radGeo, radMat);
    radiator.position.set(2.0, 0.2, 0);
    radiator.name = '散热器';
    group.add(radiator);

    // Battery
    const batteryGeo = new THREE.BoxGeometry(0.5, 0.3, 0.4);
    const batteryMat = new THREE.MeshStandardMaterial({
      color: 0xdddd44,
      roughness: 0.4,
      metalness: 0.8,
    });
    const battery = new THREE.Mesh(batteryGeo, batteryMat);
    battery.position.set(-1.2, 0.1, 0.5);
    battery.name = '电池';
    group.add(battery);

    // Suspension front
    const suspGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8);
    const suspMat = new THREE.MeshStandardMaterial({
      color: 0xdd44dd,
      roughness: 0.4,
      metalness: 0.8,
    });
    const suspensionF = new THREE.Mesh(suspGeo, suspMat);
    suspensionF.position.set(2.2, -0.3, 0.7);
    suspensionF.name = '前悬架(右)';
    suspensionF
    group.add(suspensionF);

    const suspensionFL = new THREE.Mesh(suspGeo, suspMat);
    suspensionFL.position.set(2.2, -0.3, -0.7);
    suspensionFL.name = '前悬架(左)';
    suspensionFL
    group.add(suspensionFL);

    // Wheels
    const wheelGeo = new THREE.TorusGeometry(0.35, 0.15, 8, 16);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.3,
    });
    const wheelPositions = [
      [2.2, -0.5, 0.8],
      [2.2, -0.5, -0.8],
      [-1.8, -0.5, 0.8],
      [-1.8, -0.5, -0.8],
    ];
    wheelPositions.forEach(([x, y, z], i) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      wheel.rotation.y = Math.PI / 2;
      wheel.name = `车轮${i + 1}`;
      group.add(wheel);
    });

    // Exhaust
    const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8);
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.3,
      metalness: 0.9,
    });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(-2.5, -0.4, 0.3);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.name = '排气管';
    group.add(exhaust);

    return group;
  }
}

/**
 * @typedef {Object} TreeNode
 * @property {string} id
 * @property {string} name
 * @property {string} fullPath
 * @property {boolean} isMesh
 * @property {boolean} isGroup
 * @property {THREE.Object3D} object3D
 * @property {TreeNode[]} children
 */
