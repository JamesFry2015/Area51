import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient, { streamChatCompletion } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import MessageInput from '../components/MessageInput.jsx';
import SettingsPanel from '../components/settingspanel.jsx';
import './ChatPage.css';

const ChatPage = () => {
  const { chatId } = useParams();
  const { logout } = useAuth();

  const [chat, setChat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Load settings from localStorage with defaults ---
  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('advancedSettings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: '', baseUrl: '', requestBody: null };
  });

  const [generationSettings, setGenerationSettings] = useState(() => {
    const saved = localStorage.getItem('generationSettings');
    const defaults = {
      temperature: 1.0, max_tokens: 10000, context_window: 2000000,
      top_k: 0, top_p: 1.0, repetition_penalty: 1.0, frequency_penalty: 0.0,
      response_prefill_enabled: false, response_prefill: '',
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // --- Save settings to localStorage on change ---
  useEffect(() => {
    localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));
  }, [advancedSettings]);

  useEffect(() => {
    localStorage.setItem('generationSettings', JSON.stringify(generationSettings));
  }, [generationSettings]);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const abortControllerRef = useRef(null);

  // Dynamic Page Title
  useEffect(() => {
    if (chat?.name) {
        document.title = chat.name;
    } else {
        document.title = "Vite + React";
    }
  }, [chat?.name]);

  useEffect(() => {
    const fetchChat = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.get(`/chats/${chatId}`);
        setChat(response.data);
      } catch (err) {
        setError('Failed to load chat.');
        if (err.response?.status === 401) logout();
      } finally {
        setIsLoading(false);
      }
    };
    fetchChat();
  }, [chatId, logout]);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.history]);

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsSending(false);
    }
  };

  const executeSendMessage = async (messageContent) => {
    if (!messageContent) return;

    // Clear previous error
    setError('');

    if (!advancedSettings.model || !advancedSettings.baseUrl) {
      const errorBubble = {
        role: 'assistant',
        content: 'Error: Please configure a model and base URL in the settings panel before sending a message.',
        type: 'error',
      };
      setChat(prevChat => ({ ...prevChat, history: [...prevChat.history, errorBubble] }));
      return;
    }

    const tempMessage = { role: 'user', content: messageContent };

    // Optimistic update: Add user message and a placeholder for assistant
    setChat(prevChat => ({
        ...prevChat,
        history: [
            ...prevChat.history,
            tempMessage,
            { role: 'assistant', content: generationSettings.response_prefill_enabled ? generationSettings.response_prefill : '' }
        ]
    }));

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    try {
      const requestBody = {
        message: messageContent,
        model: advancedSettings.model,
        base_url: advancedSettings.baseUrl,
        api_key: advancedSettings.apiKey || null,
        ...generationSettings,
        response_prefill: generationSettings.response_prefill_enabled
          ? generationSettings.response_prefill
          : null,
        request_body: advancedSettings.requestBody ? JSON.parse(advancedSettings.requestBody) : null
      };

      await streamChatCompletion(chatId, requestBody, (chunk) => {
          setChat(prevChat => {
              const newHistory = [...prevChat.history];
              const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg.role === 'assistant') {
                  lastMsg.content += chunk;
              }
              return { ...prevChat, history: newHistory };
          });
      }, abortControllerRef.current.signal);

    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("Request aborted.");
            return;
        }
      const errorMessage = err.message || 'An unknown error occurred.';
      const errorBubble = {
        role: 'assistant',
        content: `\n[Error: ${errorMessage}]`,
        type: 'error'
      };
      // Append error to the current stream
      setChat(prevChat => {
          const newHistory = [...prevChat.history];
           const lastMsg = newHistory[newHistory.length - 1];
              if (lastMsg.role === 'assistant') {
                  lastMsg.content += errorBubble.content;
              }
          return { ...prevChat, history: newHistory };
      });
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (messageContent) => {
      executeSendMessage(messageContent);
  };

  const handleRegenerate = async () => {
      if (!chat || chat.history.length === 0) return;

      const lastMsg = chat.history[chat.history.length - 1];
      if (lastMsg.role !== 'assistant') return; // Can only regenerate if last was assistant

      // Find the last user message
      const lastUserMsgIndex = chat.history.length - 2;
      if (lastUserMsgIndex < 0) return;
      const lastUserMsg = chat.history[lastUserMsgIndex];

      // Truncate history via PATCH
      // We want to remove the last assistant message.
      const newHistory = chat.history.slice(0, -1);

      try {
          await apiClient.patch(`/chats/${chatId}`, { history: newHistory });
          // Update local state to remove the assistant msg
          setChat(prev => ({ ...prev, history: newHistory }));
          // Re-send the user message (we don't re-add it to history because executeSendMessage expects it not to be there?
          // Wait, executeSendMessage adds the user message.
          // So we need to remove the user message too if we use executeSendMessage.

          // Actually, executeSendMessage adds the user message to the UI state and then sends it.
          // The backend adds it to DB.

          // So for regenerate:
          // 1. Delete last assistant msg AND last user msg from DB.
          // 2. Call executeSendMessage(lastUserMsg.content).

          const historyWithoutLastPair = chat.history.slice(0, -2);
          await apiClient.patch(`/chats/${chatId}`, { history: historyWithoutLastPair });
          setChat(prev => ({ ...prev, history: historyWithoutLastPair }));

          executeSendMessage(lastUserMsg.content);

      } catch (e) {
          console.error("Failed to regenerate", e);
          alert("Failed to regenerate");
      }
  };

  const handleEditMessage = async (index, newContent) => {
      // 1. Truncate history to index (exclude index)
      const newHistory = chat.history.slice(0, index);

      try {
           await apiClient.patch(`/chats/${chatId}`, { history: newHistory });
           setChat(prev => ({ ...prev, history: newHistory }));
           executeSendMessage(newContent);
      } catch (e) {
          console.error("Failed to edit message", e);
          alert("Failed to edit message");
      }
  };

  const handleDeleteMessage = async (index) => {
      if (!confirm("Are you sure you want to delete this message?")) return;
      try {
          await apiClient.delete(`/chats/${chatId}/messages/${index}`);
          // Optimistically remove from UI
          setChat(prev => {
              const newHistory = [...prev.history];
              newHistory.splice(index, 1);
              return { ...prev, history: newHistory };
          });
      } catch (e) {
          console.error("Failed to delete message", e);
          alert("Failed to delete message");
      }
  };

  const handleChatDataChange = async (updatedData) => {
    try {
      const response = await apiClient.patch(`/chats/${chatId}`, updatedData);
      setChat(response.data);
    } catch (err) {
      console.error("Failed to update chat data:", err);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
              setIsSettingsOpen(false);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) return <div>Loading chat...</div>;
  if (error) return <div>{error}</div>;

  const isSendDisabled = isSending || !advancedSettings.model || !advancedSettings.baseUrl;

  return (
    <div className="chat-page-container">
      <header className="chat-header">
        <Link to={`/main-card/${chat?.main_card_id}`} className="back-link">← Back to Persona</Link>
        <h1>{chat?.name || 'Chat'}</h1>
        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </header>
      
      <div className="chat-history-wrapper">
        <div className="chat-history">
          {chat?.history.map((msg, index) => (
            <div key={index} className="message-wrapper">
                <MessageBubble message={msg} />
                <div className="message-actions">
                    {msg.role === 'user' && (
                        <button className="msg-action-btn" onClick={() => {
                            const newContent = prompt("Edit your message:", msg.content);
                            if (newContent !== null && newContent !== msg.content) {
                                handleEditMessage(index, newContent);
                            }
                        }}>Edit</button>
                    )}
                    <button className="msg-action-btn" onClick={() => handleDeleteMessage(index)}>Del</button>
                    {index === chat.history.length - 1 && msg.role === 'assistant' && !isSending && (
                         <button className="msg-action-btn" onClick={handleRegenerate}>Regenerate</button>
                    )}
                </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <MessageInput
        onSendMessage={handleSendMessage}
        onStop={handleStop}
        isLoading={isSending}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={advancedSettings}
        onSettingChange={setAdvancedSettings}
        generationSettings={generationSettings}
        onGenerationSettingsChange={setGenerationSettings}
        chatData={chat}
        onChatDataChange={handleChatDataChange}
      />
    </div>
  );
};

export default ChatPage;
