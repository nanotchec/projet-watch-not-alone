import React, { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

interface ReconnectResponse {
  salon: {
    nom: string;
    code_partage: string;
  };
  user: {
    pseudo: string;
  };
  participation: {
    role: 'HOST' | 'MEMBER';
  };
}

interface ErrorResponse {
  error: string;
}

export default function Reconnexion() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const pseudo = String(formData.get('pseudo') || '');
    const password = String(formData.get('password') || '');

    try {
      const response = await fetch('/salon/reconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pseudo, password }),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        alert(`Erreur: ${errorData.error}`);
        return;
      }

      const data: ReconnectResponse = await response.json();
      navigate(`/room/${data.salon.code_partage}`, {
        state: {
          salonName: data.salon.nom,
          userPseudo: data.user.pseudo,
          codePartage: data.salon.code_partage,
          isHost: data.participation.role === 'HOST',
        },
      });
    } catch (error) {
      console.error('Erreur reconnexion:', error);
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
          <h1 className="text-4xl font-bold text-white mb-2">Reconnexion</h1>
          <p className="text-gray-400 mb-6">
            Entrez votre pseudo existant et le mot de passe guest ou test (minuscule)
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              name="pseudo"
              placeholder="Pseudo"
              className="input-room"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Mot de passe (guest/test)"
              className="input-room"
              required
            />
            <button type="submit" disabled={loading} className="button-submit">
              {loading ? 'Connexion...' : 'Se reconnecter'}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
