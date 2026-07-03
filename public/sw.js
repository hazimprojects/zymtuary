// Service worker sengaja minimum — hanya untuk memenuhi kriteria "installable"
// Chrome (perlu ada pendengar fetch berdaftar). Tiada caching supaya kandungan
// sentiasa terkini semasa pembangunan aktif, bukan disimpan lapuk.
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	event.respondWith(fetch(event.request));
});
