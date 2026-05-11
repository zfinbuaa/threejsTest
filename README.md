# 3D模型可视化工具

基于 **Three.js + Electron** 的桌面应用，支持将 VRML 三维模型渲染为带标注的 2D 位置图和爆炸图。

## 功能

### 位置图模式
- 加载多个车壳 VRML 数模，车壳透明度 0.7，可点击切换
- 加载目标部件数模，结构树层级展示
- 通过结构树为部件指定颜色、控制显隐、手动分配标注序号
- 白底明亮场景，鼠标操控相机旋转/缩放/平移
- 导出 PNG：水平序号圆圈 + 左右竖列均匀分布 + 自适应连线

### 爆炸图模式
- 加载目标部件数模，支持自动爆炸（沿主轴分离，滑块调节距离）
- 手动拖动部件（TransformControls 三轴移动）
- 一键复位至原始位置
- 导出 PNG：标注序号 + 红色虚线推力线（原始位置→爆炸位置）

## 运行

### 开发模式
```bash
git clone https://github.com/zfinbuaa/threejsTest.git
cd threejsTest
npm install
npm start
```

### 浏览器预览
```bash
npm run dev
# 打开 http://localhost:3000
```

### 生产部署
将 `dist/win-unpacked/` 文件夹复制到目标电脑，双击 `ModelViewer.exe`，无需安装 Node.js。

VRML 数模文件放入 `dist/win-unpacked/models/` 文件夹，通过菜单或界面按钮加载。

## 构建
```bash
npm run build
# 输出: dist/win-unpacked/
```

## 技术栈
| 层 | 技术 |
|---|---|
| 3D 引擎 | Three.js r160 |
| VRML 加载 | VRMLLoader |
| 桌面壳 | Electron 28 |
| 标注绘制 | Canvas 2D + gl.readPixels 帧缓冲读取 |
| 打包 | electron-builder (dir target) |

## 项目结构
```
├── main.js              # Electron 主进程
├── preload.js           # 安全 IPC 桥接
├── index.html           # 主界面
├── css/style.css        # 样式
├── js/
│   ├── app.js           # 应用入口，模式切换
│   ├── scene-manager.js # 场景/相机/灯光
│   ├── model-loader.js  # VRML 加载与材质管理
│   ├── tree-view.js     # 结构树组件
│   ├── position-map.js  # 位置图模式
│   ├── explosion-view.js# 爆炸图模式
│   ├── annotation.js    # 2D 标注渲染
│   └── export.js        # PNG 导出合成
├── assets/models/       # 示例数模目录
└── dist/win-unpacked/   # 构建输出
```

## License

MIT
