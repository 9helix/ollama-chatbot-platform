<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import axios from 'axios'

const router = useRouter()
const chatStore = useChatStore()
const searchQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const showResults = ref(false)
const searchTimeout = ref(null)

const emit = defineEmits(['close', 'result-selected'])

// Debounced search function
watch(searchQuery, (newQuery) => {
  // Clear previous timeout
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }

  // If query is empty, clear results
  if (!newQuery.trim()) {
    searchResults.value = []
    showResults.value = false
    return
  }

  // Wait 300ms before searching (debounce)
  searchTimeout.value = setTimeout(() => {
    performSearch(newQuery)
  }, 300)
})

async function performSearch(query) {
  if (!query.trim()) return

  isSearching.value = true
  showResults.value = true

  try {
    // Replace spaces with %20 for URL encoding
    const encodedQuery = query.trim().replace(/\s+/g, '%20')
    
    const response = await axios.get(`/api/search?q=${encodedQuery}`)
    searchResults.value = response.data
  } catch (error) {
    console.error('Search failed:', error)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

async function selectResult(result) {
  // Close search UI
  closeSearch()
  
  // Load the chat that contains this message
  await chatStore.loadChat(result.chat_id)
  
  // Navigate to the chat
  if (router.currentRoute.value.params.id !== result.chat_id) {
    router.push(`/chat/${result.chat_id}`)
  }
  
  // Emit the result
  emit('result-selected', result)
}

function closeSearch() {
  searchQuery.value = ''
  searchResults.value = []
  showResults.value = false
  emit('close')
}

function handleClickOutside(event) {
  if (!event.target.closest('.search-container')) {
    showResults.value = false
  }
}

// Truncate long messages
function truncateMessage(content, maxLength = 100) {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}
</script>

<template>
  <div class="search-container" @click.stop>
    <div class="search-input-wrapper">
      <div class="search-icon">🔍</div>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search your chat history..."
        @focus="showResults = searchQuery.length > 0"
      />
      <button 
        v-if="searchQuery"
        class="clear-button"
        @click="closeSearch"
      >
        ✕
      </button>
    </div>

    <!-- Search Results Dropdown -->
    <div v-if="showResults" class="search-results">
      <!-- Loading State -->
      <div v-if="isSearching" class="search-loading">
        <div class="spinner"></div>
        <span>Searching...</span>
      </div>

      <!-- Results -->
      <div v-else-if="searchResults.length > 0" class="results-list">
        <div class="results-header">
          Found {{ searchResults.length }} {{ searchResults.length === 1 ? 'message' : 'messages' }}
        </div>
        <div
          v-for="result in searchResults"
          :key="result.id"
          class="result-item"
          @click="selectResult(result)"
        >
          <div class="result-content">
            <div class="result-text">{{ truncateMessage(result.content) }}</div>
            <div class="result-meta">
              <span class="chat-id-badge">Chat: {{ result.chat_id.substring(0, 8) }}...</span>
            </div>
          </div>
          <div class="result-arrow">→</div>
        </div>
      </div>

      <!-- No Results -->
      <div v-else class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No messages found</div>
        <div class="no-results-hint">Try different keywords</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  position: relative;
  width: 100%;
  max-width: 600px;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 8px 12px;
  transition: all 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-icon {
  font-size: 18px;
  margin-right: 8px;
  opacity: 0.5;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  padding: 4px 0;
}

.clear-button {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 18px;
  transition: color 0.2s;
}

.clear-button:hover {
  color: #333;
}

.search-results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #666;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.results-list {
  padding: 8px 0;
}

.results-header {
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f5f5f5;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background-color: #f8f9ff;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-text {
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-id-badge {
  font-size: 11px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.result-arrow {
  font-size: 18px;
  color: #667eea;
  margin-left: 12px;
}

.no-results {
  padding: 40px 20px;
  text-align: center;
}

.no-results-icon {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 12px;
}

.no-results-text {
  font-size: 16px;
  color: #666;
  margin-bottom: 4px;
}

.no-results-hint {
  font-size: 13px;
  color: #999;
}

/* Scrollbar styling */
.search-results::-webkit-scrollbar {
  width: 6px;
}

.search-results::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

.search-results::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 10px;
}

.search-results::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>