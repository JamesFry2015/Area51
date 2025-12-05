import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api.js';
import './settingspanel.css';

const SettingsPanel = ({
  isOpen,
  onClose,
  settings,
  onSettingChange,
  generationSettings,
  onGenerationSettingsChange,
  chatData,
  onChatDataChange
}) => {
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
    if (view === 'api' || (isOpen && view === 'main')) {
      fetchApiConfigs();
    }
  }, [view, isOpen, fetchApiConfigs]);

  const handleAddClick = () => { setConfigToEdit(null); setView('addApi'); };
  const handleEditClick = (config) => { setConfigToEdit(config); setView('addApi'); };

  const handleSaveApiConfig = async (configData) => {
    try {
      const payload = { ...configData };
      const isActive = configToEdit && settings.model === configToEdit.model && settings.baseUrl === configToEdit.proxy_url;

      if (configToEdit) {
        await apiClient.patch(`/api-configs/${configToEdit.id}`, payload);
      } else {
        await apiClient.post('/api-configs/', payload);
      }

      if (isActive) {
        onSettingChange({
          model: configData.model,
          baseUrl: configData.proxy_url,
          apiKey: configData.api_key || '',
          requestBody: configData.request_body || null
        });
      }

      setView('api');
    } catch (error) { console.error("Failed to save config:", error); }
  };
  
  const handleDeleteClick = (configId) => { setConfigToDelete(configId); setShowDeleteConfirm(true); };

  const confirmDelete = async () => {
    try {
      await apiClient.delete(`/api-configs/${configToDelete}`);
      setShowDeleteConfirm(false); setConfigToDelete(null);
      fetchApiConfigs();
    } catch (error) { console.error("Failed to delete config:", error); }
  };

  const handleSelectConfig = (config) => {
    onSettingChange({
      model: config.model,
      baseUrl: config.proxy_url,
      apiKey: config.api_key || '',
      requestBody: config.request_body || null
    });
  };

  if (!isOpen) return null;

  const renderMainView = () => (
    <div className="settings-content-wrapper">
      <div className="settings-header"><h2>Settings</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content">
        <button className="settings-menu-button" onClick={() => setView('api')}>API Settings <span className="arrow">›</span></button>
        <button className="settings-menu-button" onClick={() => setView('generation')}>Generation Settings <span className="arrow">›</span></button>
        <button className="settings-menu-button" onClick={() => setView('systemMemory')}>System & Chat Memory <span className="arrow">›</span></button>
      </div>
    </div>
  );

  const renderApiView = () => (
    <div className="settings-content-wrapper">
      <div className="settings-header"><button onClick={() => setView('main')} className="back-btn">‹</button><h2>Proxy API Configurations</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content">
        <div className="api-config-header"><h3>Your Configurations</h3><button className="add-config-btn" onClick={handleAddClick}>+ Add Configuration</button></div>
        <div className="api-config-list">
          {apiConfigs.length > 0 ? apiConfigs.map(config => {
            const isActive = settings.model === config.model && settings.baseUrl === config.proxy_url;
            return (
              <div key={config.id} className={`config-item ${isActive ? 'active' : ''}`}>
                <div className="config-item-header"><h4>{config.name} {isActive && <span className="active-badge">Selected</span>}</h4><div className="config-item-actions"><button onClick={() => handleEditClick(config)}>Edit</button><button onClick={() => handleDeleteClick(config.id)}>Delete</button></div></div>
                <div className="config-item-details"><span>{config.model}</span><span>{config.proxy_url}</span></div>
                {!isActive && <button className="select-btn" onClick={() => handleSelectConfig(config)}>Select</button>}
              </div>
            )
          }) : <p>No configurations saved yet.</p>}
        </div>
      </div>
    </div>
  );

  const renderGenerationView = () => <GenerationSettingsForm onBack={() => setView('main')} onClose={onClose} settings={generationSettings} onSettingChange={onGenerationSettingsChange} />;
  const renderSystemAndMemoryView = () => <SystemAndMemoryForm onBack={() => setView('main')} onClose={onClose} chatData={chatData} onChatDataChange={onChatDataChange} />;
  const renderAddApiView = () => <ConfigForm onSave={handleSaveApiConfig} onCancel={() => setView('api')} onClose={onClose} initialData={configToEdit} />;

  const renderView = () => {
    switch(view) {
      case 'api': return renderApiView();
      case 'addApi': return renderAddApiView();
      case 'generation': return renderGenerationView();
      case 'systemMemory': return renderSystemAndMemoryView();
      default: return renderMainView();
    }
  }

  return (
    <div className="settings-backdrop">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        {renderView()}
        {showDeleteConfirm && (
          <div className="confirmation-modal"><h4>Are you sure?</h4><p>This action cannot be undone.</p><div className="form-actions"><button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button><button className="add-btn" style={{backgroundColor: '#dc3545'}} onClick={confirmDelete}>Confirm Delete</button></div></div>
        )}
      </div>
    </div>
  );
};

const SystemAndMemoryForm = ({ onBack, onClose, chatData, onChatDataChange }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChatDataChange({ ...chatData, [name]: value });
  };

  return (
    <div className="settings-content-wrapper">
      <div className="settings-header"><button onClick={onBack} className="back-btn">‹</button><h2>System & Chat Memory</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content system-memory-form">
        <label>System Prompt</label>
        <textarea name="system_prompt" placeholder="Define the model's persona, instructions, and rules here..." rows="6" value={chatData?.system_prompt || ''} onChange={handleChange}></textarea>
        <label>Chat Memory</label>
        <textarea name="chat_memory" placeholder="Add long-term facts or context for the model to remember..." rows="6" value={chatData?.chat_memory || ''} onChange={handleChange}></textarea>
      </div>
    </div>
  );
};

const GenerationSettingsForm = ({ onBack, onClose, settings, onSettingChange }) => {
  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    onSettingChange({ ...settings, [name]: parseFloat(value) });
  };
  const handleNumberChange = (e) => {
    const { name, value } = e.target;
    onSettingChange({ ...settings, [name]: parseInt(value, 10) || 0 });
  };
  const handleTextChange = (e) => {
    const { name, value } = e.target;
    onSettingChange({ ...settings, [name]: value });
  };
  const handleToggle = (e) => {
    const { name, checked } = e.target;
    onSettingChange({ ...settings, [name]: checked });
  };

  return (
    <div className="settings-content-wrapper">
      <div className="settings-header"><button onClick={onBack} className="back-btn">‹</button><h2>Generation Settings</h2><button onClick={onClose} className="close-btn">×</button></div>
      <div className="settings-content generation-form">
        {/* NEW: Streaming Toggle */}
        <div className="toggle-group">
          <label htmlFor="stream_toggle">Stream Response</label>
          <input type="checkbox" id="stream_toggle" name="stream" checked={settings.stream !== false} onChange={handleToggle} />
        </div>

        <SliderInput label="Temperature" name="temperature" value={settings.temperature} min={0} max={2} step={0.1} onChange={handleSliderChange} />
        <SliderInput label="Max Tokens" name="max_tokens" value={settings.max_tokens} min={0} max={10000} step={50} onChange={handleNumberChange} />
        <SliderInput label="Context Window" name="context_window" value={settings.context_window} min={0} max={2000000} step={1000} onChange={handleNumberChange} />
        <SliderInput label="Top-K" name="top_k" value={settings.top_k} min={0} max={100} step={1} onChange={handleNumberChange} />
        <SliderInput label="Top-P" name="top_p" value={settings.top_p} min={0} max={1} step={0.01} onChange={handleSliderChange} />
        <SliderInput label="Repetition Penalty" name="repetition_penalty" value={settings.repetition_penalty} min={0} max={2} step={0.01} onChange={handleSliderChange} />
        <SliderInput label="Frequency Penalty" name="frequency_penalty" value={settings.frequency_penalty} min={0} max={2} step={0.01} onChange={handleSliderChange} />

        <div className="toggle-group">
          <label htmlFor="response_prefill_toggle">Response Prefill</label>
          <input type="checkbox" id="response_prefill_toggle" name="response_prefill_enabled" checked={settings.response_prefill_enabled} onChange={handleToggle} />
        </div>
        {settings.response_prefill_enabled && (
          <textarea name="response_prefill" placeholder="Force the model to start its response with this text..." rows="3" value={settings.response_prefill} onChange={handleTextChange}></textarea>
        )}
      </div>
    </div>
  );
};

const SliderInput = ({ label, name, value, min, max, step, onChange }) => (
  <div className="slider-group">
    <label>{label}</label>
    <div className="slider-controls">
      <input type="range" name={name} value={value} min={min} max={max} step={step} onChange={onChange} />
      <input type="number" name={name} value={value} min={min} max={max} step={step} onChange={onChange} className="slider-value-input" />
    </div>
  </div>
);

const ConfigForm = ({ onSave, onCancel, onClose, initialData }) => {
  const [config, setConfig] = useState({ name: '', model: '', proxy_url: '', api_key: '', custom_prompt: '', request_body: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) setConfig({ ...initialData, api_key: initialData.api_key || '', request_body: initialData.request_body || '' });
    else setConfig({ name: '', model: '', proxy_url: '', api_key: '', custom_prompt: '', request_body: '' });
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
    if (name === 'request_body') setError('');
  };

  const handleSaveClick = () => {
    if (config.request_body) {
      try {
        JSON.parse(config.request_body);
      } catch (e) {
        setError('Request Body must be valid JSON');
        return;
      }
    }

    const payload = { ...config };
    onSave(payload);
  };

  return (
    <div className="settings-content-wrapper">
      <div className="settings-header">
        <button onClick={onCancel} className="back-btn">‹</button>
        <h2>{initialData ? 'Edit' : 'Add New'} Configuration</h2>
        <button onClick={onClose} className="close-btn">×</button>
      </div>
      <div className="settings-content">
        <div className="config-form">
          <label>Configuration Name</label><input name="name" type="text" placeholder="My Custom Proxy" value={config.name} onChange={handleChange} />
          <label>Model Name</label><input name="model" type="text" placeholder="gpt-4, claude-3-opus, etc." value={config.model} onChange={handleChange} />
          <label>Proxy URL</label><input name="proxy_url" type="text" placeholder="https://your.url.com/v1" value={config.proxy_url} onChange={handleChange} />
          <label>API Key</label>
          <input name="api_key" type="text" placeholder="Proxy API key" value={config.api_key} onChange={handleChange} />
          <label>Request Body (JSON)</label><textarea name="request_body" placeholder='{"key": "value"}' rows="4" value={config.request_body} onChange={handleChange}></textarea>
          {error && <span className="error-text" style={{color: 'red', fontSize: '0.9em', display: 'block', marginBottom: '10px'}}>{error}</span>}
          <label>Custom Prompt (Optional)</label><textarea name="custom_prompt" placeholder="Custom prompt template..." rows="4" value={config.custom_prompt} onChange={handleChange}></textarea>
          <div className="form-actions"><button className="cancel-btn" onClick={onCancel}>Cancel</button><button className="add-btn" onClick={handleSaveClick}>Save Configuration</button></div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;