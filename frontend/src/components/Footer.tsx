import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-800 border-t border-gray-700 p-4">
      {/* liens de navigation du footer */}
      <nav className="flex justify-center space-x-6 text-sm text-gray-400">
        <Link to="/a-propos" className="hover:underline font-ibm">À propos</Link>
        <Link to="/contact" className="hover:underline font-ibm">Contact</Link>
        <Link to="/mentions-legales" className="hover:underline font-ibm">Mentions légales</Link>
      </nav>
    </footer>
  );
}

