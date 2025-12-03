import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
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

const MessageBubble = ({ message, index, isLast, onEdit, onDelete, onRegenerate, onVersionChange }) => {
  const isUser = message.role === 'user';
  const isError = message.content && message.content.toLowerCase().startsWith('error:');
  const isThinking = !isUser && !message.content;

  // Handle versions
  const versions = message.versions || [message.content];
  const currentVersionIndex = message.current_version || 0;
  const currentContent = versions[currentVersionIndex];
  const hasMultipleVersions = versions.length > 1;

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentContent);

  useEffect(() => {
    setEditValue(currentContent);
  }, [currentContent]);

  const handleSaveEdit = () => {
    if (editValue.trim() !== currentContent) {
      onEdit(index, editValue);
    }
    setIsEditing(false);
  };

  const handlePrevVersion = () => {
    if (currentVersionIndex > 0) {
      onVersionChange(index, currentVersionIndex - 1);
    }
  };

  const handleNextVersion = () => {
    if (currentVersionIndex < versions.length - 1) {
      onVersionChange(index, currentVersionIndex + 1);
    }
  };

  return (
    <div className={`message-container ${isUser ? 'user-align' : 'assistant-align'}`}>
      
      {/* --- Bubble Content --- */}
      <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
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
            {isThinking ? (
              <div className="typing-indicator">
                <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
              </div>
            ) : (
              <ReactMarkdown
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
                {currentContent}
              </ReactMarkdown>
            )}
          </div>
        )}
      </div>

      {/* --- Action Bar (Below Bubble) --- */}
      {!isEditing && !isThinking && (
        <div className="message-footer">
          {/* Version Navigation (Carousel) */}
          {hasMultipleVersions && (
            <div className="version-nav">
              <button onClick={handlePrevVersion} disabled={currentVersionIndex === 0}>‹</button>
              <span className="version-count">{currentVersionIndex + 1} / {versions.length}</span>
              <button onClick={handleNextVersion} disabled={currentVersionIndex === versions.length - 1}>›</button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="action-buttons">
            {!isUser && <CopyButton text={currentContent} className="action-btn" />}
            
            {/* Edit Button (Available for EVERYONE now) */}
            <button className="action-btn" onClick={() => setIsEditing(true)} title="Edit Message">
              ✎
            </button>

            {/* Regenerate Button (Last Assistant Message Only) */}
            {!isUser && isLast && (
              <button className="action-btn" onClick={onRegenerate} title="Regenerate Response">
                ↻
              </button>
            )}

            {/* Delete Button (Always available) */}
            <button className="action-btn delete-icon" onClick={() => onDelete(index)} title="Delete Message">
              🗑
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;