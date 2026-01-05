// frontend/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './pages/DashboardPage.js';
import './styles/tailwind.css';
import { fetchUiLayout } from './api/routes/uiLayout.api.js';
import { hydrateUiLayoutFromSnapshot } from './state/store.js';

const queryClient = new QueryClient();
const UI_LAYOUT_PRELOAD_TIMEOUT_MS = 4000;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

const preloadUiLayout = async (): Promise<void> => {
  try {
    const layoutSnapshot = await fetchUiLayout({ timeoutMs: UI_LAYOUT_PRELOAD_TIMEOUT_MS });
    hydrateUiLayoutFromSnapshot(layoutSnapshot);
    queryClient.setQueryData(['ui-layout'], layoutSnapshot);
  } catch (error) {
    // If layout fetch fails or times out, we still render with whatever local state/cache we have.
    console.error('Failed to preload UI layout', error);
  }
};

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <DashboardPage />
  </QueryClientProvider>
);

void preloadUiLayout();
