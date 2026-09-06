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
import {
  fetchProjectSettings,
  fetchAvailableModels,
  saveProjectSettings
} from "../../api/settingsApi";
import useToastStore from "../../store/toastStore";

const ACTION_MENU_CONTEXT_ITEMS = [
  { id: "attach-file", icon: Paperclip, label: "Attach file...", stubName: "Attach file" },
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

export default function ChatActionMenu({ project, onClearConversation }) {
  const projectId = project?.id || project?._id;
  const addToast = useToastStore((state) => state.addToast);
  const actionMenuRef = useRef(null);
  const actionMenuPanelRef = useRef(null);
  const actionMenuSettingsRef = useRef({});

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
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
    onClearConversation?.();
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
                  onClick={
                    menuItem.id === "clear-conversation"
                      ? handleClearConversation
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
    </>
  );
}
