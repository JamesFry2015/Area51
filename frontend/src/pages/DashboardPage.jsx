import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
// --- FIX: Updated the import statements to use the new component names ---
import MainCard from '../components/MainCard.jsx';
import MainCardModal from '../components/MainCardModal.jsx';
import './DashboardPage.css';

const DashboardPage = () => {
  const [mainCards, setMainCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalInitialData, setModalInitialData] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);

  const { logout } = useAuth();

  const fetchMainCards = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/main-cards/');
      setMainCards(response.data);
    } catch (err) {
      setError('Failed to fetch main cards.');
      if (err.response?.status === 401) { logout(); }
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    fetchMainCards();
  }, [fetchMainCards]);

  const handleNewCard = () => {
    setModalInitialData({ id: null, name: 'New Persona', description: '', initial_message: '', example_response: '' });
    setShowEditModal(true);
  };

  const handleEditCard = (card) => {
    setModalInitialData(card);
    setShowEditModal(true);
  };

  const handleSaveCard = async (dataToSave) => {
    try {
      const { id, ...payload } = dataToSave;
      if (id) {
        // We will implement PATCH later
      } else {
        await apiClient.post('/main-cards/', payload);
      }
      setShowEditModal(false);
      fetchMainCards();
    } catch (err) {
      console.error("Failed to save main card:", err);
    }
  };
  
  const handleDeleteCard = (cardId) => {
      setCardToDelete(cardId);
      setShowDeleteConfirm(true);
  }

  const confirmDelete = async () => {
      console.log("Deleting card:", cardToDelete)
      setShowDeleteConfirm(false);
      setCardToDelete(null);
      fetchMainCards();
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Personas</h1>
        <div className="header-actions">
          <button id="new-chat-btn" onClick={handleNewCard}>＋ New Persona</button>
          <button id="logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="chat-grid">
        {mainCards.length === 0 ? (
          <p className="no-chats-message">No personas yet. Click "New Persona" to start!</p>
        ) : (
          mainCards.map(card => (
            <MainCard 
              key={card.id} 
              mainCard={card} 
              onEdit={handleEditCard}
              onDelete={handleDeleteCard}
            />
          ))
        )}
      </div>

      <MainCardModal 
        show={showEditModal}
        onSave={handleSaveCard}
        onCancel={() => setShowEditModal(false)}
        initialData={modalInitialData}
      />

      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{width: "350px", textAlign: "center"}}>
            <h2>Are you sure?</h2>
            <p>This action cannot be undone.</p>
            <button onClick={confirmDelete} style={{backgroundColor: '#dc3545', color: 'white'}}>Confirm Delete</button>
            <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

