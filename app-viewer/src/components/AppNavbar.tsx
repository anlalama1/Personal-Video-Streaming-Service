import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Library } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  // Hide navbar in the player for full-screen immersion
  if (location.pathname === '/player') return null;

  return (
    <nav className="fixed top-0 w-full z-50 bg-heritage-black/80 backdrop-blur-md border-b border-heritage-parchment/10 p-4 lg:p-6 flex items-center justify-between px-8 lg:px-12 transition-all">
      <Link to="/" className="flex items-center group">
        <img src="/logo_flat.png" alt="Alexandria+ Logo" className="h-[52px] w-auto group-hover:scale-105 transition-transform translate-x-[3px] translate-y-[1px]" />
        <h1 className="text-2xl font-black tracking-tighter text-heritage-parchment uppercase hidden sm:block -ml-[12px]">Lexandria+</h1>
      </Link>

      <div className="flex items-center gap-8 text-sm font-black uppercase tracking-widest text-heritage-400">
          <Link to="/" className="cursor-pointer hover:text-heritage-parchment transition-colors">Home</Link>
          <span className="cursor-pointer hover:text-heritage-parchment transition-colors opacity-50 cursor-not-allowed">Movies</span>
          <span className="cursor-pointer hover:text-heritage-parchment transition-colors opacity-50 cursor-not-allowed">Music</span>
          <div
            onClick={() => window.confirm('Sign out of the Heritage Vault?') && signOut()}
            className="w-9 h-9 rounded-full bg-heritage-gold flex items-center justify-center text-heritage-black text-xs font-black shadow-lg shadow-heritage-gold/20 cursor-pointer hover:scale-105 transition-all"
          >
            AL
          </div>
      </div>
    </nav>
  );
};

export default Navbar;
