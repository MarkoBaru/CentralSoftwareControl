import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { FiGrid, FiFolder, FiLogOut } from 'react-icons/fi';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import './App.css';

function Layout({ children }) {
  const { user, logout } = useAuth();

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
        </div>
        <div className="sidebar-user">
          <span>{user?.name || user?.email}</span>
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
