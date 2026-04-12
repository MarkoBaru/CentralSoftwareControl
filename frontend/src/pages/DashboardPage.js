import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiShield, FiAlertTriangle, FiActivity, FiLayers, FiTool } from 'react-icons/fi';
import api from '../api';

export default function DashboardPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, overdue: 0, maintenance: 0 });
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, projectsRes] = await Promise.all([api.getStats(), api.getProjects()]);
      setStats(statsRes.data);
      setProjects(projectsRes.data);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    }
  };

  const handleToggleBlock = async (project) => {
    try {
      await api.toggleBlock(project.id, !project.is_blocked);
      loadData();
    } catch (err) {
      console.error('Fehler beim Blockieren:', err);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (filter === 'blocked') return p.is_blocked;
    if (filter === 'active') return !p.is_blocked && p.status === 'active';
    if (filter === 'overdue') return p.subscription_status === 'overdue';
    if (filter === 'maintenance') return p.status === 'maintenance';
    return true;
  }).filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q);
  });

  const typeLabels = { website: 'Website', app: 'App', webapp: 'Web-App', other: 'Sonstige' };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="label">Gesamt Projekte</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Aktiv</div>
          <div className="value">{stats.active}</div>
        </div>
        <div className="stat-card danger">
          <div className="label">Blockiert</div>
          <div className="value">{stats.blocked}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Zahlung überfällig</div>
          <div className="value">{stats.overdue}</div>
        </div>
        <div className="stat-card">
          <div className="label">Wartung</div>
          <div className="value">{stats.maintenance}</div>
        </div>
      </div>

      <div className="filter-bar">
        {['all', 'active', 'blocked', 'overdue', 'maintenance'].map((f) => (
          <button
            key={f}
            className={`filter-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : f === 'blocked' ? 'Blockiert' : f === 'overdue' ? 'Überfällig' : 'Wartung'}
          </button>
        ))}
        <input
          className="search-box"
          placeholder="Suche nach Name oder Kunde..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Projekte ({filteredProjects.length})</h2>
          <Link to="/projects/new" className="btn btn-primary">+ Neues Projekt</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Kunde</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Abo</th>
              <th>Blockiert</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link to={`/projects/${project.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                    {project.name}
                  </Link>
                </td>
                <td>{project.client_name}</td>
                <td>{typeLabels[project.type] || project.type}</td>
                <td>
                  <span className={`badge badge-${project.status}`}>
                    {project.status === 'active' ? 'Aktiv' : project.status === 'blocked' ? 'Blockiert' : project.status === 'maintenance' ? 'Wartung' : 'Entwicklung'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${project.subscription_status === 'active' ? 'badge-active' : project.subscription_status === 'overdue' ? 'badge-overdue' : 'badge-cancelled'}`}>
                    {project.subscription_status === 'active' ? 'Aktiv' : project.subscription_status === 'overdue' ? 'Überfällig' : 'Gekündigt'}
                  </span>
                </td>
                <td>
                  <label className="toggle-switch" title={project.is_blocked ? 'Klicken zum Freigeben' : 'Klicken zum Blockieren'}>
                    <input
                      type="checkbox"
                      checked={!!project.is_blocked}
                      onChange={() => handleToggleBlock(project)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <Link to={`/projects/${project.id}`} className="btn btn-ghost btn-sm">Details</Link>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                  Keine Projekte gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
