export class TreeView {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onNodeClick = options.onNodeClick || null;
    this.onColorChange = options.onColorChange || null;
    this.selectedNodeId = null;
    this.expandedNodes = new Set();
  }

  /**
   * Render tree from hierarchy data
   */
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

  /**
   * Recursively render a tree node
   */
  _renderNode(node, parentEl, depth) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    nodeEl.dataset.nodeId = node.id;

    const headerEl = document.createElement('div');
    headerEl.className = 'tree-node-header';
    if (node.id === this.selectedNodeId) {
      headerEl.classList.add('selected');
    }

    // Expand/collapse toggle (only for groups with children)
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

    // Click handler
    headerEl.addEventListener('click', () => {
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
    // Update visual selection
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
