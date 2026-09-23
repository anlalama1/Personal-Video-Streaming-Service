import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Database, UploadCloud, Library as LibraryIcon, ClipboardCheck, LogOut } from 'lucide-react';
import Ingestion from './pages/Ingestion';
import Library from './pages/Library';
import ReviewBoard from './pages/ReviewBoard';
import { UploadProvider } from './context/UploadContext';
import UploadDrawer from './components/UploadDrawer';
import Auth from './pages/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <UploadProvider>
        <Router basename="/admin">
          <AppContent />
        </Router>
      </UploadProvider>
    </AuthProvider>
  );
}

const AppContent = () => {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return <div className="h-screen bg-heritage-black flex items-center justify-center text-heritage-gold font-black uppercase tracking-[0.3em] animate-pulse text-sm">Initializing Demetrius...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="flex h-screen bg-heritage-black text-heritage-parchment">
      {/* Sidebar */}
      <aside className="w-64 bg-heritage-900 border-r border-heritage-800 p-6 flex flex-col">
            <div className="flex flex-col gap-4 mb-10 px-2">
              <Link to="/home" className="flex items-center group">
                <img src="/logo_flat.png" alt="Alexandria+ Logo" className="h-[52px] w-auto group-hover:scale-105 transition-transform translate-x-[3px] translate-y-[1px]" />
                <h1 className="text-xl font-black tracking-tighter text-heritage-parchment uppercase -ml-[12px]">Lexandria+</h1>
              </Link>
              <span className="text-[10px] font-black block text-heritage-400 tracking-[0.2em]">Demetrius Portal</span>
            </div>

            <nav className="space-y-2 flex-1">
              <Link to="/home" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-800 transition-colors font-bold text-sm">
                <UploadCloud size={20} className="text-heritage-gold" />
                <span>Ingestion</span>
              </Link>
              <Link to="/review" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-800 transition-colors font-bold text-sm">
                <ClipboardCheck size={20} className="text-heritage-gold" />
                <span>Review Board</span>
              </Link>
              <Link to="/library" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-800 transition-colors font-bold text-sm">
                <LibraryIcon size={20} className="text-heritage-gold" />
                <span>Library</span>
              </Link>
            </nav>

            <div className="mt-auto pt-10">
                <button
                  onClick={() => window.confirm('Exit the Demetrius Portal?') && signOut()}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-sunset/10 text-heritage-400 hover:text-heritage-sunset transition-colors font-bold text-sm w-full"
                >
                  <LogOut size={20} />
                  <span>Log Out</span>
                </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-10">
            <Routes>
              <Route path="/home" element={<Ingestion />} />
              <Route path="/review" element={<ReviewBoard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Routes>
          </main>

          <UploadDrawer />
        </div>
  );
};

export default App;
