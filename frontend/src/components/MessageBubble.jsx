import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.content.toLowerCase().startsWith('error:');

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
      <div className="message-header-actions">
           {!isUser && <CopyButton text={message.content} className="message-copy-btn" />}
      </div>
      <div className="message-content">
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
                  <SyntaxHighlighter
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MessageBubble;
