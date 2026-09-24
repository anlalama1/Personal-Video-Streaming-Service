import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Database, UploadCloud, Library as LibraryIcon, ClipboardCheck, LogOut, Users, Building2, Mail, ShieldCheck, X } from 'lucide-react';
import Ingestion from './pages/Ingestion';
import Library from './pages/Library';
import ReviewBoard from './pages/ReviewBoard';
import Tenants from './pages/Tenants';
import { UploadProvider } from './context/UploadContext';
import { TenantProvider } from './context/TenantContext';
import UploadDrawer from './components/UploadDrawer';
import Auth from './pages/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <UploadProvider>
          <Router basename="/admin">
            <AppContent />
          </Router>
        </UploadProvider>
      </TenantProvider>
    </AuthProvider>
  );
}

const AppContent = () => {
  const { user, userProfile, loading, signOut } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);

  if (loading) {
    return <div className="h-screen bg-heritage-black flex items-center justify-center text-heritage-gold font-black uppercase tracking-[0.3em] animate-pulse text-sm">Initializing Demetrius...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  const displayInitial = userProfile.email
    ? userProfile.email.charAt(0).toUpperCase()
    : 'S';

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
          <Link to="/tenants" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-800 transition-colors font-bold text-sm">
            <Users size={20} className="text-heritage-gold" />
            <span>Family Tenants</span>
          </Link>
          <Link to="/library" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-heritage-800 transition-colors font-bold text-sm">
            <LibraryIcon size={20} className="text-heritage-gold" />
            <span>Library</span>
          </Link>
        </nav>

        <div className="mt-auto pt-6 border-t border-heritage-800/80 space-y-3">
          {/* Operator Profile Badge */}
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-3 p-3 rounded-xl bg-heritage-black/60 border border-heritage-800 hover:border-heritage-gold/50 transition-all text-left w-full group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-heritage-gold to-heritage-sunset flex items-center justify-center text-heritage-black text-xs font-black shadow-md shrink-0">
              {displayInitial}
            </div>
            <div className="overflow-hidden flex-1">
              <span className="text-[10px] font-black uppercase text-heritage-gold block tracking-wider truncate">Operator Profile</span>
              <span className="text-xs text-heritage-parchment font-bold truncate block group-hover:text-heritage-gold transition-colors">
                {userProfile.email || 'Shop Operator'}
              </span>
            </div>
          </button>

          <button
            onClick={() => window.confirm('Exit the Demetrius Portal?') && signOut()}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-heritage-sunset/10 text-heritage-400 hover:text-heritage-sunset transition-colors font-bold text-xs w-full uppercase tracking-wider"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-heritage-900/60 border-b border-heritage-800/80 px-10 py-4 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold text-heritage-400">
            <Building2 size={16} className="text-heritage-gold" />
            <span>Digitization Shop Operator Portal</span>
          </div>

          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 bg-heritage-black border border-heritage-800 hover:border-heritage-gold/50 px-3.5 py-2 rounded-xl text-xs font-bold text-heritage-parchment transition-all hover:scale-102"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black text-[10px] flex items-center justify-center">
              {displayInitial}
            </div>
            <span className="truncate max-w-[160px]">{userProfile.email || 'Account'}</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-10">
          <Routes>
            <Route path="/home" element={<Ingestion />} />
            <Route path="/review" element={<ReviewBoard />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/library" element={<Library />} />
            <Route path="/" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>

      <UploadDrawer />

      {/* Account Details Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-heritage-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-heritage-900 border border-heritage-800 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowAccountModal(false)}
              className="absolute top-6 right-6 text-heritage-400 hover:text-heritage-parchment transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-heritage-gold to-heritage-sunset text-heritage-black font-black text-2xl flex items-center justify-center shadow-xl">
                {displayInitial}
              </div>
              <div>
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">Shop Operator</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20 inline-block mt-0.5">
                  Demetrius Portal Admin
                </span>
              </div>
            </div>

            <div className="bg-heritage-black/70 border border-heritage-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-heritage-gold" />
                  Authenticated Operator Email
                </span>
                <p className="text-heritage-parchment font-bold break-all select-all text-sm">
                  {userProfile.email || 'Loading...'}
                </p>
              </div>

              <div className="pt-2 border-t border-heritage-800/80 space-y-1">
                <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-heritage-gold" />
                  System Partition Scope
                </span>
                <p className="text-heritage-gold font-bold text-sm tracking-wide">
                  GLOBAL / Multi-Tenant Preservation Scope
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowAccountModal(false)}
                className="flex-1 bg-heritage-black border border-heritage-800 text-heritage-400 font-bold py-3.5 rounded-xl hover:bg-heritage-800 transition-colors uppercase text-xs tracking-wider"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowAccountModal(false);
                  signOut();
                }}
                className="flex-1 bg-heritage-sunset/10 border border-heritage-sunset/30 text-heritage-sunset hover:bg-heritage-sunset/20 font-black py-3.5 rounded-xl transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
