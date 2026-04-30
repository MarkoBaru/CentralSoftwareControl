import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const TABS = ['Firma', 'E-Mail / SMTP', 'Bank-API', 'camt.054 Upload'];

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

      {activeTab !== 'camt.054 Upload' && (
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
