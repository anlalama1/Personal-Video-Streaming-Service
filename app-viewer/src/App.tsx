/**
 * ============================================================================
 * Desktop Viewer Application Shell & React Router Engine
 * ============================================================================
 * Enterprise Architecture Strategy: Authenticated Layout Router.
 * Encapsulates global AuthProvider context, managing full-page authentication
 * gates and top-level navigation routes for 'The Scroll' Desktop Viewer.
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import MediaDetails from './pages/MediaDetails';
import Auth from './pages/Auth';
import Navbar from './components/AppNavbar';
import { AuthProvider, useAuth } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

/**
 * App Content Component enforcing authentication gates and layout wrappers.
 */
const AppContent = () => {
  const { user, loading } = useAuth();

  // Render initial loading pulse while checking Cognito session
  if (loading) {
    return <div className="h-screen bg-heritage-black flex items-center justify-center text-heritage-gold font-black uppercase tracking-[0.3em] animate-pulse text-sm">Initializing Heritage Vault...</div>;
  }

  // Enforce auth gate: Render Auth screen if user is unauthenticated
  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-heritage-black text-heritage-parchment selection:bg-heritage-gold selection:text-heritage-black">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/details" element={<MediaDetails />} />
        <Route path="/player" element={<PlayerPage />} />
      </Routes>
    </div>
  );
}

export default App;
