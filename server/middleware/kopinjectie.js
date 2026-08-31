/* De kopinjecties van de voordeur: stempelaar, hand en handattribuut.

   Een eigen bestand omdat ../voordeur.js er met dit blok erin over de 10 KB
   ging (keuringsregel 13) -- en dat klopte: het bezorgen van een pagina en wat
   er in de <head> van die pagina hoort, zijn twee onderwerpen. De VOLGORDE die
   hier wordt bewaakt is de reden dat dit bij elkaar staat:

     1. de STEMPELAAR (inline): moet voor elk ander script, anders is er al een
        stijlblok gemaakt voordat hij er is;
     2. in Magnaat de SANDBOX-BLOKKADE (gezet door herschrijfketen): het eerste
        EXTERNE script, want een blokkade achter een ander extern script komt te
        laat (test/middleware.test.js 4b);
     3. dan pas shared/hand.js. Twee takken raakten deze volgorde tegelijk -- de
        een verhuisde de magnaat-herschrijving, de ander hing de hand aan de
        stempel -- en samen stond de hand voor de blokkade. */
'use strict';
const { STIJLSTEMPEL } = require('./csp');

function kopinjecties(html, nonce, req, res, magnaat) {
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
  const stijl = '<script nonce="' + nonce + '">' + STIJLSTEMPEL + '</script>';
  const handTag = '<script src="/shared/hand.js" nonce="' + nonce + '"></script>';
  /* DE SPRONG OP ELKE PAGINA (shared/sprong.js): een tik naar elke functie,
     waar u ook staat. Hij hoort hier en niet in 276 losse scripttags om
     dezelfde reden als de hand hierboven -- en vooral: een korte weg die op
     de helft van de schermen ontbreekt, is geen korte weg maar een verrassing.

     ACHTERAAN EN MET defer, want hij tekent pas iets als de pagina er staat
     en mag nooit voor de stempelaar of de blokkade komen. Zonder ledensessie
     doet hij niets; dat besluit staat in het script zelf, want alleen daar is
     te zien of er iemand is ingelogd. */
  const sprongTag = '<script src="/shared/sprong.js" defer nonce="' + nonce + '"></script>';
  /* In Magnaat gaat de hand ACHTER de blokkade: de sandbox-tag (net na
     <head> gezet door herschrijfPagina) hoort het eerste EXTERNE script te
     blijven -- een blokkade achter een ander extern script komt te laat
     (test/middleware.test.js 4b). De stempelaar mag ervoor: inline. */
  html = /<head[^>]*>/i.test(html)
    ? html.replace(/<head[^>]*>/i, (m) => m + stijl)
    : stijl + html;
  const sandboxTag = /(<script[^>]*\/apps\/magnaat-sandbox\.js[^>]*><\/script>)/i;
  html = magnaat && sandboxTag.test(html)
    ? html.replace(sandboxTag, (m) => m + handTag)
    : html.replace(stijl, stijl + handTag);
  html = html.replace(handTag, handTag + sprongTag);
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
  return html;
}

module.exports = { kopinjecties };
