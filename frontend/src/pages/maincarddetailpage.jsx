import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import './MainCardDetailPage.css';

const MainCardDetailPage = () => {
  const { mainCardId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [mainCard, setMainCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMainCard = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/main-cards/${mainCardId}`);
      setMainCard(response.data);
    } catch (err) {
      setError('Failed to load persona details.');
      if (err.response?.status === 401) logout();
    } finally {
      setIsLoading(false);
    }
  }, [mainCardId, logout]);

  useEffect(() => {
    fetchMainCard();
  }, [fetchMainCard]);

  const handleStartNewChat = async () => {
    try {
      // Ask the backend to create a new, empty chat session for this Main Card
      const response = await apiClient.post(`/main-cards/${mainCardId}/chats/`);
      const newChatId = response.data.id;
      // Navigate to the new chat page
      navigate(`/chat/${newChatId}`);
    } catch (err) {
      console.error("Failed to start new chat:", err);
      setError("Could not start a new chat session.");
    }
  };

  if (isLoading) return <div>Loading Persona...</div>;
  if (error) return <div>{error}</div>;
  if (!mainCard) return <div>Persona not found.</div>;

  return (
    <div className="detail-page-container">
      <div className="detail-header">
        <Link to="/" className="back-link">← Back to Personas</Link>
        <h1>{mainCard.name}</h1>
      </div>
      <div className="detail-content">
        <div className="description-box">
          <h3>Description</h3>
          <p>{mainCard.description || 'No description provided.'}</p>
        </div>
        <div className="chat-sessions-box">
          <div className="sessions-header">
            <h2>Chat Sessions</h2>
            <button onClick={handleStartNewChat}>＋ Start New Chat</button>
          </div>
          <div className="sessions-list">
            {mainCard.chats.length === 0 ? (
              <p>No chat sessions yet. Start one above!</p>
            ) : (
              mainCard.chats.map(chat => (
                <Link key={chat.id} to={`/chat/${chat.id}`} className="session-item">
                  Chat Session #{chat.id}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainCardDetailPage;
