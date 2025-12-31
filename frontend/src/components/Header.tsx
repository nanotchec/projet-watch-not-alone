import { Link } from 'react-router-dom';

interface HeaderProps {
  showSearch?: boolean;
  onAddVideo?: (url: string) => void;
}

export default function Header({ showSearch = false, onAddVideo }: HeaderProps) {
  //gestion du formulaire d'ajout de vidéo
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = formData.get('videoUrl') as string;
    if (url && onAddVideo) {
      onAddVideo(url);
      e.currentTarget.reset();
    }
  };

  return (
    <header className="bg-gray-800 px-6 py-4 flex items-center justify-between gap-4 border-b border-gray-700">
      {/* logo et titre */}
      <Link to="/" className="flex items-center space-x-2 shrink-0">
        <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
        <span className="text-2xl text-white font-anton">WatchNotAlone</span>
      </Link>
      {/* barre de recherche youtube */}
      {showSearch && (
        <form onSubmit={handleSubmit} className="flex flex-1 max-w-xl items-center gap-2 justify-center">
          <input
            name="videoUrl"
            type="text"
            placeholder="Ajouter URL YouTube"
            className="flex-1 px-4 py-2 rounded bg-gray-900 text-center text-white focus:ring-blue-500 focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-200 px-3 py-2 rounded font-semibold">
            Ajouter
          </button>
        </form>
      )}
    </header>
  );
}

