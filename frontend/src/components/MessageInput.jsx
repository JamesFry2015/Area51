import React, { useState, useRef } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onStop, isLoading }) => {
  const [inputValue, setInputValue] = useState('');
  // Changed from selectedImage to attachment (stores { file, previewUrl, isImage, type })
  const [attachment, setAttachment] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Helper: Process the file (from input or drop)
  const processFile = (file) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    reader.onloadend = () => {
      setAttachment({
        file: file,
        name: file.name,
        type: file.type,
        isImage: isImage,
        // For images, this is the display source. 
        // For docs, we can still use this base64 for upload, 
        // or just store the file object depending on your backend needs.
        content: reader.result 
      });
    };

    // Read everything as DataURL (Base64) for now to keep consistent with image logic
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e) => {
    processFile(e.target.files[0]);
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((inputValue.trim() || attachment) && !isLoading) {
      // Pass the whole attachment object up, or just the content if that's what useChat expects
      onSendMessage(inputValue, attachment ? attachment.content : null); 
      
      setInputValue('');
      handleRemoveAttachment();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const estimatedTokens = Math.ceil(inputValue.length / 4);

  return (
    <div className="input-wrapper">
        {/* Attachment Preview Area */}
        {attachment && (
            <div className="attachment-preview">
                {attachment.isImage ? (
                    <img src={attachment.content} alt="Preview" className="preview-image" />
                ) : (
                    <div className="file-card">
                        <span className="file-icon">📄</span>
                        <div className="file-info">
                            <span className="file-name">{attachment.name}</span>
                            <span className="file-type">{attachment.type || 'Unknown Type'}</span>
                        </div>
                    </div>
                )}
                <button className="remove-btn" onClick={handleRemoveAttachment}>×</button>
            </div>
        )}

        {/* Drag Zone Container 
            Conditional class 'dragging' adds visual cues
        */}
        <form 
            className={`message-input-container ${isDragging ? 'dragging' : ''}`} 
            onSubmit={handleSubmit}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Hidden File Input: Update accept to include docs */}
            <input 
                type="file" 
                accept="image/*, .pdf, .txt, .md, .json, .csv, .py, .js, .html, .css" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect} 
            />
            
            {/* Drag Overlay Text */}
            {isDragging && <div className="drag-overlay">Drop file to attach</div>}

            <TextareaAutosize
                className="message-textarea"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isDragging ? "Drop it!" : "Type a message..."}
                minRows={1}
                maxRows={8}
                disabled={isLoading}
                onKeyDown={handleKeyDown}
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }} // Prevent interference during drag
            />
            
            <div className="input-actions">
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current.click()} 
                    title="Attach File" 
                    className="attach-btn"
                >
                    📎
                </button>

                {isLoading ? (
                    <button type="button" className="stop-btn" onClick={onStop} title="Stop Generation">
                        ⏹
                    </button>
                ) : (
                    <button type="submit" disabled={!inputValue.trim() && !attachment}>
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