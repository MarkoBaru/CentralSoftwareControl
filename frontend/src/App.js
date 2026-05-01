import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { FiGrid, FiFolder, FiUsers, FiLogOut, FiSettings, FiFileText, FiActivity, FiSun, FiMoon } from 'react-icons/fi';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import InvoicesPage from './pages/InvoicesPage';
import ActivityPage from './pages/ActivityPage';
import './App.css';

function Layout({ children }) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('ccd_theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ccd_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-logo">Control Dashboard</div>
        <div className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <FiGrid /> Dashboard
          </NavLink>
          <NavLink to="/projects/new" className={({ isActive }) => isActive ? 'active' : ''}>
            <FiFolder /> Neues Projekt
          </NavLink>
          <NavLink to="/invoices" className={({ isActive }) => isActive ? 'active' : ''}>
            <FiFileText /> Rechnungen
          </NavLink>
          <NavLink to="/activity" className={({ isActive }) => isActive ? 'active' : ''}>
            <FiActivity /> Aktivitäten
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
            <FiUsers /> Benutzer
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
              <FiSettings /> Einstellungen
            </NavLink>
          )}
        </div>
        <div className="sidebar-user">
          <span>{user?.name || user?.email}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme'}
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            {theme === 'dark' ? <FiSun /> : <FiMoon />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: 'rgba(255,255,255,0.7)' }}>
            <FiLogOut />
          </button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/projects/new" element={<ProtectedRoute><NewProjectPage /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
          <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute><ActivityPage /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
