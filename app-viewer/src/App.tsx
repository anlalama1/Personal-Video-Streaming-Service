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

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen bg-heritage-black flex items-center justify-center text-heritage-gold font-black uppercase tracking-[0.3em] animate-pulse text-sm">Initializing Heritage Vault...</div>;
  }

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
