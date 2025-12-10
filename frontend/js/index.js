document.addEventListener('DOMContentLoaded', function() {
  const animatedText = document.getElementById('animated-text');
  if (!animatedText) return;

  const phrases = [
    "Regardez des vidéos avec tes amis.",
    "Créer un salon et partage le lien",
    "Profitez."
  ];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const delayBetweenPhrases = 2000;

  function type() {
    const currentPhrase = phrases[phraseIndex];
    if (isDeleting) {
      // Effacement
      charIndex--;
      animatedText.textContent = currentPhrase.substring(0, charIndex);
      if (charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        setTimeout(type, typingSpeed);
      } else {
        setTimeout(type, deletingSpeed);
      }
    } else {
      // Écriture
      charIndex++;
      animatedText.textContent = currentPhrase.substring(0, charIndex);
      if (charIndex === currentPhrase.length) {
        isDeleting = true;
        setTimeout(type, delayBetweenPhrases);
      } else {
        setTimeout(type, typingSpeed);
      }
    }
  }
  setTimeout(type, 500);
});

