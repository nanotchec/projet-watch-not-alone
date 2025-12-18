import React, { useState, FormEvent } from 'react';

interface SalonResponse {
  salon: {
    nom: string;
    code_partage: string;
  };
}

interface ErrorResponse {
  error: string;
}

type Mode = 'create' | 'join';

const SalonApp: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false); // état de chargement
  const [mode, setMode] = useState<Mode>('create'); // 'create' ou 'join'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    // asynchrone car attend une réponse du serveur
    e.preventDefault(); // la page ne se recharge pas lors du submit
    setLoading(true); // indicateur de chargement

    const formData = new FormData(e.currentTarget);

    try {
      let response: Response;

      if (mode === 'create') {
        const roomName = formData.get('room-name') as string;
        const userName = formData.get('user-name') as string;

        response = await fetch('http://localhost:3000/salon/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // demande au serveur de créer un salon avec le nom et pseudo que l'utilisateur a entré
            nom: roomName,
            pseudo: userName,
          }),
        });
      } else {
        const codePartage = formData.get('code-partage') as string;
        const userName = formData.get('user-name') as string;

        response = await fetch('http://localhost:3000/salon/join', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // sinon, c'est une demande de rejoindre un salon existant avec le code et pseudo
            codePartage: codePartage,
            pseudo: userName,
          }),
        });
      }

      if (!response.ok) {
        const error: ErrorResponse = await response.json();
        // si une erreur s'est produite, on la récupère et on l'affiche
        alert(`Erreur: ${error.error}`);
        return;
      }

      const data: SalonResponse = await response.json();

      if (mode === 'create') {
        // affiche le code du salon créé
        alert(`Salon créé avec succès! Code: ${data.salon.code_partage}`);
      } else {
        // affiche un message de succès pour rejoindre
        alert(`Vous avez rejoint le salon "${data.salon.nom}" avec succès!`);
      }
    } catch (error) {
      console.error('Erreur:', error); // log de l'erreur pour debug
      alert('Erreur lors de la communication avec le serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    // rendu html du form pour créer ou rejoindre
    <div className="min-h-screen flex items-center justify-center bg-sky-950">
      <div className="bg-gray-900 p-8 rounded-lg shadow-lg text-center max-w-md w-full">
        <h1 className="text-4xl font-bold text-white mb-2">
          {mode === 'create' ? 'Création de salon' : 'Rejoindre un salon'}
        </h1>
        <p className="text-gray-400 mb-6">
          {mode === 'create' ? 'Créez votre propre salon' : 'Entrez le code du salon'}
        </p>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${mode === 'create'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors ${mode === 'join'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            Rejoindre
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'create' ? (
            <input
              type="text"
              name="room-name"
              placeholder="Nom du salon"
              className="p-2 rounded-lg w-full text-white bg-gray-800 border border-gray-700 mb-4"
              required
            />
          ) : (
            <input
              type="text"
              name="code-partage"
              placeholder="Code du salon (6 caractères)"
              maxLength={6}
              className="p-2 rounded-lg w-full text-white bg-gray-800 border border-gray-700 mb-4"
              required
            />
          )}

          <input
            type="text"
            name="user-name"
            placeholder="Votre pseudo"
            className="p-2 rounded-lg w-full text-white bg-gray-800 border border-gray-700 mb-4"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors w-full"
          >
            {loading ? "Chargement..." : mode === 'create' ? "Créer le salon" : "Rejoindre"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SalonApp;