import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Login from '@/views/Login.vue'
import Chat from '@/views/Chat.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      name: 'chat',
      component: Chat,
      meta: { requiresAuth: true }
    },
    {
      path: '/chat/:id?',
      name: 'chat-detail',
      component: Chat,
      meta: { requiresAuth: true }
    }
  ]
})

// Navigation guard for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Redirect to login if not authenticated
    next('/login')
  } else if (to.path === '/login' && authStore.isAuthenticated) {
    // Redirect to chat if already logged in
    next('/')
  } else {
    next()
  }
})

export default router