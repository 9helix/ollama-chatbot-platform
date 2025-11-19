<script setup>
import { onMounted, ref, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import ChatSidebar from '@/components/ChatSidebar.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import ModelSelector from '@/components/ModelSelector.vue'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const authStore = useAuthStore()
const messagesContainer = ref(null)

onMounted(async () => {
  await chatStore.fetchModels()
  await chatStore.fetchChats()
})

// Auto-scroll to bottom when new messages arrive
watch(() => chatStore.messages.length, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
})

function handleNewChat() {
  // Reset current chat locally
  chatStore.currentChat = null
  chatStore.messages = []
  router.push('/')
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="chat-container">
    <ChatSidebar @new-chat="handleNewChat" />
    
    <div class="main-content">
      <div class="chat-header">
        <div class="header-left">
          <h2>{{ chatStore.currentChat?.title || 'New Chat' }}</h2>
          <ModelSelector />
        </div>
        <button class="logout-button" @click="handleLogout">
          <span class="logout-icon">🚪</span>
          Logout
        </button>
      </div>

      <div ref="messagesContainer" class="messages-container">
        <div v-if="chatStore.messages.length === 0" class="empty-state">
          <div class="empty-icon">💬</div>
          <h3>Start a conversation</h3>
          <p>Select a model and type your message below</p>
        </div>
        
        <ChatMessage
          v-for="(message, index) in chatStore.messages"
          :key="index"
          :message="message"
        />
        
        <div v-if="chatStore.loading" class="loading-indicator">
          <div class="loading-avatar">🤖</div>
          <div class="loading-content">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <ChatInput />
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  background-color: #f5f5f5;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: white;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e5e5;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.header-left h2 {
  font-size: 20px;
  color: #333;
  font-weight: 700;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background-color: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  font-weight: 600;
  transition: all 0.2s;
}

.logout-button:hover {
  background-color: #e5e5e5;
  color: #333;
}

.logout-icon {
  font-size: 16px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #fafafa;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 24px;
  margin-bottom: 8px;
  color: #666;
}

.empty-state p {
  font-size: 16px;
}

.loading-indicator {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background-color: #f9f9f9;
  animation: fadeIn 0.3s ease-in;
}

.loading-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.loading-content {
  flex: 1;
  display: flex;
  align-items: center;
}

.loading-dots {
  display: flex;
  gap: 6px;
  padding: 12px 0;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background-color: #667eea;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: #fafafa;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>