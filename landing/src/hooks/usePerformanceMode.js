import { useState, useEffect, useCallback } from 'react';

/**
 * GPU tier thresholds
 * HIGH   : full 3D scene, particles, postprocessing, shaders
 * MEDIUM : 3D scene, reduced particles, no postprocessing
 * LOW    : static fallback (CSS only), no Three.js canvas
 */
export const PERF_TIER = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Detect approximate GPU performance tier.
 * Uses heuristics: device memory, hardware concurrency, user-agent, renderer string.
 */
function detectGPUTier() {
  // SSR guard
  if (typeof window === 'undefined') return PERF_TIER.MEDIUM;

  // Reduced motion → treat as low to skip heavy 3D
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return PERF_TIER.LOW;
  }

  // Navigator memory API (Chrome only)
  const memory = navigator.deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  // Mobile UA detection
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  // Try WebGL renderer string for GPU class
  let rendererTier = PERF_TIER.MEDIUM;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');

    if (!gl) return PERF_TIER.LOW; // No WebGL support

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl
        .getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        .toLowerCase();

      const highEndGPU =
        /nvidia|radeon rx [5-9]|geforce rtx|geforce gtx 10[6-9]|geforce gtx [2-9]/i.test(
          renderer
        );
      const lowEndGPU =
        /intel hd|intel uhd 6|swiftshader|llvmpipe|software|microsoft basic/i.test(
          renderer
        );

      if (highEndGPU) rendererTier = PERF_TIER.HIGH;
      else if (lowEndGPU) rendererTier = PERF_TIER.LOW;
      else rendererTier = PERF_TIER.MEDIUM;
    }
  } catch (_) {
    // WebGL detection failed — default to medium
  }

  // Combine signals
  if (isMobile && memory <= 2) return PERF_TIER.LOW;
  if (isMobile && memory <= 4 && cores <= 4) return PERF_TIER.MEDIUM;
  if (!isMobile && memory >= 8 && cores >= 8 && rendererTier === PERF_TIER.HIGH)
    return PERF_TIER.HIGH;
  if (rendererTier === PERF_TIER.LOW) return PERF_TIER.LOW;

  return PERF_TIER.MEDIUM;
}

/**
 * usePerformanceMode
 *
 * Returns the detected performance tier and capability flags.
 * Components use these to render appropriate fallbacks.
 *
 * @returns {{
 *   tier: 'high' | 'medium' | 'low',
 *   canRender3D: boolean,
 *   canRenderPostProcessing: boolean,
 *   canRenderParticles: boolean,
 *   particleCount: number,
 *   isMobile: boolean,
 *   isReducedMotion: boolean,
 * }}
 */
export function usePerformanceMode() {
  const [tier, setTier] = useState(PERF_TIER.MEDIUM);
  const [isMobile, setIsMobile] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const detected = detectGPUTier();
    setTier(detected);

    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(motionQuery.matches);

    const handleMotionChange = (e) => setIsReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);
    return () => motionQuery.removeEventListener('change', handleMotionChange);
  }, []);

  // Derived capability flags
  const canRender3D = tier !== PERF_TIER.LOW && !isReducedMotion;
  const canRenderPostProcessing = tier === PERF_TIER.HIGH && !isReducedMotion;
  const canRenderParticles = tier !== PERF_TIER.LOW && !isReducedMotion;

  const particleCount = {
    [PERF_TIER.HIGH]: 800,
    [PERF_TIER.MEDIUM]: 300,
    [PERF_TIER.LOW]: 0,
  }[tier] ?? 300;

  return {
    tier,
    canRender3D,
    canRenderPostProcessing,
    canRenderParticles,
    particleCount,
    isMobile,
    isReducedMotion,
  };
}

export default usePerformanceMode;
