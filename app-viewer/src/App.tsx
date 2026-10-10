/**
 * ============================================================================
 * Desktop Viewer Application Shell & React Router Engine
 * ============================================================================
 * Enterprise Architecture Strategy: Authenticated Layout Router.
 * Encapsulates global AuthProvider & UploadProvider contexts, managing full-page
 * authentication gates and top-level navigation routes for 'The Scroll' Desktop Viewer.
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import MediaDetails from './pages/MediaDetails';
import ConsumerUpload from './pages/ConsumerUpload';
import Auth from './pages/Auth';
import VaultOnboarding from './pages/VaultOnboarding';
import VaultAdmin from './pages/VaultAdmin';
import Navbar from './components/AppNavbar';
import UploadDrawer from './components/UploadDrawer';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';

function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <Router>
          <AppContent />
        </Router>
      </UploadProvider>
    </AuthProvider>
  );
}

/**
 * App Content Component enforcing authentication gates and layout wrappers.
 */
const AppContent = () => {
  const { user, userProfile, loading, signOut } = useAuth();

  // Render initial loading pulse while checking Cognito session
  if (loading) {
    return <div className="h-screen bg-heritage-black flex items-center justify-center text-heritage-gold font-black uppercase tracking-[0.3em] animate-pulse text-sm">Initializing Heritage Vault...</div>;
  }

  // Enforce auth gate: Render Auth screen if user is unauthenticated
  if (!user) {
    return <Auth />;
  }

  if (!userProfile.familyId) {
    return <VaultOnboarding />;
  }

  if (!userProfile.isApproved && !userProfile.isAdmin) {
    return (
      <div className="min-h-screen bg-heritage-black text-heritage-parchment flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-black uppercase text-heritage-gold">Access Pending</h1>
        <p className="max-w-md text-heritage-400">
          A Family Vault administrator must approve your membership before you can view the catalog.
        </p>
        <button onClick={() => void signOut()} className="rounded-xl bg-heritage-gold px-5 py-3 font-black text-heritage-black">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-heritage-black text-heritage-parchment selection:bg-heritage-gold selection:text-heritage-black">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<ConsumerUpload />} />
        <Route path="/details" element={<MediaDetails />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/vault-admin" element={<VaultAdmin />} />
      </Routes>
      <UploadDrawer />
    </div>
  );
}

export default App;
