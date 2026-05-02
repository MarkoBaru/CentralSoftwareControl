import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ccd_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          logout();
        } else {
          setUser(payload);
        }
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password, totp) => {
    const payload = totp ? { email, password, totp } : { email, password };
    const res = await axios.post(`${API_URL}/auth/login`, payload);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('ccd_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
  };

  const setup = async (email, password, name) => {
    const res = await axios.post(`${API_URL}/auth/setup`, { email, password, name });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('ccd_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (_) {
      // egal - Token wird so oder so lokal verworfen
    }
    localStorage.removeItem('ccd_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, setup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { API_URL };
