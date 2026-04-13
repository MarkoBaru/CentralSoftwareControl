import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiArrowLeft, FiCopy, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import api from '../api';
import PaymentSection from '../components/PaymentSection';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const res = await api.getProject(id);
      setProject(res.data);
      setEditForm(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleToggleBlock = async () => {
    try {
      await api.toggleBlock(id, !project.is_blocked);
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('API-Key wirklich neu generieren? Alle Clients müssen aktualisiert werden.')) return;
    try {
      await api.regenerateKey(id);
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Projekt "${project.name}" wirklich löschen? Diese Aktion ist unwiderruflich.`)) return;
    try {
      await api.deleteProject(id);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      await api.updateProject(id, editForm);
      setEditing(false);
      loadProject();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) return <div>Laden...</div>;
  if (!project) return <div>Projekt nicht gefunden</div>;

  const typeLabels = { website: 'Website', app: 'App', webapp: 'Web-App', other: 'Sonstige' };

  return (
    <div>
      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/" className="btn btn-ghost btn-sm"><FiArrowLeft /> Zurück</Link>
          <h1>{project.name}</h1>
          <span className={`badge badge-${project.status}`}>
            {project.status === 'active' ? 'Aktiv' : project.status === 'blocked' ? 'Blockiert' : project.status === 'maintenance' ? 'Wartung' : 'Entwicklung'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Abbrechen' : 'Bearbeiten'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDelete}><FiTrash2 /> Löschen</button>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          {/* Projekt-Info */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header"><h2>Projektdetails</h2></div>
            {editing ? (
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Projektname</label>
                    <input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Typ</label>
                    <select value={editForm.type || 'website'} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}>
                      <option value="website">Website</option>
                      <option value="app">App</option>
                      <option value="webapp">Web-App</option>
                      <option value="other">Sonstige</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kundenname</label>
                    <input value={editForm.client_name || ''} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Kunden-E-Mail</label>
                    <input value={editForm.client_email || ''} onChange={(e) => setEditForm({ ...editForm, client_email: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>URL</label>
                  <input value={editForm.url || ''} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Status</label>
                    <select value={editForm.status || 'active'} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="active">Aktiv</option>
                      <option value="maintenance">Wartung</option>
                      <option value="development">Entwicklung</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Abo-Status</label>
                    <select value={editForm.subscription_status || 'active'} onChange={(e) => setEditForm({ ...editForm, subscription_status: e.target.value })}>
                      <option value="active">Aktiv</option>
                      <option value="overdue">Überfällig</option>
                      <option value="cancelled">Gekündigt</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Notizen</label>
                  <textarea rows={3} value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0 1.5rem' }}>
                <div className="info-row"><span className="label">Typ</span><span className="value">{typeLabels[project.type]}</span></div>
                <div className="info-row"><span className="label">Kunde</span><span className="value">{project.client_name}</span></div>
                <div className="info-row"><span className="label">E-Mail</span><span className="value">{project.client_email || '—'}</span></div>
                <div className="info-row"><span className="label">URL</span><span className="value">{project.url ? <a href={project.url} target="_blank" rel="noreferrer">{project.url}</a> : '—'}</span></div>
                <div className="info-row">
                  <span className="label">Abo-Status</span>
                  <span className={`badge ${project.subscription_status === 'active' ? 'badge-active' : project.subscription_status === 'overdue' ? 'badge-overdue' : 'badge-cancelled'}`}>
                    {project.subscription_status === 'active' ? 'Aktiv' : project.subscription_status === 'overdue' ? 'Überfällig' : 'Gekündigt'}
                  </span>
                </div>
                <div className="info-row"><span className="label">Abo-Ende</span><span className="value">{project.subscription_end_date || '—'}</span></div>
                <div className="info-row"><span className="label">Beschreibung</span><span className="value">{project.description || '—'}</span></div>
                <div className="info-row"><span className="label">Notizen</span><span className="value">{project.notes || '—'}</span></div>
                <div className="info-row"><span className="label">Erstellt</span><span className="value">{project.created_at}</span></div>
                <div className="info-row"><span className="label">Aktualisiert</span><span className="value">{project.updated_at}</span></div>
              </div>
            )}
          </div>

          {/* API-Key */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <h2>API-Key</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? 'Verbergen' : 'Anzeigen'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleRegenerateKey}><FiRefreshCw /> Neu generieren</button>
              </div>
            </div>
            <div style={{ padding: '1.5rem' }}>
              {showApiKey ? (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div className="api-key-box" style={{ flex: 1 }}>{project.api_key}</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(project.api_key)}><FiCopy /></button>
                </div>
              ) : (
                <div className="api-key-box">••••••••••••••••••••••</div>
              )}
              <p style={{ fontSize: '0.8125rem', color: 'var(--gray-500)', marginTop: '0.75rem' }}>
                Dieser Key wird in die Client-Website/App integriert, um den Block-Status zu prüfen.
              </p>
            </div>
          </div>

          {/* Aktivitätslog */}
          <div className="card">
            <div className="card-header"><h2>Aktivitätslog</h2></div>
            <div style={{ padding: '0 1.5rem' }}>
              <ul className="activity-list">
                {(project.activities || []).map((a) => (
                  <li key={a.id} className="activity-item">
                    <span className="time">{new Date(a.created_at).toLocaleString('de-DE')}</span>
                    <span>{a.details}</span>
                  </li>
                ))}
                {(!project.activities || project.activities.length === 0) && (
                  <li className="activity-item" style={{ color: 'var(--gray-500)' }}>Keine Aktivitäten</li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Rechte Seite: Block-Kontrolle */}
        <div>
          <div className="block-control">
            <h3>Zugriffskontrolle</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
              Blockiert die Kunden-Website/App wenn das Abo nicht bezahlt wird.
            </p>
            <label className="toggle-switch" style={{ display: 'inline-block', transform: 'scale(1.5)' }}>
              <input
                type="checkbox"
                checked={!!project.is_blocked}
                onChange={handleToggleBlock}
              />
              <span className="toggle-slider"></span>
            </label>
            <div className={`block-status ${project.is_blocked ? 'blocked' : 'active'}`}>
              {project.is_blocked ? 'BLOCKIERT' : 'FREIGEGEBEN'}
            </div>
            {project.is_blocked && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginTop: '0.75rem' }}>
                Die Kunden-Website/App ist derzeit nicht erreichbar.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Zahlungsbereich */}
      <div style={{ marginTop: '1.5rem' }}>
        <PaymentSection projectId={id} />
      </div>
    </div>
  );
}
