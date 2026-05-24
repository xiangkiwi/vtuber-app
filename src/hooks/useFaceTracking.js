import { useEffect, useRef, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export function useFaceTracking(enabled, onResult) {
  const landmarkerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const lastVideoTimeRef = useRef(-1)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stopCamera()
      return
    }

    let cancelled = false

    async function init() {
      if (!landmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        })
      }

      if (cancelled) return

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      })
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = stream

      const video = document.createElement('video')
      video.srcObject = stream
      video.playsInline = true
      video.muted = true
      videoRef.current = video

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve)
        }
      })

      if (cancelled) {
        stopCamera()
        return
      }

      function detect() {
        if (cancelled) return
        const video = videoRef.current
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect)
          return
        }
        const nowMs = performance.now()
        if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime
          const result = landmarkerRef.current.detectForVideo(video, nowMs)
          if (result.faceLandmarks?.length > 0) {
            onResultRef.current(result)
          }
        }
        rafRef.current = requestAnimationFrame(detect)
      }

      rafRef.current = requestAnimationFrame(detect)
    }

    init().catch((err) => {
      if (!cancelled) console.error('[FaceTracking] init error:', err)
    })

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [enabled, stopCamera])
}
