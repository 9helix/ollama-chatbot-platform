import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)

  const isAuthenticated = computed(() => !!token.value)

  async function login(username, password) {
    try {
      // Make API call to your backend
      const response = await axios.post('/api/auth/login', {
        username,
        password
      })
      
      // Store token and user info
      token.value = response.data.token
      user.value = response.data.user
      localStorage.setItem('token', token.value)
      
      // Set default axios header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
      
      return true
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
  }

  // Initialize axios header if token exists on page load
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout
  }
})