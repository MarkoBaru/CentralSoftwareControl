import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const STATUS_LABELS = { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', overdue: 'Überfällig', cancelled: 'Storniert' };
const STATUS_BADGE = { draft: 'badge-maintenance', sent: 'badge-active', paid: 'badge-active', overdue: 'badge-overdue', cancelled: 'badge-cancelled' };
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, paid: 0, outstanding: 0 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ project_id: '', amount: '', period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(), send_email: true, notes: '' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [invRes, projRes, statsRes] = await Promise.all([
        api.getInvoices(), api.getProjects(), api.getInvoiceStats(),
      ]);
      setInvoices(invRes.data);
      setProjects(projRes.data);
      setStats(statsRes.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = invoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      await api.createInvoice(form);
      setMsg({ type: 'success', text: 'Rechnung erfolgreich erstellt' });
      setShowCreate(false);
      setForm({ project_id: '', amount: '', period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(), send_email: true, notes: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler beim Erstellen' });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateInvoiceStatus(id, status);
      load();
    } catch { /* ignore */ }
  };

  const handleSend = async (id) => {
    try {
      await api.sendInvoice(id);
      setMsg({ type: 'success', text: 'Rechnung erneut gesendet' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Fehler beim Senden' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Rechnung wirklich löschen?')) return;
    await api.deleteInvoice(id);
    load();
  };

  const monthOpts = getMonthOptions();

  // Auto-fill Betrag wenn Projekt gewählt
  const handleProjectChange = async (projectId) => {
    setForm(f => ({ ...f, project_id: projectId }));
    if (projectId) {
      try {
        const res = await api.getPaymentSettings(projectId);
        if (res.data?.monthly_amount) setForm(f => ({ ...f, project_id: projectId, amount: res.data.monthly_amount }));
      } catch { /* ignore */ }
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Rechnungen</h1>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ marginBottom: '1rem' }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Statistiken */}
      <div className="stat-cards" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="label">Rechnungen gesamt</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Gesamtbetrag</div>
          <div className="value">CHF {Number(stats.totalAmount || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Bezahlt</div>
          <div className="value">CHF {Number(stats.paid || 0).toFixed(2)}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Ausstehend</div>
          <div className="value">CHF {Number(stats.outstanding || 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Filter + Button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', 'sent', 'paid', 'overdue', 'draft', 'cancelled'].map(s => (
          <button
            key={s}
            className={`filter-chip ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {s === 'all' ? 'Alle' : STATUS_LABELS[s]}
          </button>
        ))}
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '✕ Abbrechen' : '+ Neue Rechnung'}
        </button>
      </div>

      {/* Erstellen-Formular */}
      {showCreate && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Neue Rechnung erstellen</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Projekt *</label>
                <select className="form-control" value={form.project_id} onChange={e => handleProjectChange(e.target.value)} required>
                  <option value="">Projekt wählen...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Betrag (CHF) *</label>
                <input type="number" step="0.01" className="form-control" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>Zeitraum *</label>
                <select className="form-control" value={`${form.period_year}-${form.period_month}`} onChange={e => {
                  const [y, m] = e.target.value.split('-');
                  setForm(f => ({ ...f, period_year: parseInt(y), period_month: parseInt(m) }));
                }}>
                  {monthOpts.map(o => (
                    <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <input type="text" className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.send_email} onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))} />
                Per E-Mail an Kunden senden
              </label>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Erstelle...' : 'Rechnung erstellen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabelle */}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Rechnungsnr.</th>
              <th>Projekt</th>
              <th>Kunde</th>
              <th>Zeitraum</th>
              <th>Betrag</th>
              <th>Status</th>
              <th>Fällig</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                <td>{inv.project_name}</td>
                <td>{inv.client_name}</td>
                <td>{MONTH_NAMES[inv.period_month - 1]} {inv.period_year}</td>
                <td>CHF {Number(inv.amount).toFixed(2)}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[inv.status] || ''}`}>{STATUS_LABELS[inv.status]}</span>
                </td>
                <td>{inv.due_date || '–'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <a href={api.getInvoicePdfUrl(inv.id)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">PDF</a>
                    {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleStatusChange(inv.id, 'paid')}>Bezahlt</button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSend(inv.id)}>Senden</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(inv.id)}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                  Keine Rechnungen gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
