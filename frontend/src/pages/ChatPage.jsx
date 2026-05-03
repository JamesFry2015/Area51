import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import MessageBubble from '../components/MessageBubble.jsx';
import MessageInput from '../components/MessageInput.jsx';
import SettingsPanel from '../components/settingspanel.jsx';
import ImageModal from '../components/ImageModal.jsx';
import { useChatSettings } from '../hooks/useChatSettings'; 
import { useChat } from '../hooks/useChat'; 
import './ChatPage.css';

const ChatPage = () => {
  const { chatId } = useParams();
  const { logout } = useAuth();
  
  // 1. UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false); // NEW: Track drag state
  const [droppedFile, setDroppedFile] = useState(null); // NEW: Store dropped file
  const messagesEndRef = useRef(null);

  // 2. Custom Hooks
  const { 
    advancedSettings, setAdvancedSettings, 
    attachmentSettings, setAttachmentSettings,
    generationSettings, setGenerationSettings 
  } = useChatSettings();

  const { 
    chat, isLoading, isSending, error, actions 
  } = useChat(chatId, { advancedSettings, attachmentSettings, generationSettings, logout });

  // 3. Drag & Drop Handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setDroppedFile(file); // Send file to MessageInput
      }
    }
  };

  // 4. Effects
  useEffect(() => {
    if (chat?.name) document.title = chat.name;
  }, [chat?.name]);

  useEffect(() => {
    if (chat?.history && !isSending) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.history, isSending]);

  // 5. Computed
  const totalTokens = useMemo(() => {
    if (!chat?.history) return 0;
    return chat.history.reduce((acc, msg) => {
      const content = msg.versions?.[msg.current_version || 0] || '';
      return acc + Math.ceil(content.length / 4);
    }, 0);
  }, [chat?.history]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div 
      className="chat-page-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Visual Overlay when dragging */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-message">
            <span className="drag-icon">📸</span>
            <h2>Drop to Upload Image</h2>
          </div>
        </div>
      )}

      <header className="chat-header">
        <Link to={`/main-card/${chat?.main_card_id}`} className="back-link">← Back</Link>
        <div style={{ textAlign: 'center' }}>
          <h1>{chat?.name || 'Chat'}</h1>
          <span style={{ fontSize: '0.8rem', color: '#888' }}>Total Context: {totalTokens} tokens</span>
        </div>
        <button className="settings-btn" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
      </header>

      <div className="chat-history-wrapper">
        <div className="chat-history">
          {chat?.history.map((msg, index) => (
            <MessageBubble
              key={index}
              index={index}
              message={msg}
              isLast={index === chat.history.length - 1}
              isGenerating={isSending && index === chat.history.length - 1}
              onEdit={actions.editMessage}
              onDelete={actions.deleteMessage}
              onRegenerate={actions.regenerate}
              onVersionChange={actions.switchVersion}
              onImageClick={setPreviewImage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageInput 
        onSendMessage={actions.sendMessage} 
        onStop={actions.stop} 
        isLoading={isSending}
        externalFile={droppedFile} // Pass the dropped file down
        onFileProcessed={() => setDroppedFile(null)} // Clear it once used
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={advancedSettings}
        onSettingChange={setAdvancedSettings}
        attachmentSettings={attachmentSettings}
        onAttachmentSettingChange={setAttachmentSettings}
        generationSettings={generationSettings}
        onGenerationSettingsChange={setGenerationSettings}
        chatData={chat}
        onChatDataChange={actions.updateChatData}
      />

      <ImageModal
        src={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default ChatPage;