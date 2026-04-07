/**
 * CCD Client Guard - React/Next.js Hook
 * =======================================
 * Hook für React-basierte Webseiten und Apps.
 *
 * Verwendung:
 *   import { useCCDGuard, CCDBlockScreen } from './ccd-guard-react';
 *
 *   function App() {
 *     const { isBlocked, loading } = useCCDGuard({
 *       apiKey: 'ccd_DEIN_API_KEY',
 *       serverUrl: 'https://DEIN-DASHBOARD-SERVER',
 *     });
 *
 *     if (isBlocked) return <CCDBlockScreen />;
 *     return <YourApp />;
 *   }
 */
import { useState, useEffect } from 'react';

export function useCCDGuard({ apiKey, serverUrl, checkInterval = 300 }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!apiKey || !serverUrl) {
      console.warn('[CCD Guard] apiKey und serverUrl sind erforderlich.');
      setLoading(false);
      return;
    }

    const baseUrl = serverUrl.replace(/\/$/, '');

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `${baseUrl}/api/check-status/${encodeURIComponent(apiKey)}`
        );
        if (response.ok) {
          const data = await response.json();
          setIsBlocked(data.is_blocked);
        }
      } catch {
        // Netzwerk-Fehler: fail-open
      }
      setLoading(false);
    };

    checkStatus();
    const interval = setInterval(checkStatus, checkInterval * 1000);
    return () => clearInterval(interval);
  }, [apiKey, serverUrl, checkInterval]);

  return { isBlocked, loading };
}

export function CCDBlockScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128274;</div>
        <h1 style={{ fontSize: '1.5rem', color: '#111', marginBottom: '0.5rem' }}>
          Website vorübergehend nicht verfügbar
        </h1>
        <p style={{ color: '#666', lineHeight: 1.6 }}>
          Diese Website ist derzeit nicht erreichbar. Bitte kontaktieren Sie den
          Betreiber für weitere Informationen.
        </p>
      </div>
    </div>
  );
}
