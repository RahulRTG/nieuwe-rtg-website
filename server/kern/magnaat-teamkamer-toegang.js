/* De toegangscode van een Magnaat-teamkamer als credential
   (magnaat.teamkamer_toegangscode, RELEASEKANDIDAAT.md B9).

   Vroeger negen tekens (circa 46 bit), kaal in de kamer en zolang de kamer
   wachtte aan ELKE deelnemer teruggegeven, zonder vervaltijd. Nu: MT.<32 hex>
   (128 bit via ./bearercode.js), alleen als hash op de kamer, kaal alleen in het
   antwoord op maken of roteren (aan de host), met issuer/doel/scope, een
   vervaltijd, max_gebruik = de vrije plekken, en roteren en intrekken door de
   host. Deze module bezit geen opslag: de kamerkern roept haar aan binnen zijn
   eigen collectietransactie. Zoeken is constant-time over alle kamers. */
'use strict';

const DOEL = 'teamkamer-deelnemen';
const SCOPE = Object.freeze(['teamkamer.deelnemen']);
const GELDIG_MS = 24 * 3600000;
const VORM = /^MT\.[0-9A-F]{32}$/i;

module.exports = ({ crypto, nu, maxDeelnemers }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'magnaat.teamkamer_toegangscode', nu });

  // roteren = de vorige intrekken en een nieuwe geven; de kale code gaat alleen terug naar de aanroeper
  function geef(kamer, door) {
    const vorige = kamer.toegang;
    if (vorige) bearer.intrekken(vorige, door, 'vervangen door een nieuwe toegangscode');
    const g = bearer.maak({ prefix: 'MT', issuer: 'rtg.magnaat.teamkamer', doel: DOEL, scope: SCOPE,
      onderwerp: { soort: 'teamkamer', id: kamer.id }, geldigMs: GELDIG_MS,
      maxGebruik: Math.max(1, maxDeelnemers - kamer.deelnemers.length) });
    g.toegang.rotatie = ((vorige && Number(vorige.rotatie)) || 0) + 1;
    kamer.toegang = g.toegang;
    delete kamer.toegangscode;
    return g.code;
  }

  function vind(kamers, code) {
    const kale = String(code == null ? '' : code).trim();
    if (!VORM.test(kale)) return null;
    const gezocht = bearer.hash(kale);
    let gevonden = null;
    for (const k of kamers) if (k && bearer.zelfdeHash(k.toegang && k.toegang.code_hash, gezocht)) gevonden = k;
    return gevonden;
  }

  const reden = kamer => kamer.toegang && kamer.toegang.onderwerp && kamer.toegang.onderwerp.id === kamer.id
    ? bearer.reden(kamer.toegang, { doel: DOEL, scope: SCOPE }) : 'onbekend';

  const gebruik = kamer => bearer.gebruik(kamer.toegang);
  const intrek = (kamer, door, waarom) => { if (kamer.toegang) bearer.intrekken(kamer.toegang, door, waarom); };
  // een oude kale code (van voor de migratie) opent niets meer en verdwijnt bij de eerste schrijfronde
  const schoon = kamer => { if (kamer && 'toegangscode' in kamer) delete kamer.toegangscode; };

  return { geef, vind, reden, gebruik, intrek, schoon, publiek: bearer.publiek, DOEL, SCOPE, GELDIG_MS };
};
