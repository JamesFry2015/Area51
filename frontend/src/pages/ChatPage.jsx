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

  // Settings
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

  // Auto-scroll
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (chat?.name) document.title = chat.name;
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
    if (chat?.history && !isSending) {
        scrollToBottom();
    }
  }, [chat?.history, isSending]);

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsSending(false);
    }
  };

  const executeSendMessage = async (messageContent, isRegenerate = false) => {
    if (!messageContent && !isRegenerate) return;
    setError('');

    if (!advancedSettings.model || !advancedSettings.baseUrl) {
      alert("Please configure a model and base URL in the settings panel.");
      return;
    }

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    // Determine the API behavior based on CURRENT history state
    const lastMsg = chat.history.length > 0 ? chat.history[chat.history.length - 1] : null;
    // We only use the 'regenerate' API flag if we are truly regenerating an ASSISTANT message.
    // If the last message is USER, we want the API to perform a standard completion (appending a new assistant msg).
    const apiRegenerate = isRegenerate && lastMsg?.role === 'assistant';

    // 1. Optimistic Update
    setChat(prevChat => {
        const newHistory = [...prevChat.history];
        
        if (isRegenerate) {
            const lastHistoryMsg = newHistory[newHistory.length - 1];
            
            if (lastHistoryMsg.role === 'user') {
                // Case: User edited their message (or we deleted the assistant response)
                // We need to APPEND a new assistant placeholder
                newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
            } else {
                // Case: Regenerating an existing assistant response
                // Add new version slot
                const updatedMsg = { ...lastHistoryMsg };
                if (!updatedMsg.versions) updatedMsg.versions = [updatedMsg.content];
                
                // Visual placeholder for new content
                updatedMsg.content = ''; 
                newHistory[newHistory.length - 1] = updatedMsg;
            }
        } else {
            // Normal new message case
            newHistory.push({ role: 'user', content: messageContent, versions: [messageContent], current_version: 0 });
            // Add placeholder for Assistant
            newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
        }
        return { ...prevChat, history: newHistory };
    });

    try {
      const requestBody = {
        // If regenerating, we send null message (context comes from history). 
        // If new message, we send content.
        message: !isRegenerate ? messageContent : null,
        model: advancedSettings.model,
        base_url: advancedSettings.baseUrl,
        api_key: advancedSettings.apiKey || null,
        ...generationSettings,
        response_prefill: generationSettings.response_prefill_enabled ? generationSettings.response_prefill : null,
        request_body: advancedSettings.requestBody ? JSON.parse(advancedSettings.requestBody) : null,
        regenerate: apiRegenerate
      };

      await streamChatCompletion(chatId, requestBody, (chunk) => {
          setChat(prevChat => {
              const newHistory = [...prevChat.history];
              const lastIndex = newHistory.length - 1;
              const lastMsg = { ...newHistory[lastIndex] }; 

              // Ensure versions structure exists
              if (!lastMsg.versions) {
                  lastMsg.versions = [''];
                  lastMsg.current_version = 0;
              }

              if (apiRegenerate) {
                  // We are adding to a NEW version.
                  // Since we are streaming, we just update the 'content' display buffer.
                  // The backend will persist this as a new version entry when done.
                  lastMsg.content += chunk;
              } else {
                  // Standard append or "continue" after user edit
                  lastMsg.content += chunk;
              }
              
              newHistory[lastIndex] = lastMsg;
              return { ...prevChat, history: newHistory };
          });
      }, abortControllerRef.current.signal);

      // Refresh chat to sync versions from DB after generation
      const freshChat = await apiClient.get(`/chats/${chatId}`);
      setChat(freshChat.data);

    } catch (err) {
        if (err.name === 'AbortError') return;
        const errorMessage = err.message || 'Error';
        setChat(prev => {
            const hist = [...prev.history];
            const last = { ...hist[hist.length-1] };
            last.content += `\n[${errorMessage}]`;
            hist[hist.length-1] = last;
            return { ...prev, history: hist };
        });
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (content) => executeSendMessage(content, false);
  const handleRegenerate = () => executeSendMessage(null, true);

  const handleEditMessage = async (index, newContent) => {
      // 1. Truncate future history (ChatGPT style: editing forks the chat)
      const chatCopy = { ...chat };
      // Keep everything up to the edited message
      const truncatedHistory = chatCopy.history.slice(0, index + 1); 
      
      const messageRole = truncatedHistory[index].role;

      // Update the content and add to versions
      truncatedHistory[index] = { 
          ...truncatedHistory[index], 
          content: newContent,
          versions: [...(truncatedHistory[index].versions || []), newContent],
          current_version: (truncatedHistory[index].versions?.length || 0)
      };

      // Update DB with truncated history
      try {
          await apiClient.patch(`/chats/${chatId}`, { history: truncatedHistory });
          
          // Force state update
          setChat({ ...chat, history: truncatedHistory });
          
          // If we edited a USER message, we want to regenerate the assistant's reply.
          // If we edited an ASSISTANT message, we just want to save the edit (no regen).
          if (messageRole === 'user') {
              // Trigger generation. "isRegenerate=true" allows the logic to handle "Last msg is User -> Append Assistant"
              executeSendMessage(null, true); 
          }
          // else: do nothing, we just saved the assistant's new text.

      } catch (e) {
          alert("Failed to update chat.");
      }
  };

  const handleVersionChange = async (index, newVersionIndex) => {
      // Update local state
      const newHistory = [...chat.history];
      const msg = { ...newHistory[index] };
      msg.current_version = newVersionIndex;
      msg.content = msg.versions[newVersionIndex];
      newHistory[index] = msg;
      
      setChat({ ...chat, history: newHistory });

      // Persist to DB so it remembers where you left off
      await apiClient.patch(`/chats/${chatId}`, { history: newHistory });
  };

  const handleDeleteMessage = async (index) => {
      if (!confirm("Delete this message?")) return;
      try {
          await apiClient.delete(`/chats/${chatId}/messages/${index}`);
          setChat(prev => {
              const h = [...prev.history];
              h.splice(index, 1);
              return { ...prev, history: h };
          });
      } catch (e) { alert("Failed to delete."); }
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

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="chat-page-container">
      <header className="chat-header">
        <Link to={`/main-card/${chat?.main_card_id}`} className="back-link">← Back</Link>
        <h1>{chat?.name || 'Chat'}</h1>
        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
      </header>
      
      <div className="chat-history-wrapper">
        <div className="chat-history">
          {chat?.history.map((msg, index) => (
            <MessageBubble 
              key={index} 
              index={index}
              message={msg} 
              isLast={index === chat.history.length - 1}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
              onRegenerate={handleRegenerate}
              onVersionChange={handleVersionChange}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <MessageInput onSendMessage={handleSendMessage} onStop={handleStop} isLoading={isSending} />
      
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