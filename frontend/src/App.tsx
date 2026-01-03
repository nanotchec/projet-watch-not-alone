import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import APropos from './pages/APropos';
import Contact from './pages/Contact';
import MentionsLegales from './pages/MentionsLegales';
import CreationRoom from './pages/CreationApp';

// Application React
function App() {
  return (
    // Configuration des routes de l'app
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room" element={<Room />} /> {/* Pour les tests sans code */}
      <Route path="/room/:code" element={<Room />} /> {/* ✅ Route dynamique avec code */}
      <Route path="/creation" element={<CreationRoom />} />
      <Route path="/a-propos" element={<APropos />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
    </Routes>
  );
}

export default App;