import { useState, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Scene from './components/Scene.jsx'
import { useFaceTracking } from './hooks/useFaceTracking.js'
import { useFaceToVrm } from './hooks/useFaceToVrm.js'

export default function App() {
  const [isLiveMode, setIsLiveMode] = useState(false)
  const [vrmUrl, setVrmUrl] = useState('/avatar.vrm')
  const [cameraEnabled, setCameraEnabled] = useState(false)

  const faceResultRef = useRef(null)
  const applyFace = useFaceToVrm()

  useFaceTracking(cameraEnabled, (result) => {
    faceResultRef.current = result
  })

  const toggleLiveMode = useCallback(() => {
    setIsLiveMode(prev => {
      const next = !prev
      if (next) {
        document.body.classList.add('live-mode')
      } else {
        document.body.classList.remove('live-mode')
      }
      return next
    })
  }, [])

  const handleVrmUpload = useCallback((file) => {
    const url = URL.createObjectURL(file)
    setVrmUrl(url)
  }, [])

  return (
    <div className="flex w-full h-full">
      <div className="sidebar w-72 shrink-0 bg-gray-900 flex flex-col border-r border-gray-700">
        <Sidebar
          isLiveMode={isLiveMode}
          onToggleLiveMode={toggleLiveMode}
          onVrmUpload={handleVrmUpload}
          cameraEnabled={cameraEnabled}
          onToggleCamera={() => setCameraEnabled(v => !v)}
        />
      </div>
      <div className="canvas-wrapper flex-1 relative">
        <Scene vrmUrl={vrmUrl} isLiveMode={isLiveMode} faceResultRef={faceResultRef} applyFace={applyFace} />
        {isLiveMode && (
          <button
            onClick={toggleLiveMode}
            className="absolute top-3 right-3 z-50 w-7 h-7 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 text-white text-sm font-bold transition-colors"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
