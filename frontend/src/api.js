import axios from 'axios';

// Create a new instance of axios with a custom configuration.
const apiClient = axios.create({
  // This must be an absolute URL pointing to our running backend server.
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});


// We export this configured instance so other parts of our app can use it.
export default apiClient;

