import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, setup, user } = useAuth();
  const navigate = useNavigate();
  const [isSetup, setIsSetup] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', totp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);

  // Bereits eingeloggt → weiter zum Dashboard
  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSetup) {
        await setup(form.email, form.password, form.name);
      } else {
        await login(form.email, form.password, needs2fa ? form.totp : undefined);
      }
      navigate('/');
    } catch (err) {
      const data = err.response?.data || {};
      if (data.requires_2fa) {
        setNeeds2fa(true);
        setError(data.error || '2FA-Code erforderlich');
      } else {
        setError(data.error || 'Verbindungsfehler');
      }
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Control Dashboard</h1>
        <p>{isSetup ? 'Erstelle dein Admin-Konto' : 'Anmeldung'}</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          {isSetup && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>E-Mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {needs2fa && !isSetup && (
            <div className="form-group">
              <label>2FA-Code (Authenticator-App)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={form.totp}
                onChange={(e) => setForm({ ...form, totp: e.target.value.replace(/\D/g, '') })}
                autoFocus
                required
              />
            </div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Laden...' : isSetup ? 'Konto erstellen' : 'Anmelden'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setIsSetup(!isSetup); setError(''); }}
          >
            {isSetup ? 'Zurück zum Login' : 'Erstes Admin-Konto erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
