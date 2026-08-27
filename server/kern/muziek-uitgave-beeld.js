/* RTG Klankwerk (deelmodule van de uitgave): WAT ER NAAR BUITEN GAAT.

   Eén plek die bepaalt welke velden van een uitgave de wereld in mogen. Nooit
   een sleutel en nooit een echte naam: alleen codenamen, en de RTG-naam waar
   die door een mens bij het kantoor verdiend is (server/accounts).

   Hier staat ook `vanMaker`: alles van één maker, zonder de bodem van de zaal.
   De zaal toont er dertig omdat een lijst een einde hoort te hebben; een
   MAKERSPROFIEL is iets anders -- daar hoort zijn werk volledig te staan,
   anders verdwijnt er stil iets uit zijn eigen aftiteling. De Media OS
   (kern/mediaos/) vraagt het hier op en houdt zelf geen tweede lijst bij. */
'use strict';

const I = require('./muziek-instrumenten');

/* DE DUUR VAN EEN UITGAVE, gerekend en niet geraden. Een stuk is hier geen
   bestand met een lengte maar een raster, dus de duur volgt uit het tempo en
   het aantal maten. De rekensom komt uit de motor zelf (public/apps/klankwerk/
   motor.js: een stap duurt 60/bpm/4 seconde) en de stappen per maat uit
   ./muziek-instrumenten.js -- zodat hij meebeweegt als die constanten ooit
   veranderen in plaats van hier als 240 te blijven staan.

   Waarom dit hier staat en niet in de catalogus van de Media OS: die weet niet
   hoe een raster klinkt, en hoort dat ook niet te weten. Zonder dit veld toonde
   de mediawereld `duurS: null` voor elk uitgegeven stuk, en kon een tijdlijn er
   niet omheen gebouwd worden. */
const duurVanUitgave = (u) => {
  const bpm = Number(u.bpm), maten = Number(u.maten);
  if (!(bpm > 0) || !(maten > 0)) return null;
  return Math.round(maten * I.STAPPEN_PER_MAAT * (60 / bpm / 4));
};

module.exports = ({ U, codenaamVan }) => {
  const publiek = (u, key) => ({
    id: u.id, naam: u.naam, bpm: u.bpm, maten: u.maten, duurS: duurVanUitgave(u),
    onder: u.onder,
    naamOnder: u.onder === 'rtg' ? 'Rahul Travel Group' : (u.makers[0] || {}).codenaam || codenaamVan(u.key),
    makers: u.makers,
    toelichting: u.toelichting,
    rtgAanvraag: u.rtgAanvraag || null,
    rtgReden: u.rtgReden || '',
    mooi: Object.keys(u.mooi || {}).length,
    ikVindHem: !!(u.mooi || {})[key],
    vanMij: u.key === key,
    reacties: (U().reacties[u.id] || []).length,
    /* Het track-id staat erbij omdat het de ENIGE echte verbinding is tussen
       een uitgave en een korte video: kern/clips-studio.js legt datzelfde id
       vast als een lid zijn eigen stuk onder een clip zet. De stuk-hub van de
       Media OS gebruikt hem om te tonen waar dit nummer nog meer onder ligt.
       Geheim is hij niet: de clips-feed toont hetzelfde id al bij de clip. */
    /* Het universum gaat MEE naar buiten, en dat hoort: een luisteraar mag
       weten dat wat hij hoort binnen vastgelegde grenzen is uitgerekend, en
       welke grenzen dat zijn. Een stuk dat elke keer anders klinkt zonder dat
       te zeggen, is geen formaat maar een storing. */
    universum: u.universum || null,
    trackId: u.trackId || null,
    at: u.at
  });

  const vanMaker = (makerKey, kijkerKey) => U().lijst
    .filter(u => u.key === makerKey)
    .map(u => publiek(u, kijkerKey));

  return { publiek, vanMaker, duurVanUitgave };
};
