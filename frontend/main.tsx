// frontend/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './pages/DashboardPage.js';
import './styles/tailwind.css';
import { fetchUiLayout } from './api/routes/uiLayout.api.js';
import { hydrateUiLayoutFromSnapshot } from './state/store.js';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

const bootstrap = async (): Promise<void> => {
  try {
    const layoutSnapshot = await fetchUiLayout();
    hydrateUiLayoutFromSnapshot(layoutSnapshot);
    queryClient.setQueryData(['ui-layout'], layoutSnapshot);
  } catch (error) {
    // If layout fetch fails, we still render with whatever local state/cache we have.
    console.error('Failed to preload UI layout', error);
  }

  ReactDOM.createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
};

void bootstrap();
