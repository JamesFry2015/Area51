import React from 'react';
import './MessageBubble.css';

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.type === 'error';
  const hasReasoning = message.reasoning && Object.keys(message.reasoning).length > 0;

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
      {hasReasoning && (
        <details className="reasoning-dropdown">
          <summary>Look at reasoning tokens</summary>
          <pre className="reasoning-content">
            {JSON.stringify(message.reasoning, null, 2)}
          </pre>
        </details>
      )}
      <div className="message-content">
        {message.content}
      </div>
    </div>
  );
};

export default MessageBubble;
