# VTuber 脸部捕捉应用程式 — 架构提案（Phase 1 & 2）

## 使用情境确认
- 直播软件：抖音直播伴侣（窗口捕获 + 色度键扣绿幕）
- 分发方式：GitHub + Vercel 网页托管
- 主要使用者：非技术用户（须操作友善）
- 目标硬件：有独立显卡

---

## 档案结构

```
vtuber-app/
├── public/
│   └── avatar.vrm              # 预设 VRM 模型（2806253484254506632.vrm）
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx         # 控制面板 UI
│   │   └── Scene.jsx           # R3F 场景、灯光、摄影机、VRM 更新器
│   ├── hooks/
│   │   ├── useVrm.js           # VRM 载入逻辑（独立封装）
│   │   ├── useFaceTracking.js  # MediaPipe FaceLandmarker 摄像头循环
│   │   └── useFaceToVrm.js     # Blendshape + 头部骨骼映射（含 lerp 平滑）
│   ├── App.jsx                 # 版面布局 + 模式切换 + 追踪串接
│   ├── main.jsx
│   └── index.css               # Tailwind + 绿幕背景覆写
├── index.html
├── vite.config.js
└── package.json
```

---

## 核心设计决策

**1. 绿幕取代透明背景**
抖音直播伴侣不支持 Browser Source，只能用窗口捕获。因此实况模式背景改为纯绿色（`#00FF00`），配合直播软件的色度键功能扣除背景，而非依赖 CSS `transparent`。

**2. 透过在 `<body>` 加入 CSS class 来切换模式**
切换至实况模式时，在 `<body>` 加入 `live-mode` class。CSS 负责：隐藏侧边栏、将背景切换为 `#00FF00`。Canvas 保持挂载，不会有 R3F 重新初始化的开销。

**3. 将 VRM 载入逻辑封装为自订 Hook（`useVrm.js`）**
处理 `GLTFLoader` + `VRMLoaderPlugin` 的副作用，支持 VRM 0.x 与 1.0 自动判断。保持 `Scene.jsx` 简洁，并与脸部追踪逻辑解耦。

**4. Phase 1 就支持自定义 VRM 上传**
考虑到目标用户（非技术背景），上传模型须在 Phase 1 完成，不能要求用户手动替换档案。实现方式：侧边栏加入文件选择器，读取本地 `.vrm` 档案后以 `URL.createObjectURL()` 传入载入器。

**5. 摄影机定位**
`<PerspectiveCamera>` 位置设在 `[0, 1.4, 1.2]`，看向 `[0, 1.3, 0]` — 不需要知道模型的精确骨骼位置，就能将标准 VRM 模型框在胸部/脸部高度。

**6. VRM 朝向修正**
VRM 规格规定模型朝向 `-Z`。载入后套用 `vrm.scene.rotation.y = Math.PI`，让模型面向镜头，无需触碰任何骨骼。

**7. 动画循环**
R3F 组件内的 `useFrame` 每帧呼叫 `vrm.update(delta)` — 驱动弹簧骨骼（头髮、衣物物理）与表情系统。

---

## 方案比较

| 决策 | 替代方案 | 选择此方案的原因 |
|---|---|---|
| 绿幕背景 | CSS transparent | 抖音直播伴侣不支持 Browser Source，窗口捕获无法读取透明 |
| CSS class 切换（不卸载组件） | 条件式渲染 | 避免 R3F context 被销毁，保留 VRM 与追踪状态 |
| Phase 1 就做 VRM 上传 | Phase 2 再做 | 目标用户非技术背景，不能要求手动替换档案 |
| `useVrm` Hook | 在 Scene 内直接载入 | 关注点分离；Phase 2 的脸部追踪需要与渲染解耦 |
| Vercel 网页托管 | Electron 打包 .exe | 无需安装、自动更新、女朋友直接开网址即用 |
| MediaPipe GPU delegate | 纯 CPU | 有独立显卡，GPU 运算减轻 CPU 负担 |

---

## Phase 2：脸部追踪（已完成）

**8. MediaPipe FaceLandmarker — `useFaceTracking.js`**
从 CDN WASM 初始化 `FaceLandmarker`，启用 `delegate: 'GPU'`、`outputFaceBlendshapes: true`、`outputFacialTransformationMatrixes: true`、`runningMode: 'VIDEO'`。在隐藏的 `<video>` 元素上运行 `requestAnimationFrame` 检测循环，结果写入 `useRef`（而非 state），避免每帧触发 React 重渲染。

**9. Blendshape + 头部骨骼映射 — `useFaceToVrm.js`**
将 MediaPipe blendshape 分数映射到 VRM 表情名称（`blinkLeft`、`blinkRight`、`aa`、`browUpLeft`、`browUpRight`、`happy`）。读取 `facialTransformationMatrixes[0].data` 转为 `THREE.Matrix4` → `THREE.Euler`，取得 pitch/yaw/roll。所有数值每帧做 lerp 平滑。头部骨骼旋转符号（VRM 场景已套用 `rotation.y = Math.PI`）：`x = -pitch`、`y = +yaw`、`z = +roll`。

**10. GPU 加速说明**
MediaPipe 已请求 `delegate: 'GPU'`，但双显卡笔电上浏览器默认使用集成显卡。解决方法：Windows 设定 → 显示器 → 图形 → 将浏览器设为「高性能」（NVIDIA）。

---

## 尚未完成的功能

- Blendshape 灵敏度调整 — Phase 3
- 灯光/摄影机预设 — Phase 3
- 设定值持久化 — Phase 3

---

## 绿幕使用说明（给女朋友）

1. 开启应用程式网址
2. 上传你的 VRM 模型档案
3. 点击「开启摄像头」启动脸部追踪
4. 点击「开始实况」按钮 → 画面变成绿色背景
5. 在抖音直播伴侣中新增窗口捕获，选择浏览器窗口
6. 在该来源的滤镜中加入「色度键」，选择绿色即可扣除背景

---

## 状态
- [x] 需求确认完成
- [x] Phase 1 实作完成（VRM 模型查看、绿幕、档案上传）
- [x] Phase 2 实作完成（MediaPipe 脸部追踪、Blendshape、头部姿态）
- [ ] 部署至 Vercel
