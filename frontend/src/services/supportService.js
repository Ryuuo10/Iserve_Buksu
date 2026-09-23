import axios from 'axios';
import API_BASE_URL from '../config/api';
import authService from './authService';

const supportApi = axios.create({
  baseURL: `${API_BASE_URL}/support`,
});

supportApi.interceptors.request.use((config) => {
  const token = authService.getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const defaultError = (message) => ({
  success: false,
  message,
});

const supportService = {
  getTickets: async () => {
    try {
      const response = await supportApi.get('/tickets');
      return response.data;
    } catch (error) {
      return error.response?.data || defaultError('Failed to load support tickets');
    }
  },

  getTicketById: async (ticketId) => {
    try {
      const response = await supportApi.get(`/tickets/${ticketId}`);
      return response.data;
    } catch (error) {
      return error.response?.data || defaultError('Failed to load support ticket');
    }
  },

  createTicket: async (ticketData) => {
    try {
      const response = await supportApi.post('/tickets', ticketData);
      return response.data;
    } catch (error) {
      return error.response?.data || defaultError('Failed to create support ticket');
    }
  },

  addTicketMessage: async (ticketId, payload) => {
    try {
      const response = await supportApi.post(`/tickets/${ticketId}/messages`, payload);
      return response.data;
    } catch (error) {
      return error.response?.data || defaultError('Failed to update support ticket');
    }
  },
};

export default supportService;
