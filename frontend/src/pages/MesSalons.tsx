import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

interface Salon {
  id_salon: number;
  nom: string;
  code_partage: string;
  cree_le: string;
}

export default function MesSalons() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) {
      navigate('/auth');
      return;
    }

    const fetchSalons = async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || '/api';
        const response = await fetch(`${baseUrl}/auth/mes-salons`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSalons(data.salons || []);
        } else {
          console.error('Erreur lors de la récupération des salons');
        }
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSalons();
  }, [user, token, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-sky-950 text-white">
      <Header />
      <main className="flex flex-1 flex-col items-center p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-4xl font-bold font-anton mb-8 w-full text-left">Mes Salons</h1>
        
        {loading ? (
          <p className="text-gray-400">Chargement de votre historique...</p>
        ) : salons.length === 0 ? (
          <div className="bg-gray-900 p-8 rounded-lg shadow-lg text-center w-full border border-gray-800">
            <p className="text-gray-400 mb-4">Vous n'avez participé à aucun salon pour le moment.</p>
            <button 
              onClick={() => navigate('/creation')}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-bold transition"
            >
              Créer un salon
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {salons.map(salon => (
              <div key={salon.id_salon} className="bg-gray-900 p-6 rounded-lg border border-gray-700 flex flex-col justify-between hover:border-gray-500 transition">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{salon.nom}</h2>
                  <p className="text-sm text-gray-400 mb-4">Code : <span className="text-blue-400 font-mono">{salon.code_partage}</span></p>
                  <p className="text-xs text-gray-500 mb-4">Créé le {new Date(salon.cree_le).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => navigate(`/room/${salon.code_partage}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-bold mt-auto"
                >
                  Rejoindre
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
