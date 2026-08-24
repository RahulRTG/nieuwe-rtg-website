/* WAT EEN STORING HEEFT AANGERICHT -- en, net zo belangrijk, wat daarvan niet
   te meten is.

   DIT IS DE GEVAARLIJKSTE TEKST OP EEN INCIDENTSCHERM. "23 facturen vertraagd,
   0 verloren, 0 dubbel verwerkt" is precies wat een eigenaar wil lezen, en
   precies wat je niet mag schrijven zonder iets dat die drie getallen kan
   tellen. Een nul die niemand heeft geteld, is geen nul.

   DUS: alles wat hier als getal staat, komt uit een bevinding van de
   gezondheidskaart -- die zelf uit een teller of een scan komt. Alles wat we
   NIET kunnen tellen, staat met naam en reden in `nietGemeten`, en dat blok
   hoort op het scherm te staan en niet in een voetnoot.

   De drie die er altijd in staan zijn geen bescheidenheid maar een feit over
   deze code: server/meting.js telt per ROUTEPATROON en draagt geen lid en geen
   organisatie, en het transactie-grootboek (server/db/tx/) dekt de collecties
   die daar zijn aangemeld en niet het hele platform. Zolang dat zo is, kan
   niemand hier zeggen hoeveel mensen het merkten of dat er niets verloren ging. */
'use strict';

const NIET_TE_METEN = [
  { wat: 'hoeveel leden of organisaties dit heeft geraakt',
    waarom: 'de meting telt per routepatroon (server/meting.js) en draagt geen lid en geen tenant. Een getal ' +
      'hierover zou verzonnen zijn.' },
  { wat: 'of er gegevens verloren zijn gegaan',
    waarom: 'er is geen teller die verlies meet. Het transactie-grootboek (server/db/tx/collecties.js) dekt ' +
      'de collecties die daar zijn aangemeld, niet het hele platform.' },
  { wat: 'of er iets dubbel is verwerkt',
    waarom: 'om dezelfde reden als hierboven: er is geen dubbeltelling over alle collecties heen.' }
];

/* De impact van EEN vermogen, uit zijn eigen bevindingen. Alleen bevindingen
   met een oordeel tellen mee -- de schakelkast zegt iets nuttigs zonder iets
   over schade te zeggen. */
function impactVan(v) {
  const gemeten = [];
  for (const b of (v.bevindingen || [])) {
    if (!b.oordeel || !b.getallen) continue;
    gemeten.push({ bron: b.bron, oordeel: b.oordeel, graad: b.graad, at: b.at,
      zin: b.zin, getallen: b.getallen });
  }
  return {
    vermogen: v.id, naam: v.naam, oordeel: v.oordeel, graad: v.graad,
    gemeten,
    /* Leunt dit vermogen op iets dat ook stuk is, dan hoort dat bij de impact:
       de storing is dan misschien niet HIER ontstaan. */
    geraaktDoor: v.geraakt || [],
    nietGemeten: NIET_TE_METEN,
    let: gemeten.length ? null
      : 'geen enkele bron levert een getal over dit vermogen, dus de omvang van deze storing is niet gemeten'
  };
}

/* DE OORZAAK IS EEN VERMOEDEN EN GEEN FEIT, en de vorm dwingt dat af: er staat
   geen veld `oorzaak` met een zin erin maar een lijst aanleidingen met per stuk
   de bron en de hardheid. Vindt hij niets, dan zegt hij dat -- "geen gedeelde
   oorzaak gevonden" is een uitslag, en het is een betere dan een gok.

   Dezelfde regel als in ./oorzaak.js, waar de operator zijn gevallen groepeert:
   die MEET welk veld de gevallen het strakst clustert in plaats van een tabel
   "wat verklaart wat" te raadplegen. */
function aanleidingen(v, kaart) {
  const uit = [];
  for (const b of (v.bevindingen || [])) {
    if (b.oordeel !== 'storing') continue;
    uit.push({ soort: 'bevinding', bron: b.bron, graad: b.graad, wat: b.zin,
      afgeleid: !!b.afgeleid, zegtNiet: b.zegtNiet || null });
  }
  /* Een vermogen verderop in de keten dat ook stuk is, is een sterkere
     kandidaat dan wat dan ook hier: dit vermogen kan het gevolg zijn. */
  for (const id of (v.geraakt || [])) {
    const op = (kaart || []).find(x => x.id === id);
    uit.push({ soort: 'keten', bron: id, graad: op ? op.graad : 'onbekend',
      wat: 'dit vermogen leunt op "' + (op ? op.naam : id) + '", en dat heeft zelf een storing',
      zegtNiet: 'dat twee dingen tegelijk stuk zijn, bewijst niet dat het ene het andere veroorzaakt' });
  }
  return { lijst: uit,
    zekerheid: !uit.length ? 'geen aanleiding gevonden'
      : uit.some(x => x.soort === 'keten') ? 'een vermogen in de keten is ook stuk; dit kan het gevolg zijn'
        : 'gemeten aanleiding in dit vermogen zelf',
    let: uit.length ? 'Dit zijn AANLEIDINGEN en geen oorzaak. Wat hier staat is gemeten; waarom het ' +
      'gebeurde, staat er niet.' : 'Er is geen aanleiding gevonden die dit verklaart. Dat is een uitslag ' +
      'en geen reden om er een te verzinnen.' };
}

module.exports = { impactVan, aanleidingen, NIET_TE_METEN };
