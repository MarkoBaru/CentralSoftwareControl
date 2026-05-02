import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen haben');
      return;
    }
    if (password !== confirm) {
      setError('Passwoerter stimmen nicht ueberein');
      return;
    }
    setLoading(true);
    try {
      await api.confirmPasswordReset(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Verbindungsfehler');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Neues Passwort</h1>
        {done ? (
          <p>Passwort gesetzt. Du wirst weitergeleitet...</p>
        ) : (
          <>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Neues Passwort (min. 8 Zeichen)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus minLength={8} />
              </div>
              <div className="form-group">
                <label>Passwort wiederholen</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Speichere...' : 'Passwort setzen'}
              </button>
            </form>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <Link to="/login">Zurueck zum Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
