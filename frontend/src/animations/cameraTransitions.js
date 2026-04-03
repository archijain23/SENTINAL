import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-driven camera path for Three.js camera.
 * Mutates camera.position and camera.lookAt target ref.
 *
 * Call this from useScrollCamera hook after the R3F canvas mounts.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Vector3} lookAtTarget  - mutable ref to current lookAt point
 * @param {HTMLElement} scrollContainer - the scroll container element
 */
export function bindScrollCamera(camera, lookAtTarget, scrollContainer) {
  if (!camera || !lookAtTarget) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReducedMotion) return;

  // Define keyframe stops along the scroll path
  const keyframes = [
    // Hero — front view
    {
      progress: 0,
      position: { x: 0, y: 0, z: 12 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
    // Features — pull back + tilt up
    {
      progress: 0.15,
      position: { x: -3, y: 2, z: 14 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
    // Architecture — side angle
    {
      progress: 0.35,
      position: { x: 5, y: 1, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
    // Monitoring — overhead sweep
    {
      progress: 0.55,
      position: { x: 0, y: 6, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
    // AI Engine — close frontal
    {
      progress: 0.72,
      position: { x: -2, y: -1, z: 8 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
    // CTA — pull back to overview
    {
      progress: 1,
      position: { x: 0, y: 2, z: 16 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  ];

  // Create a proxy object that GSAP can tween
  const camProxy = {
    px: keyframes[0].position.x,
    py: keyframes[0].position.y,
    pz: keyframes[0].position.z,
    lx: keyframes[0].lookAt.x,
    ly: keyframes[0].lookAt.y,
    lz: keyframes[0].lookAt.z,
  };

  // Build the scroll-scrubbed tween
  const totalHeight = scrollContainer
    ? scrollContainer.scrollHeight - window.innerHeight
    : document.body.scrollHeight - window.innerHeight;

  ScrollTrigger.create({
    trigger: scrollContainer || document.body,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.5,
    onUpdate: (self) => {
      const progress = self.progress;

      // Find surrounding keyframes
      let fromKF = keyframes[0];
      let toKF = keyframes[keyframes.length - 1];

      for (let i = 0; i < keyframes.length - 1; i++) {
        if (
          progress >= keyframes[i].progress &&
          progress <= keyframes[i + 1].progress
        ) {
          fromKF = keyframes[i];
          toKF = keyframes[i + 1];
          break;
        }
      }

      const span = toKF.progress - fromKF.progress;
      const t = span === 0 ? 0 : (progress - fromKF.progress) / span;
      const ease = gsap.parseEase('power2.inOut')(t);

      // Interpolate
      camera.position.x = lerp(fromKF.position.x, toKF.position.x, ease);
      camera.position.y = lerp(fromKF.position.y, toKF.position.y, ease);
      camera.position.z = lerp(fromKF.position.z, toKF.position.z, ease);

      lookAtTarget.x = lerp(fromKF.lookAt.x, toKF.lookAt.x, ease);
      lookAtTarget.y = lerp(fromKF.lookAt.y, toKF.lookAt.y, ease);
      lookAtTarget.z = lerp(fromKF.lookAt.z, toKF.lookAt.z, ease);
    },
  });
}

/**
 * Intro cinematic — camera dolly in on mount.
 * @param {THREE.Camera} camera
 */
export function introCameraAnimation(camera) {
  if (!camera) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.from(camera.position, {
    z: 22,
    duration: 2.2,
    ease: 'power4.out',
    delay: 0.3,
  });

  gsap.from(camera.position, {
    y: -3,
    duration: 2.2,
    ease: 'power3.out',
    delay: 0.3,
  });
}

/**
 * Transition camera to a specific position (used for section focus).
 * @param {THREE.Camera} camera
 * @param {{x,y,z}} position
 * @param {number} duration
 */
export function transitionCameraTo(camera, position, duration = 1.2) {
  if (!camera) return;
  gsap.to(camera.position, {
    ...position,
    duration,
    ease: 'power3.inOut',
  });
}

// ─── Util ────────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t;
}
