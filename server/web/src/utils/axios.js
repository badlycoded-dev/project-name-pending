import axios from 'axios';
import { removeToken } from './utils';

const useHttps = process.env.REACT_APP_USE_HTTPS === 'true';

const BASE_URL = useHttps
  ? (process.env.REACT_APP_API_URL_S || 'https://localhost:4043/api')
  : (process.env.REACT_APP_API_URL   || 'http://localhost:4040/api');

const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;