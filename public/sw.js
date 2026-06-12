// Minimaler Service Worker — macht die App "installierbar" (PWA-Kriterium).
// Bewusst KEIN aggressives Caching (Wallet-Pässe/DB müssen immer frisch sein).
const CACHE = 'flowstate-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  // Network-first, kein Caching von API/Pass — nur durchreichen.
  return; // Standardverhalten (Browser-Fetch), SW nur fuer Installierbarkeit.
});
