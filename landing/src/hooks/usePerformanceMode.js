/** usePerformanceMode — detect GPU tier and enable mobile fallback */
import { useState, useEffect } from 'react';
export function usePerformanceMode() {
  const [lowPerf, setLowPerf] = useState(false);
  useEffect(() => {
    // Treat mobile (pointer: coarse) as low-performance — disable heavy 3D
    const mq = window.matchMedia('(pointer: coarse)');
    setLowPerf(mq.matches);
  }, []);
  return { lowPerf };
}
