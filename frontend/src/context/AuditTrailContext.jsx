import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { getAuditTrail } from '../api/records';

const AuditTrailContext = createContext(null);

const STORAGE_PREFIX = 'healthchain_audit_session_';
const PAGE_SIZE = 20;

function getInitialSessionEvents(wallet) {
  if (!wallet) return [];
  try {
    const key = `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return [];
}

/**
 * AuditTrailProvider - Manages authoritative on-chain audit trail from GET /audit-trail
 * combined with client sessionStorage events for pending/just-performed actions.
 * Supports pagination (Load more) and zero-duplicate event merging.
 */
export function AuditTrailProvider({ children }) {
  const { walletAddress, isAuthenticated } = useAuth();

  const [serverEvents, setServerEvents] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [isRpcError, setIsRpcError] = useState(false);

  // In-session optimistic events
  const [sessionEvents, setSessionEvents] = useState(() => getInitialSessionEvents(walletAddress));
  const [currentWallet, setCurrentWallet] = useState(walletAddress);

  // Synchronize when wallet changes
  if (currentWallet !== walletAddress) {
    setCurrentWallet(walletAddress);
    setSessionEvents(getInitialSessionEvents(walletAddress));
    setServerEvents([]);
    setServerTotal(0);
  }

  const persistSessionEvents = useCallback((items, wallet) => {
    if (!wallet) return;
    try {
      const key = `${STORAGE_PREFIX}${wallet.toLowerCase()}`;
      sessionStorage.setItem(key, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Fetch initial or refreshed events from backend
  const fetchAuditTrail = useCallback(
    async (offset = 0, isInitial = false) => {
      if (!isAuthenticated) return;

      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');
      setIsRpcError(false);

      try {
        const res = await getAuditTrail(PAGE_SIZE, offset);
        const incoming = Array.isArray(res?.events) ? res.events : [];
        const total = typeof res?.total === 'number' ? res.total : incoming.length;

        if (offset === 0) {
          setServerEvents(incoming);
        } else {
          setServerEvents((prev) => {
            const existingTx = new Set(prev.map((e) => e.txHash).filter(Boolean));
            const fresh = incoming.filter((e) => !existingTx.has(e.txHash));
            return [...prev, ...fresh];
          });
        }
        setServerTotal(total);
      } catch (err) {
        const isRpc = err?.code === 'RPC_ERROR' || err?.status === 503;
        setIsRpcError(isRpc);
        setError(
          isRpc
            ? 'Blockchain RPC node is currently unavailable. Please verify network connectivity.'
            : err?.message || 'Failed to load on-chain audit trail.'
        );
      } finally {
        if (isInitial) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [isAuthenticated]
  );

  // Load audit trail when authenticated or when wallet changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchAuditTrail(0, true);
    } else {
      setServerEvents([]);
      setServerTotal(0);
    }
  }, [isAuthenticated, walletAddress, fetchAuditTrail]);

  // Load more pagination handler
  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (serverEvents.length >= serverTotal) return;
    fetchAuditTrail(serverEvents.length, false);
  }, [loading, loadingMore, serverEvents.length, serverTotal, fetchAuditTrail]);

  // Refresh handler
  const refresh = useCallback(() => {
    return fetchAuditTrail(0, true);
  }, [fetchAuditTrail]);

  /**
   * Adds an audit event for a just-performed client action.
   * Merged with server events without duplication.
   */
  const addAuditEvent = useCallback(
    (eventData) => {
      if (!eventData || !eventData.txHash) return;

      const normalizedType =
        eventData.type === 'RECORD_UPLOADED' ? 'RECORD_ADDED' : eventData.type;

      const newEvent = {
        id: `${eventData.txHash}_session`,
        type: normalizedType,
        eventName:
          normalizedType === 'RECORD_ADDED'
            ? 'RecordAdded'
            : normalizedType === 'ACCESS_GRANTED'
            ? 'AccessGranted'
            : 'AccessRevoked',
        recordId: String(eventData.recordId || ''),
        label: eventData.label || `Record #${eventData.recordId}`,
        cid: eventData.cid || null,
        fileHash: eventData.fileHash || null,
        txHash: eventData.txHash,
        owner: eventData.owner || walletAddress || null,
        ownerName: eventData.ownerName || null,
        doctor: eventData.doctor || eventData.doctorAddress || null,
        doctorName: eventData.doctorName || null,
        purpose: eventData.purpose || null,
        expiresAt: eventData.expiresAt || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        isPendingSession: true,
      };

      setSessionEvents((prev) => {
        // Prevent duplicate session entries by txHash
        if (prev.some((e) => e.txHash === newEvent.txHash)) {
          return prev;
        }
        const updated = [newEvent, ...prev].slice(0, 30);
        persistSessionEvents(updated, walletAddress);
        return updated;
      });
    },
    [walletAddress, persistSessionEvents]
  );

  /**
   * Clears session events and re-fetches from chain.
   */
  const clearAuditTrail = useCallback(() => {
    setSessionEvents([]);
    if (walletAddress) {
      try {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${walletAddress.toLowerCase()}`);
      } catch {
        // Ignore
      }
    }
    fetchAuditTrail(0, true);
  }, [walletAddress, fetchAuditTrail]);

  /**
   * Optional fallback for legacy seed compatibility.
   */
  const seedFromRecords = useCallback(() => {
    // Real history is loaded from GET /audit-trail; no-op
  }, []);

  // Merge session events that haven't yet been confirmed/returned by the server
  const events = useMemo(() => {
    const serverTxHashes = new Set(serverEvents.map((e) => e.txHash).filter(Boolean));
    const pendingSession = sessionEvents.filter((e) => !serverTxHashes.has(e.txHash));
    return [...pendingSession, ...serverEvents];
  }, [sessionEvents, serverEvents]);

  const hasMore = serverEvents.length < serverTotal;
  const total = serverTotal + (events.length - serverEvents.length);

  const value = {
    events,
    loading,
    loadingMore,
    error,
    isRpcError,
    total,
    hasMore,
    loadMore,
    refresh,
    addAuditEvent,
    clearAuditTrail,
    seedFromRecords,
  };

  return <AuditTrailContext.Provider value={value}>{children}</AuditTrailContext.Provider>;
}

export function useAuditTrail() {
  const context = useContext(AuditTrailContext);
  if (!context) {
    throw new Error('useAuditTrail must be used within an AuditTrailProvider');
  }
  return context;
}

export default AuditTrailContext;
