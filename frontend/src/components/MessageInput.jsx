import React, { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onStop, isLoading }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey) {
        // Ctrl+Enter -> Send
        handleSubmit(e);
      } else if (!e.shiftKey) {
         // Enter (without Shift) -> Send (Standard behavior)
         // But often user wants Shift+Enter for newline.
         // If we want Shift+Enter for newline, simple Enter sends.
         handleSubmit(e);
      }
      // If Shift+Enter, let default behavior happen (newline)
    }
  };

  // Lightweight token estimation: ~4 chars per token
  const estimatedTokens = Math.ceil(inputValue.length / 4);

  return (
    <div className="input-wrapper">
        <form className="message-input-container" onSubmit={handleSubmit}>
        <TextareaAutosize
            className="message-textarea"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message here..."
            minRows={1}
            maxRows={8}
            disabled={isLoading}
            onKeyDown={handleKeyDown}
        />
        <div className="input-actions">
            {isLoading ? (
                <button type="button" className="stop-btn" onClick={onStop} title="Stop Generation">
                    ⏹
                </button>
            ) : (
                <button type="submit" disabled={!inputValue.trim()}>
                    ➤
                </button>
            )}
        </div>
        </form>
        <div className="token-usage">
            Estimated tokens: {estimatedTokens}
        </div>
    </div>
  );
};

export default MessageInput;
