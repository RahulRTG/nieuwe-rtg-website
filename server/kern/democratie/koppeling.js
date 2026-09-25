/* ============================================================================
   DE KOPPELING TUSSEN EEN INBRENGER EN ZIJN RTG-SLEUTEL -- op een plek.

   Een kwestie draagt geen RTG-sleutel en geen codenaam van wie hem inbracht,
   alleen een INBRENGERSNUMMER (`ib-...`). Hier, en nergens anders in deze laag,
   staat welk nummer bij welke sleutel hoort. Daar zijn drie redenen voor:

   1. VERHUIZEN (POLITIEK.md par. 1.1, proef P3). De kwesties kunnen mee naar een
      onafhankelijke organisatie; deze tabel blijft bij het identiteitsdomein.
   2. GEEN PROFIEL (DO-01). Elke kwestie krijgt een EIGEN nummer, ook als dezelfde
      mens er tien inbrengt. Wie alleen de kwesties ziet, kan ze dus niet tot een
      persoon optellen.
   3. VERGETEN ZONDER GESCHIEDENIS TE HERSCHRIJVEN. Wie vergeten wil worden,
      verliest hier zijn sleutel; de regel blijft staan met `vergetenOp`. De
      kwestie blijft bestaan, en de meter weet dat de inbrenger er bewust niet
      meer is -- in plaats van een breuk te melden.

   Deze module schrijft niets zelf weg; hij werkt op de kaart die index.js hem
   binnen een vastlegging geeft. */
'use strict';

function maakKoppeling({ crypto, kaart, kijk, nu }) {
  const nieuwNummer = () => 'ib-' + crypto.randomBytes(6).toString('hex');

  /* Een nieuw nummer voor een nieuwe kwestie. Alleen binnen een vastlegging. */
  function koppel(sleutel) {
    const k = kaart();
    let ref = nieuwNummer();
    while (k[ref]) ref = nieuwNummer();
    k[ref] = { sleutel, at: nu() };
    return ref;
  }

  /* Leest; maakt niets aan. */
  function sleutelVan(ref) {
    const k = kijk() || {};
    const r = k[ref];
    return r && r.sleutel ? r.sleutel : null;
  }

  function bekend(ref) {
    const k = kijk() || {};
    return Object.prototype.hasOwnProperty.call(k, ref);
  }

  function vergeten(ref) {
    const k = kijk() || {};
    return !!(k[ref] && k[ref].vergetenOp);
  }

  /* Alle nummers van een sleutel -- alleen om iemand zijn EIGEN kwesties te tonen. */
  function nummersVan(sleutel) {
    const k = kijk() || {};
    return Object.keys(k).filter(ref => k[ref] && k[ref].sleutel === sleutel);
  }

  /* Het recht om vergeten te worden: de sleutel gaat weg, de regel blijft. */
  function vergeet(sleutel) {
    const k = kaart();
    let n = 0;
    for (const ref of Object.keys(k)) {
      if (k[ref] && k[ref].sleutel === sleutel) { k[ref] = { sleutel: null, vergetenOp: nu() }; n++; }
    }
    return n;
  }

  return { koppel, sleutelVan, bekend, vergeten, nummersVan, vergeet };
}

module.exports = { maakKoppeling };
