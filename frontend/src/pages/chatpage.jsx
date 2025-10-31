import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../api.js';
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
    return saved ? JSON.parse(saved) : { apiKey: '', model: '', baseUrl: '' };
  });

  const [generationSettings, setGenerationSettings] = useState(() => {
    const saved = localStorage.getItem('generationSettings');
    const defaults = {
      temperature: 1.0, max_tokens: 10000, context_window: 2000000,
      top_k: 0, top_p: 1.0, repetition_penalty: 1.0, frequency_penalty: 0.0,
      response_prefill_enabled: false, response_prefill: '', reasoning: false,
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

  const handleSendMessage = async (messageContent) => {
    if (!messageContent) return;

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
    setChat(prevChat => ({ ...prevChat, history: [...prevChat.history, tempMessage] }));
    setIsSending(true);
    setError('');

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
      };

      const response = await apiClient.post(`/chats/${chatId}/messages`, requestBody);
      setChat(response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'An unknown error occurred.';
      const errorBubble = {
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        type: 'error'
      };
      setChat(prevChat => ({ ...prevChat, history: [...prevChat.history, errorBubble] }));
    } finally {
      setIsSending(false);
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
            <MessageBubble key={index} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <MessageInput onSendMessage={handleSendMessage} isLoading={isSendDisabled} />

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