'use client';

import { ChatMessage } from './types';

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
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
}

export function clearChatMessages(): void {
    localStorage.removeItem(CHAT_STORAGE_KEY);
}
