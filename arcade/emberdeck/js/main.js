'use strict';
// EMBER DECK — boot: settings, routing, lifecycle, service worker.
(function (root) {
  const ED = root.ED, U = ED.UI, Au = ED.Audio;
  U.applySettings();
  // first gesture unlocks audio
  const unlock = () => { Au.unlock(); };
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  // block pinch / double-tap zoom and the iOS context bubble on play surfaces
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { U.save(); Au.stopMusic(); }
    else if (U.S.set.music) Au.startMusic();
  });
  root.addEventListener('pagehide', () => U.save());
  if (U.S.run && U.params.get('title') !== '1') U.route();
  else U.show('title');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }
})(window);
