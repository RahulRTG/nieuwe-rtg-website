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
const { CSP, magnaatHtml, STIJLSTEMPEL } = require('./csp');
/* De vijf herschrijvingen en hun volgorde staan apart; die volgorde is dragend
   en hoort als keten leesbaar te zijn. Zie ./herschrijfketen.js. */
const { herschrijfPagina } = require('./herschrijfketen');

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

/* De site-root is de HOMESCREEN, en er is er maar een.

   Hier stonden twee bureaubladen naast elkaar. /apps/app.html draagt het
   springboard -- iconen, mappen, de horlogering, zoeken -- en dat is de
   homescreen. Daarnaast lag /apps/index.html: een scrollende pagina met alle
   apps in secties, een eigen kopbalk met woordmerk, accountchips, en tegels
   die een app in een IFRAME-venster erbovenop openden. Dat was een tweede
   beginscherm met de metaforen van een computer, en twee beginschermen is er
   een te veel: je wist nooit welke "thuis" was.

   Alle drie de paden komen nu op dezelfde plek uit. /apps/index.html blijft
   als pad bestaan omdat er van buiten naar gelinkt kan zijn; hij brengt je
   gewoon thuis. */
function bureaublad(app) {
  const naarHome = (req, res, next) => { herschrijf(req, '/apps/app.html'); next(); };
  app.get('/', naarHome);
  app.get('/apps/bureau.html', naarHome);
  app.get('/apps/index.html', naarHome);
  /* ZONDER SCHUINE STREEP GEREGISTREERD, en dat is geen smaak.

     Hier stond '/apps/'. De routematcher accepteert een pad EN datzelfde pad met
     een streep erachter (web/routing.js, padMatch), dus '/apps/' matchte op
     /apps/ en /apps// -- maar niet op /apps. Wie dat intypte kreeg 404, terwijl
     de routekaart '/apps' meldde: leesLagen knipt de sluitstreep eraf. De kaart
     beweerde dus een route die de router niet had.

     Dat is precies het soort stille afwijking waar de dekkingsmeting op stuit
     zodra ze ALLE routes meet in plaats van alleen /api/: de route was niet
     ongedekt, hij was onbereikbaar. Zonder streep geregistreerd dekt hij beide
     vormen, en dan is de kaart weer waar. */
  app.get('/apps', naarHome);
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
      const magnaat = req.query && String(req.query.magnaat || '') === '1' && rel.startsWith('/apps/');
      html = herschrijfPagina(html, rel, publicDir, magnaat);
      html = html.replace(/<script(?![^>]*\bnonce=)/g, '<script nonce="' + nonce + '"');
      // dezelfde behandeling voor de stijlblokken: sinds style-src een nonce
      // draagt, komt een ongestempeld blok er niet meer doorheen
      html = html.replace(/<style(?![^>]*\bnonce=)/g, '<style nonce="' + nonce + '"');
      /* De stempelaar voor stijlen die een script zelf maakt, als eerste in de
         <head>. Hij moet voor elk ander script staan, anders is er al een blok
         gemaakt voordat hij er is. Geen <head>? Dan vooraan het document; een
         browser hangt hem daar alsnog in de head die hij zelf aanmaakt. */
      /* De stempelaar eerst, dan de hand. STIJLSTEMPEL moet voor elk ander
         script staan (zie hierboven); shared/hand.js maakt geen stijlblokken en
         mag er dus achter. Hij staat wel VOOR de rest van de pagina, want hij
         corrigeert het attribuut hieronder als de cookie achterliep -- en dat
         moet gebeurd zijn voordat er iets getekend wordt. Zo hoeven er geen 257
         losse scripttags voor. */
      const stempel = '<script nonce="' + nonce + '">' + STIJLSTEMPEL + '</script>'
        + '<script src="/shared/hand.js" nonce="' + nonce + '"></script>';
      html = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, (m) => m + stempel)
        : stempel + html;
      /* LINKS- OF RECHTSHANDIG, voordat er iets getekend is.

         De duimboog van een linkshandige is het spiegelbeeld van die van een
         rechtshandige, en het huis beweegt daarin mee (shared/hand.js). Zou dat
         pas in de browser gebeuren, dan klapt het scherm van een linkshandige
         bij elke start zichtbaar om -- dus zet deze laag het attribuut er hier
         al in, uit de cookie die shared/hand.js bijhoudt.

         DE COOKIE IS NIET DE WAARHEID, alleen het transport naar deze kant.
         localStorage is de waarheid; shared/hand.js trekt de twee bij elk laden
         gelijk. Loopt de cookie achter (een blad uit de servicewerker-cache),
         dan corrigeert dat script het attribuut alsnog -- dan flikkert het een
         keer, in plaats van altijd.

         Alleen twee woorden komen erdoor. Wat er verder in die cookie staat is
         van buiten en hoort nooit in een attribuut te belanden. */
      const hand = /(?:^|;\s*)rtg_hand=(links|rechts)(?:;|$)/.exec(String(req.headers.cookie || ''));
      if (hand && /<html[^>]*>/i.test(html)) {
        html = html.replace(/<html(?![^>]*\bdata-hand=)/i, '<html data-hand="' + hand[1] + '"');
        /* Anders serveert een tussenliggende cache het blad van de een aan de
           ander. Vary staat verderop al voor Accept-Encoding; dit hoort ernaast. */
        res.setHeader('Vary', 'Cookie, Accept-Encoding');
      }
      res.set('Content-Security-Policy', CSP(nonce, magnaat));
      res.type('html');
      /* Ook de pagina's zelf gecomprimeerd over de lijn (satelliet en traag
         mobiel).

         WAAROM DIT DE ASYNCHRONE gzip IS EN NIET gzipSync. Dit is de enige
         compressie in huis die PER VERZOEK gebeurt: een pagina draagt een eigen
         nonce, dus het antwoord is elke keer anders en er valt niets te cachen
         (statische bestanden gaan een keer door de compressor en daarna uit de
         cache, zie ./compressie.js -- daar is sync juist prima).

         gzipSync legt de event loop stil voor de duur van de compressie. Deze
         server is er maar EEN: het failover-trio houdt er twee op standby en
         db.writable laat maar een proces schrijven, dus die ene event loop is
         het hele huis. De asynchrone gzip doet hetzelfde werk op de
         libuv-threadpool en dus op de andere kernen.

         Gemeten, 200 verzoeken van 93 KB op vier kernen:
           gzipSync   475 ms   2,37 ms per verzoek, event loop geblokkeerd
           gzip       271 ms   1,36 ms per verzoek, op de threadpool
         Dat is 1,75x, zonder ook maar iets aan de opslag te veranderen. */
      if (html.length > 2048 && /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
        return zlib.gzip(Buffer.from(html), { level: 6 }, (gzFout, gz) => {
          // gaat het comprimeren mis, dan gaat de pagina onverpakt de deur uit:
          // trager, maar nooit een leeg scherm
          if (gzFout || !gz) return res.send(html);
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.send(gz);
        });
      }
      res.send(html);
    });
  };
}

module.exports = { bureaublad, cspNonce, herschrijf, CSP, magnaatHtml, opPagina };
