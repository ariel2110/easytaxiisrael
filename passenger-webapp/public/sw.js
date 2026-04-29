// Kill-switch SW: unregisters the stale driver-webapp SW that was
// accidentally installed at this origin when nginx was misconfigured.
// On detection of this new script the browser installs it, it immediately
// activates, clears all caches, then unregisters itself so future
// navigations go straight to the server.

self.skipWaiting();

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => clients.forEach(c => c.navigate(c.url)))
  );
});
