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
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { prijsVan } = require('../server/kern/spellen/magnaat/prijsstand');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { basisvraag } = require('../server/kern/spellen/magnaat/vraag');
const { capaciteit } = require('../server/kern/spellen/magnaat/stap');

const MAAND = 6;          // juni: midden in het jaar, niet de piek en niet het dal
const DOEL = 12;          // waar de sectortabel op geijkt is: terugverdientijd in maanden

/* Wat een vestiging van deze sector op zijn BESTE kavel doet, OP MAAT gebouwd:
   precies zo groot als de vraag daar.

   Die maat is een correctie, en een belangrijke. Eerst mat dit script elke
   sector bij een VASTE omvang (veertig), en dat loog: bij die maat staat elke
   sector ongeveer even veel leeg, dus zagen ze er gelijk uit. De winst zit
   juist in op maat bouwen, en daar liepen ze ver uiteen -- logistiek verdiende
   zichzelf op maat in 5,7 maanden terug en horeca in 9,6. Dat kwam pas boven
   water toen `magnaat-strateeg.js` campagnes ging uitspelen en er een profiel
   100% van zijn duels won. Een momentopname bij de verkeerde maat is geen
   momentopname maar een verkeerd antwoord. */
function meet(stadsleutel, sleutel) {
  const k = kaart(stadsleutel);
  const s = SECTOREN[sleutel];
  let beste = null, besteIndex = 0;
  for (const kav of k.kavels) {
    const index = basisvraag(k, kav, sleutel, MAAND);
    if (index > besteIndex) { besteIndex = index; beste = kav; }
  }
  const vraag = besteIndex * s.markt;
  const omvang = Math.max(1, Math.round(vraag / s.perMaand));   // op maat: zo groot als de vraag
  const personeel = Math.ceil(omvang / s.perMedewerker);
  const v = { sector: sleutel, omvang, personeel };
  const cap = capaciteit(v, 0);
  const verkocht = Math.min(vraag, cap);
  const omzet = verkocht * prijsVan(sleutel, 'midden');
  const huur = Math.round(beste.eigenschappen.huur * omvang * 0.55);
  const kosten = omzet * s.inkoop + personeel * s.loon + omvang * s.vast + huur + omvang * s.vast * 0.35;
  const netto = omzet - kosten;
  const bouw = omvang * s.bouw;
  return { sleutel, kavel: beste.naam, vraag, omvang, cap, bezetting: cap ? verkocht / cap : 0,
    omzet, kosten, netto, bouw, terug: netto > 0 ? bouw / netto : Infinity };
}

const alles = (stadsleutel) => Object.keys(SECTOREN).map(s => meet(stadsleutel, s));

if (require.main === module) {
  const stad = process.argv[2] || 'ijmuiden';
  console.log('Magnaat-balans voor ' + stad + ' (op maat gebouwd, maand ' + MAAND + ')\n');
  console.log('sector      | beste plek                     | maat | bezet | omzet/mnd | netto/mnd | terugverdiend');
  for (const r of alles(stad)) {
    console.log(r.sleutel.padEnd(11) + ' | ' + r.kavel.slice(0, 30).padEnd(30) + ' | ' +
      r.omvang.toString().padStart(4) + ' | ' +
      Math.round(r.bezetting * 100).toString().padStart(4) + '% | ' +
      Math.round(r.omzet).toString().padStart(9) + ' | ' + Math.round(r.netto).toString().padStart(9) + ' | ' +
      (Number.isFinite(r.terug) ? r.terug.toFixed(1) + ' maanden' : 'NOOIT'));
  }
  /* De band is smal, en dat kan nu ook: op maat gemeten horen de sectoren dicht
     bij elkaar te liggen. Elders kiest iedereen dezelfde sector. */
  const stuk = alles(stad).filter(r => !(r.terug >= DOEL - 3 && r.terug <= DOEL + 3));
  console.log('\n' + (stuk.length ? 'BUITEN DE BAND (' + (DOEL - 3) + '-' + (DOEL + 3) + ' maanden): ' + stuk.map(r => r.sleutel).join(', ')
    : 'alle sectoren binnen de band van ' + (DOEL - 3) + ' tot ' + (DOEL + 3) + ' maanden'));
}

module.exports = { meet, alles, MAAND, DOEL };
