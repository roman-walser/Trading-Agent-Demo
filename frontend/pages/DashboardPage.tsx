// frontend/pages/DashboardPage.tsx
import HealthPanel from '../features/dashboard/panels/HealthPanel.js';
import '../styles/dashboard.css';
import '../styles/panel.css';

export const DashboardPage = (): JSX.Element => {
  return (
    <div className="app-shell">
      <div className="dashboard__container">
        <div className="dashboard">
          <HealthPanel />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
