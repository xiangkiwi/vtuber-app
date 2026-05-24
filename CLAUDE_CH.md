# VTuber 脸部捕捉应用程式 — 专案参考文件

## 专案目标
一个专为 VTuber 设计的轻量级网页脸部捕捉应用程式。双模式设计：
1. **UI 模式** — 左侧设定面板，右侧 3D 预览画布。
2. **实况模式** — 隐藏所有 UI，画布全萤幕显示，背景设为纯绿色供直播软件色度键扣图。

## 使用情境
- 直播软件：**抖音直播伴侣**（无 Browser Source，用窗口捕获 + 色度键）
- 实况模式背景为 **纯绿色（`#00FF00`）**，不使用透明背景
- 部署方式：**GitHub + Vercel** 网页托管，女朋友访问固定网址即可使用
- 目标用户：非技术用户，操作须直觉友善

## 技术堆叠
| 工具 | 用途 |
|---|---|
| Vite | 构建工具 |
| React | UI 框架 |
| Three.js | 3D 引擎 |
| @react-three/fiber (R3F) | Three.js 的 React 绑定 |
| @react-three/drei | R3F 辅助工具（摄影机、控制器等） |
| @pixiv/three-vrm | VRM 模型解析与运行时（支持 0.x 和 1.0） |
| Tailwind CSS | 控制面板样式 |
| MediaPipe FaceMesh | 脸部追踪（完整 468 特征点，GPU delegate） |

## 档案结构
```
vtuber-app/
├── public/
│   └── avatar.vrm              # 预设测试模型
├── src/
│   ├── components/
│   │   ├── VrmViewer.jsx       # VRM 渲染 + 动画循环
│   │   ├── Sidebar.jsx         # 控制面板 UI
│   │   └── Scene.jsx           # R3F 场景、灯光、摄影机
│   ├── hooks/
│   │   ├── useVrm.js           # VRM 载入逻辑（独立封装）
│   │   └── useFaceTracking.js  # MediaPipe 脸部追踪逻辑
│   ├── App.jsx                 # 版面布局 + 模式切换
│   ├── main.jsx
│   └── index.css               # Tailwind + 绿幕背景覆写
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## 架构决策

### 模式切换
- 在 `<body>` 加入 `live-mode` class 来切换模式 — 不需要卸载/重新挂载 R3F。
- 实况模式：背景切换为纯绿色（`#00FF00`），隐藏所有 UI。
- 切换按钮位于侧边栏**最下方**。

### 绿幕方案（取代透明背景）
- 抖音直播伴侣不支持 Browser Source，只能窗口捕获。
- 实况模式背景设为 `#00FF00`，用直播软件的色度键功能扣除绿幕。
- 好处：所有直播软件通用，不依赖特定透明背景支持。

### VRM 载入
- 自订 Hook `useVrm.js` 负责处理 `GLTFLoader` + `VRMLoaderPlugin` 的副作用。
- 回传 `{ vrm, loading, error }`。
- 支持 VRM 0.x 与 1.0，载入时自动判断规格。
- **Phase 1 就支持用户上传自定义 VRM 档案**（非技术用户须能自行更换模型）。

### 摄影机
- `<PerspectiveCamera>` 位置设在 `[0, 1.4, 1.2]`，看向 `[0, 1.3, 0]`。
- 不需要知道模型的骨骼位置，就能框住标准 VRM 的胸部/脸部区域。

### VRM 朝向修正
- VRM 规格：模型朝向 `-Z`。载入后套用 `vrm.scene.rotation.y = Math.PI` 让模型面向镜头。

### 动画循环
- `useFrame` 每帧呼叫 `vrm.update(delta)`。
- 驱动弹簧骨骼（头髮/衣物物理）与表情系统。

### 脸部追踪（Phase 2）
- 使用 MediaPipe FaceMesh 完整 468 特征点。
- 启用 GPU delegate，将运算卸载至独立显卡，降低 CPU 占用（目标 10-20%）。
- 逻辑封装在 `useFaceTracking.js` Hook，与渲染层解耦。
- 追踪目标：头部旋转、眨眼、张嘴、眉毛上扬。

## 开发阶段

### Phase 1 — 基础架构（当前阶段）
- [ ] 专案脚手架（Vite + React + R3F + Tailwind）
- [ ] 双模式版面布局，使用 CSS class 切换
- [ ] 实况模式绿幕背景（`#00FF00`）
- [ ] VRM 载入器，支持 VRM 0.x 和 1.0 自动判断
- [ ] **用户可上传/更换自定义 VRM 档案**
- [ ] 基础场景：AmbientLight + DirectionalLight
- [ ] VRM Y 轴旋转修正 + 弹簧骨骼更新循环
- [ ] 侧边栏切换按钮（位于最下方）
- [ ] 部署至 Vercel

### Phase 2 — 脸部追踪
- [ ] 整合 MediaPipe FaceMesh（468 特征点 + GPU delegate）
- [ ] 将脸部特征点映射至 VRM Blendshape（眨眼、张嘴、眉毛）
- [ ] 将头部姿态映射至 VRM 头部骨骼旋转
- [ ] 摄影机开启/关闭控制

### Phase 3 — 精修优化
- [ ] Blendshape 灵敏度手动调整
- [ ] 灯光预设
- [ ] 摄影机位置预设（脸部 / 上半身 / 全身）
- [ ] 设定值持久化（localStorage）

## 关键限制
- 模式切换时，Canvas 必须保持**挂载状态**（不能丢失状态）。
- 实况模式下，**任何 UI 元素都不可见**。
- 绿幕色必须是**纯正的 `#00FF00`**，避免色度键误扣模型颜色。
- VRM 物理引擎（`vrm.update(delta)`）必须每帧执行，否则弹簧骨骼会停止运作。
- UI 设计须对非技术用户友善（女朋友为主要使用者）。

## 部署
```bash
# 本地开发
cd vtuber-app
npm install
npm run dev
# 开启 http://localhost:5173
```

- 代码推送至 GitHub → Vercel 自动部署
- 女朋友访问 Vercel 提供的固定网址即可使用
- 无需安装任何软件
