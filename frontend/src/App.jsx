import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/loginpage.jsx';
import DashboardPage from './pages/dashboardpage.jsx';
import MainCardDetailPage from './pages/maincarddetailpage.jsx'; // <-- Import new page
import ChatPage from './pages/chatpage.jsx';
import ProtectedRoute from './components/protectedroute.jsx';

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

