/* De ene bron van de openbare RTG-voordeur, in twee omgevingen.

   index.html in de repositoryroot is de canonieke GitHub Pages-pagina. De
   Node-server heeft geen kopie daarvan onder public/: twee HTML-bestanden
   zouden na de eerstvolgende ontwerpwijziging weer uiteenlopen. In plaats
   daarvan leest de nonce-laag hetzelfde bestand en past alleen de adressen aan
   die door de andere webroot anders zijn:

     GitHub Pages                 Node-server
     ./public/site/...            /site/...
     app.rahultravelgroup.com     dezelfde origin

   Ook de drie basis-meta's gaan naar dezelfde origin. Daardoor herschrijft
   start.js de data-app-path-links niet na het laden alsnog terug naar het
   productiedomein, en gaan beeld- en vertaalverzoeken door dezelfde Node-poort.
   De bron zelf blijft onaangeraakt; test/startpagina.test.js blijft dus exact
   de statische Pages-variant bewaken. */
'use strict';

const path = require('path');

const APP_ORIGIN = 'https://app.rahultravelgroup.com';
const META_ZELFDE_ORIGIN = new Set(['rtg-api-base', 'rtg-app-base', 'rtg-asset-base']);

function bronbestand(publicDir) {
  return path.resolve(publicDir, '..', 'index.html');
}

function metaNaarZelfdeOrigin(tag) {
  const naam = /\bname\s*=\s*(["'])([^"']+)\1/i.exec(tag);
  if (!naam || !META_ZELFDE_ORIGIN.has(naam[2])) return tag;
  return tag.replace(/(\bcontent\s*=\s*)(["'])[^"']*\2/i,
    (heel, voor, quote) => voor + quote + '/' + quote);
}

function voorNode(bron) {
  return String(bron || '')
    .replace(/<meta\b[^>]*>/gi, metaNaarZelfdeOrigin)
    .replace(/(\s(?:href|src)\s*=\s*["'])\.\/public\//gi, '$1/')
    /* Een letterlijke hostregex houdt de veiligheidsgrens ook voor statische
       analyzers zichtbaar: de punten zijn hostpunten, geen jokertekens. */
    .replace(/(\s(?:href|action)\s*=\s*["'])https:\/\/app\.rahultravelgroup\.com(?=\/)/gi, '$1');
}

/* Alleen de openbare landing wordt ook bediend wanneer de nonce-laag bewust
   uitstaat. De GET- en HEAD-vorm horen bij dezelfde bron en blijven daarom bij
   de landing, in plaats van als een tweede antwoordpad in voordeur.js. */
function stuurZonderNonce(req, res, html) {
  res.type('html');
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', Buffer.byteLength(html));
    return res.end();
  }
  return res.send(html);
}

module.exports = { APP_ORIGIN, bronbestand, voorNode, stuurZonderNonce };
