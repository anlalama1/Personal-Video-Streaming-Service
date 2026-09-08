import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Database, UploadCloud, Library as LibraryIcon } from 'lucide-react';
import Ingestion from './pages/Ingestion';
import Library from './pages/Library';
import { UploadProvider } from './context/UploadContext';
import UploadDrawer from './components/UploadDrawer';

function App() {
  return (
    <UploadProvider>
      <Router basename="/admin">
        <div className="flex h-screen bg-slate-900 text-slate-100">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-10 px-2">
              <Database className="text-blue-400 w-8 h-8" />
              <h1 className="text-xl font-bold tracking-tight">Alexandria+ <span className="text-sm font-light block text-slate-400">Demetrius Portal</span></h1>
            </div>

            <nav className="space-y-2">
              <Link to="/home" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors">
                <UploadCloud size={20} />
                <span>Ingestion</span>
              </Link>
              <Link to="/library" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-700 transition-colors">
                <LibraryIcon size={20} />
                <span>Library</span>
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-10">
            <Routes>
              <Route path="/home" element={<Ingestion />} />
              <Route path="/library" element={<Library />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
            </Routes>
          </main>

          <UploadDrawer />
        </div>
      </Router>
    </UploadProvider>
  );
}

export default App;
