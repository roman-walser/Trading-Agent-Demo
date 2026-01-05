// frontend/features/dashboard/components/PageHeader.tsx
import { useEffect, useState } from 'react';

export type PanelToggleItem = {
  id: string;
  label: string;
};

type PageHeaderProps = {
  title: string;
  panels: PanelToggleItem[];
  visible: Record<string, boolean>;
  onTogglePanel: (id: string) => void;
  disabled?: boolean;
};

export const PageHeader = ({
  title,
  panels,
  visible,
  onTogglePanel,
  disabled = false
}: PageHeaderProps): JSX.Element => {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const chevronClass =
    'inline-flex items-center justify-center w-5 h-5 rounded-md border border-white/10 bg-white/5 text-xs font-bold transition-transform duration-150 ' +
    (isDropdownOpen ? 'rotate-180' : 'rotate-0');
  const panelButtonClass =
    'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-semibold tracking-wide transition select-none ' +
    (disabled
      ? 'opacity-60 cursor-not-allowed'
      : 'hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)]');
  const checkboxClass =
    'w-4 h-4 accent-[#4bd6a8]' + (disabled ? ' opacity-60 cursor-not-allowed' : '');
  const panelLabelClass =
    'flex items-center gap-3 py-2 px-1 text-[#dbe7ff] select-none ' +
    (disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer');

  useEffect(() => {
    if (disabled && isDropdownOpen) {
      setDropdownOpen(false);
    }
  }, [disabled, isDropdownOpen]);

  return (
    <header className="w-full bg-gradient-to-r from-[#132852b3] to-[#091226e6] border-b border-[rgba(80,140,255,0.18)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="max-w-[100rem] mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="text-lg font-extrabold tracking-wide text-[#eaf1ff] select-none">{title}</div>
        <div className="flex items-center gap-3">
          <a
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-semibold tracking-wide hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)] transition select-none"
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
          >
            APIs
          </a>
          <div className="relative select-none">
            <button
              className={panelButtonClass}
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
              disabled={disabled}
            >
              Panels
              <span className={chevronClass} aria-hidden="true">
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
            {isDropdownOpen ? (
              <div className="absolute right-0 mt-2 bg-[#0a1220f2] border border-[rgba(80,140,255,0.25)] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-3 min-w-[200px] z-10 select-none">
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
