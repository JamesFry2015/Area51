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
  const messagesEndRef = useRef(null);

  // 2. Custom Hooks
  const { 
    advancedSettings, setAdvancedSettings, 
    attachmentSettings, setAttachmentSettings, // NEW: Destructure Attachment Settings
    generationSettings, setGenerationSettings 
  } = useChatSettings();

  // Pass attachmentSettings to useChat so it can use them when sending files
  const { 
    chat, isLoading, isSending, error, actions 
  } = useChat(chatId, { advancedSettings, attachmentSettings, generationSettings, logout });

  // 3. Effects (Title & Scroll)
  useEffect(() => {
    if (chat?.name) document.title = chat.name;
  }, [chat?.name]);

  useEffect(() => {
    if (chat?.history && !isSending) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat?.history, isSending]);

  // 4. Computed
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
    <div className="chat-page-container">
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
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={advancedSettings}
        onSettingChange={setAdvancedSettings}
        attachmentSettings={attachmentSettings} // NEW: Pass to Settings Panel
        onAttachmentSettingChange={setAttachmentSettings} // NEW: Pass Setter
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