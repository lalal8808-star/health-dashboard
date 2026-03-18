'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Trash2, Bot, User, Loader2, Mic, MicOff, StopCircle } from 'lucide-react';
import { ChatMessage } from '@/app/lib/types';
import { getChatMessages, saveChatMessage, clearChatMessages } from '@/app/lib/chat-storage';
import { getRecords } from '@/app/lib/storage';
import { getFoodLogs } from '@/app/lib/food-storage';
import { getWorkoutLogs } from '@/app/lib/workout-storage';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
}
declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition: new () => SpeechRecognitionInstance;
    }
}

// ── Module-level state (persists across tab navigations) ──────────────────────
let _messages: ChatMessage[] = [];
let _isStreaming = false;
let _abortController: AbortController | null = null;
const _listeners = new Set<() => void>();

function _notify() { _listeners.forEach(fn => fn()); }

function _subscribe(fn: () => void) {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
}

function _init() {
    if (_messages.length === 0) {
        _messages = getChatMessages();
    }
}
// ─────────────────────────────────────────────────────────────────────────────

interface DietChatbotProps {
    /** StorageSync 완료 시 버전 증가 → 새 기기에서 메시지 다시 로드 */
    syncVersion?: number;
}

export default function DietChatbot({ syncVersion = 0 }: DietChatbotProps) {
    const [tick, setTick] = useState(0);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [micAvailable, setMicAvailable] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

    // Force re-render when module state changes
    useEffect(() => {
        _init();
        setTick(n => n + 1);
        return _subscribe(() => setTick(n => n + 1));
    }, []);

    // StorageSync 완료 후: localStorage(=서버와 병합된 결과)로 모듈 상태 갱신
    useEffect(() => {
        if (syncVersion > 0 && !_isStreaming) {
            try {
                const synced = getChatMessages();
                // 스마트 병합: ID 기준으로 합치기 (syncFromServer가 이미 병합해놓은 결과)
                if (synced.length !== _messages.length) {
                    _messages = synced;
                    _notify();
                }
            } catch {
                // 안전 무시
            }
        }
    }, [syncVersion]);

    useEffect(() => {
        const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
        setMicAvailable(!!SR);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [tick]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const gatherHealthData = useCallback(() => ({
        records: getRecords(),
        foodLogs: getFoodLogs(),
        workoutLogs: getWorkoutLogs(),
    }), []);

    const handleSend = async (textOverride?: string) => {
        const text = (textOverride ?? input).trim();
        if (!text || _isStreaming) return;

        // Snapshot history before adding new messages
        const historyForAPI = _messages.map(m => ({ role: m.role, content: m.content }));

        const userMsg: ChatMessage = {
            id: `chat-${Date.now()}-user`,
            role: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        saveChatMessage(userMsg);

        const assistantMsgId = `chat-${Date.now() + 1}-assistant`;
        const assistantPlaceholder: ChatMessage = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            createdAt: new Date().toISOString(),
        };

        _messages = [..._messages, userMsg, assistantPlaceholder];
        _isStreaming = true;
        _abortController = new AbortController();
        _notify();

        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        try {
            const healthData = gatherHealthData();

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: historyForAPI, healthData }),
                signal: _abortController.signal,
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || '응답 생성에 실패했습니다.');
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
                _messages = _messages.map(m =>
                    m.id === assistantMsgId ? { ...m, content: fullText } : m
                );
                _notify();
            }

            // Commit the completed message to storage
            const finalMsg = { ..._messages.find(m => m.id === assistantMsgId)! };
            saveChatMessage(finalMsg);

        } catch (error) {
            if ((error as { name?: string })?.name === 'AbortError') {
                // User stopped — save partial text if any
                const partial = _messages.find(m => m.id === assistantMsgId);
                if (partial?.content) {
                    const stoppedMsg = { ...partial, content: partial.content + '\n\n*(중단됨)*' };
                    saveChatMessage(stoppedMsg);
                    _messages = _messages.map(m => m.id === assistantMsgId ? stoppedMsg : m);
                } else {
                    _messages = _messages.filter(m => m.id !== assistantMsgId);
                }
            } else {
                const errContent = `⚠️ ${error instanceof Error ? error.message : '오류가 발생했습니다. 다시 시도해주세요.'}`;
                const errMsg: ChatMessage = {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: errContent,
                    createdAt: new Date().toISOString(),
                };
                saveChatMessage(errMsg);
                _messages = _messages.map(m => m.id === assistantMsgId ? errMsg : m);
            }
        } finally {
            _isStreaming = false;
            _abortController = null;
            _notify();
        }
    };

    const handleStop = () => {
        _abortController?.abort();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleMic = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return;

        const recognition = new SR();
        recognition.lang = 'ko-KR';
        recognition.continuous = false;
        recognition.interimResults = true;

        recognition.onresult = (e: SpeechRecognitionEvent) => {
            let transcript = '';
            for (let i = 0; i < e.results.length; i++) {
                transcript += e.results[i][0].transcript;
            }
            setInput(transcript);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
            }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const handleClear = () => {
        if (_messages.length === 0) return;
        if (confirm('대화 기록을 모두 삭제하시겠습니까?')) {
            clearChatMessages();
            _messages = [];
            _notify();
        }
    };

    const formatContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('### ')) {
                return <h4 key={i} style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{line.slice(4)}</h4>;
            }
            if (line.startsWith('## ')) {
                return <h3 key={i} style={{ margin: '14px 0 6px', fontSize: '15px', fontWeight: 700, color: 'var(--accent-blue)' }}>{line.slice(3)}</h3>;
            }
            const parts = line.split(/(\*\*.*?\*\*)/g);
            const rendered = parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });
            if (line.startsWith('* ') || line.startsWith('- ')) {
                const text = line.slice(2);
                const textParts = text.split(/(\*\*.*?\*\*)/g).map((p, j) =>
                    p.startsWith('**') && p.endsWith('**')
                        ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
                        : p
                );
                return <div key={i} style={{ paddingLeft: '12px', margin: '2px 0', lineHeight: 1.6 }}>• {textParts}</div>;
            }
            if (line.match(/^\d+\.\s/)) {
                return <div key={i} style={{ paddingLeft: '8px', margin: '2px 0', lineHeight: 1.6 }}>{rendered}</div>;
            }
            if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
            return <div key={i} style={{ margin: '2px 0', lineHeight: 1.6 }}>{rendered}</div>;
        });
    };

    const messages = _messages;
    const isStreaming = _isStreaming;

    return (
        <div className="chat-container">
            {/* Header */}
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="chat-avatar-coach">
                        <Bot size={20} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>다이어트 코치 AI</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>체성분 · 식단 · 운동 데이터 기반 맞춤 코칭</div>
                    </div>
                </div>
                {messages.length > 0 && !isStreaming && (
                    <button className="chat-clear-btn" onClick={handleClear} title="대화 기록 삭제">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">💪</div>
                        <h3>다이어트 코치에게 물어보세요!</h3>
                        <p>체성분, 식단, 운동 데이터를 모두 분석하여 맞춤 답변을 드립니다.</p>
                        <div className="chat-suggestions">
                            {[
                                '오늘 저녁 뭐 먹으면 좋을까?',
                                '최근 체성분 변화 분석해줘',
                                '체지방 빼려면 어떻게 해야 해?',
                                '오늘 운동 루틴 추천해줘',
                            ].map((q, i) => (
                                <button
                                    key={i}
                                    className="chat-suggestion-btn"
                                    onClick={() => {
                                        setInput(q);
                                        textareaRef.current?.focus();
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.role}`}>
                        <div className={`chat-message-avatar ${msg.role}`}>
                            {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                        </div>
                        <div className={`chat-message-bubble ${msg.role}`}>
                            {msg.role === 'assistant' ? (
                                <div className="chat-message-content">
                                    {msg.content
                                        ? formatContent(msg.content)
                                        : (
                                            <div className="chat-typing">
                                                <Loader2 size={16} className="chat-spinner" />
                                                <span>코치가 답변을 작성하고 있습니다...</span>
                                            </div>
                                        )
                                    }
                                </div>
                            ) : (
                                <div className="chat-message-content" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            )}
                            <div className="chat-message-time">
                                {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
                {isListening && (
                    <div className="chat-listening-banner">
                        <span className="chat-listening-dot" />
                        듣고 있습니다... 말씀하세요
                    </div>
                )}
                <div className="chat-input-wrapper">
                    {micAvailable && !isStreaming && (
                        <button
                            className={`chat-mic-btn ${isListening ? 'listening' : ''}`}
                            onClick={toggleMic}
                            title={isListening ? '마이크 중지' : '음성 입력'}
                            type="button"
                        >
                            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                        </button>
                    )}
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder={isListening ? '음성을 듣고 있습니다...' : isStreaming ? '답변을 생성 중입니다...' : '코치에게 질문하세요... (Shift+Enter로 줄바꿈)'}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isStreaming || isListening}
                    />
                    {isStreaming ? (
                        <button
                            className="chat-send-btn active"
                            onClick={handleStop}
                            title="답변 중지"
                            type="button"
                            style={{ background: 'var(--danger, #ef4444)' }}
                        >
                            <StopCircle size={18} />
                        </button>
                    ) : (
                        <button
                            className={`chat-send-btn ${input.trim() ? 'active' : ''}`}
                            onClick={() => handleSend()}
                            disabled={!input.trim()}
                            type="button"
                        >
                            <Send size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
