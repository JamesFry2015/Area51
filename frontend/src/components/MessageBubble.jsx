import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import TextareaAutosize from 'react-textarea-autosize';
import './MessageBubble.css';

const CopyButton = ({ text, className }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className={`copy-btn ${className || ''}`} onClick={handleCopy} title="Copy to clipboard">
      {copied ? '✓' : '📋'}
    </button>
  );
};

const MessageBubble = ({ message, index, isLast, onEdit, onDelete, onRegenerate, onVersionChange, onImageClick }) => {
  const isUser = message.role === 'user';
  
  // FIX: Robust error detection
  const isError = message.content && (
      message.content.toLowerCase().startsWith('error:') || 
      message.content.startsWith('[Error:')
  );
  
  const versions = message.versions || [message.content];
  const currentVersionIndex = message.current_version || 0;
  const currentContent = versions[currentVersionIndex] || '';
  const hasMultipleVersions = versions.length > 1;
  const attachedImages = message.images || [];

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentContent);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  useEffect(() => {
    setEditValue(currentContent);
  }, [currentContent]);

  const { thought, finalContent, isThinking } = useMemo(() => {
    if (isUser || !currentContent) return { thought: null, finalContent: currentContent, isThinking: false };

    const thinkMatch = /<think>([\s\S]*?)<\/think>/i.exec(currentContent);
    const openThinkMatch = /<think>([\s\S]*)/i.exec(currentContent);

    if (thinkMatch) {
      const thoughtContent = thinkMatch[1];
      const restContent = currentContent.replace(thinkMatch[0], '').trim();
      return { thought: thoughtContent, finalContent: restContent, isThinking: false };
    } else if (openThinkMatch) {
      return { thought: openThinkMatch[1], finalContent: '', isThinking: true };
    }

    return { thought: null, finalContent: currentContent, isThinking: false };
  }, [currentContent, isUser]);

  const hasAutoCollapsedRef = useRef(false);

  useEffect(() => {
    if (isThinking) {
        setIsReasoningOpen(true);
        hasAutoCollapsedRef.current = false;
    } else if (thought && finalContent && !hasAutoCollapsedRef.current) {
        setIsReasoningOpen(false);
        hasAutoCollapsedRef.current = true;
    } else if (thought && !finalContent) {
        setIsReasoningOpen(true);
    }
  }, [isThinking, finalContent, thought]);


  const handleSaveEdit = () => {
    if (editValue.trim() !== currentContent) {
      onEdit(index, editValue);
    }
    setIsEditing(false);
  };

  const handlePrevVersion = () => {
    if (currentVersionIndex > 0) onVersionChange(index, currentVersionIndex - 1);
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < versions.length - 1) onVersionChange(index, currentVersionIndex + 1);
  };

  const renderMarkdown = (text) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <div className="code-block-wrapper">
              <div className="code-block-header">
                <span className="code-lang">{match[1]}</span>
                <CopyButton text={String(children).replace(/\n$/, '')} />
              </div>
              <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" {...props}>
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );

  const thumbnailStyle = {
    maxWidth: '300px',
    maxHeight: '300px',
    width: 'auto',
    height: 'auto',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: '#222'
  };

  return (
    <div className={`message-container ${isUser ? 'user-align' : 'assistant-align'}`}>
      
      <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
        
        {attachedImages.length > 0 && (
            <div className="message-images">
                {attachedImages.map((imgSrc, i) => (
                    <img 
                      key={i} 
                      src={imgSrc} 
                      alt="Attached content" 
                      onClick={() => onImageClick(imgSrc)} 
                      style={thumbnailStyle}
                    />
                ))}
            </div>
        )}

        {isEditing ? (
          <div className="edit-mode-container">
            <TextareaAutosize 
              value={editValue} 
              onChange={(e) => setEditValue(e.target.value)} 
              className="edit-textarea"
            />
            <div className="edit-actions">
              <button className="save-btn" onClick={handleSaveEdit}>Save</button>
              <button className="cancel-btn" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="message-content">
            {thought && (
              <div className="reasoning-wrapper">
                <button 
                  className={`reasoning-toggle ${isThinking ? 'pulsing' : ''}`} 
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                >
                  <span className="toggle-arrow">{isReasoningOpen ? '▼' : '▶'}</span>
                  <span className="toggle-text">{isThinking ? 'Thinking...' : 'Thought Process'}</span>
                  {isThinking && <span className="thinking-spinner"> ⚙️</span>}
                </button>
                
                {isReasoningOpen && (
                  <div className="reasoning-content">
                    {renderMarkdown(thought)}
                  </div>
                )}
              </div>
            )}

            {!finalContent && !isThinking && !thought && !isUser ? (
              <div className="typing-indicator">
                <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
              </div>
            ) : (
              renderMarkdown(finalContent)
            )}
          </div>
        )}
      </div>

      {!isEditing && (!isThinking || finalContent) && (
        <div className="message-footer">
          <span className="token-badge" title="Estimated Tokens">
            {Math.ceil(currentContent.length / 4)} tok
          </span>

          {hasMultipleVersions && (
            <div className="version-nav">
              <button onClick={handlePrevVersion} disabled={currentVersionIndex === 0}>‹</button>
              <span className="version-count">{currentVersionIndex + 1} / {versions.length}</span>
              <button onClick={handleNextVersion} disabled={currentVersionIndex === versions.length - 1}>›</button>
            </div>
          )}

          <div className="action-buttons">
            {!isUser && <CopyButton text={finalContent || thought} className="action-btn" />}
            <button className="action-btn" onClick={() => setIsEditing(true)}>✎</button>
            {!isUser && isLast && <button className="action-btn" onClick={onRegenerate}>↻</button>}
            <button className="action-btn delete-icon" onClick={() => onDelete(index)}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;