// frontend/pages/DashboardPage.tsx
import { useMemo, useState } from 'react';
import HealthPanel from '../features/dashboard/panels/HealthPanel.js';
import PageHeader from '../features/dashboard/components/PageHeader.js';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGrid = WidthProvider(GridLayout);
const resizeHandle = (
  <span className="custom-resize-handle" aria-label="Resize panel" />
);

const applyCollapsedLayout = (entry: Layout, isCollapsed: boolean): Layout =>
  isCollapsed
    ? { ...entry, h: 2, minH: 2, maxH: 2, resizeHandles: ['e'], isResizable: true }
    : {
        ...entry,
        minH: entry.minH ?? 2,
        maxH: entry.maxH,
        resizeHandles: entry.resizeHandles ?? ['se'],
        isResizable: entry.isResizable ?? true
      };

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    health: false
  });

  const [layout, setLayout] = useState<Layout[]>([
    { i: 'health', x: 0, y: 0, w: 3, h: 8, minW: 2, minH: 2, maxW: 12, isResizable: true }
  ]);

  const togglePanel = (id: string): void => {
    setVisible((prev) => {
      const nextVisible = !prev[id];
      if (nextVisible) {
        setLayout((prevLayout) =>
          prevLayout.map((entry) =>
            entry.i === id ? applyCollapsedLayout(entry, collapsed[id] ?? false) : entry
          )
        );
      }
      return { ...prev, [id]: nextVisible };
    });
  };

  const activePanels = panels.filter((panel) => visible[panel.id]);

  const handleCollapseChange = (id: string, collapsed: boolean): void => {
    setCollapsed((prev) => ({ ...prev, [id]: collapsed }));
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
      <PageHeader title="Demo Project" panels={panels} visible={visible} onTogglePanel={togglePanel} />

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
                setLayout((prev) => {
                  const mergedVisible = newLayout.map((item) => {
                    const prevItem = prev.find((p) => p.i === item.i);
                    return {
                      ...item,
                      isResizable: prevItem?.isResizable ?? item.isResizable,
                      minH: prevItem?.minH ?? item.minH,
                      maxH: prevItem?.maxH ?? item.maxH,
                      resizeHandles: prevItem?.resizeHandles ?? item.resizeHandles
                    };
                  });
                  const stillHidden = prev.filter((p) => !newLayout.find((n) => n.i === p.i));
                  return [...mergedVisible, ...stillHidden];
                })
              }
            >
              {activePanels.map((panel) => (
                <div
                  key={panel.id}
                  data-grid={applyCollapsedLayout(
                    layout.find((l) => l.i === panel.id) ?? {
                      i: panel.id,
                      x: 0,
                      y: 0,
                      w: 3,
                      h: 8,
                      minW: 2,
                      minH: 2,
                      maxW: 12,
                      isResizable: true
                    },
                    collapsed[panel.id] ?? false
                  )}
                  className="resizable-item min-w-[18rem] h-full"
                >
                  {panel.render({
                    collapsed: collapsed[panel.id] ?? false,
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
