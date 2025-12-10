// Fonction pour charger un composant HTML
async function loadComponent(elementId, componentPath) {
  try {
    const response = await fetch(componentPath);
    const html = await response.text();
    document.getElementById(elementId).innerHTML = html;
  } catch (error) {
    console.error(`Erreur lors du chargement du composant ${componentPath}:`, error);
  }
}

// Charger les composants au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  // Détecter le contexte (racine ou pages)
  const isInPages = window.location.pathname.includes('/pages/');
  const basePath = isInPages ? '../' : '';
  
  // Détecter si c'est la page room (header spécial) ou une autre page
  const isRoomPage = window.location.pathname.includes('room.html');
  
  // Charger le header (sauf pour room.html qui a son propre header)
  if (!isRoomPage) {
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
      const headerFile = isInPages ? 'header-pages.html' : 'header.html';
      loadComponent('header-placeholder', `${basePath}components/${headerFile}`);
    }
  }
  
  // Charger le footer (room.html n'a pas de footer, donc on vérifie)
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (footerPlaceholder) {
    const footerFile = isInPages ? 'footer-pages.html' : 'footer.html';
    loadComponent('footer-placeholder', `${basePath}components/${footerFile}`);
  }
});

