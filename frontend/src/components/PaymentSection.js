import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiPlus, FiTrash2, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import api from '../api';

export default function PaymentSection({ projectId }) {
  const [settings, setSettings] = useState(null);
  const [payments, setPayments] = useState([]);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', reference_number: '', payment_date: '', period_month: '', period_year: '', notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [settingsRes, paymentsRes] = await Promise.all([
        api.getPaymentSettings(projectId),
        api.getPayments(projectId)
      ]);
      setSettings(settingsRes.data);
      setSettingsForm(settingsRes.data);
      setPayments(paymentsRes.data);
    } catch (err) {
      console.error('Fehler beim Laden der Zahlungsdaten:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.updatePaymentSettings(projectId, settingsForm);
      setEditingSettings(false);
      setSuccess('Zahlungseinstellungen gespeichert');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.addPayment(projectId, {
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
        period_month: parseInt(paymentForm.period_month),
        period_year: parseInt(paymentForm.period_year)
      });
      setShowAddPayment(false);
      setPaymentForm({ amount: '', reference_number: '', payment_date: '', period_month: '', period_year: '', notes: '' });
      setSuccess('Zahlung erfasst');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erfassen');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Zahlung wirklich löschen?')) return;
    try {
      await api.deletePayment(paymentId);
      setSuccess('Zahlung gelöscht');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const handleCheckStatus = async () => {
    try {
      await api.checkAllPayments();
      setSuccess('Zahlungsstatus geprüft');
      loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler bei der Prüfung');
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const isMonthPaid = (month, year) => {
    return payments.some(p => p.period_month === month && p.period_year === year && p.status === 'confirmed');
  };

  // Zeige die letzten 6 Monate + aktueller + nächste 2
  const monthOverview = [];
  for (let i = -6; i <= 2; i++) {
    let m = currentMonth + i;
    let y = currentYear;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    monthOverview.push({ month: m, year: y, paid: isMonthPaid(m, y), isCurrent: i === 0 });
  }

  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  if (!settings) return null;

  return (
    <div>
      {success && <div style={{ background: '#bbf7d0', color: '#16a34a', padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}
      {error && <div className="error-msg">{error}</div>}

      {/* Zahlungseinstellungen */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2><FiDollarSign style={{ marginRight: '0.5rem' }} />Zahlungseinstellungen</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={handleCheckStatus} title="Status prüfen"><FiRefreshCw /> Prüfen</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEditingSettings(!editingSettings); setError(''); }}>
              {editingSettings ? 'Abbrechen' : 'Bearbeiten'}
            </button>
          </div>
        </div>
        {editingSettings ? (
          <div className="modal-body">
            <form onSubmit={handleSaveSettings}>
              <div className="form-row">
                <div className="form-group">
                  <label>Monatlicher Betrag (€)</label>
                  <input type="number" step="0.01" min="0" value={settingsForm.monthly_amount || ''} onChange={(e) => setSettingsForm({ ...settingsForm, monthly_amount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Referenznummer (Bank)</label>
                  <input value={settingsForm.reference_number || ''} onChange={(e) => setSettingsForm({ ...settingsForm, reference_number: e.target.value })} placeholder="z.B. PROJ-001" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Puffer-Monate</label>
                  <input type="number" min="0" max="12" value={settingsForm.buffer_months != null ? settingsForm.buffer_months : 3} onChange={(e) => setSettingsForm({ ...settingsForm, buffer_months: parseInt(e.target.value) || 0 })} />
                  <small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Wie viele Monate darf die Zahlung ausbleiben, bevor blockiert wird</small>
                </div>
                <div className="form-group">
                  <label>Abrechnungszyklus</label>
                  <select value={settingsForm.billing_cycle || 'monthly'} onChange={(e) => setSettingsForm({ ...settingsForm, billing_cycle: e.target.value })}>
                    <option value="monthly">Monatlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={!!settingsForm.auto_block} onChange={(e) => setSettingsForm({ ...settingsForm, auto_block: e.target.checked ? 1 : 0 })} />
                  Automatisches Blockieren bei ausbleibender Zahlung
                </label>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={!!settingsForm.auto_invoice} onChange={(e) => setSettingsForm({ ...settingsForm, auto_invoice: e.target.checked ? 1 : 0 })} />
                    Wiederkehrende Rechnung automatisch erstellen
                  </label>
                </div>
                <div className="form-group">
                  <label>Tag im Monat (Rechnung)</label>
                  <input type="number" min="1" max="28" value={settingsForm.invoice_day != null ? settingsForm.invoice_day : 1} onChange={(e) => setSettingsForm({ ...settingsForm, invoice_day: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ padding: '0 1.5rem' }}>
            <div className="info-row"><span className="label">Monatlicher Betrag</span><span className="value">{settings.monthly_amount > 0 ? `${settings.monthly_amount.toFixed(2)} €` : 'Nicht konfiguriert'}</span></div>
            <div className="info-row"><span className="label">Referenznummer</span><span className="value">{settings.reference_number || '—'}</span></div>
            <div className="info-row"><span className="label">Puffer-Monate</span><span className="value">{settings.buffer_months}</span></div>
            <div className="info-row"><span className="label">Abrechnungszyklus</span><span className="value">{settings.billing_cycle === 'yearly' ? 'Jährlich' : 'Monatlich'}</span></div>
            <div className="info-row"><span className="label">Auto-Blockieren</span><span className="value">{settings.auto_block ? 'Aktiv' : 'Deaktiviert'}</span></div>
          </div>
        )}
      </div>

      {/* Monatsübersicht */}
      {settings.monthly_amount > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header"><h2>Zahlungsübersicht</h2></div>
          <div style={{ padding: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {monthOverview.map(({ month, year, paid, isCurrent }) => (
              <div key={`${year}-${month}`} style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                textAlign: 'center',
                minWidth: '70px',
                border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                background: paid ? 'var(--success-light)' : (isCurrent || month <= currentMonth && year === currentYear ? 'var(--danger-light)' : 'var(--gray-50)')
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{year}</div>
                <div style={{ fontWeight: 600 }}>{monthNames[month - 1]}</div>
                <div style={{ marginTop: '0.25rem' }}>
                  {paid ? <FiCheck style={{ color: 'var(--success)' }} /> : <FiX style={{ color: month <= currentMonth && year <= currentYear ? 'var(--danger)' : 'var(--gray-300)' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Zahlungshistorie */}
      <div className="card">
        <div className="card-header">
          <h2>Zahlungshistorie</h2>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setShowAddPayment(true);
            setPaymentForm({
              amount: settings.monthly_amount || '',
              reference_number: settings.reference_number || '',
              payment_date: new Date().toISOString().split('T')[0],
              period_month: currentMonth,
              period_year: currentYear,
              notes: ''
            });
          }}>
            <FiPlus /> Zahlung erfassen
          </button>
        </div>

        {showAddPayment && (
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
            <form onSubmit={handleAddPayment}>
              <div className="form-row">
                <div className="form-group">
                  <label>Betrag (€) *</label>
                  <input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Referenznummer</label>
                  <input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Zahlungsdatum</label>
                  <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Monat *</label>
                    <select value={paymentForm.period_month} onChange={(e) => setPaymentForm({ ...paymentForm, period_month: e.target.value })}>
                      {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Jahr *</label>
                    <input type="number" min="2020" max="2040" value={paymentForm.period_year} onChange={(e) => setPaymentForm({ ...paymentForm, period_year: e.target.value })} required />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddPayment(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary btn-sm">Zahlung erfassen</button>
              </div>
            </form>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Zeitraum</th>
              <th>Betrag</th>
              <th>Referenz</th>
              <th>Datum</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{monthNames[p.period_month - 1]} {p.period_year}</td>
                <td style={{ fontWeight: 500 }}>{p.amount.toFixed(2)} €</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.reference_number || '—'}</td>
                <td>{p.payment_date}</td>
                <td>
                  <span className={`badge ${p.status === 'confirmed' ? 'badge-active' : p.status === 'pending' ? 'badge-maintenance' : 'badge-blocked'}`}>
                    {p.status === 'confirmed' ? 'Bestätigt' : p.status === 'pending' ? 'Ausstehend' : 'Fehlgeschlagen'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePayment(p.id)} style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                  Keine Zahlungen erfasst
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
