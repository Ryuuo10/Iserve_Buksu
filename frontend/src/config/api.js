const normalizeBaseUrl = (url) => (url || '').replace(/\/+$/, '');

const BACKEND_URL = normalizeBaseUrl(
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
);

const API_BASE_URL = `${BACKEND_URL}/api`;
const buildApiUrl = (path = '') => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export { BACKEND_URL, API_BASE_URL, buildApiUrl };
export default API_BASE_URL;
