import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onStop, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result); // This is the base64 string
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((inputValue.trim() || selectedImage) && !isLoading) {
      onSendMessage(inputValue, selectedImage); // Pass image up
      setInputValue('');
      handleRemoveImage();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Lightweight token estimation: ~4 chars per token
  const estimatedTokens = Math.ceil(inputValue.length / 4);

  return (
    <div className="input-wrapper">
        {selectedImage && (
            <div className="image-preview">
                <img src={selectedImage} alt="Selected" />
                <button className="remove-btn" onClick={handleRemoveImage}>×</button>
            </div>
        )}

        <form className="message-input-container" onSubmit={handleSubmit}>
        {/* Hidden File Input */}
        <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileSelect} 
        />

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
            {/* Attachment Button */}
            <button type="button" onClick={() => fileInputRef.current.click()} title="Attach Image" style={{backgroundColor: '#444'}}>
                📎
            </button>

            {isLoading ? (
                <button type="button" className="stop-btn" onClick={onStop} title="Stop Generation">
                    ⏹
                </button>
            ) : (
                <button type="submit" disabled={!inputValue.trim() && !selectedImage}>
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