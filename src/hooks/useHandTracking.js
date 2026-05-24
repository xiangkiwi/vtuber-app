import { useEffect, useRef, useCallback } from 'react'
import { HandLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'

export function useHandTracking(enabled, onResult) {
  const handLandmarkerRef = useRef(null)
  const poseLandmarkerRef = useRef(null)
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
      if (!handLandmarkerRef.current || !poseLandmarkerRef.current) {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const [hand, pose] = await Promise.all([
          HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 2,
          }),
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
          }),
        ])
        handLandmarkerRef.current = hand
        poseLandmarkerRef.current = pose
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
        video.onloadedmetadata = () => video.play().then(resolve)
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
          const handResult = handLandmarkerRef.current.detectForVideo(video, nowMs)
          const poseResult = poseLandmarkerRef.current.detectForVideo(video, nowMs)
          if (handResult.landmarks?.length > 0 || poseResult.landmarks?.length > 0) {
            onResultRef.current({ handResult, poseResult })
          }
        }
        rafRef.current = requestAnimationFrame(detect)
      }

      rafRef.current = requestAnimationFrame(detect)
    }

    init().catch((err) => {
      if (!cancelled) console.error('[HandTracking] init error:', err)
    })

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [enabled, stopCamera])
}
