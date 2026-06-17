import React from 'react';
import './ImageModal.css';

const ImageModal = ({ src, onClose }) => {
  if (!src) return null;

  return (
    <div className="image-modal-backdrop" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt="Full size preview" />
        <button className="image-modal-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
};

export default ImageModal;