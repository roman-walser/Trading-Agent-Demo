// frontend/pages/DashboardPage.tsx
import { useMemo, useState } from 'react';
import HealthPanel from '../features/dashboard/panels/HealthPanel.js';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGrid = WidthProvider(GridLayout);
const resizeHandle = (
  <span className="custom-resize-handle" aria-label="Resize panel" />
);

export const DashboardPage = (): JSX.Element => {
  const panels = useMemo(
    () => [
      { id: 'health', label: 'Health', render: (props?: any) => <HealthPanel {...props} /> }
    ],
    []
  );

  const [visible, setVisible] = useState<Record<string, boolean>>({
    health: true
  });
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const [layout, setLayout] = useState<Layout[]>([
    { i: 'health', x: 0, y: 0, w: 3, h: 8, minW: 2, minH: 2, maxW: 12, isResizable: true }
  ]);

  const togglePanel = (id: string): void => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activePanels = panels.filter((panel) => visible[panel.id]);

  const handleCollapseChange = (id: string, collapsed: boolean): void => {
    setLayout((prev) =>
      prev.map((entry) =>
        entry.i === id
          ? {
              ...entry,
              h: collapsed ? 2 : 8,
              minH: collapsed ? 2 : 2,
              maxH: collapsed ? 2 : undefined,
              isResizable: true,
              resizeHandles: collapsed ? ['e'] : ['se']
            }
          : entry
      )
    );
  };

  return (
    <div className="w-full min-h-screen">
      <header className="w-full bg-gradient-to-r from-[#132852b3] to-[#091226e6] border-b border-[rgba(80,140,255,0.18)] shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div className="max-w-[100rem] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-lg font-extrabold tracking-wide text-[#eaf1ff]">Demo Project</div>
          <div className="relative">
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[#dbe7ff] font-semibold tracking-wide hover:bg-white/10 hover:border-[rgba(80,140,255,0.35)] transition"
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
            >
              Panels
              <span className="text-sm">{isDropdownOpen ? '▴' : '▾'}</span>
            </button>
            {isDropdownOpen ? (
              <div className="absolute right-0 mt-2 bg-[#0a1220f2] border border-[rgba(80,140,255,0.25)] rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.45)] p-3 min-w-[200px] z-10">
                {panels.map((panel) => (
                  <label className="flex items-center gap-3 py-2 px-1 text-[#dbe7ff] cursor-pointer" key={panel.id}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-[#4bd6a8]"
                      checked={visible[panel.id]}
                      onChange={() => togglePanel(panel.id)}
                    />
                    <span>{panel.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="bg-transparent">
        <div className="max-w-[100rem] mx-auto px-6 py-10">
          {activePanels.length === 0 ? (
            <div className="text-center text-[#7d8caf] font-semibold py-8">No panels selected</div>
          ) : (
            <ResponsiveGrid
              className="layout"
              layout={layout.filter((l) => visible[l.i])}
              cols={12}
              rowHeight={30}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              isResizable
              draggableHandle=".panel-drag-handle"
              draggableCancel=".panel-toggle"
              resizeHandles={['se']}
              compactType={null}
              verticalCompact={false}
              isBounded={false}
              resizeHandle={resizeHandle}
              onLayoutChange={(newLayout: Layout[]) =>
                setLayout((prev) =>
                  newLayout.map((item) => {
                    const prevItem = prev.find((p) => p.i === item.i);
                    return {
                      ...item,
                      isResizable: prevItem?.isResizable ?? item.isResizable,
                      minH: prevItem?.minH ?? item.minH,
                      maxH: prevItem?.maxH ?? item.maxH,
                      resizeHandles: prevItem?.resizeHandles ?? item.resizeHandles
                    };
                  })
                )
              }
            >
              {activePanels.map((panel) => (
                <div
                  key={panel.id}
                  data-grid={
                    layout.find((l) => l.i === panel.id) ?? {
                      x: 0,
                      y: 0,
                      w: 3,
                      h: 8,
                      minW: 2,
                      minH: 2,
                      maxW: 12,
                      isResizable: true,
                      resizeHandles: ['se']
                    }
                  }
                  className="resizable-item min-w-[18rem] h-full"
                >
                  {panel.render({
                    onCollapseChange: (collapsed: boolean) => handleCollapseChange(panel.id, collapsed)
                  })}
                </div>
              ))}
            </ResponsiveGrid>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
