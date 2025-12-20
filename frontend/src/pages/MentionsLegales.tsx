import Header from '../components/Header';
import Sidebar from '../components/Sidebar';


export default function MentionsLegales() {
  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <Sidebar />
        <section className="flex-1 bg-gray-900 p-8 overflow-y-auto">
          <h1 className="text-3xl font-anton font-bold mb-6">Mentions Légales</h1>
          <div className="space-y-6 text-gray-300 font-ibm">
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Éditeur du site</h2>
              <p>Nom du groupe: WATCHNOTALONE</p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Technologies</h2>
              <p>Hébergeur : OVH CLOUD</p>
              <p>Framework Frontend : React + Vite + Tailwind CSS</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

