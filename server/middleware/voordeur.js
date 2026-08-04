/* De voordeur en de scriptbeveiliging van de pagina's.

   De voordeur: wie naar / gaat krijgt meteen het RTG-OS-bureaublad met alle
   apps als tegels. Bewust geen omleiding maar een interne herschrijving, zodat
   de nonce-laag hieronder er gewoon overheen gaat en er geen 302-sprong
   tussen zit. Web en mobiel krijgen exact dezelfde pagina; de tegels schalen
   mee met het formaat. De oude bureau-URL blijft werken.

   De scriptbeveiliging: op de app-pagina's staat geen 'unsafe-inline' voor
   scripts, maar krijgt elk antwoord een eigen nonce. We lezen het bestand,
   geven elke <script> die nonce mee en zetten de CSP navenant. De apps werken
   met addEventListener en niet met inline on-handlers, dus dit kan zonder ze
   om te bouwen, en het sluit de deur voor ingespoten scripts.

   Uit te zetten met RTG_CSP_NONCE=0. Losse statische pagina's (bijvoorbeeld
   de 404) vallen dan terug op de gewone CSP. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const CSP = nonce =>
  "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
  "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

/* Een verzoek intern doorverwijzen naar een ander pad.

   Let op req.path. De eigen webmotor (server/web/verrijk.js) zet die eenmalig
   als gewone eigenschap, afgeleid uit req.url aan het begin van het verzoek.
   Alleen req.url herschrijven is dus niet genoeg: alles wat daarna op req.path
   kijkt ziet nog het oude pad. Dat was hier ook zo, en het kostte de voordeur
   zijn scriptbeveiliging: / viel terug op de losse CSP met 'unsafe-inline',
   terwijl /apps/app.html gewoon een nonce kreeg. Juist de meest bezochte
   pagina had daarmee de zwakste regel.

   We zetten daarom allebei, maar alleen als req.path echt een eigen,
   schrijfbare eigenschap is. Op Express is het een getter op het prototype;
   daar leidt hij zichzelf af uit req.url en moeten we er vanaf blijven. */
function herschrijf(req, naar) {
  req.url = naar;
  const eigen = Object.getOwnPropertyDescriptor(req, 'path');
  if (eigen && eigen.writable) req.path = naar;
}

/* De site-root is het bureaublad. Twee paden, dezelfde pagina. */
function bureaublad(app) {
  const naarBureaublad = (req, res, next) => { herschrijf(req, '/apps/app.html'); next(); };
  app.get('/', naarBureaublad);
  app.get('/apps/bureau.html', naarBureaublad);
}

/* ---------- meekijken welke SCHERMEN er geopend worden ----------
   Dezelfde vorm als de patroonhaak in web/routing.js. Deze laag serveert ELKE
   pagina zelf (hij zet er een nonce in), dus een .html komt hier langs en niet
   bij de routematcher -- daarom stond er in het routejournaal nooit iets over
   schermen, en kon niemand natrekken of een schermtoets een app ooit had
   geopend. Staat de nonce-laag uit, dan doet de statische laag het werk; die
   heeft dezelfde haak, en het journaal ontdubbelt.

   Zonder haak kost dit niets, en deze module weet niet wie er meekijkt. */
let paginaHaak = null;
function opPagina(fn) { paginaHaak = typeof fn === 'function' ? fn : null; }

function cspNonce(publicDir, aan) {
  return (req, res, next) => {
    if (!aan || req.method !== 'GET') return next();
    let rel = req.path;
    if (rel.endsWith('/')) rel += 'index.html';
    if (!rel.endsWith('.html')) return next();
    const bestand = path.join(publicDir, rel);
    if (!bestand.startsWith(publicDir + path.sep)) return next(); // geen path traversal
    fs.readFile(bestand, 'utf8', (err, html) => {
      if (err) return next(); // bestaat niet: laat de statische laag/404 het doen
      // het verzoek gaat mee: alleen daaraan is te zien of dit een bezoek was
      // of een voorophaling van een service worker (zie server/routelog.js)
      if (paginaHaak) { try { paginaHaak(rel, req); } catch (e) {} }
      const nonce = crypto.randomBytes(16).toString('base64');
      html = html.replace(/<script(?![^>]*\bnonce=)/g, '<script nonce="' + nonce + '"');
      res.set('Content-Security-Policy', CSP(nonce));
      res.type('html');
      // ook de pagina's zelf gecomprimeerd over de lijn (satelliet en traag mobiel)
      if (html.length > 2048 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        return res.send(zlib.gzipSync(Buffer.from(html), { level: 6 }));
      }
      res.send(html);
    });
  };
}

module.exports = { bureaublad, cspNonce, herschrijf, CSP, opPagina };
