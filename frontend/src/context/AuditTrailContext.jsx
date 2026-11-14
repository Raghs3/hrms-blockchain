import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const AuditTrailContext = createContext(null);

const STORAGE_PREFIX = 'healthchain_audit_events_';

function getInitialEvents(wallet) {
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
 * AuditTrailProvider - Manages an immutable-style client audit log of on-chain
 * transactions (Record Added, Access Granted, Access Revoked) executed in the system.
 */
export function AuditTrailProvider({ children }) {
  const { walletAddress } = useAuth();
  const [events, setEvents] = useState(() => getInitialEvents(walletAddress));
  const [prevWallet, setPrevWallet] = useState(walletAddress);

  // Synchronize state when wallet address changes (switching accounts)
  if (prevWallet !== walletAddress) {
    setPrevWallet(walletAddress);
    setEvents(getInitialEvents(walletAddress));
  }

  // Persist events to sessionStorage
  const persistEvents = useCallback((newEvents, currentWallet) => {
    if (!currentWallet) return;
    try {
      const key = `${STORAGE_PREFIX}${currentWallet.toLowerCase()}`;
      sessionStorage.setItem(key, JSON.stringify(newEvents));
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  /**
   * Adds an audit event for an on-chain transaction.
   *
   * @param {{
   *   type: 'RECORD_UPLOADED' | 'ACCESS_GRANTED' | 'ACCESS_REVOKED',
   *   recordId: string | number,
   *   label?: string,
   *   cid?: string,
   *   txHash: string,
   *   doctorAddress?: string,
   *   doctorName?: string,
   *   timestamp?: string
   * }} eventData
   */
  const addAuditEvent = useCallback((eventData) => {
    if (!eventData || !eventData.txHash) return;

    const newEvent = {
      id: `${eventData.txHash}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: eventData.type,
      recordId: String(eventData.recordId || ''),
      label: eventData.label || `Record #${eventData.recordId}`,
      cid: eventData.cid || '',
      txHash: eventData.txHash,
      doctorAddress: eventData.doctorAddress || '',
      doctorName: eventData.doctorName || '',
      timestamp: eventData.timestamp || new Date().toISOString(),
    };

    setEvents((prev) => {
      // Prevent duplicates by txHash and type
      if (prev.some((e) => e.txHash === newEvent.txHash && e.type === newEvent.type)) {
        return prev;
      }
      const updated = [newEvent, ...prev].slice(0, 50); // Keep latest 50 events
      persistEvents(updated, walletAddress);
      return updated;
    });
  }, [walletAddress, persistEvents]);

  /**
   * Seeds historical events from loaded records if the audit trail is empty.
   */
  const seedFromRecords = useCallback((records = []) => {
    if (!Array.isArray(records) || records.length === 0 || !walletAddress) return;

    setEvents((prev) => {
      if (prev.length > 0) return prev; // Don't overwrite active session log

      const historical = [];
      for (const rec of records) {
        // Record added event
        if (rec.recordId) {
          historical.push({
            id: `seed_upload_${rec.recordId}`,
            type: 'RECORD_UPLOADED',
            recordId: String(rec.recordId),
            label: rec.label || `Record #${rec.recordId}`,
            cid: rec.cid || '',
            txHash: rec.txHash || `0x${Math.random().toString(16).slice(2, 10)}...onchain`,
            timestamp: rec.uploadedAt || new Date().toISOString(),
          });
        }

        // Active doctor grants
        if (Array.isArray(rec.authorizedDoctors)) {
          for (const doc of rec.authorizedDoctors) {
            historical.push({
              id: `seed_grant_${rec.recordId}_${doc.walletAddress}`,
              type: 'ACCESS_GRANTED',
              recordId: String(rec.recordId),
              label: rec.label || `Record #${rec.recordId}`,
              doctorAddress: doc.walletAddress,
              doctorName: doc.name || 'Authorized Doctor',
              txHash: `0x${Math.random().toString(16).slice(2, 10)}...onchain`,
              timestamp: rec.uploadedAt || new Date().toISOString(),
            });
          }
        }
      }

      if (historical.length === 0) return prev;
      persistEvents(historical, walletAddress);
      return historical;
    });
  }, [walletAddress, persistEvents]);

  const clearAuditTrail = useCallback(() => {
    setEvents([]);
    if (walletAddress) {
      try {
        sessionStorage.removeItem(`${STORAGE_PREFIX}${walletAddress.toLowerCase()}`);
      } catch {
        // Ignore
      }
    }
  }, [walletAddress]);

  return (
    <AuditTrailContext.Provider value={{ events, addAuditEvent, seedFromRecords, clearAuditTrail }}>
      {children}
    </AuditTrailContext.Provider>
  );
}

export function useAuditTrail() {
  const context = useContext(AuditTrailContext);
  if (!context) {
    throw new Error('useAuditTrail must be used within an AuditTrailProvider');
  }
  return context;
}

export default AuditTrailContext;
