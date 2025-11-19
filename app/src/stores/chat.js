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
      const response = await axios.get('http://localhost:4001/api/models')
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
      
      const response = await axios.get(`http://localhost:4001/api/users/${userId}/chats`)
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
      
      const response = await axios.post('http://localhost:4001/api/chats', {
        user_id: userId,
        model_id: selectedModel.value,
        title,
        initial_message: initialMessage
      })      
      chats.value.unshift(response.data)
      currentChat.value = response.data
      
      // Load messages for this chat
      await loadChatMessages(response.data._id)
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
      const response = await axios.get(`http://localhost:4001/api/chats/${chatId}/messages`)
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
    loading.value = true

    // Create a placeholder message for the assistant's streaming response
    const assistantMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    }
    messages.value.push(assistantMessage)

    try {      
      const response = await fetch(`http://localhost:4001/api/chats/${currentChat.value._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          break
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })
        
        // Process complete lines from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '') continue
          
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) continue
              
              const data = JSON.parse(jsonStr)
              
              if (data.chunk) {
                // Append chunk to the assistant message
                assistantMessage.content += data.chunk
              } else if (data.done) {
                // Streaming complete
                assistantMessage.streaming = false
              } else if (data.error) {
                console.error('Streaming error:', data.error)
                assistantMessage.content = `Error: ${data.error}`
                assistantMessage.streaming = false
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', line, e)
            }
          }
        }
      }
      assistantMessage.streaming = false
      
      // Update chat in list
      const chatIndex = chats.value.findIndex(c => c._id === currentChat.value._id)
      if (chatIndex !== -1) {
        chats.value[chatIndex].updated_at = new Date()
        chats.value[chatIndex].last_message = content.substring(0, 50)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Update the assistant message with error
      assistantMessage.content = `Error: ${error.message}. Make sure Ollama is running and accessible.`
      assistantMessage.streaming = false
    } finally {
      loading.value = false
    }
  }

  async function deleteChat(chatId) {
    try {
      // Note: Your backend doesn't have a DELETE endpoint yet
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