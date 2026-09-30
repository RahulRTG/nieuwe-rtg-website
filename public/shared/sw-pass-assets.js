/* Cache only public interface assets requested by the Pass document. Never
   accept navigation, API, uploads or arbitrary query parameters from a client. */
self.RTGPassAssets = function (cacheName) {
  function allowed(value) {
    try {
      const u = new URL(value);
      if (u.origin !== self.location.origin || u.username || u.password || u.hash) return false;
      const bundled = /^\/(?:scriptbundel|scriptblok|stijlbundel|stijlblok)\.(?:js|css)$/.test(u.pathname);
      const file = /^\/(?:shared|apps)\/[\w/.-]+\.(?:js|css)$/.test(u.pathname) ||
        /^\/fonts\/[\w.-]+\.(?:css|woff2?)$/.test(u.pathname) ||
        /^\/images\/(?:world-homes|worlds\/heritage)\/[\w.-]+\.(?:jpg|png|webp)$/.test(u.pathname) ||
        ['/shared/interface/world-widget-catalog.json','/shared/handelingindex.json'].includes(u.pathname);
      return (file || bundled) && Array.from(u.searchParams.keys()).every(k =>
        (bundled ? ['f','i','v'] : ['v']).includes(k));
    } catch (e) { return false; }
  }
  self.addEventListener('message', e => {
    if (!e.data || e.data.type !== 'rtg-pass-assets' || !e.source || !e.ports[0]) return;
    e.waitUntil((async () => {
      const client = await self.clients.get(e.source.id);
      if (!client || new URL(client.url).pathname !== '/apps/app.html') return;
      const urls = Array.from(new Set(Array.isArray(e.data.urls) ? e.data.urls : [])).filter(allowed).slice(0,500);
      const cache = await caches.open(cacheName), saved = [];
      // Bound network concurrency; installation can involve many small modules.
      for (let i = 0; i < urls.length; i += 8) await Promise.all(urls.slice(i,i+8).map(async url => {
        try {
          if (!(await cache.match(url))) {
            const response = await fetch(new Request(url, {cache:'no-cache', credentials:'omit'}));
            if (!response.ok || response.redirected || /text\/html/.test(response.headers.get('content-type') || '')) return;
            await cache.put(url, response);
          }
          saved.push(url);
        } catch (error) { /* Online/pageshow can retry an incomplete install. */ }
      }));
      e.ports[0].postMessage({ok:saved.length === urls.length, saved:saved});
    })());
  });
};
