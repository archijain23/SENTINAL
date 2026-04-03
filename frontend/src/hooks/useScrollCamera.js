import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bindScrollCamera, introCameraAnimation } from '../animations/cameraTransitions';

/**
 * useScrollCamera
 * 
 * Binds GSAP ScrollTrigger camera transitions to the R3F camera.
 * The camera smoothly navigates through keyframe positions as the user scrolls.
 * 
 * Usage: call inside a component that lives INSIDE the <Canvas>
 */
export function useScrollCamera(enabled = true) {
  const { camera } = useThree();
  const lookAtTarget = useRef(new THREE.Vector3(0, 0, 0));
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled || initialized.current) return;

    // Fire intro cinematic dolly-in
    introCameraAnimation(camera);

    // Bind scroll-driven camera movement
    bindScrollCamera(camera, lookAtTarget.current, document.body);

    initialized.current = true;

    return () => {
      // Cleanup is handled by killAllScrollTriggers in App unmount
    };
  }, [camera, enabled]);

  // Per-frame: update camera.lookAt smoothly
  useFrame(() => {
    if (!enabled) return;
    camera.lookAt(lookAtTarget.current);
  });

  return { camera, lookAtTarget };
}

export default useScrollCamera;
