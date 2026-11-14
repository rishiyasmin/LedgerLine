
import axios from 'axios'

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    'https://ledgerline-backend-y3h0.onrender.com/api',

  headers: {
    'Content-Type': 'application/json',
  },

  timeout: 30000,
})

// Attach authentication token to API requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ledgerline_token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Handle expired or invalid authentication
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      localStorage.getItem('ledgerline_token')
    ) {
      localStorage.removeItem('ledgerline_token')
      localStorage.removeItem('ledgerline_user')

      window.dispatchEvent(new Event('ledgerline:unauthorized'))
    }

    return Promise.reject(error)
  }
)

export default api
