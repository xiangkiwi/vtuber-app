import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export function useVrm(url, scene) {
  const vrmRef = useRef(null)

  useEffect(() => {
    if (!url || !scene) return

    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))

    let objectUrl = null
    let cancelled = false

    loader.load(
      url,
      (gltf) => {
        if (cancelled) return

        const vrm = gltf.userData.vrm
        if (!vrm) return

        VRMUtils.removeUnnecessaryJoints(vrm.scene)
        vrm.scene.rotation.y = Math.PI

        if (vrmRef.current) {
          scene.remove(vrmRef.current.scene)
          VRMUtils.deepDispose(vrmRef.current.scene)
        }

        scene.add(vrm.scene)
        vrmRef.current = vrm
      },
      undefined,
      (error) => {
        console.error('VRM load error:', error)
      }
    )

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, scene])

  return vrmRef
}
