import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || null)

  const isAuthenticated = computed(() => !!token.value)

  async function login(username, password) {
    try {
      const response = await axios.post('http://localhost:4001/api/login', {
        username,
        password
      })
      
      user.value = response.data.user
      token.value = response.data.user._id
      localStorage.setItem('token', token.value)
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
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