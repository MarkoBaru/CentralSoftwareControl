import axios from 'axios';
import { API_URL } from './context/AuthContext';

const api = {
  // Projekte
  getProjects: () => axios.get(`${API_URL}/projects`),
  getStats: () => axios.get(`${API_URL}/projects/stats`),
  getProject: (id) => axios.get(`${API_URL}/projects/${id}`),
  createProject: (data) => axios.post(`${API_URL}/projects`, data),
  updateProject: (id, data) => axios.put(`${API_URL}/projects/${id}`, data),
  toggleBlock: (id, is_blocked) => axios.patch(`${API_URL}/projects/${id}/block`, { is_blocked }),
  regenerateKey: (id) => axios.patch(`${API_URL}/projects/${id}/regenerate-key`),
  deleteProject: (id) => axios.delete(`${API_URL}/projects/${id}`),

  // Benutzer
  getUsers: () => axios.get(`${API_URL}/users`),
  createUser: (data) => axios.post(`${API_URL}/users`, data),
  updateUser: (id, data) => axios.put(`${API_URL}/users/${id}`, data),
  changePassword: (id, data) => axios.patch(`${API_URL}/users/${id}/password`, data),
  deleteUser: (id) => axios.delete(`${API_URL}/users/${id}`),

  // Zahlungen
  getPaymentSettings: (projectId) => axios.get(`${API_URL}/payments/settings/${projectId}`),
  updatePaymentSettings: (projectId, data) => axios.put(`${API_URL}/payments/settings/${projectId}`, data),
  getPayments: (projectId) => axios.get(`${API_URL}/payments/${projectId}`),
  addPayment: (projectId, data) => axios.post(`${API_URL}/payments/${projectId}`, data),
  deletePayment: (paymentId) => axios.delete(`${API_URL}/payments/entry/${paymentId}`),
  checkAllPayments: () => axios.post(`${API_URL}/payments/check-all`),
};

export default api;
