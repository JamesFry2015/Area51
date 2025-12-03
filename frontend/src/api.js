import axios from 'axios';

// Create a new instance of axios with a custom configuration.
// We use an environment variable if available, otherwise fallback to localhost.
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
export const streamChatCompletion = async (chatId, payload, onChunk, signal) => {
    const token = localStorage.getItem('authToken');
    // Use the same BASE_URL as axios, ensuring no trailing slash issues if simple concat
    const baseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

    const response = await fetch(`${baseUrl}/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            // The chunk might contain multiple "data: ..." lines or partial lines.
            // For simplicity in this implementation, we are passing the raw chunk to the callback
            // and letting the caller handle it, OR we should parse SSE here.
            // In the ChatPage.jsx, we were just appending chunk to content.
            // BUT backend sends SSE format: "data: {json}\n\n".
            // So we MUST parse it here or in ChatPage.

            // Let's implement a simple SSE parser here to be clean.
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                        // Check if it's our error format or JSON
                        if (data.startsWith('Error:')) {
                            // It's a plain text error from our backend (see crud.py)
                            // yield f"data: Error: API key is missing.\n\n"
                            // So data is "Error: API key is missing."
                             onChunk(data); // Pass it through, UI handles it
                        } else {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content || '';
                            if (content) onChunk(content);
                        }
                    } catch (e) {
                         // If it's not JSON, maybe it's raw text?
                         // In crud.py we yield "Error: ..." inside the data block?
                         // actually: yield f"Error: {str(e)}" (without data prefix? no, see below)

                         // crud.py:
                         // yield f"data: Error: API key is missing.\n\n"
                         // ...
                         // yield f"Error: {str(e)}" -> This breaks SSE format!

                         // We should fix crud.py to be consistent.
                         // But if we receive raw text that's not data:, we might ignore it or handle it.
                         console.warn("Failed to parse SSE data", data);
                    }
                } else if (line.startsWith('Error: ')) {
                     // Handle the case where backend yielded non-SSE error
                     onChunk(line);
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
             // Request aborted by user, that's fine
        } else {
             throw error;
        }
    }
};

// We export this configured instance so other parts of our app can use it.
export default apiClient;
