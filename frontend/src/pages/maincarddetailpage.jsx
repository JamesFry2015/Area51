import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import MainCardModal from '../components/maincardmodal.jsx';
import './maincarddetailpage.css';

const MainCardDetailPage = () => {
  const { mainCardId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [mainCard, setMainCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // --- NEW: State for modals and forms ---
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [chatToRename, setChatToRename] = useState(null);
  const [newChatName, setNewChatName] = useState("");
  const [chatToDelete, setChatToDelete] = useState(null);

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

  useEffect(() => { fetchMainCard(); }, [fetchMainCard]);

  const handleStartNewChat = async () => {
    try {
      const response = await apiClient.post(`/main-cards/${mainCardId}/chats/`);
      navigate(`/chat/${response.data.id}`);
    } catch (err) { setError("Could not start a new chat session."); }
  };

  // --- Main Card Handlers ---
  const handleSaveCard = async (dataToSave) => {
    try {
      await apiClient.patch(`/main-cards/${mainCardId}`, dataToSave);
      setShowEditModal(false);
      fetchMainCard();
    } catch (err) { console.error("Failed to save main card:", err); }
  };

  const confirmDeleteCard = async () => {
    try {
      await apiClient.delete(`/main-cards/${mainCardId}`);
      navigate('/');
    } catch (err) { console.error("Failed to delete main card:", err); }
  };

  // --- Chat Handlers ---
  const handleSaveRename = async (chatId) => {
    try {
      await apiClient.patch(`/chats/${chatId}`, { name: newChatName });
      setChatToRename(null);
      fetchMainCard();
    } catch (err) { console.error("Failed to rename chat:", err); }
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    try {
      await apiClient.delete(`/chats/${chatToDelete.id}`);
      setChatToDelete(null);
      fetchMainCard();
    } catch (err) { console.error("Failed to delete chat:", err); }
  };

  if (isLoading) return <div>Loading Persona...</div>;
  if (error) return <div>{error}</div>;
  if (!mainCard) return <div>Persona not found.</div>;

  return (
    <div className="detail-page-container">
      <div className="detail-header">
        <Link to="/" className="back-link">← Back to Personas</Link>
        <h1>{mainCard.name}</h1>
        <div className="header-actions">
          <button onClick={() => setShowEditModal(true)} className="edit-btn">Edit</button>
          <button onClick={() => setShowDeleteConfirm(true)} className="delete-btn">Delete</button>
        </div>
      </div>
      <div className="detail-content">
        <div className="description-box">
          <h3>Description</h3>
          <p>{mainCard.description || 'No description provided.'}</p>
        </div>
        <div className="chat-sessions-box">
          <div className="sessions-header">
            <h2>Chat Sessions</h2>
            <button onClick={handleStartNewChat} className="add-btn">＋ Start New Chat</button>
          </div>
          <div className="sessions-list">
            {mainCard.chats.length === 0 ? (
              <p>No chat sessions yet. Start one above!</p>
            ) : (
              mainCard.chats.map(chat => (
                <div key={chat.id} className="session-item">
                  {chatToRename?.id === chat.id ? (
                    <div className="rename-form">
                      <input type="text" value={newChatName} onChange={(e) => setNewChatName(e.target.value)} autoFocus />
                      <button onClick={() => handleSaveRename(chat.id)}>Save</button>
                      <button onClick={() => setChatToRename(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <Link to={`/chat/${chat.id}`} className="session-link">{chat.name}</Link>
                      {chat.chat_memory && <p className="chat-memory">Memory: {chat.chat_memory}</p>}
                      <div className="session-actions">
                        <button onClick={() => { setChatToRename(chat); setNewChatName(chat.name); }}>Rename</button>
                        <button onClick={() => setChatToDelete(chat)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <MainCardModal show={showEditModal} onSave={handleSaveCard} onCancel={() => setShowEditModal(false)} initialData={mainCard} />
      {showDeleteConfirm && (
        <div className="modal-backdrop"><div className="modal-content"><h2>Are you sure?</h2><p>This will delete the entire persona and all its chats. This action cannot be undone.</p><div className="form-actions"><button onClick={() => setShowDeleteConfirm(false)}>Cancel</button><button onClick={confirmDeleteCard} className="delete-btn">Confirm Delete</button></div></div></div>
      )}
      {chatToDelete && (
        <div className="modal-backdrop"><div className="modal-content"><h2>Delete Chat?</h2><p>Are you sure you want to delete "{chatToDelete.name}"? This action cannot be undone.</p><div className="form-actions"><button onClick={() => setChatToDelete(null)}>Cancel</button><button onClick={confirmDeleteChat} className="delete-btn">Confirm Delete</button></div></div></div>
      )}
    </div>
  );
};

export default MainCardDetailPage;
