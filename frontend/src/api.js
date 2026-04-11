import axios from 'axios';
import { API_URL } from './context/AuthContext';

const api = {
  getProjects: () => axios.get(`${API_URL}/projects`),
  getStats: () => axios.get(`${API_URL}/projects/stats`),
  getProject: (id) => axios.get(`${API_URL}/projects/${id}`),
  createProject: (data) => axios.post(`${API_URL}/projects`, data),
  updateProject: (id, data) => axios.put(`${API_URL}/projects/${id}`, data),
  toggleBlock: (id, is_blocked) => axios.patch(`${API_URL}/projects/${id}/block`, { is_blocked }),
  regenerateKey: (id) => axios.patch(`${API_URL}/projects/${id}/regenerate-key`),
  deleteProject: (id) => axios.delete(`${API_URL}/projects/${id}`),
};

export default api;
