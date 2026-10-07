import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import PlayersPage from './pages/PlayersPage.jsx';
import PlayerFormPage from './pages/PlayerFormPage.jsx';
import PlayerDetailPage from './pages/PlayerDetailPage.jsx';
import TeamsPage from './pages/TeamsPage.jsx';
import TeamFormPage from './pages/TeamFormPage.jsx';
import TeamDashboardPage from './pages/TeamDashboardPage.jsx';
import CaptainsPage from './pages/CaptainsPage.jsx';
import AuctionPage from './pages/AuctionPage.jsx';
import LiveDisplayPage from './pages/LiveDisplayPage.jsx';
import PoolPage from './pages/PoolPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import RoundsPage from './pages/RoundsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public big-screen display for the audience (read-only, live via Socket.IO) */}
      <Route path="/live" element={<LiveDisplayPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/auction" element={<AuctionPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/new" element={<PlayerFormPage />} />
          <Route path="/players/:id" element={<PlayerDetailPage />} />
          <Route path="/players/:id/edit" element={<PlayerFormPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/new" element={<TeamFormPage />} />
          <Route path="/teams/:id" element={<TeamDashboardPage />} />
          <Route path="/teams/:id/edit" element={<TeamFormPage />} />
          <Route path="/captains" element={<CaptainsPage />} />
          <Route path="/pool" element={<PoolPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/rounds" element={<RoundsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
