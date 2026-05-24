import { useCallback } from 'react'
import * as THREE from 'three'

// Dedicated vectors — never shared between finger and arm calculations
const _fingerA = new THREE.Vector3()
const _fingerB = new THREE.Vector3()
const _armUpper = new THREE.Vector3()
const _armLower = new THREE.Vector3()

function lerp(a, b, t) { return a + (b - a) * t }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function lerpBone(state, key, target, alpha) {
  state[key] = lerp(state[key] ?? target, target, alpha)
  return state[key]
}

// Angle between two vectors formed by three points (b is the vertex)
function angleBetween(p0, p1, p2) {
  _fingerA.set(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z).normalize()
  _fingerB.set(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z).normalize()
  return Math.acos(clamp(_fingerA.dot(_fingerB), -1, 1))
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
    if (proxBone) proxBone.rotation.x = lerpBone(state, `${prefix}${prox}`, -curl * 1.4, alpha)
    if (midBone)  midBone.rotation.x  = lerpBone(state, `${prefix}${mid}`,  -curl * 1.6, alpha)
    if (distBone) distBone.rotation.x = lerpBone(state, `${prefix}${dist}`, -curl * 1.2, alpha)
  }

  // Thumb
  const [tp, tm, td, ti0, ti1, ti2] = THUMB_DEF
  const thumbCurl = fingerCurl(lms, ti0, ti1, ti2)
  const tMeta  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${tp}`)
  const tProx  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${tm}`)
  const tDist  = vrm.humanoid?.getNormalizedBoneNode(`${prefix}${td}`)
  if (tMeta)  tMeta.rotation.z  = lerpBone(state, `${prefix}${tp}z`,  (side === 'left' ? -1 : 1) * thumbCurl * 0.5, alpha)
  if (tProx)  tProx.rotation.x  = lerpBone(state, `${prefix}${tm}`,   -thumbCurl * 1.0, alpha)
  if (tDist)  tDist.rotation.x  = lerpBone(state, `${prefix}${td}`,   -thumbCurl * 0.8, alpha)
}

// Map pose landmarks (normalized screen coords: x/y in 0..1, origin top-left) → arm rotations
// Landmark indices: 11=L_shoulder 12=R_shoulder 13=L_elbow 14=R_elbow 15=L_wrist 16=R_wrist
function applyArm(vrm, poseLms, side, state, alpha = 0.15) {
  const isLeft = side === 'left'
  const shoulderIdx = isLeft ? 12 : 11
  const elbowIdx    = isLeft ? 14 : 13
  const wristIdx    = isLeft ? 16 : 15

  const shoulder = poseLms[shoulderIdx]
  const elbow    = poseLms[elbowIdx]
  const wrist    = poseLms[wristIdx]
  if (!shoulder || !elbow || !wrist) return

  // Skip low-visibility landmarks to avoid jitter
  if ((shoulder.visibility ?? 1) < 0.5) return
  if ((elbow.visibility ?? 1) < 0.4) return

  const upperArmBone = vrm.humanoid?.getNormalizedBoneNode(isLeft ? 'leftUpperArm' : 'rightUpperArm')
  const lowerArmBone = vrm.humanoid?.getNormalizedBoneNode(isLeft ? 'leftLowerArm' : 'rightLowerArm')

  // Screen coords: +X right, +Y DOWN (origin top-left), no reliable Z
  // Upper arm vector: shoulder → elbow
  const uax = elbow.x - shoulder.x
  const uay = elbow.y - shoulder.y
  const len = Math.sqrt(uax * uax + uay * uay) || 1

  // Screen Y increases downward. arm hanging down → uay > 0 → acos(uay/len) ≈ 0
  // acos(uay/len): 0 = arm down, π/2 = horizontal, π = arm up
  const absAngle = Math.acos(clamp(uay / len, -1, 1))

  // deviation from horizontal: negative = arm below T-pose, positive = arm above T-pose
  const raiseAngle = clamp(absAngle - Math.PI / 2, -Math.PI / 2, Math.PI / 2)

  // VRM normalized space, left arm:
  //   rotation.z > 0 → arm rotates DOWN from T-pose (toward body)
  //   rotation.z < 0 → arm rotates UP above T-pose
  // Right arm is mirrored: rotation.z < 0 → down, > 0 → up
  // raiseAngle < 0 means arm is below horizontal (hanging down).
  // We want: arm down → left.z > 0, right.z < 0 → multiply by -zSign
  // Selfie camera doesn't affect landmark assignment (isLeft already uses lm11 = person's left).
  const zSign = isLeft ? 1 : -1

  // Forward/backward: use elbow x offset from shoulder (screen horizontal = VRM forward/back)
  // elbow moves toward center of body → arm swings forward
  // For copy mode: left arm uses right landmarks (shoulderIdx=12), so uax>0 means arm forward
  const xSign = isLeft ? -1 : 1
  const forwardAngle = clamp(uax * Math.PI * 1.5, -Math.PI / 2, Math.PI / 2)

  if (upperArmBone) {
    upperArmBone.rotation.z = lerpBone(state, `${side}UpperZ`, zSign * -raiseAngle, alpha)
    upperArmBone.rotation.x = lerpBone(state, `${side}UpperX`, xSign * forwardAngle, alpha)
  }

  if (lowerArmBone) {
    // Elbow bend from screen: angle at elbow between shoulder→elbow and elbow→wrist vectors
    const lax = wrist.x - elbow.x
    const lay = wrist.y - elbow.y
    // dot product of normalized upper and lower arm vectors
    const uLen = Math.sqrt(uax * uax + uay * uay) || 1
    const lLen = Math.sqrt(lax * lax + lay * lay) || 1
    const dot  = clamp((uax * lax + uay * lay) / (uLen * lLen), -1, 1)
    const elbowAngle = Math.acos(dot) // π = straight, 0 = fully folded
    // bend = deviation from straight
    const bend = clamp(Math.PI - elbowAngle, 0, Math.PI * 0.85)
    lowerArmBone.rotation.x = lerpBone(state, `${side}LowerX`, bend, alpha)
  }
}

export function useHandToVrm() {
  const state = useCallback(() => ({}), [])()

  const apply = useCallback((vrm, result) => {
    if (!vrm || !result) return
    const { handResult, poseResult } = result

    // ── Arms (from pose landmarks) ────────────────────────────
    const poseLms = poseResult?.landmarks?.[0]
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
