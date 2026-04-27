import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const pseudo = String(formData.get('pseudo') || '');
    const password = String(formData.get('password') || '');
    const email = isLoginTab ? '' : String(formData.get('email') || '');

    const endpoint = isLoginTab ? '/auth/login' : '/auth/register';
    const body = isLoginTab ? { pseudo, password } : { pseudo, password, email };

    try {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error}`);
        return;
      }

      const data = await response.json();
      
      if (data.token && data.user) {
        login(data.token, data.user);
        navigate('/mes-salons'); // Redirection vers l'historique ou accueil
      }
    } catch (error) {
      console.error('Erreur authentification:', error);
      alert('Erreur lors de la communication avec le serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-sky-950 text-white">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="bg-gray-900 p-8 rounded-lg shadow-lg text-center max-w-md w-full border border-gray-800">
          
          <div className="flex mb-6 border-b border-gray-700">
            <button
              className={`flex-1 py-2 font-semibold ${isLoginTab ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setIsLoginTab(true)}
            >
              Connexion
            </button>
            <button
              className={`flex-1 py-2 font-semibold ${!isLoginTab ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setIsLoginTab(false)}
            >
              Inscription
            </button>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isLoginTab ? 'Connexion' : 'Créer un compte'}
          </h1>
          <p className="text-gray-400 mb-6">
            {isLoginTab 
              ? 'Connectez-vous pour retrouver vos salons' 
              : 'Rejoignez WatchNotAlone'}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              name="pseudo"
              placeholder="Pseudo"
              className="input-room"
              required
            />
            {!isLoginTab && (
              <input
                type="email"
                name="email"
                placeholder="Email"
                className="input-room"
                required
              />
            )}
            <input
              type="password"
              name="password"
              placeholder="Mot de passe"
              className="input-room"
              required
            />
            <button type="submit" disabled={loading} className="button-submit mt-2">
              {loading 
                ? 'Chargement...' 
                : (isLoginTab ? 'Se connecter' : 'S\'inscrire')}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
