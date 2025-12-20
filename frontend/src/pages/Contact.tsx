import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function Contact() {
  //page de contact
  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <Sidebar />
        <section className="flex-1 bg-gray-900 p-8 overflow-y-auto">
          <h1 className="text-3xl font-anton font-bold mb-6">Contactez-nous</h1>
          <div className="space-y-4 text-gray-300 font-ibm">
            <p>
              Pour toute question, suggestion ou problème technique, n'hésitez pas à nous contacter.
            </p>
            <p>
              Vous pouvez nous envoyer un email à l'adresse suivante :{' '}
              <a href="mailto:contact@watchnotalone.space" className="text-blue-400 hover:underline">
                contact@watchnotalone.space
              </a>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

