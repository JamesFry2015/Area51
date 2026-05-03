import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api.js';

export const useChat = (chatId, { advancedSettings, attachmentSettings, generationSettings, logout }) => {
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
    if (chatId) fetchChat();
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
  const sendMessage = async (messageContent, attachment = null, isRegenerate = false) => {
    if (!messageContent && !attachment && !isRegenerate) return;
    setError('');

    const activeSettings = (attachment && attachmentSettings) ? attachmentSettings : advancedSettings;

    if (!activeSettings.model || !activeSettings.baseUrl) {
      alert("Please configure a model and base URL in the settings panel.");
      return;
    }

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    // -- Optimistic Update Logic --
    setChat(prevChat => {
        if (!prevChat) return null;
        
        const newHistory = [...prevChat.history]; 
        
        if (isRegenerate) {
            if (newHistory.length > 0) {
                const lastMsgIndex = newHistory.length - 1;
                const lastMsg = newHistory[lastMsgIndex];
                
                if (lastMsg.role === 'user') {
                    newHistory.push({ 
                        role: 'assistant', 
                        content: '', 
                        versions: [''], 
                        current_version: 0 
                    });
                } else {
                    const updatedMsg = { ...lastMsg };
                    const newVersions = [...(updatedMsg.versions || [updatedMsg.content]), ''];
                    updatedMsg.versions = newVersions;
                    updatedMsg.current_version = newVersions.length - 1;
                    updatedMsg.content = ''; 
                    newHistory[lastMsgIndex] = updatedMsg;
                }
            }
        } else {
            newHistory.push({ 
                role: 'user', 
                content: messageContent, 
                versions: [messageContent], 
                current_version: 0, 
                images: attachment ? [attachment] : [] 
            });
            newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
        }
        return { ...prevChat, history: newHistory };
    });

    try {
      const shouldStream = generationSettings.stream !== false;
      
      const requestBody = {
        message: !isRegenerate ? messageContent : null,
        images: attachment ? [attachment] : [],
        model: activeSettings.model,
        base_url: activeSettings.baseUrl,
        api_key: activeSettings.apiKey || null,
        ...generationSettings,
        stream: shouldStream,
        response_prefill: generationSettings.response_prefill_enabled ? generationSettings.response_prefill : null,
        request_body: activeSettings.requestBody ? JSON.parse(activeSettings.requestBody) : null,
        regenerate: isRegenerate
      };

      if (shouldStream) {
        await apiClient.streamChatCompletion(chatId, requestBody, (chunk) => {
          setChat(prev => {
            if (!prev) return null;
            const hist = [...prev.history];
            const lastIdx = hist.length - 1;
            const last = { ...hist[lastIdx] };
            
            const verIdx = last.current_version || 0;
            const versions = [...(last.versions || [''])];
            
            versions[verIdx] = (versions[verIdx] || '') + chunk;
            
            last.versions = versions;
            last.content = versions[verIdx];
            hist[lastIdx] = last;
            
            return { ...prev, history: hist };
          });
        }, abortControllerRef.current.signal);
      } else {
        const response = await apiClient.post(`/chats/${chatId}/messages`, requestBody);
        setChat(response.data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Message send failed:", err);
      setError('Failed to send message. Please checks your API settings.');
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (content, attachment) => sendMessage(content, attachment, false);
  const handleRegenerate = () => sendMessage(null, null, true);

  // 4. FIX: Robust Edit Message Function
  const editMessage = async (index, newContent) => {
    // Snapshot for rollback
    const previousChat = JSON.parse(JSON.stringify(chat)); 

    try {
        let updatedMessageForApi = null;

        setChat(prevChat => {
            if (!prevChat) return null;
            const history = [...prevChat.history];
            const msg = { ...history[index] }; // Shallow copy

            // 1. Handle Versions Logic safely
            // Initialize versions array if it doesn't exist (common for legacy or image-only messages)
            let versions = Array.isArray(msg.versions) ? [...msg.versions] : [];

            // If versions was empty/missing, attempt to use the old content or start fresh
            if (versions.length === 0) {
                 if (msg.content) {
                     versions = [msg.content];
                 } else {
                     // If no content existed (e.g. image only), start with an empty string placeholder
                     versions = ['']; 
                 }
            }

            const currentVer = msg.current_version || 0;
            const targetVer = (currentVer >= 0 && currentVer < versions.length) ? currentVer : 0;
            
            // Update the specific version with new content
            versions[targetVer] = newContent;
            
            // 2. Update Message Object
            msg.content = newContent;
            msg.versions = versions;
            msg.current_version = targetVer;

            // Capture for API call
            updatedMessageForApi = msg;

            history[index] = msg;
            return { ...prevChat, history };
        });

        // 3. API Call with FULL payload
        // We send the entire relevant state so the backend doesn't lose data (like images)
        if (updatedMessageForApi) {
            await apiClient.put(`/chats/${chatId}/messages/${index}`, { 
                content: newContent,
                versions: updatedMessageForApi.versions,
                current_version: updatedMessageForApi.current_version,
                images: updatedMessageForApi.images || [], // Preserve images
                role: updatedMessageForApi.role
            });
        }
        
    } catch(e) { 
        console.error("Edit failed", e); 
        // FIX: Use alert instead of setError to prevent the whole page from being replaced by the error screen
        alert(`Failed to save edit: ${e.response?.data?.detail || e.message}`);
        setChat(previousChat); // Rollback to previous state
    }
  };
  
  const deleteMessage = async (index) => {
    try {
        setChat(prev => {
            if (!prev) return null;
            const history = prev.history.filter((_, i) => i !== index);
            return { ...prev, history };
        });
        await apiClient.delete(`/chats/${chatId}/messages/${index}`);
    } catch(e) { 
        console.error(e); 
        alert('Failed to delete message'); 
        // Re-fetch chat to restore state logic could go here
    }
  };

  const switchVersion = async (index, verIdx) => {
    setChat(prev => {
        if (!prev) return null;
        const hist = [...prev.history];
        const msg = { ...hist[index] };
        
        const versions = msg.versions || [msg.content];
        if (versions[verIdx] !== undefined) {
            msg.current_version = verIdx;
            msg.content = versions[verIdx];
            hist[index] = msg;
        }
        return { ...prev, history: hist };
    });
    // Optional: Persist version choice to backend if your API supports it
  };
  
  const updateChatData = async (data) => {
      try {
          await apiClient.patch(`/chats/${chatId}`, data);
          setChat(prev => ({ ...prev, ...data }));
      } catch(e) { console.error(e); setError("Failed to update chat data"); }
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