import {
  SquareSlash,
  Paperclip,
  AtSign,
  Eraser,
  Bot,
  Check,
  Loader2
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  fetchProjectSettings,
  fetchAvailableModels,
  saveProjectSettings
} from "../../api/settingsApi";
import useToastStore from "../../store/toastStore";

const ACTION_MENU_CONTEXT_ITEMS = [
  // { id: "attach-file", icon: Paperclip, label: "Attach file...", stubName: "Attach file" },
  { id: "mention-file", icon: AtSign, label: "Mention file from this project...", stubName: "Mention file" },
  { id: "clear-conversation", icon: Eraser, label: "Clear conversation" }
];

function ActionMenuItem({ icon: MenuItemIcon, label, onClick, right, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer text-left disabled:opacity-50 disabled:pointer-events-none"
    >
      <span className="w-[13px] shrink-0 flex justify-center text-slate-400">
        {MenuItemIcon ? <MenuItemIcon size={13} /> : null}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {right}
    </button>
  );
}

export default function ChatActionMenu({ project, onClearConversation, onMentionFile, canMention }) {
  const projectId = project?.id || project?._id;
  const addToast = useToastStore((state) => state.addToast);
  const actionMenuRef = useRef(null);
  const actionMenuPanelRef = useRef(null);
  const actionMenuSettingsRef = useRef({});

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [actionMenuModels, setActionMenuModels] = useState([]);
  const [actionMenuSelectedModel, setActionMenuSelectedModel] = useState("");
  const [isActionMenuLoadingModels, setIsActionMenuLoadingModels] = useState(false);

  const closeActionMenu = () => setIsActionMenuOpen(false);

  const openActionMenu = async () => {
    if (isActionMenuOpen) {
      closeActionMenu();
      return;
    }
    setIsActionMenuOpen(true);
    if (!projectId) return;

    setIsActionMenuLoadingModels(true);
    try {
      const [savedSettings, modelsList] = await Promise.all([
        fetchProjectSettings(projectId),
        fetchAvailableModels(projectId),
      ]);
      actionMenuSettingsRef.current = savedSettings || {};
      setActionMenuModels(Array.isArray(modelsList) ? modelsList : []);
      setActionMenuSelectedModel(savedSettings?.default_model || "");
    } catch (loadError) {
      addToast(`Failed to load models: ${loadError.message}`, "error");
    } finally {
      setIsActionMenuLoadingModels(false);
    }
  };

  const handleActionMenuStub = (featureName) => {
    addToast(`${featureName} is coming soon.`, "info");
    closeActionMenu();
  };

  const handleClearConversation = () => {
    closeActionMenu();
    setPendingClear(true);
  };

  const handleMentionFile = () => {
    onMentionFile?.();
    closeActionMenu();
  };

  const handleSelectActionMenuModel = async (modelKey) => {
    const savedSettings = actionMenuSettingsRef.current;
    if (!savedSettings?.api_url || !savedSettings?.api_key) {
      addToast("Save the project's API settings before switching models.", "error");
      return;
    }
    try {
      await saveProjectSettings(projectId, {
        api_url: savedSettings.api_url,
        api_key: savedSettings.api_key,
        default_model: modelKey,
      });
      setActionMenuSelectedModel(modelKey);
      addToast(`Default model set to ${modelKey}`, "success");
    } catch (saveError) {
      addToast(`Failed to switch model: ${saveError.message}`, "error");
    }
  };

  useEffect(() => {
    if (!isActionMenuOpen) return;
    const handleOutsideMouseDown = (event) => {
      const clickedInsideMenu =
        actionMenuRef.current?.contains(event.target) ||
        actionMenuPanelRef.current?.contains(event.target);
      if (!clickedInsideMenu) closeActionMenu();
    };
    const handleMenuKeyDown = (event) => {
      if (event.key === "Escape") closeActionMenu();
    };
    document.addEventListener("mousedown", handleOutsideMouseDown);
    document.addEventListener("keydown", handleMenuKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
      document.removeEventListener("keydown", handleMenuKeyDown);
    };
  }, [isActionMenuOpen]);

  return (
    <>
      <button
        ref={actionMenuRef}
        onClick={openActionMenu}
        className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-md transition-colors cursor-pointer ${
          isActionMenuOpen
            ? "text-slate-700 bg-slate-100"
            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
        }`}
        title="Actions"
      >
        <SquareSlash size={13} />
      </button>

      {isActionMenuOpen && (
        <div
          ref={actionMenuPanelRef}
          className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-[fadeIn_0.15s_ease]"
        >
            <div className="p-1.5 max-h-80 overflow-y-auto scrollbar-thin">
              <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Context
              </div>
              {ACTION_MENU_CONTEXT_ITEMS.map((menuItem) => (
                <ActionMenuItem
                  key={menuItem.id}
                  icon={menuItem.icon}
                  label={menuItem.label}
                  disabled={menuItem.id === "mention-file" && !canMention}
                  onClick={
                    menuItem.id === "clear-conversation"
                      ? handleClearConversation
                      : menuItem.id === "mention-file"
                        ? handleMentionFile
                        : () => handleActionMenuStub(menuItem.stubName)
                  }
                />
              ))}

              <div className="border-t border-slate-100 my-1.5"></div>

              <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Model
              </div>
              {isActionMenuLoadingModels ? (
                <div className="flex items-center gap-2 px-2 py-2 text-[12px] text-slate-400">
                  <Loader2 size={13} className="animate-spin" />
                  Loading models…
                </div>
              ) : actionMenuModels.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-slate-400">No models available</div>
              ) : (
                actionMenuModels.map((modelOption) => (
                  <ActionMenuItem
                    key={modelOption.key}
                    icon={Bot}
                    label={modelOption.display_name || modelOption.key}
                    onClick={() => handleSelectActionMenuModel(modelOption.key)}
                    right={
                      modelOption.key === actionMenuSelectedModel ? (
                        <Check size={13} className="text-primary-500 shrink-0" />
                      ) : null
                    }
                  />
                ))
              )}
            </div>
        </div>
      )}

      {/* Clear Conversation Confirmation Dialog */}
      {pendingClear && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50">
                <Eraser size={28} className="text-white" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">Clear Conversation?</h3>
              <p className="text-sm text-slate-500 mb-1">
                The entire chat conversation will be removed.
              </p>
              <p className="text-[11px] text-slate-400">
                This action cannot be undone.
              </p>
            </div>

            <div className="px-8 pb-8 flex items-center gap-3">
              <button
                onClick={() => setPendingClear(false)}
                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPendingClear(false);
                  onClearConversation?.();
                  closeActionMenu();
                }}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200/50 hover:shadow-red-300/50 active:scale-95"
              >
                Yes, Clear
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
