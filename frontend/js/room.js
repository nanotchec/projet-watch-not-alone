let player;
let playlist = [];
let currentVideoIndex = 0;

// Initialisation YouTube API
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId: '',
    playerVars: {
      autoplay: 0,
      controls: 0, // on fera nos propres contrôles
      modestbranding: 1,
      rel: 0,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    }
  });
}

// quand c'est bon
function onPlayerReady() {
  updatePlayPauseButton();
  updateVolumeControl();
  updateSeekBar();
  if (playlist.length > 0) {
    loadVideo(0);
  }
}

const playPauseBtn = document.getElementById('playPauseBtn');
playPauseBtn.addEventListener('click', () => {
  if (player.getPlayerState() === YT.PlayerState.PLAYING) {
    player.pauseVideo();
  } else {
    player.playVideo();
  }
});

// barre
const seekBar = document.getElementById('seekBar');
seekBar.addEventListener('input', () => {
  const duration = player.getDuration();
  const seekTo = duration * (seekBar.value / 100);
  player.seekTo(seekTo, true);
});

// volume 
const volumeControl = document.getElementById('volumeControl');
volumeControl.addEventListener('input', () => {
  player.setVolume(volumeControl.value);
});

// plein écran: toggle + mise à jour des icônes
const fullscreenBtn = document.getElementById('fullscreenBtn');
fullscreenBtn.addEventListener('click', () => {
  const iframe = player?.getIframe?.();
  if (!iframe) return;
  if (!document.fullscreenElement) {
    // demander le plein écran
    if (iframe.requestFullscreen) iframe.requestFullscreen();
    else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
    else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
  } else {
    // quitter le plein écran
    if (document.exitFullscreen) document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  const expand = document.getElementById('iconExpand');
  const compress = document.getElementById('iconCompress');
  if (!expand || !compress) return;
  if (document.fullscreenElement) {
    expand.classList.add('hidden');
    compress.classList.remove('hidden');
    fullscreenBtn.setAttribute('aria-label', 'Quitter le plein écran');
  } else {
    compress.classList.add('hidden');
    expand.classList.remove('hidden');
    fullscreenBtn.setAttribute('aria-label', 'Activer le plein écran');
  }
});

// mise à jour bouton play/pause selon état player
function updatePlayPauseButton() {
  const state = player.getPlayerState();
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  if (!iconPlay || !iconPause) return;
  if (state === YT.PlayerState.PLAYING) {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
    playPauseBtn.setAttribute('aria-label', 'Mettre la vidéo en pause');
  } else {
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
    playPauseBtn.setAttribute('aria-label', 'Lire la vidéo');
  }
}

// mise à jour barre seek en temps réel
function updateSeekBar() {
  if (!player || player.getDuration() === 0) {
    seekBar.value = 0;
    return;
  }
  const duration = player.getDuration();
  const currentTime = player.getCurrentTime();
  seekBar.value = (currentTime / duration) * 100;
}

// mise à jour volume
function updateVolumeControl() {
  if (player) {
    volumeControl.value = player.getVolume();
  }
}

// quand l'état du player change
function onPlayerStateChange(event) {
  updatePlayPauseButton();

  // quand la vidéo est terminée, passer à la suivante dans la playlist
  if (event.data === YT.PlayerState.ENDED) {
    playNextVideo();
  }
}

// fonction pour charger une vidéo via index dans la playlist
function loadVideo(index) {
  if (index < 0 || index >= playlist.length) return;
  currentVideoIndex = index;
  // playlist stocke { id, title }
  player.loadVideoById(playlist[index].id);
  highlightPlaylistItem(index);
}

// mise a jour de la playlist pour la vidéo en cours
function highlightPlaylistItem(index) {
  if (!playlistEl) return;
  const items = playlistEl.querySelectorAll('li');
  items.forEach((el, i) => {
    if (i === index) {
      el.classList.add('bg-blue-600', 'text-white');
    } else {
      el.classList.remove('bg-blue-600', 'text-white');
    }
  });
}

// lancer la video suivante
function playNextVideo() {
  if (playlist.length === 0) return;
  const next = currentVideoIndex + 1;
  if (next < playlist.length) {
    loadVideo(next);
    if (player && player.playVideo) player.playVideo();
  } else {
    // fin de playlist — on arrête la lecture
    if (player && player.stopVideo) player.stopVideo();
  }
}

// fonction pour extraire l'id vidéo youtube
function extractVideoID(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|embed|shorts)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  return null;
}

//ajouter une vidéo à la playlist via bouton
const addVideoBtn = document.getElementById('addVideoBtn');
const videoUrlInput = document.getElementById('videoUrlInput');
const playlistEl = document.getElementById('playlist');

// récupère le titre d'une vidéo via un player YouTube temporaire
function fetchTitle(videoID) {
  return new Promise((resolve) => {
    if (!window.YT || !YT.Player) {
      resolve(videoID);
      return;
    }

    const container = document.createElement('div');
    container.style.width = '0px';
    container.style.height = '0px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);

    const tempPlayer = new YT.Player(container, {
      height: '0',
      width: '0',
      videoId: videoID,
      events: {
        onReady(e) {
          try {
            const info = e.target.getVideoData();
            const title = (info && info.title) ? info.title : videoID;
            resolve(title);
          } catch (err) {
            resolve(videoID);
          } finally {
            setTimeout(() => {
              try { tempPlayer.destroy(); } catch (e) {}
              if (container && container.parentNode) container.parentNode.removeChild(container);
            }, 0);
          }
        },
        onError() {
          resolve(videoID);
          try { tempPlayer.destroy(); } catch (e) {}
          if (container && container.parentNode) container.parentNode.removeChild(container);
        }
      }
    });
  });
}

addVideoBtn.addEventListener('click', async () => {
  const input = videoUrlInput.value.trim();
  const videoID = extractVideoID(input);
  if (!videoID) {
    alert('Veuillez entrer une URL ou un ID YouTube valide.');
    return;
  }

  // élément provisoire pendant récupération du titre
  const provisionalIndex = playlist.length;
  addVideoToList('Chargement...', provisionalIndex);

  const title = await fetchTitle(videoID);

  // stocker objet {id,title}
  playlist.push({ id: videoID, title });

  // mettre à jour l'élément dans la liste
  const item = playlistEl.querySelectorAll('li')[provisionalIndex];
  if (item) item.textContent = title;

  videoUrlInput.value = '';

  // chargement de la première vidéo
  if (playlist.length === 1 && player && player.loadVideoById) {
    loadVideo(0);
  }
});

//ajouter une vidéo dans la liste HTML (titre affiché)
function addVideoToList(text, index) {
  const li = document.createElement('li');
  li.textContent = text;
  li.className = 'cursor-pointer px-2 py-1 rounded hover:bg-blue-700';
  li.addEventListener('click', () => loadVideo(index));
  playlistEl.appendChild(li);
}

// chat
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;

  //afficher message dans la chat box
  const p = document.createElement('p');
  p.textContent = `Moi : ${msg}`;
  p.className = 'bg-indigo-600 rounded px-2 py-1 max-w-xs';
  p.className = 'bg-blue-600 rounded px-2 py-1 max-w-xs';
  chatMessages.appendChild(p);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.value = '';
});

//mise à jour continue de la barre seek
setInterval(() => {
  if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
    updateSeekBar();
  }
}, 500);

