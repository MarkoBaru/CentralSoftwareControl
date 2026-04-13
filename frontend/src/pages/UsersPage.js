import React, { useState, useEffect } from 'react';
import { FiUserPlus, FiTrash2, FiEdit2, FiKey, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showPassword, setShowPassword] = useState(null); // userId
  const [showEdit, setShowEdit] = useState(null); // userId
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', name: '', role: 'viewer' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [editForm, setEditForm] = useState({ name: '', role: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createUser(inviteForm);
      setShowInvite(false);
      setInviteForm({ email: '', password: '', name: '', role: 'viewer' });
      setSuccess('Benutzer erfolgreich eingeladen');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Erstellen');
    }
  };

  const handlePasswordChange = async (e, userId) => {
    e.preventDefault();
    setError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    try {
      const data = { newPassword: passwordForm.newPassword };
      if (userId === currentUser.id) {
        data.currentPassword = passwordForm.currentPassword;
      }
      await api.changePassword(userId, data);
      setShowPassword(null);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Passwort erfolgreich geändert');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Ändern');
    }
  };

  const handleEditUser = async (e, userId) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateUser(userId, editForm);
      setShowEdit(null);
      setSuccess('Benutzer aktualisiert');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!window.confirm(`Benutzer "${userName}" wirklich löschen?`)) return;
    try {
      await api.deleteUser(userId);
      setSuccess('Benutzer gelöscht');
      loadUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const openEdit = (u) => {
    setEditForm({ name: u.name, role: u.role });
    setShowEdit(u.id);
    setShowPassword(null);
    setShowInvite(false);
    setError('');
  };

  const openPassword = (userId) => {
    setShowPassword(userId);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setShowEdit(null);
    setShowInvite(false);
    setError('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Benutzerverwaltung</h1>
        <button className="btn btn-primary" onClick={() => { setShowInvite(true); setShowEdit(null); setShowPassword(null); setError(''); }}>
          <FiUserPlus /> Benutzer einladen
        </button>
      </div>

      {success && <div style={{ background: '#bbf7d0', color: '#16a34a', padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{success}</div>}
      {error && <div className="error-msg">{error}</div>}

      {/* Einladungsformular */}
      {showInvite && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2>Neuen Benutzer einladen</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}><FiX /></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleInvite}>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>E-Mail *</label>
                  <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Passwort *</label>
                  <input type="password" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} required minLength={6} />
                </div>
                <div className="form-group">
                  <label>Rolle</label>
                  <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}>
                    <option value="admin">Admin</option>
                    <option value="viewer">Betrachter</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Abbrechen</button>
                <button type="submit" className="btn btn-primary">Einladen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Benutzerliste */}
      <div className="card">
        <div className="card-header"><h2>Benutzer ({users.length})</h2></div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Erstellt</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <React.Fragment key={u.id}>
                <tr>
                  <td style={{ fontWeight: 500 }}>
                    {u.name}
                    {u.id === currentUser.id && <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginLeft: '0.5rem' }}>(Du)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-active' : 'badge-development'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Betrachter'}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openPassword(u.id)} title="Passwort ändern"><FiKey /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Bearbeiten"><FiEdit2 /></button>
                      {u.id !== currentUser.id && (
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(u.id, u.name)} title="Löschen" style={{ color: 'var(--danger)' }}><FiTrash2 /></button>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Inline Passwort-Ändern */}
                {showPassword === u.id && (
                  <tr>
                    <td colSpan="5" style={{ background: 'var(--gray-50)' }}>
                      <form onSubmit={(e) => handlePasswordChange(e, u.id)} style={{ maxWidth: 400, padding: '1rem 0' }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Passwort ändern für {u.name}</h3>
                        {u.id === currentUser.id && (
                          <div className="form-group">
                            <label>Aktuelles Passwort</label>
                            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required />
                          </div>
                        )}
                        <div className="form-group">
                          <label>Neues Passwort</label>
                          <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength={6} />
                        </div>
                        <div className="form-group">
                          <label>Passwort bestätigen</label>
                          <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required minLength={6} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button type="submit" className="btn btn-primary btn-sm">Speichern</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword(null)}>Abbrechen</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
                {/* Inline Benutzer bearbeiten */}
                {showEdit === u.id && (
                  <tr>
                    <td colSpan="5" style={{ background: 'var(--gray-50)' }}>
                      <form onSubmit={(e) => handleEditUser(e, u.id)} style={{ maxWidth: 400, padding: '1rem 0' }}>
                        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Benutzer bearbeiten</h3>
                        <div className="form-group">
                          <label>Name</label>
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Rolle</label>
                          <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                            <option value="admin">Admin</option>
                            <option value="viewer">Betrachter</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button type="submit" className="btn btn-primary btn-sm">Speichern</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEdit(null)}>Abbrechen</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
