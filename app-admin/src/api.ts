import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (err) {
    console.warn('No active session, proceeding without token');
  }
  return config;
});

export default api;
