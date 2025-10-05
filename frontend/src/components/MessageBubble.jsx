import React from 'react';
import './MessageBubble.css'; // We will create this CSS file next

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Check for a specific message type for more robust error handling
  const isError = message.type === 'error';

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
      <div className="message-content">
        {/* We'll use a simple pre-wrap for now to respect newlines */}
        {message.content}
      </div>
    </div>
  );
};

export default MessageBubble;
