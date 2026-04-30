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

  // Einstellungen
  getSettings: () => axios.get(`${API_URL}/settings`),
  updateSettings: (data) => axios.put(`${API_URL}/settings`, data),
  sendTestEmail: () => axios.post(`${API_URL}/settings/test-email`),
  bankSync: () => axios.post(`${API_URL}/settings/bank-sync`),
  uploadCamt: (xmlContent) => axios.post(`${API_URL}/settings/upload-camt`, { xmlContent }),

  // Rechnungen
  getInvoices: () => axios.get(`${API_URL}/invoices`),
  getInvoiceStats: () => axios.get(`${API_URL}/invoices/stats`),
  createInvoice: (data) => axios.post(`${API_URL}/invoices`, data),
  updateInvoiceStatus: (id, status) => axios.patch(`${API_URL}/invoices/${id}/status`, { status }),
  sendInvoice: (id) => axios.post(`${API_URL}/invoices/${id}/send`),
  deleteInvoice: (id) => axios.delete(`${API_URL}/invoices/${id}`),
  getInvoicePdfUrl: (id) => `${API_URL}/invoices/${id}/pdf`,
};

export default api;
