import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Verbindungsfehler');
    }
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Passwort vergessen</h1>
        {done ? (
          <>
            <p>Falls die E-Mail bekannt ist, wurde eine Nachricht mit Reset-Link gesendet. Pruefe auch deinen Spam-Ordner.</p>
            <p style={{ marginTop: '1rem' }}><Link to="/login">Zurueck zum Login</Link></p>
          </>
        ) : (
          <>
            <p>Gib deine E-Mail-Adresse ein, um einen Link zum Zuruecksetzen zu erhalten.</p>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>E-Mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Sende...' : 'Reset-Link anfordern'}
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
