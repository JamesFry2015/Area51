import React from 'react';
import { Link } from 'react-router-dom';

// This component now represents a "Main Card"
const MainCard = ({ mainCard, onEdit, onDelete }) => {
  return (
    <div className="chat-card">
      {/* The link now points to a new route for viewing the Main Card's details */}
      <Link to={`/main-card/${mainCard.id}`}>
        <div className="card-thumbnail">
          <i className="fas fa-robot"></i> {/* Changed icon */}
        </div>
      </Link>
      <div className="card-body">
        <h4>{mainCard.name}</h4>
        <div className="card-actions">
          <button onClick={() => onEdit(mainCard)}>✏️</button>
          <button onClick={() => onDelete(mainCard.id)}>🗑️</button>
        </div>
      </div>
    </div>
  );
};

export default MainCard;
