import { axiosInstance } from './authService';
import API_BASE_URL from '../config/api';

const PROFILE_API_BASE_URL = `${API_BASE_URL}/profile`;

class ProfileService {
  async checkCompletionStatus() {
    const response = await axiosInstance.get(`${PROFILE_API_BASE_URL}/completion-status`);
    return response.data;
  }

  async completeProfile(data) {
    const response = await axiosInstance.post(`${PROFILE_API_BASE_URL}/complete`, data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }

  async getOffices() {
    const response = await axiosInstance.get(`${PROFILE_API_BASE_URL}/offices`);
    return response.data;
  }
}

export default new ProfileService();
