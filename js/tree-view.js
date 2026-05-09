export class TreeView {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onNodeClick = options.onNodeClick || null;
    this.onVisibilityToggle = options.onVisibilityToggle || null;
    this.onNumberChange = options.onNumberChange || null;
    this.selectedNodeId = null;
    this.expandedNodes = new Set();
  }

  render(hierarchy, title = '') {
    this.container.innerHTML = '';
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'section-title';
      titleEl.textContent = title;
      this.container.appendChild(titleEl);
    }
    this._renderNode(hierarchy, this.container, 0);
  }

  _renderNode(node, parentEl, depth) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    nodeEl.dataset.nodeId = node.id;

    const headerEl = document.createElement('div');
    headerEl.className = 'tree-node-header';
    if (node.id === this.selectedNodeId) {
      headerEl.classList.add('selected');
    }

    // Expand/collapse toggle
    const hasChildren = node.children && node.children.length > 0;
    const toggleEl = document.createElement('span');
    toggleEl.className = 'expand-toggle';
    if (hasChildren) {
      const isExpanded = this.expandedNodes.has(node.id);
      toggleEl.textContent = isExpanded ? '▼' : '▶';
      toggleEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleExpand(node.id, nodeEl);
      });
    }
    headerEl.appendChild(toggleEl);

    // Visibility toggle (eye icon) - for mesh nodes
    if (node.isMesh && node.object3D) {
      const visEl = document.createElement('span');
      visEl.className = 'node-vis-toggle';
      const visible = node.object3D.visible !== false;
      visEl.textContent = visible ? '👁' : '○';
      visEl.title = visible ? '点击隐藏' : '点击显示';
      visEl.addEventListener('click', (e) => {
        e.stopPropagation();
        node.object3D.visible = !(node.object3D.visible !== false);
        visEl.textContent = node.object3D.visible !== false ? '👁' : '○';
        if (this.onVisibilityToggle) {
          this.onVisibilityToggle(node, node.object3D.visible !== false);
        }
      });
      headerEl.appendChild(visEl);

      // Visibility also affects children
      if (node.object3D.visible === false) {
        headerEl.style.opacity = '0.4';
      }
    }

    // Icon
    const iconEl = document.createElement('span');
    iconEl.className = 'node-icon';
    iconEl.textContent = node.isMesh ? '◉' : '📁';
    headerEl.appendChild(iconEl);

    // Name
    const nameEl = document.createElement('span');
    nameEl.className = 'node-name';
    nameEl.textContent = node.name;
    nameEl.title = node.fullPath;
    headerEl.appendChild(nameEl);

    // Color indicator (only for meshes)
    if (node.isMesh && node.object3D && node.object3D.material) {
      const colorEl = document.createElement('span');
      colorEl.className = 'node-color';
      const mat = Array.isArray(node.object3D.material)
        ? node.object3D.material[0]
        : node.object3D.material;
      if (mat.color) {
        colorEl.style.backgroundColor = '#' + mat.color.getHexString();
      }
      headerEl.appendChild(colorEl);
    }

    // Number input for mesh nodes
    if (node.isMesh) {
      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.className = 'node-number-input';
      numInput.min = 1;
      numInput.max = 999;
      numInput.step = 1;
      numInput.placeholder = '#';
      numInput.title = '标注序号（留空则不标注）';
      numInput.value = node._seqNumber || '';
      numInput.addEventListener('click', (e) => e.stopPropagation());
      numInput.addEventListener('input', (e) => {
        const val = e.target.value ? parseInt(e.target.value) : null;
        node._seqNumber = val;
        if (this.onNumberChange) {
          this.onNumberChange(node, val);
        }
      });
      headerEl.appendChild(numInput);
    }

    // Click handler
    headerEl.addEventListener('click', (e) => {
      // Don't trigger if clicking on input
      if (e.target.tagName === 'INPUT') return;
      this.selectNode(node);
      if (this.onNodeClick) {
        this.onNodeClick(node);
      }
    });

    nodeEl.appendChild(headerEl);

    // Children
    if (hasChildren) {
      const childrenEl = document.createElement('div');
      childrenEl.className = 'tree-children';
      if (!this.expandedNodes.has(node.id)) {
        childrenEl.classList.add('collapsed');
      }
      for (const child of node.children) {
        this._renderNode(child, childrenEl, depth + 1);
      }
      nodeEl.appendChild(childrenEl);
    }

    parentEl.appendChild(nodeEl);
  }

  _toggleExpand(nodeId, nodeEl) {
    if (this.expandedNodes.has(nodeId)) {
      this.expandedNodes.delete(nodeId);
    } else {
      this.expandedNodes.add(nodeId);
    }
    const childrenEl = nodeEl.querySelector('.tree-children');
    if (childrenEl) {
      childrenEl.classList.toggle('collapsed');
    }
    const toggleEl = nodeEl.querySelector('.expand-toggle');
    if (toggleEl) {
      toggleEl.textContent = this.expandedNodes.has(nodeId) ? '▼' : '▶';
    }
  }

  selectNode(node) {
    this.selectedNodeId = node.id;
    const allHeaders = this.container.querySelectorAll('.tree-node-header');
    allHeaders.forEach((h) => h.classList.remove('selected'));
    const targetHeader = this.container.querySelector(`[data-node-id="${node.id}"] > .tree-node-header`);
    if (targetHeader) {
      targetHeader.classList.add('selected');
    }
  }

  expandAll() {
    this._expandAllNodes(this.container);
  }

  _expandAllNodes(container) {
    const childrenEls = container.querySelectorAll('.tree-children');
    childrenEls.forEach((el) => {
      el.classList.remove('collapsed');
      const parentNodeEl = el.parentElement;
      if (parentNodeEl) {
        const nodeId = parentNodeEl.querySelector('.tree-node-header')?.parentElement?.dataset?.nodeId;
        if (nodeId) {
          this.expandedNodes.add(nodeId);
        }
        const toggle = parentNodeEl.querySelector('.expand-toggle');
        if (toggle) toggle.textContent = '▼';
      }
    });
  }

  collapseAll() {
    const childrenEls = this.container.querySelectorAll('.tree-children');
    childrenEls.forEach((el) => {
      el.classList.add('collapsed');
      const parentNodeEl = el.parentElement;
      if (parentNodeEl) {
        const toggle = parentNodeEl.querySelector('.expand-toggle');
        if (toggle) toggle.textContent = '▶';
      }
    });
    this.expandedNodes.clear();
  }

  clear() {
    this.container.innerHTML = '';
    this.selectedNodeId = null;
    this.expandedNodes.clear();
  }
}
