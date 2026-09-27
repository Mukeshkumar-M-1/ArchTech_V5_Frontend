import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Eye, EyeOff, Loader2 } from 'lucide-react';
import { fetchProjectSettings, saveProjectSettings, fetchAvailableModels } from '../../api/settingsApi';
import useToastStore from '../../store/toastStore';

const EMPTY_SETTINGS_FORM = { api_url: '', api_key: '', default_model: '' };

export default function SettingsDialog({ project, onClose }) {
  const projectId = project?.id;
  const addToast = useToastStore((state) => state.addToast);

  const [settingsForm, setSettingsForm] = useState(EMPTY_SETTINGS_FORM);
  const [availableModels, setAvailableModels] = useState([]);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingSettings(true);

    fetchProjectSettings(projectId)
      .then((savedSettings) => {
        if (!isMounted) return;
        setSettingsForm({
          api_url: savedSettings.api_url ?? '',
          api_key: savedSettings.api_key ?? '',
          default_model: savedSettings.default_model,
        });
        if (!savedSettings.api_url || !savedSettings.api_key) return;
        return fetchAvailableModels(projectId).then((modelsList) => {
          if (!isMounted || !Array.isArray(modelsList) || modelsList.length === 0) return;
          setAvailableModels(modelsList);
          setSettingsForm((previousForm) => {
            const isSavedModelStillListed = modelsList.some(
              (model) => model.key === previousForm.default_model
            );
            // Stale saved model (removed/renamed on the API) — fall back to the first one.
            if (previousForm.default_model && isSavedModelStillListed) return previousForm;
            return { ...previousForm, default_model: modelsList[0].key };
          });
        });
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        addToast(`Failed to load settings: ${fetchError.message}`, 'error');
      })
      .finally(() => {
        if (isMounted) setIsLoadingSettings(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setSettingsForm((previousForm) => ({ ...previousForm, [name]: value }));
  };

  const handleModelSelect = (selectedModelKey) => {
    setSettingsForm((previousForm) => ({ ...previousForm, default_model: selectedModelKey }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedApiUrl = settingsForm.api_url.trim();
    const trimmedApiKey = settingsForm.api_key.trim();

    if (!trimmedApiUrl || !trimmedApiKey) {
      addToast('API URL and API Key are required.', 'error');
      return;
    }

    // Placeholder formats: "https://llmgw.datapatterns.co.in/v1" and "sk-dpllm-..."
    if (!/^https:\/\/[^\s]+\.[^\s]+/.test(trimmedApiUrl)) {
      addToast('API URL must be a valid https:// URL, e.g. https://llmgw.datapatterns.co.in/v1', 'error');
      return;
    }
    if (!/^sk-\S+$/.test(trimmedApiKey)) {
      addToast('API Key must start with "sk-", e.g. sk-dpllm-...', 'error');
      return;
    }

    // Only enforce model selection once the list has loaded — on first-time setup
    // the list is empty until credentials are saved, so blocking here would deadlock.
    if (availableModels.length > 0) {
      if (!settingsForm.default_model) {
        addToast('Please choose a default model, then save.', 'error');
        return;
      }
      // A saved/typed model key may no longer exist on the API (renamed, removed) —
      // reject it instead of saving a default the gateway would reject later.
      const isModelInList = availableModels.some((model) => model.key === settingsForm.default_model);
      if (!isModelInList) {
        addToast(`Model "${settingsForm.default_model}" is not available. Please choose one from the list.`, 'error');
        return;
      }
    }

    setIsSavingSettings(true);
    saveProjectSettings(projectId, {
      api_url: trimmedApiUrl,
      api_key: trimmedApiKey,
      default_model: settingsForm.default_model || '',
    })
      .then(() => {
        addToast('LLM settings saved.', 'success');
        // Credentials just changed, so re-fetch the model list against the new API
        // instead of waiting for the dialog to be reopened.
        return fetchAvailableModels(projectId).catch((modelsError) => {
          // Save already succeeded — don't let a model-list failure look like a save failure.
          addToast(`Saved, but couldn't load models: ${modelsError.message}`, 'error');
        });
      })
      .then((modelsList) => {
        if (!Array.isArray(modelsList) || modelsList.length === 0) return;
        setAvailableModels(modelsList);
        if (settingsForm.default_model) return;
        // First-time setup: nothing was selected before save, so persist the first
        // available model as the default instead of making the user save twice.
        const firstModelKey = modelsList[0].key;
        setSettingsForm((previousForm) =>
          previousForm.default_model
            ? previousForm
            : { ...previousForm, default_model: firstModelKey }
        );
        return saveProjectSettings(projectId, {
          api_url: trimmedApiUrl,
          api_key: trimmedApiKey,
          default_model: firstModelKey,
        }).then(() => addToast(`Default model set to ${firstModelKey}.`, 'success'));
      })
      .catch((saveError) => {
        addToast(`Failed to save settings: ${saveError.message}`, 'error');
      })
      .finally(() => {
        setIsSavingSettings(false);
      });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-2xl overflow-hidden"
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-8 pt-7">
            {/* Compact left-aligned header */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200/50 shrink-0">
                <Settings size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 leading-tight">LLM Configuration</h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Global API settings for project <span className="font-mono text-primary-500">{projectId}</span>
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 mt-5 mb-6"></div>

            {isLoadingSettings ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <Loader2 size={24} className="text-primary-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Loading settings</span>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-2">
                {/* Left column — API connection */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">API Connection</p>
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label htmlFor="settings-api-url" className="text-[11px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                        API URL
                      </label>
                      <input
                        id="settings-api-url"
                        type="text"
                        name="api_url"
                        className="premium-input bg-slate-50"
                        placeholder="https://llmgw.datapatterns.co.in/v1"
                        value={settingsForm.api_url}
                        onChange={handleFieldChange}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-api-key" className="text-[11px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          id="settings-api-key"
                          type={isApiKeyVisible ? 'text' : 'password'}
                          name="api_key"
                          className="premium-input bg-slate-50 !pr-11"
                          placeholder="sk-dpllm-..."
                          value={settingsForm.api_key}
                          onChange={handleFieldChange}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setIsApiKeyVisible((visible) => !visible)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                          title={isApiKeyVisible ? 'Hide API key' : 'Show API key'}
                        >
                          {isApiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right column — default model */}
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Default Model</p>
                  <div className="space-y-2.5">
                    {availableModels.map((modelOption) => {
                      const isModelSelected = modelOption.key === settingsForm.default_model;
                      return (
                        <button
                          key={modelOption.key}
                          type="button"
                          onClick={() => handleModelSelect(modelOption.key)}
                          className={`w-full text-left px-4 py-3 rounded-2xl border transition-all active:scale-[0.99] ${
                            isModelSelected
                              ? 'border-primary-500 bg-primary-50/60 shadow-sm shadow-primary-100'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isModelSelected ? 'border-primary-500' : 'border-slate-300'
                              }`}
                            >
                              {isModelSelected && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{modelOption.display_name}</span>
                                {isModelSelected && (
                                  <span className="text-[9px] font-black uppercase tracking-widest text-primary-600 bg-primary-100 px-1.5 py-0.5 rounded-md">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{modelOption.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="px-8 pb-8 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isLoadingSettings || isSavingSettings}
              className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-200/50 hover:shadow-blue-300/50 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSavingSettings ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
