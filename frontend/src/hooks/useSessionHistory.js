import { useState, useCallback } from 'react';

/**
 * useSessionHistory - In-memory session history hook for Doctor Dashboard.
 *
 * Tracks:
 * - lookups: Last 5 lookups [{ id: string, result: 'GRANTED' | 'DENIED', timestamp: string }]
 * - viewedCount: Number of successful record views in this session
 * - lastLookup: Most recent lookup entry ({ id, result, timestamp } or null)
 */
export function useSessionHistory() {
  const [lookups, setLookups] = useState([]);
  const [viewedCount, setViewedCount] = useState(0);

  const addLookup = useCallback((id, result) => {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLookups((prev) => {
      const newEntry = { id, result, timestamp };
      const filtered = prev.filter((item) => item.id !== id);
      return [newEntry, ...filtered].slice(0, 5);
    });
  }, []);

  const updateLookupResult = useCallback((id, result) => {
    setLookups((prev) =>
      prev.map((item) => (item.id === id ? { ...item, result } : item))
    );
  }, []);

  const recordViewSuccess = useCallback(() => {
    setViewedCount((c) => c + 1);
  }, []);

  const lastLookup = lookups[0] || null;

  return {
    lookups,
    viewedCount,
    lastLookup,
    addLookup,
    updateLookupResult,
    recordViewSuccess,
  };
}

export default useSessionHistory;

