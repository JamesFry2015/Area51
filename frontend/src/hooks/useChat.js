import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient, { streamChatCompletion } from '../api.js';

export const useChat = (chatId, { advancedSettings, generationSettings, logout }) => {
  const [chat, setChat] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const abortControllerRef = useRef(null);

  // 1. Fetch Chat on mount or chatId change
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

  // 2. Stop Generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }, []);

  // 3. The Big Send Function
  const sendMessage = async (messageContent, image = null, isRegenerate = false) => {
    if (!messageContent && !image && !isRegenerate) return;
    setError('');

    if (!advancedSettings.model || !advancedSettings.baseUrl) {
      alert("Please configure a model and base URL in the settings panel.");
      return;
    }

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    // -- Optimistic Update Logic --
    setChat(prevChat => {
        const newHistory = [...prevChat.history];
        if (isRegenerate) {
            const lastMsg = newHistory[newHistory.length - 1];
            if (lastMsg.role === 'user') {
                 // Regenerating after a user edit/delete
                newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
            } else {
                // Standard Regenerate
                const updatedMsg = { ...lastMsg };
                updatedMsg.versions = [...(updatedMsg.versions || [updatedMsg.content]), ''];
                updatedMsg.current_version = updatedMsg.versions.length - 1;
                updatedMsg.content = '';
                newHistory[newHistory.length - 1] = updatedMsg;
            }
        } else {
            // New User Message
            newHistory.push({ 
                role: 'user', content: messageContent, 
                versions: [messageContent], current_version: 0, images: image ? [image] : [] 
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
        regenerate: isRegenerate // logic adjusted for clarity
      };

      if (shouldStream) {
        await streamChatCompletion(chatId, requestBody, (chunk) => {
          setChat(prev => {
            const hist = [...prev.history];
            const last = { ...hist[hist.length - 1] };
            const verIdx = last.current_version || 0;
            const versions = [...(last.versions || [''])];
            versions[verIdx] = (versions[verIdx] || '') + chunk;
            last.versions = versions;
            last.content = versions[verIdx];
            hist[hist.length - 1] = last;
            return { ...prev, history: hist };
          });
        }, abortControllerRef.current.signal);
      } else {
        const response = await apiClient.post(`/chats/${chatId}/messages`, requestBody);
        setChat(response.data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Error handling logic...
      console.error(err);
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  // Helper wrappers
  const handleSendMessage = (content, img) => sendMessage(content, img, false);
  const handleRegenerate = () => sendMessage(null, null, true);

  // 4. Other CRUD Operations
  const editMessage = async (index, newContent) => {
    // ... Copy logic from original handleEditMessage ...
    // Remember to call handleRegenerate() if needed inside here
  };
  
  const deleteMessage = async (index) => {
     // ... Copy logic from original handleDeleteMessage ...
  };

  const switchVersion = async (index, verIdx) => {
     // ... Copy logic from original handleVersionChange ...
  };
  
  const updateChatData = async (data) => {
     // ... Copy logic from handleChatDataChange ...
  };

  return {
    chat,
    isLoading,
    isSending,
    error,
    actions: {
      sendMessage: handleSendMessage,
      regenerate: handleRegenerate,
      stop: stopGeneration,
      editMessage,
      deleteMessage,
      switchVersion,
      updateChatData
    }
  };
};