# VTuber Face-Capture App — Project Reference

## Project Goal
A lightweight web face-capture app for VTubers. Dual-mode design:
1. **UI Mode** — left sidebar for settings, right canvas for 3D preview.
2. **Live Mode** — all UI hidden, canvas fullscreen with green screen background for chroma key in streaming software.

## Usage Context
- Streaming software: **Douyin Live Companion** (no Browser Source — uses window capture + chroma key)
- Live mode background: **solid green (`#00FF00`)**, not transparent
- Deployment: **GitHub + Vercel** web hosting — girlfriend opens a fixed URL, no install needed
- Target user: non-technical user, UI must be intuitive

## Tech Stack
| Tool | Purpose |
|---|---|
| Vite | Build tool |
| React | UI framework |
| Three.js | 3D engine |
| @react-three/fiber (R3F) | React bindings for Three.js |
| @react-three/drei | R3F helpers (camera, controls, etc.) |
| @pixiv/three-vrm | VRM model parsing & runtime (supports 0.x and 1.0) |
| Tailwind CSS | Control panel styling |
| MediaPipe FaceMesh | Face tracking (full 468 landmarks, GPU delegate) |

## File Structure
```
vtuber-app/
├── public/
│   └── avatar.vrm              # default test model
├── src/
│   ├── components/
│   │   ├── VrmViewer.jsx       # VRM render + animation loop
│   │   ├── Sidebar.jsx         # control panel UI
│   │   └── Scene.jsx           # R3F scene, lights, camera
│   ├── hooks/
│   │   ├── useVrm.js           # VRM load logic (isolated)
│   │   └── useFaceTracking.js  # MediaPipe face tracking (Phase 2)
│   ├── App.jsx                 # layout + mode toggle
│   ├── main.jsx
│   └── index.css               # Tailwind + green screen override
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Architecture Decisions

### Mode Toggle
- Adding `live-mode` class to `<body>` switches modes — no R3F unmount/remount.
- Live mode: background switches to solid green (`#00FF00`), all UI hidden.
- Toggle button located at the **bottom of the sidebar**.

### Green Screen (replaces transparent background)
- Douyin Live Companion does not support Browser Source — only window capture.
- Live mode background is `#00FF00`; streaming software's chroma key removes it.
- Benefit: works with any streaming software, no dependency on CSS transparency support.

### VRM Loading
- Custom hook `useVrm.js` handles `GLTFLoader` + `VRMLoaderPlugin` side-effects.
- Returns `{ vrm, loading, error }`.
- Auto-detects VRM 0.x vs 1.0 spec on load.
- **Custom VRM file upload supported in Phase 1** — target user cannot be expected to manually replace files.

### Camera
- `<PerspectiveCamera>` at `[0, 1.4, 1.2]` looking at `[0, 1.3, 0]`.
- Frames chest/face of a standard VRM without knowing exact bone positions.

### VRM Orientation
- VRM spec: model faces `-Z`. Apply `vrm.scene.rotation.y = Math.PI` after load.

### Animation Loop
- `useFrame` calls `vrm.update(delta)` every tick.
- Drives spring bones (hair/cloth physics) and expression system.

### Face Tracking (Phase 2)
- MediaPipe FaceMesh full 468 landmarks with GPU delegate.
- Offloads computation to dedicated GPU, target CPU usage 10-20%.
- Logic encapsulated in `useFaceTracking.js`, decoupled from render layer.
- Tracking targets: head rotation, blink, mouth open, eyebrow raise.

## Development Phases

### Phase 1 — Foundation (current)
- [ ] Project scaffold (Vite + React + R3F + Tailwind)
- [ ] Dual-mode layout with CSS class toggle
- [ ] Live mode green screen background (`#00FF00`)
- [ ] VRM loader with auto-detection of VRM 0.x and 1.0
- [ ] **Custom VRM file upload in sidebar**
- [ ] Basic scene: AmbientLight + DirectionalLight
- [ ] VRM Y-rotation fix + spring bone update loop
- [ ] Sidebar toggle button (bottom of sidebar)
- [ ] Deploy to Vercel

### Phase 2 — Face Tracking
- [ ] Integrate MediaPipe FaceMesh (468 landmarks + GPU delegate)
- [ ] Map face landmarks → VRM blendshapes (blink, mouth, eyebrows)
- [ ] Map head pose → VRM head bone rotation
- [ ] Camera on/off control in sidebar

### Phase 3 — Polish
- [ ] Blendshape sensitivity controls
- [ ] Lighting presets
- [ ] Camera position presets (face / upper body / full body)
- [ ] Settings persistence (localStorage)

## Key Constraints
- Canvas must remain **mounted** across mode switches (no state loss).
- In live mode, **zero UI chrome** should be visible.
- Green screen color must be **exactly `#00FF00`** — avoid colors present in typical VRM models.
- VRM physics (`vrm.update(delta)`) must run every frame or spring bones freeze.
- UI must be intuitive for a non-technical user.

## Deployment
```bash
# Local development
cd vtuber-app
npm install
npm run dev
# open http://localhost:5173
```

- Push to GitHub → Vercel auto-deploys
- Girlfriend opens the Vercel URL in any browser — no install required

## Green Screen Setup (for end user)
1. Open the app URL in browser
2. Upload your VRM model file via the sidebar
3. Click "Go Live" button → background turns green
4. In Douyin Live Companion, add a window capture source, select the browser window
5. Add a "Chroma Key" filter to that source, select green to remove the background
