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
const { herschrijfHtml: stijlbundelHtml } = require('./stijlbundel');

/* STIJL: EEN NONCE VOOR DE BLOKKEN, EN unsafe-inline ALLEEN NOG VOOR ATTRIBUTEN.

   style-src stond op 'unsafe-inline'. Daarmee mocht ELKE stijl die ergens in de
   pagina belandt draaien -- ook een <style>-blok dat een aanvaller erin krijgt.
   Dat blok kan de pagina overtekenen: een nep-inlogveld over het echte, een
   knop die ergens anders staat dan hij lijkt.

   Nu draagt style-src een nonce, precies zoals script-src. Dan geldt volgens
   CSP3 het 'unsafe-inline' niet meer voor <style>-blokken: alleen wat WIJ
   stempelen komt erdoorheen. Een ingespoten blok draait niet.

   style-src-attr HOUDT 'unsafe-inline', en dat is een bewuste, benoemde schuld:
   er staan 8957 style="..."-attributen in public/. Een nonce bestaat daar niet
   voor -- CSP kent geen stempel op een attribuut -- dus dat is niet af te
   dwingen zonder ze allemaal weg te halen. Dat is echt werk en het staat op de
   lijst; het hoort hier te staan als getal en niet als stilte. Wat een attribuut
   kan aanrichten is bovendien kleiner: het geldt alleen voor het element waar
   het op staat, en om er een op te hangen moet je al HTML kunnen injecteren.

   Wat een CSS-lek naar buiten betreft: img-src en connect-src staan op 'self',
   dus de klassieke truc (een attribuutselector die een achtergrondplaatje bij
   een vreemde server ophaalt en zo tekens verklikt) komt sowieso niet weg. */
const CSP = nonce =>
  "default-src 'self'; script-src 'self' 'nonce-" + nonce + "'; " +
  "style-src 'self' 'nonce-" + nonce + "'; style-src-attr 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; " +
  "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

/* DE STIJLEN DIE EEN SCRIPT ZELF MAAKT.

   Dertig gedeelde modules bouwen hun eigen opmaak: document.createElement
   ('style'), textContent erin, in de <head> hangen. Tachtig plekken in totaal.
   Zo'n blok is voor CSP hetzelfde als een blok in de bron -- zonder stempel
   draait het niet, en dan verliest een scherm stil zijn opmaak.

   Tachtig plekken elk hun eigen stempel laten zetten is tachtig plekken die het
   kunnen vergeten, en een eenendertigste module die het morgen ook weer moet
   weten. Daarom staat het hier, op EEN plek: dit stukje draait als eerste op
   elke pagina en zorgt dat een <style> die een script maakt de nonce van diezelfde
   pagina meekrijgt.

   Waarom dit niets opengooit: wie hier iets aan wil hebben moet al script kunnen
   draaien, en daarvoor heb je de script-nonce nodig. Alles wat als HTML wordt
   ingespoten komt hier niet langs -- dat gaat door de ontleder, niet door
   createElement, en blijft dus geblokkeerd. */
const STIJLSTEMPEL = '(function(d){var s=d.currentScript;var n=s&&s.nonce;if(!n)return;' +
  'var maak=d.createElement.bind(d);d.createElement=function(t){var e=maak.apply(null,arguments);' +
  "if(String(t).toLowerCase()==='style'){try{e.setAttribute('nonce',n);e.nonce=n;}catch(x){}}" +
  'return e;};})(document);';

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
      if (paginaHaak) { try { paginaHaak(rel); } catch (e) {} }
      const nonce = crypto.randomBytes(16).toString('base64');
      /* Een rij opeenvolgende stijlbladen wordt EEN verwijzing. Dit gaat voor de
         stempels uit: wat hier verdwijnt hoeft geen nonce meer. Zie
         ./stijlbundel.js voor wat er wel en niet in mag. */
      html = stijlbundelHtml(html);
      html = html.replace(/<script(?![^>]*\bnonce=)/g, '<script nonce="' + nonce + '"');
      // dezelfde behandeling voor de stijlblokken: sinds style-src een nonce
      // draagt, komt een ongestempeld blok er niet meer doorheen
      html = html.replace(/<style(?![^>]*\bnonce=)/g, '<style nonce="' + nonce + '"');
      /* De stempelaar voor stijlen die een script zelf maakt, als eerste in de
         <head>. Hij moet voor elk ander script staan, anders is er al een blok
         gemaakt voordat hij er is. Geen <head>? Dan vooraan het document; een
         browser hangt hem daar alsnog in de head die hij zelf aanmaakt. */
      const stempel = '<script nonce="' + nonce + '">' + STIJLSTEMPEL + '</script>';
      html = /<head[^>]*>/i.test(html)
        ? html.replace(/<head[^>]*>/i, (m) => m + stempel)
        : stempel + html;
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
