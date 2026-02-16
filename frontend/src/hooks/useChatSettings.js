import { useState, useEffect } from 'react';

export const useChatSettings = () => {
  // Advanced Settings
  const [advancedSettings, setAdvancedSettings] = useState(() => {
    const saved = localStorage.getItem('advancedSettings');
    return saved ? JSON.parse(saved) : { apiKey: '', model: '', baseUrl: '', requestBody: null };
  });

  // Generation Settings
  const [generationSettings, setGenerationSettings] = useState(() => {
    const saved = localStorage.getItem('generationSettings');
    const defaults = {
      stream: true,
      temperature: 1.0, max_tokens: 10000, context_window: 2000000,
      top_k: 0, top_p: 1.0, repetition_penalty: 1.0, frequency_penalty: 0.0,
      response_prefill_enabled: false, response_prefill: '',
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));
  }, [advancedSettings]);

  useEffect(() => {
    localStorage.setItem('generationSettings', JSON.stringify(generationSettings));
  }, [generationSettings]);

  return {
    advancedSettings,
    setAdvancedSettings,
    generationSettings,
    setGenerationSettings
  };
};