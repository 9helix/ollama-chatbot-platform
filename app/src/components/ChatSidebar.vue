<script setup>
import { useChatStore } from '@/stores/chat'
import { useRouter } from 'vue-router'

const chatStore = useChatStore()
const router = useRouter()

const emit = defineEmits(['new-chat'])

function selectChat(chat) {
  chatStore.loadChat(chat._id)
  router.push(`/chat/${chat._id}`)
}

function formatDate(date) {
  const d = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now - d)
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString()
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h1>Ollama Chatbot</h1>
      <button class="new-chat-btn" @click="emit('new-chat')">
        <span class="icon">+</span>
        New Chat
      </button>
    </div>

    <div class="chats-list">
      <div
        v-for="chat in chatStore.chats"
        :key="chat._id"
        class="chat-item"
        :class="{ active: chatStore.currentChat?._id === chat._id }"
        @click="selectChat(chat)"
      >
        <div class="chat-item-content">
          <h3>{{ chat.title }}</h3>
          <p v-if="chat.last_message">{{ chat.last_message }}</p>
        </div>
        <div class="chat-item-footer">
          <span class="chat-date">{{ formatDate(chat.updated_at) }}</span>
          <button 
            class="delete-btn"
            @click.stop="chatStore.deleteChat(chat._id)"
            title="Delete chat"
          >
            ✕
          </button>
        </div>
      </div>

      <div v-if="chatStore.chats.length === 0" class="empty-chats">
        <p>No chats yet</p>
        <p class="empty-subtitle">Click "New Chat" to start</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 280px;
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #34495e;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #34495e;
}

.sidebar-header h1 {
  font-size: 20px;
  margin-bottom: 16px;
  font-weight: 700;
}

.new-chat-btn {
  width: 100%;
  padding: 12px;
  background-color: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.new-chat-btn .icon {
  font-size: 20px;
  font-weight: 300;
}

.new-chat-btn:hover {
  background-color: #5568d3;
  transform: translateY(-1px);
}

.new-chat-btn:active {
  transform: translateY(0);
}

.chats-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chat-item {
  padding: 12px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.chat-item:hover {
  background-color: #34495e;
}

.chat-item.active {
  background-color: #34495e;
  border-left: 3px solid #667eea;
}

.chat-item-content h3 {
  font-size: 14px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.chat-item-content p {
  font-size: 12px;
  color: #95a5a6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.chat-date {
  font-size: 11px;
  color: #7f8c8d;
}

.delete-btn {
  background: none;
  border: none;
  color: #95a5a6;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 16px;
  transition: color 0.2s;
  border-radius: 4px;
}

.delete-btn:hover {
  color: #e74c3c;
  background-color: rgba(231, 76, 60, 0.1);
}

.empty-chats {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #7f8c8d;
  text-align: center;
  padding: 20px;
}

.empty-chats p {
  margin-bottom: 4px;
}

.empty-subtitle {
  font-size: 12px;
}

/* Scrollbar styling */
.chats-list::-webkit-scrollbar {
  width: 6px;
}

.chats-list::-webkit-scrollbar-track {
  background: #2c3e50;
}

.chats-list::-webkit-scrollbar-thumb {
  background: #34495e;
  border-radius: 3px;
}

.chats-list::-webkit-scrollbar-thumb:hover {
  background: #4a5f7f;
}
</style>