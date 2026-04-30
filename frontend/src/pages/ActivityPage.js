import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiRefreshCw, FiMail } from 'react-icons/fi';
import api from '../api';

const ACTION_LABELS = {
  auto_blocked: { label: 'Automatisch gesperrt', color: '#dc2626' },
  auto_unblocked: { label: 'Automatisch freigegeben', color: '#16a34a' },
  manual_block: { label: 'Manuell gesperrt', color: '#b91c1c' },
  manual_unblock: { label: 'Manuell freigegeben', color: '#15803d' },
  payment_received: { label: 'Zahlung erhalten', color: '#0ea5e9' },
  payment_added: { label: 'Zahlung erfasst', color: '#0284c7' },
  payment_deleted: { label: 'Zahlung geloescht', color: '#64748b' },
  invoice_created: { label: 'Rechnung erstellt', color: '#7c3aed' },
  invoice_sent: { label: 'Rechnung versendet', color: '#6d28d9' },
  invoice_reminder: { label: 'Mahnung versendet', color: '#ea580c' },
  invoice_paid: { label: 'Rechnung bezahlt', color: '#16a34a' },
  invoice_cancelled: { label: 'Rechnung storniert', color: '#94a3b8' },
  project_created: { label: 'Projekt erstellt', color: '#2563eb' },
  project_updated: { label: 'Projekt aktualisiert', color: '#475569' },
  project_deleted: { label: 'Projekt geloescht', color: '#64748b' },
  key_regenerated: { label: 'API-Key neu generiert', color: '#f59e0b' },
};

function actionMeta(action) {
  return ACTION_LABELS[action] || { label: action, color: '#64748b' };
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ActivityPage() {
  const [items, setItems] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', limit: 100 });
  const [reminderResult, setReminderResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: filter.limit };
      if (filter.action) params.action = filter.action;
      const [list, acts] = await Promise.all([
        api.getActivity(params),
        api.getActivityActions(),
      ]);
      setItems(list.data);
      setActions(acts.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const triggerReminders = async () => {
    setReminderResult(null);
    try {
      const res = await api.processReminders();
      setReminderResult(res.data);
      load();
    } catch (err) {
      setReminderResult({ error: err.response?.data?.error || err.message });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FiActivity /> Aktivitäten
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <FiRefreshCw /> Aktualisieren
          </button>
          <button className="btn btn-primary" onClick={triggerReminders}>
            <FiMail /> Mahnwesen ausführen
          </button>
        </div>
      </div>

      {reminderResult && (
        <div className="card" style={{ marginBottom: 16, padding: 16, background: reminderResult.error ? '#fee2e2' : '#ecfdf5' }}>
          {reminderResult.error
            ? <strong>Fehler: {reminderResult.error}</strong>
            : <span>{reminderResult.overdue_marked} überfällig markiert · {reminderResult.reminders_sent} Mahnung(en) versendet</span>}
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Aktion:&nbsp;
          <select value={filter.action} onChange={e => setFilter({ ...filter, action: e.target.value })}>
            <option value="">Alle</option>
            {actions.map(a => (
              <option key={a} value={a}>{actionMeta(a).label}</option>
            ))}
          </select>
        </label>
        <label>
          Limit:&nbsp;
          <select value={filter.limit} onChange={e => setFilter({ ...filter, limit: parseInt(e.target.value) })}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </label>
        <span style={{ color: '#64748b' }}>{items.length} Eintrag(e)</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: 12 }}>Zeitpunkt</th>
              <th style={{ padding: 12 }}>Aktion</th>
              <th style={{ padding: 12 }}>Projekt</th>
              <th style={{ padding: 12 }}>Details</th>
              <th style={{ padding: 12 }}>Ausgeführt von</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Lädt …</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Keine Aktivitäten gefunden.</td></tr>
            )}
            {items.map(it => {
              const meta = actionMeta(it.action);
              return (
                <tr key={it.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{formatDate(it.created_at)}</td>
                  <td style={{ padding: 12 }}>
                    <span style={{
                      background: meta.color + '22',
                      color: meta.color,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: 12 }}>
                    {it.project_id
                      ? <Link to={`/projects/${it.project_id}`}>{it.project_name || it.project_id}</Link>
                      : '–'}
                  </td>
                  <td style={{ padding: 12 }}>{it.details || '–'}</td>
                  <td style={{ padding: 12, color: '#475569' }}>{it.performed_by || 'System'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
