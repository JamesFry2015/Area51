import axios from 'axios';

// Create a new instance of axios with a custom configuration.
const apiClient = axios.create({
  // This must be an absolute URL pointing to our running backend server.
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// This interceptor adds the auth token to every request.
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// We export this configured instance so other parts of our app can use it.
export default apiClient;

