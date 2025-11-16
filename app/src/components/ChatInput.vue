<script setup>
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const input = ref('')

async function handleSubmit() {
  if (!input.value.trim() || chatStore.loading) return
  
  const message = input.value.trim()
  input.value = ''
  
  await chatStore.sendMessage(message)
}

function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}
</script>

<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <textarea
        v-model="input"
        placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
        class="chat-input"
        rows="1"
        :disabled="chatStore.loading"
        @keydown="handleKeydown"
      ></textarea>
      <button 
        class="send-button"
        :disabled="!input.trim() || chatStore.loading"
        @click="handleSubmit"
      >
        <span v-if="!chatStore.loading">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span v-else class="spinner"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-input-container {
  padding: 16px 24px;
  border-top: 1px solid #e5e5e5;
  background-color: white;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  max-width: 1000px;
  margin: 0 auto;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 15px;
  font-family: inherit;
  resize: none;
  min-height: 48px;
  max-height: 200px;
  transition: border-color 0.2s;
}

.chat-input:focus {
  outline: none;
  border-color: #667eea;
}

.chat-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 0.6;
}

.send-button {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-button:active:not(:disabled) {
  transform: translateY(0);
}

.send-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>