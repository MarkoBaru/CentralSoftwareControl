import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const TABS = ['Firma', 'E-Mail / SMTP', 'Bank-API', 'camt.054 Upload', 'Sicherheit (2FA)', 'Backups'];

const INPUT_GROUPS = {
  'Firma': [
    { key: 'company_name', label: 'Firmenname', placeholder: 'Muster GmbH' },
    { key: 'company_address', label: 'Adresse', placeholder: 'Musterstrasse 1' },
    { key: 'company_zip', label: 'PLZ', placeholder: '8200' },
    { key: 'company_city', label: 'Ort', placeholder: 'Schaffhausen' },
    { key: 'company_country', label: 'Land', placeholder: 'Schweiz' },
    { key: 'company_email', label: 'E-Mail', placeholder: 'info@firma.ch' },
    { key: 'company_phone', label: 'Telefon', placeholder: '+41 52 000 00 00' },
    { key: 'company_uid', label: 'UID / MwSt-Nr.', placeholder: 'CHE-123.456.789 MWST' },
    { key: 'company_iban', label: 'IBAN', placeholder: 'CH56 0483 5012 3456 7800 9' },
    { key: 'company_bank', label: 'Bank', placeholder: 'Schaffhauser Kantonalbank' },
    { key: 'invoice_prefix', label: 'Rechnungs-Präfix', placeholder: 'RE' },
    { key: 'invoice_due_days', label: 'Zahlungsfrist (Tage)', placeholder: '30', type: 'number' },
    { key: 'invoice_footer', label: 'Rechnungs-Fusszeile', placeholder: 'Vielen Dank für Ihren Auftrag.' },
  ],
  'E-Mail / SMTP': [
    { key: 'smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
    { key: 'smtp_port', label: 'SMTP Port', placeholder: '587', type: 'number' },
    { key: 'smtp_user', label: 'SMTP Benutzer', placeholder: 'user@gmail.com' },
    { key: 'smtp_pass', label: 'SMTP Passwort', type: 'password', placeholder: '••••••••' },
    { key: 'smtp_from', label: 'Absender-Name', placeholder: 'Control Dashboard <noreply@firma.ch>' },
    { key: 'smtp_secure', label: 'SSL/TLS', type: 'checkbox' },
  ],
  'Bank-API': [
    { key: 'bank_api_url', label: 'Bank-API URL', placeholder: 'https://api.yourbank.ch/v1' },
    { key: 'bank_api_key', label: 'API-Key / Bearer-Token', placeholder: 'sk_live_...' },
    { key: 'bank_api_account', label: 'Kontonummer / IBAN', placeholder: 'CH56 0483 5012 3456 7800 9' },
  ],
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [camtText, setCamtText] = useState('');
  const [camtResult, setCamtResult] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setForm(res.data);
    } catch {
      setMsg({ type: 'error', text: 'Einstellungen konnten nicht geladen werden' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleChange = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateSettings(form);
      setMsg({ type: 'success', text: 'Einstellungen gespeichert' });
    } catch {
      setMsg({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setMsg(null);
    try {
      const res = await api.sendTestEmail();
      setMsg({ type: 'success', text: res.data.message });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler' });
    }
  };

  const handleBankSync = async () => {
    setSyncing(true);
    setMsg(null);
    try {
      const res = await api.bankSync();
      setMsg({ type: 'success', text: `Bank-Sync: ${res.data.fetched} Transaktionen, ${res.data.processed} verarbeitet, ${res.data.blocked} blockiert, ${res.data.unblocked} freigegeben` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Bank-Sync fehlgeschlagen' });
    } finally {
      setSyncing(false);
    }
  };

  const handleCamtUpload = async () => {
    if (!camtText.trim()) return;
    setMsg(null);
    try {
      const res = await api.uploadCamt(camtText);
      setCamtResult(res.data);
      setMsg({ type: 'success', text: `camt.054: ${res.data.found} Zahlungen gefunden, ${res.data.processed} verarbeitet` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler beim Parsen' });
    }
  };

  const handleFileRead = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCamtText(ev.target.result);
    reader.readAsText(file, 'utf-8');
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--gray-500)' }}>Lade Einstellungen...</div>;

  const fields = INPUT_GROUPS[activeTab] || [];
  const isFormTab = !!INPUT_GROUPS[activeTab];

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Einstellungen</h1>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t}
            className={`filter-chip ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {isFormTab && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>
                {f.type === 'checkbox' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form[f.key] === 'true' || form[f.key] === true}
                      onChange={e => handleChange(f.key, e.target.checked ? 'true' : 'false')}
                    />
                    Aktiviert (SSL/TLS)
                  </label>
                ) : (
                  <input
                    type={f.type || 'text'}
                    className="form-control"
                    placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => handleChange(f.key, e.target.value)}
                    autoComplete={f.type === 'password' ? 'new-password' : undefined}
                  />
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Speichert...' : 'Speichern'}
            </button>
            {activeTab === 'E-Mail / SMTP' && (
              <button className="btn btn-ghost" onClick={handleTestEmail}>
                Test-E-Mail senden
              </button>
            )}
            {activeTab === 'Bank-API' && (
              <button className="btn btn-ghost" onClick={handleBankSync} disabled={syncing}>
                {syncing ? 'Synchronisiert...' : 'Jetzt synchronisieren'}
              </button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Sicherheit (2FA)' && <TwoFactorPanel onMsg={setMsg} />}

      {activeTab === 'Backups' && <BackupsPanel onMsg={setMsg} />}

      {activeTab === 'camt.054 Upload' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
            camt.054 ist das ISO 20022 XML-Format für Zahlungsbenachrichtigungen aller Schweizer Banken (inkl. SHKB).
            Laden Sie die XML-Datei hoch oder fügen Sie den XML-Inhalt direkt ein.
          </p>
          <div className="form-group">
            <label>XML-Datei hochladen</label>
            <input type="file" accept=".xml" onChange={handleFileRead} className="form-control" />
          </div>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>XML-Inhalt (direkt einfügen)</label>
            <textarea
              className="form-control"
              rows={8}
              value={camtText}
              onChange={e => setCamtText(e.target.value)}
              placeholder="<?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?>&#10;<Document xmlns=&quot;urn:iso:std:iso:20022:tech:xsd:camt.054.001.04&quot;>..."
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCamtUpload} disabled={!camtText.trim()}>
            Verarbeiten
          </button>
          {camtResult && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: 8 }}>
              <strong>Ergebnis:</strong> {camtResult.found} Zahlungen gefunden,{' '}
              {camtResult.processed} verarbeitet, {camtResult.blocked} blockiert,{' '}
              {camtResult.unblocked} freigegeben
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TwoFactorPanel({ onMsg }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null); // { secret, qr }
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.twoFaStatus();
      setEnabled(!!res.data.enabled);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await api.twoFaSetup();
      setSetupData(res.data);
    } catch (err) {
      onMsg({ type: 'error', text: err.response?.data?.error || 'Setup fehlgeschlagen' });
    } finally { setBusy(false); }
  };

  const enable = async () => {
    setBusy(true);
    try {
      await api.twoFaEnable(token);
      onMsg({ type: 'success', text: '2FA wurde aktiviert' });
      setSetupData(null);
      setToken('');
      await load();
    } catch (err) {
      onMsg({ type: 'error', text: err.response?.data?.error || 'Aktivierung fehlgeschlagen' });
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await api.twoFaDisable(token);
      onMsg({ type: 'success', text: '2FA wurde deaktiviert' });
      setToken('');
      await load();
    } catch (err) {
      onMsg({ type: 'error', text: err.response?.data?.error || 'Deaktivierung fehlgeschlagen' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="card" style={{ padding: '1.5rem' }}>Lade Status...</div>;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h2 style={{ marginTop: 0 }}>Zwei-Faktor-Authentifizierung (TOTP)</h2>
      <p style={{ color: 'var(--gray-600)' }}>
        Status: <strong>{enabled ? 'aktiviert' : 'deaktiviert'}</strong>.
        Kompatibel mit Google Authenticator, Authy, Microsoft Authenticator, 1Password.
      </p>

      {!enabled && !setupData && (
        <button className="btn btn-primary" onClick={startSetup} disabled={busy}>
          Einrichtung starten
        </button>
      )}

      {!enabled && setupData && (
        <div>
          <p>1. Scannen Sie den QR-Code mit Ihrer Authenticator-App:</p>
          <img src={setupData.qr} alt="2FA QR-Code" style={{ display: 'block', margin: '1rem 0' }} />
          <p style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            Manuell: <code>{setupData.secret}</code>
          </p>
          <p>2. Geben Sie den 6-stelligen Code aus der App ein:</p>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: 320 }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="form-control"
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
            <button className="btn btn-primary" onClick={enable} disabled={busy || token.length !== 6}>
              Aktivieren
            </button>
          </div>
        </div>
      )}

      {enabled && (
        <div>
          <p>Zur Deaktivierung bitte aktuellen Code aus der Authenticator-App eingeben:</p>
          <div style={{ display: 'flex', gap: '0.5rem', maxWidth: 320 }}>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="form-control"
              value={token}
              onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
            <button className="btn btn-ghost" onClick={disable} disabled={busy || token.length !== 6}>
              2FA deaktivieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupsPanel({ onMsg }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listBackups();
      setBackups(res.data || []);
    } catch (err) {
      onMsg({ type: 'error', text: err.response?.data?.error || 'Laden fehlgeschlagen' });
    } finally { setLoading(false); }
  }, [onMsg]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.createBackup();
      onMsg({ type: 'success', text: `Backup erstellt: ${res.data.file}` });
      await load();
    } catch (err) {
      onMsg({ type: 'error', text: err.response?.data?.error || 'Backup fehlgeschlagen' });
    } finally { setBusy(false); }
  };

  const fmtSize = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
  const token = localStorage.getItem('ccd_token');

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Datenbank-Backups</h2>
        <button className="btn btn-primary" onClick={create} disabled={busy}>
          {busy ? 'Erstellt...' : 'Jetzt Backup erstellen'}
        </button>
      </div>
      <p style={{ color: 'var(--gray-600)' }}>
        Tägliches Backup um 03:00 Europe/Zurich. Aufbewahrung: 14 Snapshots.
      </p>
      {loading ? <div>Lade...</div> : (
        <table className="data-table">
          <thead><tr><th>Dateiname</th><th>Größe</th><th>Erstellt</th><th></th></tr></thead>
          <tbody>
            {backups.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-500)' }}>Keine Backups vorhanden</td></tr>}
            {backups.map(b => (
              <tr key={b.filename}>
                <td style={{ fontFamily: 'monospace' }}>{b.filename}</td>
                <td>{fmtSize(b.size)}</td>
                <td>{new Date(b.created_at).toLocaleString('de-CH')}</td>
                <td>
                  <a className="btn btn-ghost btn-sm" href={`${api.downloadBackupUrl(b.filename)}?token=${encodeURIComponent(token)}`} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
