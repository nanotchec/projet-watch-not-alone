import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function APropos() {
  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      <Header />
      <main className="flex flex-1 overflow-hidden">
        <Sidebar />
        <section className="flex-1 bg-gray-900 p-8 overflow-y-auto">
          <h1 className="text-3xl font-anton font-bold mb-6">À Propos de WatchNotAlone</h1>
          <div className="space-y-4 text-gray-300 font-ibm">
            <p>
              WatchNotAlone est un site conçue pour vous permettre de regarder des vidéos avec vos amis et votre famille, où que vous soyez. Notre mission est de recréer l'expérience d'une soirée cinéma, mais en ligne.
            </p>
            <p>
              Créez un salon, invitez vos proches, et profitez de vidéos synchronisées en temps réel. Le chat intégré vous permet de discuter et de réagir ensemble, comme si vous étiez dans la même pièce.
            </p>
            <p>
              Ce projet a été développé par une équipe d'étudiants en licence Informatique.
            </p>
            <p>
              Nous espérons que vous apprécierez utiliser WatchNotAlone autant que nous avons aimé le créer !
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

