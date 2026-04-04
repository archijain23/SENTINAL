import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetchFn, deps = [], options = {}) {
  const { immediate = true, initialData = null } = options;
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError]     = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(...args);
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) setError(err.message || 'Unknown error');
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) execute();
  }, [execute]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: execute };
}
