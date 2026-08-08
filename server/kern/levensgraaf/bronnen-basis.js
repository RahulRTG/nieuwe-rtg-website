/* Levensgraaf, deelbestand "bronnen-basis": wat ELK lid heeft, ongeacht pas.

   De rest van de bronnen leest het lifestyle-dossier of het platform. Dit
   bestand leest het LEDENDOSSIER zelf -- de rij die iedereen heeft, van een
   gratis account tot een Business Pass.

   EN DAAR ZIT PRECIES HET PUNT VAN DEZE HELE LAAG. Toen de levensgraaf nog in
   het Privekantoor woonde, was hij een voorrecht van twintigduizend euro per
   maand. Maar een gratis lid heeft ook een paspoort dat verloopt, en dat is
   precies zo'n datum die je vergeet en die je op de verkeerde dag tegenkomt --
   op een vliegveld. De motor hoort algemeen te zijn; wat het KANTOOR ermee doet
   (mandaat, zaken, orkestratie) mag premium blijven.

   HET PASPOORT KOMT ER VANZELF IN. Niemand typt hier een datum: shared/mrz.js
   leest de machineleesbare strook van een paspoortscan, controleert de
   ICAO-controlecijfers en vult alleen in als die kloppen
   (kern/onboarding/paspoort.js schrijft het naar het ledendossier). Wie ooit
   zijn paspoort heeft gescand, heeft daarmee zonder het te weten zijn eerste
   termijn in de tower staan.

   WAT ER NIET IN GAAT: het nummer, de nationaliteit en de geboortedatum die uit
   diezelfde scan komen. De graaf heeft aan de DATUM genoeg om te waarschuwen, en
   alles wat hij niet nodig heeft, hoort hij niet te dragen -- zeker geen
   documentnummer dat langs een concierge-scherm zou kunnen glijden. Vandaar ook
   'lid': deze knoop verlaat de kring van het lid niet.

   Gemount via ./bronnen.js. */
'use strict';

const H = require('./hulp');
const { VERTROUWELIJK, isDatum } = H;

const BASIS = [
  /* ---- Het eigen reisdocument, uit het ledendossier (de kluis) ---- */
  { kamer: 'gezelschap', knopen(l, K, ctx) {
    /* De datum komt uit kern/paspoort.js, de module die over paspoorten gaat.
       Hier staat geen enkele kennis over waar het ledendossier ligt of hoe een
       sleutel eruitziet -- alleen de vraag, en het antwoord is een datum. */
    const vraag = ctx && ctx.paspoortVervalt;
    const tot = vraag ? vraag(ctx.key) : null;
    if (!isDatum(tot)) return [];
    return [K({ id: 'mijnpaspoort', soort: 'termijn', naam: 'uw paspoort',
      kamer: 'gezelschap', bron: 'Paspoort', gevoelig: VERTROUWELIJK, deel: 'lid',
      vervalt: tot, vervaltWat: 'paspoort' })];
  } }
];

module.exports = BASIS;
