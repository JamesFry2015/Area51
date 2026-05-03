import React, { useState, useRef, useEffect } from 'react'; // Added useEffect here
import TextareaAutosize from 'react-textarea-autosize';
import './MessageInput.css';

// Added externalFile and onFileProcessed to the props list
const MessageInput = ({ onSendMessage, onStop, isLoading, externalFile, onFileProcessed }) => {
  const [inputValue, setInputValue] = useState('');
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
        content: reader.result 
      });
    };

    reader.readAsDataURL(file);
  };

  // --- NEW: Global Drop Listener ---
  // This watches for files dropped anywhere on the ChatPage
  useEffect(() => {
    if (externalFile) {
      processFile(externalFile);
      // Tell the ChatPage that we've successfully grabbed the file
      if (onFileProcessed) onFileProcessed();
    }
  }, [externalFile, onFileProcessed]);

  const handleFileSelect = (e) => {
    processFile(e.target.files[0]);
  };

  // --- Drag and Drop Handlers (Local to the input box) ---
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

        <form 
            className={`message-input-container ${isDragging ? 'dragging' : ''}`} 
            onSubmit={handleSubmit}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input 
                type="file" 
                accept="image/*, .pdf, .txt, .md, .json, .csv, .py, .js, .html, .css" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect} 
            />
            
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
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
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