import { useCallback } from 'react'
import * as THREE from 'three'

const _euler = new THREE.Euler()
const _matrix = new THREE.Matrix4()

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Map a MediaPipe blendshape score to a VRM expression value with lerp smoothing
function applyExpression(vrm, name, value, prev, alpha = 0.4) {
  const expr = vrm.expressionManager
  if (!expr) return value
  const smoothed = lerp(prev ?? value, value, alpha)
  try {
    expr.setValue(name, smoothed)
  } catch (_) {}
  return smoothed
}

export function useFaceToVrm() {
  // Keep smoothing state between frames without re-rendering
  const state = useCallback(() => ({}), [])()

  const apply = useCallback((vrm, result) => {
    if (!vrm || !result) return

    // ── Blendshapes ──────────────────────────────────────────
    const shapes = result.faceBlendshapes?.[0]?.categories
    if (shapes) {
      const get = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0

      const blinkL = clamp(get('eyeBlinkLeft'), 0, 1)
      const blinkR = clamp(get('eyeBlinkRight'), 0, 1)
      const mouthOpen = clamp(get('jawOpen') * 1.4, 0, 1)
      const browUpL = clamp(get('browInnerUp') * 0.7 + get('browOuterUpLeft') * 0.3, 0, 1)
      const browUpR = clamp(get('browInnerUp') * 0.7 + get('browOuterUpRight') * 0.3, 0, 1)
      const mouthSmileL = clamp(get('mouthSmileLeft'), 0, 1)
      const mouthSmileR = clamp(get('mouthSmileRight'), 0, 1)

      // Swap left/right for mirror behavior
      state.blinkL = applyExpression(vrm, 'blinkLeft', blinkR, state.blinkL)
      state.blinkR = applyExpression(vrm, 'blinkRight', blinkL, state.blinkR)
      state.mouthOpen = applyExpression(vrm, 'aa', mouthOpen, state.mouthOpen)
      state.browUpL = applyExpression(vrm, 'browUpLeft', browUpR, state.browUpL, 0.2)
      state.browUpR = applyExpression(vrm, 'browUpRight', browUpL, state.browUpR, 0.2)
      state.mouthSmileL = applyExpression(vrm, 'happy', Math.max(mouthSmileL, mouthSmileR), state.mouthSmileL, 0.2)
    }

    // ── Head pose ────────────────────────────────────────────
    const matrix = result.facialTransformationMatrixes?.[0]?.data
    if (matrix) {
      _matrix.fromArray(matrix)
      _euler.setFromRotationMatrix(_matrix, 'XYZ')

      const headBone = vrm.humanoid?.getNormalizedBoneNode('head')
      if (headBone) {
        const pitch = clamp(_euler.x, -0.5, 0.5)   // nod up/down
        const yaw   = clamp(_euler.y, -0.7, 0.7)   // turn left/right
        const roll  = clamp(_euler.z, -0.4, 0.4)   // tilt

        const alpha = 0.3
        state.pitch = lerp(state.pitch ?? pitch, pitch, alpha)
        state.yaw   = lerp(state.yaw   ?? yaw,   yaw,   alpha)
        state.roll  = lerp(state.roll  ?? roll,  roll,  alpha)

        headBone.rotation.x = -state.pitch
        headBone.rotation.y = -state.yaw
        headBone.rotation.z = state.roll
      }
    }
  }, [state])

  return apply
}
