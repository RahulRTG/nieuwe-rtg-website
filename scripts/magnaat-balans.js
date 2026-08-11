#!/usr/bin/env node
/* DE BALANSMETER VAN MAGNAAT: is dit nog een spel?

   De sectortabel (server/kern/spellen/magnaat/sectoren.js) is spelbalans, en
   spelbalans is precies het soort ding dat stil scheefgroeit: iemand verstelt
   een loon, en drie sectoren later blijkt niets meer rendabel. Dit script zet
   ze naast elkaar op EEN maat -- wat verdient een goed geplaatste, goed bemande
   vestiging, en wanneer is de bouwsom terugverdiend.

   HET IS HIER OOK ECHT MEE MISGEGAAN, en dat is de reden dat het bestaat. In de
   eerste versie was `omvang` tegelijk de maandcapaciteit: veertig couverts per
   MAAND voor een restaurant met veertig stoelen. Alle zeven sectoren draaiden
   verlies, en in een uitgespeelde campagne wonnen de spelers die MINDER
   personeel aannamen en GEEN onderhoud deden -- want capaciteit was toch niet
   de bindende factor. Een spel waarin niets doen de beste zet is, is geen spel.
   Dat was aan de code niet te zien en aan deze tabel meteen.

   `test/spelmagnaat.test.js` houdt de uitkomst vast; dit script is om te KIJKEN
   terwijl je verstelt.

   Gebruik: node scripts/magnaat-balans.js */
'use strict';
const { SECTOREN, prijsVan } = require('../server/kern/spellen/magnaat/sectoren');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { basisvraag } = require('../server/kern/spellen/magnaat/vraag');
const { capaciteit } = require('../server/kern/spellen/magnaat/stap');

const OMVANG = 40;        // dezelfde maat voor alle sectoren, anders vergelijk je niets
const MAAND = 6;          // juni: midden in het jaar, niet de piek en niet het dal

/* Wat een vestiging van deze sector op zijn BESTE kavel doet. Geen simulatie
   over de tijd -- dat doet de toets -- maar een momentopname bij de bezetting
   waar de tabel op geijkt is. */
function meet(stadsleutel, sleutel) {
  const k = kaart(stadsleutel);
  const s = SECTOREN[sleutel];
  let beste = null, besteIndex = 0;
  for (const kav of k.kavels) {
    const index = basisvraag(k, kav, sleutel, MAAND);
    if (index > besteIndex) { besteIndex = index; beste = kav; }
  }
  const personeel = Math.ceil(OMVANG / s.perMedewerker);
  const v = { sector: sleutel, omvang: OMVANG, personeel };
  const cap = capaciteit(v, 0);
  const vraag = besteIndex * s.markt;
  const verkocht = Math.min(vraag, cap);
  const omzet = verkocht * prijsVan(sleutel, 'midden');
  const huur = Math.round(beste.eigenschappen.huur * OMVANG * 0.55);
  const kosten = omzet * s.inkoop + personeel * s.loon + OMVANG * s.vast + huur + OMVANG * s.vast * 0.35;
  const netto = omzet - kosten;
  const bouw = OMVANG * s.bouw;
  return { sleutel, kavel: beste.naam, vraag, cap, bezetting: cap ? verkocht / cap : 0,
    omzet, kosten, netto, bouw, terug: netto > 0 ? bouw / netto : Infinity };
}

const alles = (stadsleutel) => Object.keys(SECTOREN).map(s => meet(stadsleutel, s));

if (require.main === module) {
  const stad = process.argv[2] || 'ijmuiden';
  console.log('Magnaat-balans voor ' + stad + ' (omvang ' + OMVANG + ', maand ' + MAAND + ')\n');
  console.log('sector      | beste plek                     | bezet | omzet/mnd | netto/mnd | terugverdiend');
  for (const r of alles(stad)) {
    console.log(r.sleutel.padEnd(11) + ' | ' + r.kavel.slice(0, 30).padEnd(30) + ' | ' +
      Math.round(r.bezetting * 100).toString().padStart(4) + '% | ' +
      Math.round(r.omzet).toString().padStart(9) + ' | ' + Math.round(r.netto).toString().padStart(9) + ' | ' +
      (Number.isFinite(r.terug) ? r.terug.toFixed(1) + ' maanden' : 'NOOIT'));
  }
  const stuk = alles(stad).filter(r => !(r.terug >= 8 && r.terug <= 24));
  console.log('\n' + (stuk.length ? 'BUITEN DE BAND (8-24 maanden): ' + stuk.map(r => r.sleutel).join(', ')
    : 'alle sectoren binnen de band van 8 tot 24 maanden'));
}

module.exports = { meet, alles, OMVANG, MAAND };
