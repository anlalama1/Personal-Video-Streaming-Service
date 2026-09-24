/**
 * ============================================================================
 * Desktop Viewer Header Navigation Bar & Account Profile Modal
 * ============================================================================
 * Enterprise Architecture Strategy: Responsive Header & Identity Display.
 * Serves as global layout navigation header featuring "Logo-as-a-Letter" lockup,
 * route hiding during video playback, and an interactive Account Details Modal
 * displaying authenticated email and Family Vault Partition Code.
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, LogOut, Key, Mail, ShieldCheck, X, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const { userProfile, signOut } = useAuth();
  const [showAccountModal, setShowAccountModal] = useState(false);

  // Hide navbar in the player for full-screen cinematic immersion
  if (location.pathname === '/player') return null;

  const displayInitial = userProfile.email
    ? userProfile.email.charAt(0).toUpperCase()
    : 'U';

  /**
   * Copies the active Family Vault Partition Key to the user's clipboard.
   */
  const handleCopyFamilyCode = () => {
    if (userProfile.familyId) {
      navigator.clipboard.writeText(userProfile.familyId);
      alert(`Copied Family Vault Code (${userProfile.familyId}) to clipboard!`);
    }
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-40 bg-heritage-black/80 backdrop-blur-md border-b border-heritage-parchment/10 p-4 lg:p-6 flex items-center justify-between px-8 lg:px-12 transition-all">
        {/* Brand Lockup */}
        <Link to="/" className="flex items-center group">
          <img src="/logo_flat.png" alt="Alexandria+ Logo" className="h-[52px] w-auto group-hover:scale-105 transition-transform translate-x-[3px] translate-y-[1px]" />
          <h1 className="text-2xl font-black tracking-tighter text-heritage-parchment uppercase hidden sm:block -ml-[12px]">Lexandria+</h1>
        </Link>

        {/* Global Links & Account Avatar */}
        <div className="flex items-center gap-8 text-sm font-black uppercase tracking-widest text-heritage-400">
            <Link to="/" className="cursor-pointer hover:text-heritage-parchment transition-colors">Home</Link>
            <span className="cursor-pointer hover:text-heritage-parchment transition-colors opacity-50 cursor-not-allowed">Movies</span>
            <span className="cursor-pointer hover:text-heritage-parchment transition-colors opacity-50 cursor-not-allowed">Music</span>

            {/* Account Button Trigger */}
            <button
              onClick={() => setShowAccountModal(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-heritage-gold to-heritage-sunset flex items-center justify-center text-heritage-black text-sm font-black shadow-lg shadow-heritage-gold/20 hover:scale-105 transition-all cursor-pointer border border-heritage-gold/30"
              title="Account Details"
            >
              {displayInitial}
            </button>
        </div>
      </nav>

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
                <h3 className="text-xl font-black text-heritage-parchment uppercase tracking-tight">Family Vault Member</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-heritage-gold bg-heritage-gold/10 px-2 py-0.5 rounded border border-heritage-gold/20 inline-block mt-0.5">
                  Authenticated User
                </span>
              </div>
            </div>

            <div className="bg-heritage-black/70 border border-heritage-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                  <Mail size={12} className="text-heritage-gold" />
                  Authenticated Email
                </span>
                <p className="text-heritage-parchment font-bold break-all select-all text-sm">
                  {userProfile.email || 'Loading...'}
                </p>
              </div>

              {userProfile.familyId && (
                <div className="pt-2 border-t border-heritage-800/80 space-y-1">
                  <span className="text-[10px] font-sans font-black uppercase tracking-wider text-heritage-400 flex items-center gap-1.5">
                    <Key size={12} className="text-heritage-gold" />
                    Family Vault Partition
                  </span>
                  <div className="flex items-center justify-between text-heritage-gold font-bold">
                    <span className="select-all tracking-wider text-sm">{userProfile.familyId}</span>
                    <button
                      onClick={handleCopyFamilyCode}
                      className="text-[10px] font-sans bg-heritage-gold/10 border border-heritage-gold/30 text-heritage-gold px-2 py-1 rounded hover:bg-heritage-gold/20 transition-all flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy
                    </button>
                  </div>
                </div>
              )}
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
    </>
  );
};

export default Navbar;
