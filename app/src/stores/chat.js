import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

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
        selectedModel.value = models.value[0].model_name
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      // For testing without backend - REMOVE THIS LATER
      models.value = [
        { model_name: 'granite3.3:latest', label: 'Granite 3.3', description: 'Great for summarizing' },
        { model_name: 'llama3.1:latest', label: 'Llama 3.1', description: 'General purpose' },
        { model_name: 'mistral:latest', label: 'Mistral', description: 'Good for programming' }
      ]
      selectedModel.value = models.value[0].model_name
    }
  }

  async function fetchChats() {
    try {
      const response = await axios.get('/api/chats')
      chats.value = response.data
    } catch (error) {
      console.error('Failed to fetch chats:', error)
      // For testing - mock data
      chats.value = [
        {
          _id: '1',
          title: 'Previous Chat 1',
          last_message: 'Hello, how are you?',
          updated_at: new Date(Date.now() - 1000 * 60 * 30) // 30 min ago
        },
        {
          _id: '2',
          title: 'Previous Chat 2',
          last_message: 'Can you help me with...',
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
        }
      ]
    }
  }

  async function createChat(title = 'New Chat') {
    try {
      const response = await axios.post('/api/chats', {
        title,
        model: selectedModel.value
      })
      chats.value.unshift(response.data)
      currentChat.value = response.data
      messages.value = []
      return response.data
    } catch (error) {
      console.error('Failed to create chat:', error)
      // Mock for testing
      const newChat = {
        _id: Date.now().toString(),
        title,
        model: selectedModel.value,
        updated_at: new Date(),
        last_message: ''
      }
      chats.value.unshift(newChat)
      currentChat.value = newChat
      messages.value = []
      return newChat
    }
  }

  async function loadChat(chatId) {
    try {
      const response = await axios.get(`/api/chats/${chatId}`)
      currentChat.value = response.data
      messages.value = response.data.messages || []
    } catch (error) {
      console.error('Failed to load chat:', error)
      const chat = chats.value.find(c => c._id === chatId)
      if (chat) {
        currentChat.value = chat
        messages.value = []
      }
    }
  }

  async function sendMessage(content) {
    if (!currentChat.value) {
      await createChat('New Chat')
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
      const response = await fetch(`/api/chats/${currentChat.value._id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          model: selectedModel.value
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.chunk) {
                // Append chunk to the assistant message
                assistantMessage.content += data.chunk
              } else if (data.done) {
                // Streaming complete
                assistantMessage.streaming = false
              } else if (data.error) {
                console.error('Streaming error:', data.error)
                assistantMessage.content = 'Error: Failed to get response'
                assistantMessage.streaming = false
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e)
            }
          }
        }
      }
      
      // Update chat in list
      const chatIndex = chats.value.findIndex(c => c._id === currentChat.value._id)
      if (chatIndex !== -1) {
        chats.value[chatIndex].updated_at = new Date()
        chats.value[chatIndex].last_message = content.substring(0, 50)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      // Update the assistant message with error
      assistantMessage.content = `Error: ${error.message}. Make sure the backend is running.`
      assistantMessage.streaming = false
    } finally {
      loading.value = false
    }
  }

  async function deleteChat(chatId) {
    try {
      await axios.delete(`/api/chats/${chatId}`)
      chats.value = chats.value.filter(c => c._id !== chatId)
      if (currentChat.value?._id === chatId) {
        currentChat.value = null
        messages.value = []
      }
    } catch (error) {
      console.error('Failed to delete chat:', error)
      // Mock for testing
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
    sendMessage,
    deleteChat
  }
})