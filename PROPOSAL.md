# VTuber Face-Capture App — Architecture Proposal (Phase 1 & 2)

## Context
- Streaming software: Douyin Live Companion (window capture + chroma key)
- Deployment: GitHub + Vercel web hosting
- Primary user: non-technical (girlfriend)
- Hardware: dedicated GPU available

---

## File Structure

```
vtuber-app/
├── public/
│   └── avatar.vrm              # default VRM model (2806253484254506632.vrm)
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx         # control panel UI
│   │   └── Scene.jsx           # R3F scene, lights, camera, VRM updater
│   ├── hooks/
│   │   ├── useVrm.js           # VRM load logic (isolated)
│   │   ├── useFaceTracking.js  # MediaPipe FaceLandmarker webcam loop
│   │   └── useFaceToVrm.js     # blendshape + head bone mapping with lerp
│   ├── App.jsx                 # layout + mode toggle + tracking wiring
│   ├── main.jsx
│   └── index.css               # Tailwind + green screen override
├── index.html
├── vite.config.js
└── package.json
```

---

## Key Design Decisions

**1. Green screen instead of transparent background**
Douyin Live Companion has no Browser Source — only window capture. Live mode background is set to pure green (`#00FF00`), removed by the streaming software's chroma key filter. Works with any streaming software universally.

**2. Mode toggle via CSS class on `<body>`**
Switching to live mode adds `live-mode` to `<body>`. CSS handles hiding the sidebar and switching the background to `#00FF00`. Canvas stays mounted — no R3F teardown, no state loss.

**3. VRM loading in a custom hook (`useVrm.js`)**
Isolates `GLTFLoader` + `VRMLoaderPlugin` side-effects. Auto-detects VRM 0.x vs 1.0 on load. Keeps `Scene.jsx` clean and decouples load logic from face tracking.

**4. VRM file upload in Phase 1**
Target user cannot be expected to manually replace files on disk. Sidebar includes a file picker that reads a local `.vrm` file and passes it to the loader via `URL.createObjectURL()`.

**5. Camera targeting**
`<PerspectiveCamera>` at `[0, 1.4, 1.2]` looking at `[0, 1.3, 0]` — frames a standard VRM at chest/face level without needing bone position data.

**6. VRM rotation**
VRM spec has model facing `-Z`. Apply `vrm.scene.rotation.y = Math.PI` after load.

**7. Animation loop**
`useFrame` calls `vrm.update(delta)` every tick — drives spring bones (hair/cloth physics) and expression system.

---

## Tradeoffs

| Decision | Alternative | Why this way |
|---|---|---|
| Green screen background | CSS transparent | Douyin Live Companion window capture can't read CSS transparency |
| CSS class toggle (no unmount) | Conditional render | Avoids R3F context teardown; keeps VRM + tracking state |
| VRM upload in Phase 1 | Phase 2 | Non-technical user can't manually replace files |
| `useVrm` hook | Load inside Scene | Decouples load logic; Phase 2 face tracking reuses it |
| Vercel web hosting | Electron .exe | No install, auto-updates, girlfriend just opens a URL |
| MediaPipe GPU delegate | CPU only | Dedicated GPU available; offloads compute, ~10-20% CPU target |

---

## Phase 2: Face Tracking (complete)

**8. MediaPipe FaceLandmarker via `useFaceTracking.js`**
Initializes `FaceLandmarker` from CDN WASM with `delegate: 'GPU'`, `outputFaceBlendshapes: true`, `outputFacialTransformationMatrixes: true`, `runningMode: 'VIDEO'`. Runs a `requestAnimationFrame` detection loop on a hidden `<video>` element; pushes results into a `useRef` (not state) to avoid triggering React re-renders every frame.

**9. Blendshape + head bone mapping via `useFaceToVrm.js`**
Maps MediaPipe blendshape scores to VRM expression names (`blinkLeft`, `blinkRight`, `aa`, `browUpLeft`, `browUpRight`, `happy`). Reads `facialTransformationMatrixes[0].data` into a `THREE.Matrix4` → `THREE.Euler` for pitch/yaw/roll. All values lerp-smoothed per frame. Head bone signs (after `rotation.y = Math.PI` on the VRM scene): `x = -pitch`, `y = +yaw`, `z = +roll`.

**10. GPU acceleration note**
MediaPipe code requests `delegate: 'GPU'` but on dual-GPU laptops the browser defaults to the integrated GPU. Fix: Windows Settings → Display → Graphics → set browser to "High performance" (NVIDIA).

---

## What's NOT yet done

- Blendshape sensitivity controls — Phase 3
- Lighting / camera presets — Phase 3
- Settings persistence — Phase 3

---

## Status
- [x] Requirements confirmed
- [x] Phase 1 implementation complete (VRM viewer, green screen, file upload)
- [x] Phase 2 implementation complete (MediaPipe face tracking, blendshapes, head pose)
- [ ] Deployed to Vercel
