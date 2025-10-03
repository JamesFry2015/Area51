import React, { useState } from 'react';
import './MessageInput.css'; // We will create this CSS file next

const MessageInput = ({ onSendMessage, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message here..."
        rows="1"
        disabled={isLoading}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
            }
        }}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? '...' : 'Send'}
      </button>
    </form>
  );
};

export default MessageInput;
