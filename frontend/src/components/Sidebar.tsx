import { Link } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="w-40 bg-gray-800 flex flex-col border-r border-gray-700 px-4 pb-5 pt-10 space-y-8">
      {/* boutons d'action du salon */}
      <Link to="/room" className="w-full text-center bg-gray-900 font-semibold font-ibm hover:bg-blue-900 py-2 rounded">
        Accueil
      </Link>
      <button className="w-full bg-gray-900 font-semibold font-ibm hover:bg-blue-900 py-2 rounded">
        Inviter
      </button>
      <button className="w-full bg-gray-900 font-semibold font-ibm hover:bg-blue-900 py-2 rounded">
        Autorisations
      </button>
      <button className="w-full bg-gray-900 font-semibold font-ibm hover:bg-blue-900 py-2 rounded">
        Paramètres
      </button>
      <button className="w-full bg-gray-900 font-semibold font-ibm hover:bg-blue-900 py-2 rounded">
        Aide
      </button>

      <hr className="border-gray-700" />

      {/* liens de navigation */}
      <nav className="flex flex-col space-y-4 text-sm text-gray-400">
        <Link to="/" className="hover:underline font-ibm">Accueil</Link>
        <Link to="/a-propos" className="hover:underline font-ibm">A propos</Link>
        <Link to="/contact" className="hover:underline font-ibm">Contact</Link>
        <Link to="/mentions-legales" className="hover:underline font-ibm">Mentions légales</Link>
      </nav>
    </aside>
  );
}

