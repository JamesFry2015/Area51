import axios from 'axios';

// Create a new instance of axios with a custom configuration.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// This interceptor adds the auth token to every request.
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper function for streaming requests using fetch
apiClient.streamChatCompletion = async (chatId, payload, onChunk, signal) => {
    const token = localStorage.getItem('authToken');
    const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

    const response = await fetch(`${baseUrl}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
        signal: signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processLine = (line) => {
        if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return true; // Signal to stop
            try {
                if (data.startsWith('Error:')) {
                     onChunk(data); 
                } else {
                    const json = JSON.parse(data);
                    const content = json.choices?.[0]?.delta?.content || '';
                    if (content) onChunk(content);
                }
            } catch (e) {
                 console.warn("Failed to parse SSE data", data);
            }
        } else if (line.startsWith('Error: ')) {
             onChunk(line);
        }
        return false;
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last part in the buffer as it might be incomplete
            buffer = lines.pop(); 

            for (const line of lines) {
                if (processLine(line)) return;
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
             // Request aborted by user
        } else {
             throw error;
        }
    } finally {
        // FIX: Process any remaining text in the buffer when the stream ends
        if (buffer.trim()) {
            processLine(buffer.trim());
        }
    }
};

export const streamChatCompletion = apiClient.streamChatCompletion;

export default apiClient;
