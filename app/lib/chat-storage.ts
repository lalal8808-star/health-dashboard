'use client';

import { ChatMessage } from './types';
import { syncedSetItem } from './storage-sync';

const CHAT_STORAGE_KEY = 'health-dashboard-chat-messages' as const;

export function getChatMessages(): ChatMessage[] {
    if (typeof window === 'undefined') return [];
    try {
        const data = localStorage.getItem(CHAT_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function saveChatMessage(message: ChatMessage): void {
    const messages = getChatMessages();
    messages.push(message);
    syncedSetItem(CHAT_STORAGE_KEY, messages);
}

export function clearChatMessages(): void {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    syncedSetItem(CHAT_STORAGE_KEY, []);
}
