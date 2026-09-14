import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PlayerPage from './pages/PlayerPage';
import MediaDetails from './pages/MediaDetails';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/details" element={<MediaDetails />} />
          <Route path="/player" element={<PlayerPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
