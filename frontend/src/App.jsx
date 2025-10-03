import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MainCardDetailPage from './pages/MainCardDetailPage.jsx'; // <-- Import new page
import ChatPage from './pages/ChatPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        {/* --- NEW: Route for the Main Card detail page --- */}
        <Route path="/main-card/:mainCardId" element={<MainCardDetailPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
      </Route>
    </Routes>
  );
}

export default App;

