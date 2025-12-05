import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient, { streamChatCompletion } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import MessageInput from '../components/MessageInput.jsx';
import SettingsPanel from '../components/settingspanel.jsx';
import ImageModal from '../components/ImageModal.jsx';
import './ChatPage.css';

const ChatPage = () => {
  const { chatId } = useParams();
  const { logout } = useAuth();

  const [chat, setChat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [previewImage, setPreviewImage] = useState(null);

  // Settings
  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('advancedSettings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: '', baseUrl: '', requestBody: null };
  });

  const [generationSettings, setGenerationSettings] = useState(() => {
    const saved = localStorage.getItem('generationSettings');
    const defaults = {
      stream: true, // Default to true
      temperature: 1.0, max_tokens: 10000, context_window: 2000000,
      top_k: 0, top_p: 1.0, repetition_penalty: 1.0, frequency_penalty: 0.0,
      response_prefill_enabled: false, response_prefill: '',
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  useEffect(() => {
    localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));
  }, [advancedSettings]);

  useEffect(() => {
    localStorage.setItem('generationSettings', JSON.stringify(generationSettings));
  }, [generationSettings]);

  // Calculate Total Tokens
  const totalTokens = useMemo(() => {
    if (!chat?.history) return 0;
    return chat.history.reduce((acc, msg) => {
        const versions = msg.versions || [msg.content];
        const currentContent = versions[msg.current_version || 0] || '';
        return acc + Math.ceil(currentContent.length / 4);
    }, 0);
  }, [chat?.history]);

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

  const executeSendMessage = async (messageContent, image = null, isRegenerate = false) => {
    if (!messageContent && !image && !isRegenerate) return;
    setError('');

    if (!advancedSettings.model || !advancedSettings.baseUrl) {
      alert("Please configure a model and base URL in the settings panel.");
      return;
    }

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    const lastMsg = chat.history.length > 0 ? chat.history[chat.history.length - 1] : null;
    const apiRegenerate = isRegenerate && lastMsg?.role === 'assistant';

    // 1. Optimistic Update
    setChat(prevChat => {
        const newHistory = [...prevChat.history];
        
        if (isRegenerate) {
            const lastHistoryMsg = newHistory[newHistory.length - 1];
            
            if (lastHistoryMsg.role === 'user') {
                newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
            } else {
                const updatedMsg = { ...lastHistoryMsg };
                if (!updatedMsg.versions) updatedMsg.versions = [updatedMsg.content];
                
                // FIX: Create NEW version slot so MessageBubble sees empty content immediately
                const newVersionIndex = updatedMsg.versions.length;
                updatedMsg.versions = [...updatedMsg.versions, '']; 
                updatedMsg.current_version = newVersionIndex;
                updatedMsg.content = ''; 
                
                newHistory[newHistory.length - 1] = updatedMsg;
            }
        } else {
            newHistory.push({ 
                role: 'user', 
                content: messageContent, 
                versions: [messageContent], 
                current_version: 0,
                images: image ? [image] : [] 
            });
            newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
        }
        return { ...prevChat, history: newHistory };
    });

    try {
      const shouldStream = generationSettings.stream !== false;
      const requestBody = {
        message: !isRegenerate ? messageContent : null,
        images: image ? [image] : [],
        model: advancedSettings.model,
        base_url: advancedSettings.baseUrl,
        api_key: advancedSettings.apiKey || null,
        ...generationSettings,
        stream: shouldStream,
        response_prefill: generationSettings.response_prefill_enabled ? generationSettings.response_prefill : null,
        request_body: advancedSettings.requestBody ? JSON.parse(advancedSettings.requestBody) : null,
        regenerate: apiRegenerate
      };

      if (shouldStream) {
          await streamChatCompletion(chatId, requestBody, (chunk) => {
              setChat(prevChat => {
                  const newHistory = [...prevChat.history];
                  const lastIndex = newHistory.length - 1;
                  const lastMsg = { ...newHistory[lastIndex] }; 

                  if (!lastMsg.versions) {
                      lastMsg.versions = [''];
                      lastMsg.current_version = 0;
                  }

                  // Update the specific version slot we created
                  const currentVer = lastMsg.current_version || 0;
                  const currentContent = lastMsg.versions[currentVer] || '';
                  
                  lastMsg.versions[currentVer] = currentContent + chunk;
                  lastMsg.content = lastMsg.versions[currentVer];
                  
                  newHistory[lastIndex] = lastMsg;
                  return { ...prevChat, history: newHistory };
              });
          }, abortControllerRef.current.signal);
      } else {
          // Non-streaming: Wait for full response
          const response = await apiClient.post(`/chats/${chatId}/messages`, requestBody);
          // Backend returns the fully updated chat object
          setChat(response.data);
      }

      // Sync final state (important for DB IDs, etc.)
      // For non-stream, we just did it. For stream, we do it now.
      if (shouldStream) {
          const freshChat = await apiClient.get(`/chats/${chatId}`);
          setChat(freshChat.data);
      }

    } catch (err) {
        if (err.name === 'AbortError') return;
        const errorMessage = err.message || 'Error';
        setChat(prev => {
            const hist = [...prev.history];
            const last = { ...hist[hist.length-1] };
            
            // Append error to current version
            const currentVer = last.current_version || 0;
            const currentContent = last.versions?.[currentVer] || '';
            
            if (last.versions) {
                last.versions[currentVer] = currentContent + `\n[${errorMessage}]`;
            } else {
                last.content += `\n[${errorMessage}]`;
            }
            
            hist[hist.length-1] = last;
            return { ...prev, history: hist };
        });
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (content, image) => executeSendMessage(content, image, false);
  const handleRegenerate = () => executeSendMessage(null, null, true);

  const handleEditMessage = async (index, newContent) => {
      const chatCopy = { ...chat };
      const truncatedHistory = chatCopy.history.slice(0, index + 1); 
      
      const messageRole = truncatedHistory[index].role;

      truncatedHistory[index] = { 
          ...truncatedHistory[index], 
          content: newContent,
          versions: [...(truncatedHistory[index].versions || []), newContent],
          current_version: (truncatedHistory[index].versions?.length || 0)
      };

      try {
          await apiClient.patch(`/chats/${chatId}`, { history: truncatedHistory });
          setChat({ ...chat, history: truncatedHistory });
          
          if (messageRole === 'user') {
              executeSendMessage(null, null, true); 
          }
      } catch (e) {
          alert("Failed to update chat.");
      }
  };

  const handleVersionChange = async (index, newVersionIndex) => {
      const newHistory = [...chat.history];
      const msg = { ...newHistory[index] };
      msg.current_version = newVersionIndex;
      msg.content = msg.versions[newVersionIndex];
      newHistory[index] = msg;
      
      setChat({ ...chat, history: newHistory });
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

  useEffect(() => {
      const handleKeyDown = (e) => {
          if (e.key === 'Escape') {
              setIsSettingsOpen(false);
              setPreviewImage(null);
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
        <div style={{textAlign: 'center'}}>
            <h1>{chat?.name || 'Chat'}</h1>
            <span style={{fontSize: '0.8rem', color: '#888'}}>Total Context: {totalTokens} tokens</span>
        </div>
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
              onImageClick={setPreviewImage}
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

      <ImageModal 
        src={previewImage} 
        onClose={() => setPreviewImage(null)} 
      />
    </div>
  );
};

export default ChatPage;