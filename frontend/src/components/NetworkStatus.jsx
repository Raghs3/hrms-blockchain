import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

/**
 * NetworkStatus - Live network health monitor for the EVM node and API gateway.
 * Checks GET /health on mount and supports manual refresh.
 */
export default function NetworkStatus() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'degraded' | 'offline'
  const [latency, setLatency] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setStatus('checking');
    const start = performance.now();
    try {
      const res = await api.get('/health');
      const duration = Math.round(performance.now() - start);
      if (res?.data?.ok) {
        setStatus('online');
        setLatency(duration);
        setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setStatus('degraded');
        setLatency(duration);
      }
    } catch {
      setStatus('offline');
      setLatency(null);
      setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const start = performance.now();
    api.get('/health')
      .then((res) => {
        if (!ignore) {
          const duration = Math.round(performance.now() - start);
          if (res?.data?.ok) {
            setStatus('online');
            setLatency(duration);
            setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          } else {
            setStatus('degraded');
            setLatency(duration);
          }
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus('offline');
          setLatency(null);
          setLastChecked(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const isOnline = status === 'online';
  const isChecking = status === 'checking';

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: '0.75rem',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
      id="network-health-monitor"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#10b981' : isChecking ? '#38bdf8' : '#ef4444',
              boxShadow: isOnline ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
              display: 'inline-block',
            }}
            aria-hidden="true"
          />
          <span style={{ fontWeight: 600, color: '#f1f5f9', letterSpacing: '0.02em' }}>
            {isChecking ? 'Checking Network...' : isOnline ? 'Network Healthy' : 'Network Offline'}
          </span>
        </div>
        <button
          type="button"
          onClick={checkHealth}
          disabled={isChecking}
          title="Refresh network connectivity"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: isChecking ? 'default' : 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'color var(--transition)',
          }}
          aria-label="Refresh network status"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isChecking ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.6875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>EVM Node (8545)</span>
          <span style={{ color: isOnline ? '#34d399' : '#f87171', fontWeight: 500 }}>
            {isOnline ? 'Connected' : 'Offline'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>API Gateway (4000)</span>
          <span style={{ color: isOnline ? '#34d399' : '#f87171', fontWeight: 500 }}>
            {isOnline ? `${latency ? `${latency}ms` : 'Online'}` : 'Offline'}
          </span>
        </div>
        {lastChecked && (
          <div style={{ color: '#64748b', fontSize: '0.625rem', marginTop: '2px' }}>
            Checked at {lastChecked}
          </div>
        )}
      </div>
    </div>
  );
}
