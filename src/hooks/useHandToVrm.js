import { useCallback } from 'react'
import * as THREE from 'three'

const _vA = new THREE.Vector3()
const _vB = new THREE.Vector3()
const _vC = new THREE.Vector3()

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function lerpBone(state, key, target, alpha) {
  state[key] = lerp(state[key] ?? target, target, alpha)
  return state[key]
}

// Angle between two vectors formed by three points (b is the vertex)
function angleBetween(p0, p1, p2) {
  _vA.set(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize()
  _vB.set(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize()
  return Math.acos(clamp(_vA.dot(_vB), -1, 1))
}

// How much a finger is curled based on MCP→PIP→TIP angle
function fingerCurl(lms, mcpIdx, pipIdx, tipIdx) {
  const angle = angleBetween(lms[mcpIdx], lms[pipIdx], lms[tipIdx])
  // straight ≈ π, fully curled ≈ π/3 → map to 0..1
  return clamp(1 - (angle - Math.PI / 3) / (Math.PI * 2 / 3), 0, 1)
}

const FINGER_DEFS = [
  // [proximalBone, intermediateBone, distalBone, mcpIdx, pipIdx, dipIdx, tipIdx]
  ['IndexProximal',  'IndexIntermediate',  'IndexDistal',  5, 6, 7, 8],
  ['MiddleProximal', 'MiddleIntermediate', 'MiddleDistal', 9, 10, 11, 12],
  ['RingProximal',   'RingIntermediate',   'RingDistal',   13, 14, 15, 16],
  ['LittleProximal', 'LittleIntermediate', 'LittleDistal', 17, 18, 19, 20],
]

const THUMB_DEF = ['ThumbMetacarpal', 'ThumbProximal', 'ThumbDistal', 1, 2, 3, 4]

function applyFingers(vrm, lms, side, state, alpha = 0.35) {
  const prefix = side === 'left' ? 'left' : 'right'

  for (const [prox, mid, dist, mcpI, pipI, dipI, tipI] of FINGER_DEFS) {
    const curl = fingerCurl(lms, mcpI, pipI, tipI)
    const proxBone = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${prox}`)
    const midBone  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${mid}`)
    const distBone = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${dist}`)
    if (proxBone) proxBone.rotation.x = lerpBone(state, `${prefix}${prox}`, curl * 1.4, alpha)
    if (midBone)  midBone.rotation.x  = lerpBone(state, `${prefix}${mid}`,  curl * 1.6, alpha)
    if (distBone) distBone.rotation.x = lerpBone(state, `${prefix}${dist}`, curl * 1.2, alpha)
  }

  // Thumb
  const [tp, tm, td, ti0, ti1, ti2] = THUMB_DEF
  const thumbCurl = fingerCurl(lms, ti0, ti1, ti2)
  const tMeta  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${tp}`)
  const tProx  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${tm}`)
  const tDist  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${td}`)
  if (tMeta)  tMeta.rotation.z  = lerpBone(state, `${prefix}${tp}z`,  (side === 'left' ? -1 : 1) * thumbCurl * 0.5, alpha)
  if (tProx)  tProx.rotation.x  = lerpBone(state, `${prefix}${tm}`,   thumbCurl * 1.0, alpha)
  if (tDist)  tDist.rotation.x  = lerpBone(state, `${prefix}${td}`,   thumbCurl * 0.8, alpha)
}

// Map pose world landmarks → upper/lower arm rotations
// Landmark indices: 11=L_shoulder 12=R_shoulder 13=L_elbow 14=R_elbow 15=L_wrist 16=R_wrist
function applyArm(vrm, poseLms, side, state, alpha = 0.2) {
  const isLeft = side === 'left'
  const shoulderIdx = isLeft ? 11 : 12
  const elbowIdx    = isLeft ? 13 : 14
  const wristIdx    = isLeft ? 15 : 16

  const shoulder = poseLms[shoulderIdx]
  const elbow    = poseLms[elbowIdx]
  const wrist    = poseLms[wristIdx]
  if (!shoulder || !elbow || !wrist) return

  // Upper arm: direction from shoulder to elbow
  _vA.set(elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z)
  // Lower arm: direction from elbow to wrist
  _vB.set(wrist.x - elbow.x, wrist.y - elbow.y, wrist.z - elbow.z)

  // Convert to bone rotations — sign flips for left vs right due to VRM local axes
  const sign = isLeft ? 1 : -1

  const upperArmBone = vrm.humanoid?.getNormalizedBoneNode(isLeft ? 'leftUpperArm' : 'rightUpperArm')
  const lowerArmBone = vrm.humanoid?.getNormalizedBoneNode(isLeft ? 'leftLowerArm' : 'rightLowerArm')

  if (upperArmBone) {
    const pitch = clamp(-_vA.y * 2.0, -Math.PI / 2, Math.PI / 2)
    const roll  = clamp(sign * _vA.x * 2.0, -Math.PI / 2, Math.PI / 2)
    upperArmBone.rotation.x = lerpBone(state, `${side}UpperX`, pitch, alpha)
    upperArmBone.rotation.z = lerpBone(state, `${side}UpperZ`, roll,  alpha)
  }

  if (lowerArmBone) {
    // Elbow bend: angle between upper and lower arm segments
    _vC.copy(_vA).normalize()
    const _vD = _vB.clone().normalize()
    const elbowAngle = Math.acos(clamp(_vC.dot(_vD), -1, 1))
    const bend = clamp(Math.PI - elbowAngle, 0, Math.PI * 0.9)
    lowerArmBone.rotation.x = lerpBone(state, `${side}LowerX`, bend * sign, alpha)
  }
}

export function useHandToVrm() {
  const state = useCallback(() => ({}), [])()

  const apply = useCallback((vrm, result) => {
    if (!vrm || !result) return
    const { handResult, poseResult } = result

    // ── Arms (from pose landmarks) ────────────────────────────
    const poseLms = poseResult?.worldLandmarks?.[0]
    if (poseLms) {
      applyArm(vrm, poseLms, 'left',  state)
      applyArm(vrm, poseLms, 'right', state)
    }

    // ── Fingers (from hand landmarks) ────────────────────────
    if (handResult?.landmarks) {
      for (let i = 0; i < handResult.landmarks.length; i++) {
        const lms = handResult.landmarks[i]
        // MediaPipe reports from camera's perspective — mirror for avatar
        const reportedSide = handResult.handedness?.[i]?.[0]?.categoryName?.toLowerCase()
        const avatarSide = reportedSide === 'left' ? 'right' : 'left'
        applyFingers(vrm, lms, avatarSide, state)
      }
    }
  }, [state])

  return apply
}
