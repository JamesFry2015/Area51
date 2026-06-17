import React, { useState, useEffect } from 'react';

const MainCardModal = ({ show, onSave, onCancel, initialData }) => {
  const [modalData, setModalData] = useState({ name: '', description: '', initial_message: '', example_response: '' });

  useEffect(() => {
    if (initialData) {
      setModalData(initialData);
    }
  }, [initialData]);

  if (!show) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>{initialData && initialData.id ? 'Edit Main Card' : 'Create New Main Card'}</h2>
        <input
          type="text"
          placeholder="Name (e.g., 'Helpful Assistant', 'Shakespearean Poet')"
          value={modalData.name}
          onChange={(e) => setModalData({ ...modalData, name: e.target.value })}
        />
        <textarea
          placeholder="Description / System Prompt (optional)"
          rows="3"
          value={modalData.description}
          onChange={(e) => setModalData({ ...modalData, description: e.target.value })}
        />
        <textarea
          placeholder="Initial Message (optional, the AI's first message)"
          rows="3"
          value={modalData.initial_message}
          onChange={(e) => setModalData({ ...modalData, initial_message: e.target.value })}
        />
        <textarea
          placeholder="Example Response (optional, a sample of the AI's persona)"
          rows="3"
          value={modalData.example_response}
          onChange={(e) => setModalData({ ...modalData, example_response: e.target.value })}
        />
        <button onClick={() => onSave(modalData)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

export default MainCardModal;
