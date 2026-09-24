/**
 * ============================================================================
 * Axios API Client & JWT Interceptor Module (Desktop Viewer)
 * ============================================================================
 * Enterprise Architecture Strategy: Centralized HTTP Client & Automated JWT Injection.
 * Configures a single Axios instance bound to VITE_API_BASE_URL (api.alexandria-plus.com)
 * with an interceptor that automatically attaches active Cognito ID Tokens.
 */

import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create centralized Axios instance
const api = axios.create({
  baseURL: API_BASE_URL
});

/**
 * Axios Request Interceptor: Automatically fetches current Amplify Auth session
 * and injects the cryptographically signed JWT ID Token into the 'Authorization: Bearer' header.
 */
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
