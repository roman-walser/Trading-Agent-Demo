// frontend/features/dashboard/components/PageHeader.tsx
import { useEffect, useState } from 'react';

export type PanelToggleItem = {
  id: string;
  label: string;
};

export type LayoutPresetItem = {
  id: string;
  name: string;
};

type PageHeaderProps = {
  title: string;
  panels: PanelToggleItem[];
  visible: Record<string, boolean>;
  onTogglePanel: (id: string) => void;
  onBack?: () => void;
  onForward?: () => void;
  onDefaultLayout?: () => void;
  onDeleteHistory?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  layoutPresets?: LayoutPresetItem[];
  onApplyLayoutPreset?: (id: string) => void;
  onSaveLayoutPreset?: (name: string) => void;
  onCreateLayoutPreset?: (name: string) => void;
  onRenameLayoutPreset?: (id: string, name: string) => void;
  onDeleteLayoutPreset?: (id: string) => void;
  layoutPresetsCurrentName?: string;
  layoutPresetsBusy?: boolean;
  disabled?: boolean;
};

export const PageHeader = ({
  title,
  panels,
  visible,
  onTogglePanel,
  onBack,
  onForward,
  onDefaultLayout,
  onDeleteHistory,
  canGoBack = false,
  canGoForward = false,
  layoutPresets = [],
  onApplyLayoutPreset,
  onSaveLayoutPreset,
  onCreateLayoutPreset,
  onRenameLayoutPreset,
  onDeleteLayoutPreset,
  layoutPresetsCurrentName,
  layoutPresetsBusy = false,
  disabled = false
}: PageHeaderProps): JSX.Element => {
  const [isLayoutOpen, setLayoutOpen] = useState(false);
  const [isPanelsOpen, setPanelsOpen] = useState(false);
  const [isLayoutsOpen, setLayoutsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const chevronClass = (open: boolean) =>
    'inline-flex items-center justify-center w-5 h-5 rounded-md border border-white/10 bg-white/5 text-xs font-bold transition-transform duration-150 ' +
    (open ? 'rotate-180' : 'rotate-0');
  const panelButtonClass =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-semibold tracking-wide transition select-none ' +
    (disabled
      ? 'opacity-60 cursor-not-allowed'
      : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]');
  const menuItemClass = (isDisabled: boolean) =>
    `w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-[#dbe7ff] transition text-left ${
      isDisabled
        ? 'opacity-40 cursor-not-allowed'
        : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]'
    }`;
  const submenuButtonClass = (isOpen: boolean) =>
    `w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-[#dbe7ff] transition ${
      isOpen ? 'bg-white/5' : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]'
    }`;
  const presetItemClass = (isDisabled: boolean) =>
    `flex-1 px-2 py-1 rounded-md text-sm font-semibold text-left text-[#dbe7ff] transition ${
      isDisabled
        ? 'opacity-40 cursor-not-allowed'
        : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]'
    }`;
  const presetActionClass = (isDisabled: boolean) =>
    `px-2 py-1 rounded-md text-xs font-semibold text-[#dbe7ff] transition ${
      isDisabled
        ? 'opacity-40 cursor-not-allowed'
        : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]'
    }`;
  const presetInputClass =
    'w-full px-2 py-1 rounded-md border border-white/10 bg-white/5 text-sm text-[#dbe7ff] focus:outline-none focus:ring-1 focus:ring-[rgba(80,140,255,0.45)]';
  const checkboxClass =
    'w-4 h-4 accent-[#4bd6a8]' + (disabled ? ' opacity-60 cursor-not-allowed' : '');
  const panelLabelClass =
    'flex items-center gap-3 py-2 px-1 text-[#dbe7ff] select-none ' +
    (disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer');
  const hasLayoutsMenu = Boolean(
    onApplyLayoutPreset ||
      onSaveLayoutPreset ||
      onCreateLayoutPreset ||
      onRenameLayoutPreset ||
      onDeleteLayoutPreset
  );
  const layoutPresetsDisabled = disabled || layoutPresetsBusy;
  const trimmedPresetName = newPresetName.trim();
  const canSavePreset =
    Boolean(onSaveLayoutPreset) && trimmedPresetName.length > 0 && !layoutPresetsDisabled;
  const canCreatePreset =
    Boolean(onCreateLayoutPreset) && trimmedPresetName.length > 0 && !layoutPresetsDisabled;
  const showLayoutMenu = Boolean(
    onBack ||
      onForward ||
      onDefaultLayout ||
      onDeleteHistory ||
      panels.length > 0 ||
      hasLayoutsMenu
  );
  const layoutLabel = layoutPresetsCurrentName?.trim() || 'custom';
  const backDisabled = disabled || !onBack || !canGoBack;
  const forwardDisabled = disabled || !onForward || !canGoForward;
  const hasHistory = canGoBack || canGoForward;
  const deleteDisabled = disabled || !onDeleteHistory || !hasHistory;
  const defaultDisabled = disabled || !onDefaultLayout;

  const openLayoutMenu = (): void => {
    if (disabled) return;
    setLayoutOpen(true);
  };

  const closeLayoutMenu = (): void => {
    setLayoutOpen(false);
    setPanelsOpen(false);
    setLayoutsOpen(false);
    setEditingPresetId(null);
    setEditingPresetName('');
  };

  const toggleLayoutMenu = (): void => {
    if (disabled) return;
    if (isLayoutOpen) {
      closeLayoutMenu();
      return;
    }
    openLayoutMenu();
  };

  const togglePanelsMenu = (): void => {
    if (disabled) return;
    setPanelsOpen((open) => !open);
  };

  const toggleLayoutsMenu = (): void => {
    if (layoutPresetsDisabled) return;
    setLayoutsOpen((open) => !open);
  };

  const handleLayoutAction = (action?: () => void, isDisabled?: boolean): void => {
    if (disabled || isDisabled) return;
    action?.();
    closeLayoutMenu();
  };

  const handleApplyPreset = (id: string): void => {
    if (layoutPresetsDisabled || !onApplyLayoutPreset) return;
    onApplyLayoutPreset(id);
    closeLayoutMenu();
  };

  const handleSavePreset = (): void => {
    if (!canSavePreset || !onSaveLayoutPreset) return;
    onSaveLayoutPreset(trimmedPresetName);
  };

  const handleCreatePreset = (): void => {
    if (!canCreatePreset || !onCreateLayoutPreset) return;
    onCreateLayoutPreset(trimmedPresetName);
  };

  const handleRenamePreset = (presetId: string): void => {
    if (layoutPresetsDisabled) return;
    const trimmed = editingPresetName.trim();
    if (!trimmed || !onRenameLayoutPreset) return;
    onRenameLayoutPreset(presetId, trimmed);
    setEditingPresetId(null);
    setEditingPresetName('');
  };

  const handleDeletePreset = (presetId: string): void => {
    if (layoutPresetsDisabled || !onDeleteLayoutPreset) return;
    onDeleteLayoutPreset(presetId);
  };

  useEffect(() => {
    if (disabled && isLayoutOpen) {
      closeLayoutMenu();
    }
  }, [disabled, isLayoutOpen]);

  return (
    <header className="w-full bg-gradient-to-r from-[#132852b3] to-[#091226e6] border-b border-[rgba(80,140,255,0.18)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="max-w-[100rem] mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="text-lg font-extrabold tracking-wide text-[#eaf1ff] select-none">{title}</div>
        <div className="flex items-center gap-3">
          {showLayoutMenu ? (
            <div className="relative select-none">
              <button
                className={panelButtonClass}
                type="button"
                onClick={toggleLayoutMenu}
                aria-haspopup="true"
                aria-expanded={isLayoutOpen}
                aria-label="Layout menu"
                disabled={disabled}
              >
                Layout
                <span className={chevronClass(isLayoutOpen)} aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {isLayoutOpen ? (
                <div className="absolute right-0 mt-2 bg-[#0a1220f2] border border-[rgba(80,140,255,0.25)] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-3 min-w-[240px] z-10 select-none">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={menuItemClass(backDisabled)}
                      onClick={() => handleLayoutAction(onBack, backDisabled)}
                      aria-label="Back layout"
                      disabled={backDisabled}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className={menuItemClass(forwardDisabled)}
                      onClick={() => handleLayoutAction(onForward, forwardDisabled)}
                      aria-label="Forward layout"
                      disabled={forwardDisabled}
                    >
                      Forward
                    </button>
                    <button
                      type="button"
                      className={menuItemClass(defaultDisabled)}
                      onClick={() => handleLayoutAction(onDefaultLayout, defaultDisabled)}
                      aria-label="Default layout"
                      disabled={defaultDisabled}
                    >
                      Default layout
                    </button>
                    <button
                      type="button"
                      className={menuItemClass(deleteDisabled)}
                      onClick={() => handleLayoutAction(onDeleteHistory, deleteDisabled)}
                      aria-label="Delete history"
                      disabled={deleteDisabled}
                    >
                      Delete history
                    </button>
                    {hasLayoutsMenu ? (
                      <>
                        <div className="h-px bg-white/10 my-1" />
                        <button
                          type="button"
                          className={submenuButtonClass(isLayoutsOpen)}
                          onClick={toggleLayoutsMenu}
                          aria-label="Layouts menu"
                          aria-expanded={isLayoutsOpen}
                          disabled={layoutPresetsDisabled}
                        >
                          <span className="flex items-center gap-2">
                            <span>Layouts</span>
                            <span className="text-xs text-[#9fb4da]">({layoutLabel})</span>
                          </span>
                          <span className={chevronClass(isLayoutsOpen)} aria-hidden="true">
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </button>
                        {isLayoutsOpen ? (
                          <div className="pt-1 pl-2 flex flex-col gap-2">
                            {layoutPresets.length ? (
                              <div className="flex flex-col gap-2">
                                {layoutPresets.map((preset) => {
                                  const isEditing = editingPresetId === preset.id;
                                  const renameDisabled =
                                    layoutPresetsDisabled || !onRenameLayoutPreset;
                                  const deleteDisabled =
                                    layoutPresetsDisabled || !onDeleteLayoutPreset;
                                  const applyDisabled =
                                    layoutPresetsDisabled || !onApplyLayoutPreset;
                                  if (isEditing) {
                                    const renameTrimmed = editingPresetName.trim();
                                    const canRename =
                                      !renameDisabled && renameTrimmed.length > 0;
                                    return (
                                      <div
                                        key={preset.id}
                                        className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
                                      >
                                        <input
                                          className={presetInputClass}
                                          value={editingPresetName}
                                          onChange={(event) =>
                                            setEditingPresetName(event.target.value)
                                          }
                                          placeholder="Rename layout"
                                          disabled={layoutPresetsDisabled}
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            className={presetActionClass(!canRename)}
                                            onClick={() => handleRenamePreset(preset.id)}
                                            disabled={!canRename}
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            className={presetActionClass(layoutPresetsDisabled)}
                                            onClick={() => {
                                              setEditingPresetId(null);
                                              setEditingPresetName('');
                                            }}
                                            disabled={layoutPresetsDisabled}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="flex items-center gap-2" key={preset.id}>
                                      <button
                                        type="button"
                                        className={presetItemClass(applyDisabled)}
                                        onClick={() => handleApplyPreset(preset.id)}
                                        disabled={applyDisabled}
                                      >
                                        {preset.name}
                                      </button>
                                      <button
                                        type="button"
                                        className={presetActionClass(renameDisabled)}
                                        onClick={() => {
                                          setEditingPresetId(preset.id);
                                          setEditingPresetName(preset.name);
                                        }}
                                        aria-label={`Rename ${preset.name}`}
                                        disabled={renameDisabled}
                                      >
                                        Rename
                                      </button>
                                      <button
                                        type="button"
                                        className={presetActionClass(deleteDisabled)}
                                        onClick={() => handleDeletePreset(preset.id)}
                                        aria-label={`Delete ${preset.name}`}
                                        disabled={deleteDisabled}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-[#94a3b8] px-1 py-1">
                                No saved layouts
                              </div>
                            )}
                            {onSaveLayoutPreset || onCreateLayoutPreset ? (
                              <div className="flex flex-col gap-2 pt-1">
                                <input
                                  className={presetInputClass}
                                  value={newPresetName}
                                  onChange={(event) => setNewPresetName(event.target.value)}
                                  placeholder="New layout name"
                                  disabled={layoutPresetsDisabled}
                                />
                                <div className="flex gap-2">
                                  {onSaveLayoutPreset ? (
                                    <button
                                      type="button"
                                      className={presetActionClass(!canSavePreset)}
                                      onClick={handleSavePreset}
                                      disabled={!canSavePreset}
                                    >
                                      Save current
                                    </button>
                                  ) : null}
                                  {onCreateLayoutPreset ? (
                                    <button
                                      type="button"
                                      className={presetActionClass(!canCreatePreset)}
                                      onClick={handleCreatePreset}
                                      disabled={!canCreatePreset}
                                    >
                                      New default
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {panels.length ? (
                      <>
                        <div className="h-px bg-white/10 my-1" />
                        <button
                          type="button"
                          className={submenuButtonClass(isPanelsOpen)}
                          onClick={togglePanelsMenu}
                          aria-label="Panels menu"
                          aria-expanded={isPanelsOpen}
                          disabled={disabled}
                        >
                          Panels
                          <span className={chevronClass(isPanelsOpen)} aria-hidden="true">
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </button>
                        {isPanelsOpen ? (
                          <div className="pt-1 pl-2">
                            {panels.map((panel) => (
                              <label className={panelLabelClass} key={panel.id}>
                                <input
                                  type="checkbox"
                                  className={checkboxClass}
                                  checked={visible[panel.id]}
                                  onChange={() => onTogglePanel(panel.id)}
                                  disabled={disabled}
                                />
                                <span>{panel.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <a
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-semibold tracking-wide hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)] transition select-none"
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
          >
            APIs
          </a>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
