import { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api.js'; // Ensure this import matches your file structure
// Note: Assuming streamChatCompletion is exported from api.js or handled inline. 
// If it's separate, import it. Based on your file, it seems to be in api.js

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

    // LOGIC: Determine which settings to use
    // If there is an attachment AND attachment settings are configured, use them.
    // Otherwise, fallback to the standard advancedSettings.
    const activeSettings = (attachment && attachmentSettings) ? attachmentSettings : advancedSettings;

    if (!activeSettings.model || !activeSettings.baseUrl) {
      alert("Please configure a model and base URL in the settings panel.");
      return;
    }

    setIsSending(true);
    abortControllerRef.current = new AbortController();

    // -- Optimistic Update Logic --
    // We update the UI immediately before the server responds
    setChat(prevChat => {
        if (!prevChat) return null;
        
        // Deep copy history to avoid mutation
        const newHistory = [...prevChat.history]; 
        
        if (isRegenerate) {
            // Regeneration Logic
            if (newHistory.length > 0) {
                const lastMsgIndex = newHistory.length - 1;
                const lastMsg = newHistory[lastMsgIndex];
                
                // If the last message was the user, we need to add a placeholder assistant response
                if (lastMsg.role === 'user') {
                    newHistory.push({ 
                        role: 'assistant', 
                        content: '', 
                        versions: [''], 
                        current_version: 0 
                    });
                } else {
                    // If the last message was assistant, we create a new version for it
                    const updatedMsg = { ...lastMsg };
                    const newVersions = [...(updatedMsg.versions || [updatedMsg.content]), ''];
                    updatedMsg.versions = newVersions;
                    updatedMsg.current_version = newVersions.length - 1;
                    updatedMsg.content = ''; // Clear content for streaming
                    newHistory[lastMsgIndex] = updatedMsg;
                }
            }
        } else {
            // New Message Logic
            newHistory.push({ 
                role: 'user', 
                content: messageContent, 
                versions: [messageContent], 
                current_version: 0, 
                // Store attachment in history (assuming backend handles 'images' field for both images/docs or you map it)
                images: attachment ? [attachment] : [] 
            });
            // Placeholder for Assistant Response
            newHistory.push({ role: 'assistant', content: '', versions: [''], current_version: 0 });
        }
        return { ...prevChat, history: newHistory };
    });

    try {
      const shouldStream = generationSettings.stream !== false;
      
      // Construct payload using the ACTIVE settings (either Main or Attachment model)
      const requestBody = {
        message: !isRegenerate ? messageContent : null, // If regenerate, backend usually uses history
        images: attachment ? [attachment] : [],
        model: activeSettings.model,
        base_url: activeSettings.baseUrl,
        api_key: activeSettings.apiKey || null,
        // Spread generation parameters (temp, top_p, etc)
        ...generationSettings,
        stream: shouldStream,
        response_prefill: generationSettings.response_prefill_enabled ? generationSettings.response_prefill : null,
        // Parse custom request body if present in the active config
        request_body: activeSettings.requestBody ? JSON.parse(activeSettings.requestBody) : null,
        regenerate: isRegenerate
      };

      if (shouldStream) {
        // Assuming streamChatCompletion is a helper that handles the EventSource/Stream logic
        await apiClient.streamChatCompletion(chatId, requestBody, (chunk) => {
          setChat(prev => {
            if (!prev) return null;
            const hist = [...prev.history];
            const lastIdx = hist.length - 1;
            const last = { ...hist[lastIdx] };
            
            const verIdx = last.current_version || 0;
            const versions = [...(last.versions || [''])];
            
            // Append chunk
            versions[verIdx] = (versions[verIdx] || '') + chunk;
            
            last.versions = versions;
            last.content = versions[verIdx];
            hist[lastIdx] = last;
            
            return { ...prev, history: hist };
          });
        }, abortControllerRef.current.signal);
      } else {
        // Non-streaming request
        const response = await apiClient.post(`/chats/${chatId}/messages`, requestBody);
        setChat(response.data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error("Message send failed:", err);
      setError('Failed to send message. Please checks your API settings.');
      
      // Optional: Revert optimistic update on error could go here
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
    }
  };

  // Helper wrappers
  const handleSendMessage = (content, attachment) => sendMessage(content, attachment, false);
  const handleRegenerate = () => sendMessage(null, null, true);

  // 4. Other CRUD Operations (Placeholders as per your file)
  const editMessage = async (index, newContent) => {
    // Implementation depends on your backend API for editing
    // Usually involves PUT /chats/:id/messages/:index and then refreshing chat
    try {
        const history = [...chat.history];
        history[index].content = newContent;
        // Optimistic update
        setChat({...chat, history});
        // Call API
        await apiClient.put(`/chats/${chatId}/messages/${index}`, { content: newContent });
        // Often we regenerate after editing a user message
        if (history[index].role === 'user') {
            // Trigger regeneration from this point? 
            // This logic depends on your specific app flow.
        }
    } catch(e) { console.error(e); setError('Failed to edit message'); }
  };
  
  const deleteMessage = async (index) => {
    try {
        const response = await apiClient.delete(`/chats/${chatId}/messages/${index}`);
        setChat(response.data);
    } catch(e) { console.error(e); setError('Failed to delete message'); }
  };

  const switchVersion = async (index, verIdx) => {
    setChat(prev => {
        const hist = [...prev.history];
        hist[index].current_version = verIdx;
        hist[index].content = hist[index].versions[verIdx];
        return { ...prev, history: hist };
    });
    // Optional: Persist version choice to backend
  };
  
  const updateChatData = async (data) => {
      // Update system prompt, memory, etc.
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