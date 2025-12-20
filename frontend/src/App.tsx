import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import APropos from './pages/APropos';
import Contact from './pages/Contact';
import MentionsLegales from './pages/MentionsLegales';
import CreationRoom from './pages/CreationApp';

//application react
function App() {
  return (
    //configuration des routes de l'app
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room" element={<Room />} />
      <Route path="/creation" element={<CreationRoom/>}/>
      <Route path="/a-propos" element={<APropos />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
    </Routes>
  );
}

export default App;
