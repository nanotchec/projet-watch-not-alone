import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Home() {
  //valeurs pour l'animation
  const [displayedText, setDisplayedText] = useState('');
  const phraseIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  //phrases pour l'animation
  const phrases = [
    "Regardez des vidéos avec tes amis.",
    "Créez un salon et partagez le lien",
    "Profitez de WatchNotAlone."
  ];
  useEffect(() => {
    //reglages de l'animation
    const typingSpeed = 50;
    const deletingSpeed = 40;
    const delayBetweenPhrases = 2000;

    const type = () => {
      const currentPhrase = phrases[phraseIndexRef.current];
      //suppression
      if (isDeletingRef.current) {
        if (charIndexRef.current > 0) {
          charIndexRef.current--;
          setDisplayedText(currentPhrase.substring(0, charIndexRef.current));
          timeoutRef.current = setTimeout(type, deletingSpeed);
        } else {
          //suivant
          isDeletingRef.current = false;
          phraseIndexRef.current = (phraseIndexRef.current + 1) % phrases.length;
          charIndexRef.current = 0;
          timeoutRef.current = setTimeout(type, typingSpeed);
        }
      } else {
        //écriture
        if (charIndexRef.current < currentPhrase.length) {
          charIndexRef.current++;
          setDisplayedText(currentPhrase.substring(0, charIndexRef.current));
          timeoutRef.current = setTimeout(type, typingSpeed);
        } else {
          //attente
          isDeletingRef.current = true;
          timeoutRef.current = setTimeout(type, delayBetweenPhrases);
        }
      }
    };

    timeoutRef.current = setTimeout(type, 500);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  //page d'accueil
  return (
    <div className="bg-gray-900 text-white flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <h1 className="text-5xl md:text-7xl font-anton mb-4">WatchNotAlone</h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8 font-ibm max-w-2xl h-24 md:h-6">
          <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {displayedText}
          </span>
          <span className="typed-cursor--blink" aria-hidden="true">|</span>
        </p>
        <Link to="/room" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition duration-300 ease-in-out transform hover:scale-105">
          Créer un salon
        </Link>
      </main>
      <Footer />
    </div>
  );
}

