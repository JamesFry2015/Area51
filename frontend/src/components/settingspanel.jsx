import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api.js';
import './SettingsPanel.css';

const SettingsPanel = ({ isOpen, onClose }) => {
  const [view, setView] = useState('main');
  const [apiConfigs, setApiConfigs] = useState([]);
  const [configToEdit, setConfigToEdit] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);

  const fetchApiConfigs = useCallback(async () => {
    if (isOpen) {
      try {
        const response = await apiClient.get('/api-configs/');
        setApiConfigs(response.data);
      } catch (error) { console.error("Failed to fetch API configs:", error); }
    }
  }, [isOpen]);

  useEffect(() => {
    if (view === 'api') {
      fetchApiConfigs();
    }
  }, [view, fetchApiConfigs]);

  const handleAddClick = () => {
    setConfigToEdit(null);
    setView('addApi');
  };

  const handleEditClick = (config) => {
    setConfigToEdit(config);
    setView('addApi');
  };

  const handleSave = async (configData) => {
    try {
      const payload = { ...configData };
      if (payload.api_key === '') {
        delete payload.api_key;
      }
      
      if (configToEdit) {
        await apiClient.patch(`/api-configs/${configToEdit.id}`, payload);
      } else {
        await apiClient.post('/api-configs/', payload);
      }
      setView('api');
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };
  
  const handleDeleteClick = (configId) => {
    setConfigToDelete(configId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await apiClient.delete(`/api-configs/${configToDelete}`);
      setShowDeleteConfirm(false);
      setConfigToDelete(null);
      fetchApiConfigs();
    } catch (error) {
      console.error("Failed to delete config:", error);
    }
  };

  if (!isOpen) return null;

  const renderMainView = () => (
    <div className="settings-content-wrapper">
      <div className="settings-header"><h2>Settings</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content"><button className="settings-menu-button" onClick={() => setView('api')}>API Settings <span className="arrow">›</span></button></div>
    </div>
  );

  const renderApiView = () => (
    <div className="settings-content-wrapper">
      <div className="settings-header"><button onClick={() => setView('main')} className="back-btn">‹</button><h2>Proxy API Configurations</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content">
        <div className="api-config-header"><h3>Your Configurations</h3><button className="add-config-btn" onClick={handleAddClick}>+ Add Configuration</button></div>
        <div className="api-config-list">
          {apiConfigs.length > 0 ? apiConfigs.map(config => (
            <div key={config.id} className="config-item">
              <div className="config-item-header"><h4>{config.name}</h4><div className="config-item-actions"><button onClick={() => handleEditClick(config)}>Edit</button><button onClick={() => handleDeleteClick(config.id)}>Delete</button></div></div>
              <div className="config-item-details"><span>{config.model}</span><span>{config.proxy_url}</span></div>
            </div>
          )) : <p>No configurations saved yet.</p>}
        </div>
      </div>
    </div>
  );

  const renderAddApiView = () => <ConfigForm onSave={handleSave} onCancel={() => setView('api')} initialData={configToEdit} />;

  const renderView = () => {
    switch(view) {
      case 'api': return renderApiView();
      case 'addApi': return renderAddApiView();
      default: return renderMainView();
    }
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {renderView()}
        {showDeleteConfirm && (
          <div className="confirmation-modal">
            <h4>Are you sure?</h4>
            <p>This action cannot be undone.</p>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="add-btn" style={{backgroundColor: '#dc3545'}} onClick={confirmDelete}>Confirm Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- FIX: The full ConfigForm component is now included ---
const ConfigForm = ({ onSave, onCancel, initialData }) => {
  const [config, setConfig] = useState({
    name: '',
    model: '',
    proxy_url: '',
    api_key: '',
    custom_prompt: ''
  });

  useEffect(() => {
    if (initialData) {
      // Don't pre-fill the api_key for security when editing
      setConfig({ ...initialData, api_key: '' });
    } else {
      // Reset form for "Add New"
      setConfig({ name: '', model: '', proxy_url: '', api_key: '', custom_prompt: '' });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClick = () => {
    // Create a payload, but don't include the api_key if it wasn't changed.
    const payload = { ...config };
    if (initialData && !payload.api_key) {
      delete payload.api_key;
    }
    onSave(payload);
  };

  return (
    <div className="settings-content-wrapper">
      <div className="settings-header">
        <button onClick={onCancel} className="back-btn">‹</button>
        <h2>{initialData ? 'Edit' : 'Add New'} Configuration</h2>
      </div>
      <div className="settings-content">
        <div className="config-form">
            <label>Configuration Name</label>
            <input name="name" type="text" placeholder="My Custom Proxy" value={config.name} onChange={handleChange} />
            
            <label>Model Name</label>
            <input name="model" type="text" placeholder="gpt-4, claude-3-opus, etc." value={config.model} onChange={handleChange} />
            
            <label>Proxy URL</label>
            <input name="proxy_url" type="text" placeholder="https://your.url.com/v1" value={config.proxy_url} onChange={handleChange} />
            
            <label>API Key (Optional)</label>
            <input name="api_key" type="password" placeholder={initialData ? "Leave blank to keep existing key" : "Proxy API key"} value={config.api_key} onChange={handleChange} />
            
            <label>Custom Prompt (Optional)</label>
            <textarea name="custom_prompt" placeholder="Custom prompt template..." rows="4" value={config.custom_prompt} onChange={handleChange}></textarea>
            
            <div className="form-actions">
                <button className="cancel-btn" onClick={onCancel}>Cancel</button>
                <button className="add-btn" onClick={handleSaveClick}>Save Configuration</button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;

