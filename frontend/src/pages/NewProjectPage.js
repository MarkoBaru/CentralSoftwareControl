import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    client_email: '',
    type: 'website',
    url: '',
    description: '',
    subscription_end_date: '',
    notes: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.createProject(form);
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen');
    }
  };

  const update = (field, value) => setForm({ ...form, [field]: value });

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Neues Projekt</h1>
      {error && <div className="error-msg">{error}</div>}
      <div className="card">
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Projektname *</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Typ *</label>
                <select value={form.type} onChange={(e) => update('type', e.target.value)}>
                  <option value="website">Website</option>
                  <option value="app">App</option>
                  <option value="webapp">Web-App</option>
                  <option value="other">Sonstige</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Kundenname *</label>
                <input value={form.client_name} onChange={(e) => update('client_name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Kunden-E-Mail</label>
                <input type="email" value={form.client_email} onChange={(e) => update('client_email', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>URL</label>
              <input value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Beschreibung</label>
              <textarea rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Abo-Ende</label>
              <input type="date" value={form.subscription_end_date} onChange={(e) => update('subscription_end_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Notizen</label>
              <textarea rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>Abbrechen</button>
              <button type="submit" className="btn btn-primary">Projekt anlegen</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
