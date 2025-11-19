<script setup>
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
</script>

<template>
  <div class="model-selector">
    <label for="model-select">Model:</label>
    <select 
      id="model-select"
      v-model="chatStore.selectedModel"
      class="model-dropdown"
    >
      <option 
        v-for="model in chatStore.models" 
        :key="model._id"
        :value="model._id"
      >
        {{ model.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.model-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

label {
  font-size: 14px;
  font-weight: 600;
  color: #666;
}

.model-dropdown {
  padding: 8px 32px 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  color: #333;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.model-dropdown:hover {
  border-color: #667eea;
}

.model-dropdown:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
</style>