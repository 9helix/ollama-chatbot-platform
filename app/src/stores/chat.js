import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

export const useChatStore = defineStore('chat', () => {
  const chats = ref([])
  const currentChat = ref(null)
  const messages = ref([])
  const models = ref([])
  const selectedModel = ref(null)
  const loading = ref(false)

  async function fetchModels() {
    try {
      const response = await axios.get('/api/models')
      models.value = response.data
      if (models.value.length > 0 && !selectedModel.value) {
        selectedModel.value = models.value[0]._id
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      models.value = []
    }
  }

  async function fetchChats() {
    try {
      const authStore = useAuthStore()
      const userId = authStore.user?._id
      
      if (!userId) {
        console.error('No user ID found')
        return
      }
      
      const response = await axios.get(`/api/users/${userId}/chats`)
      chats.value = response.data
    } catch (error) {
      console.error('Failed to fetch chats:', error)
      chats.value = []
    }
  }

  async function createChat(title = 'New Chat', initialMessage) {
    try {
      const authStore = useAuthStore()
      const userId = authStore.user?._id
      
      if (!userId || !selectedModel.value) {
        throw new Error('Missing user ID or model ID')
      }
      const userMessage = {
      role: 'user',
      content:initialMessage,
      timestamp: new Date()
    }
    
    messages.value.push(userMessage)
      const response = await axios.post('/api/chats', {
        user_id: userId,
        model_id: selectedModel.value,
        title,
        initial_message: initialMessage
      })      
      chats.value.unshift(response.data.chat)
      currentChat.value = response.data.chat
      
      // Load messages for this chat
      //await loadChatMessages(response.data.chat._id)
      const botMessage = {
      role: 'assistant',
      content:response.data.response,
      timestamp: new Date()
    }
    
    messages.value.push(botMessage)
      return response.data
    } catch (error) {
      console.error('Failed to create chat:', error)
      throw error
    }
  }

  async function loadChat(chatId) {
    try {
      currentChat.value = chats.value.find(c => c._id === chatId) || null
      await loadChatMessages(chatId)
    } catch (error) {
      console.error('Failed to load chat:', error)
      const chat = chats.value.find(c => c._id === chatId)
      if (chat) {
        currentChat.value = chat
        messages.value = []
      }
    }
  }

  async function loadChatMessages(chatId) {
    try {
      const response = await axios.get(`/api/chats/${chatId}/messages`)
      messages.value = response.data.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at
      }))
    } catch (error) {
      console.error('Failed to load chat messages:', error)
      messages.value = []
    }
  }

  async function sendMessage(content) {
    if (!currentChat.value) {
      // Create a new chat with the first message
      await createChat('New Chat', content)
      return
    }

    const userMessage = {
      role: 'user',
      content,
      timestamp: new Date()
    }
    
    messages.value.push(userMessage)
    //loading.value = true

    // Create a placeholder message for the assistant's streaming response
    
    //messages.value.push(assistantMessage)

         
    const response = await axios.post(`/api/chats/${currentChat.value._id}/messages`, {
      message: content
    })
const assistantMessage = {
      role: 'assistant',
      content: response.data.response,
      timestamp: new Date(),
    }
    messages.value.push(assistantMessage)
  }

  async function deleteChat(chatId) {
    try {
      console.log("Deleting chat from store:", chatId);
      await axios.delete(`/api/chats/${chatId}`)
      chats.value = chats.value.filter(c => c._id !== chatId)
      if (currentChat.value?._id === chatId) {
        currentChat.value = null
        messages.value = []
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
      // Still remove from frontend even if backend fails
      chats.value = chats.value.filter(c => c._id !== chatId)
      if (currentChat.value?._id === chatId) {
        currentChat.value = null
        messages.value = []
      }
    }
  }

  return {
    chats,
    currentChat,
    messages,
    models,
    selectedModel,
    loading,
    fetchModels,
    fetchChats,
    createChat,
    loadChat,
    loadChatMessages,
    sendMessage,
    deleteChat
  }
})