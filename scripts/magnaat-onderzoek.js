#!/usr/bin/env node
/* DE ONDERZOEKSMETER VAN MAGNAAT: verdient een uitvinding zichzelf terug?

   `magnaat-balans.js` doet dit voor SECTOREN en `magnaat-strateeg.js` voor
   STIJLEN. Deze doet het voor de boom, en hij bestaat omdat het toernooi een
   fout vond die geen enkele toets kon zien: het profiel dat onderzocht EN
   uitrolde deed het slechter dan het profiel dat alleen onderzocht. De meter
   erachter zei waarom -- `uitgerold: 0`. In zesendertig maanden werd er wel
   uitgevonden en NOOIT uitgerold, want geen enkele uitvinding verdiende zijn
   uitrol terug.

   DE OORZAAK WAS DEZELFDE ALS BIJ DE CONTRACTEN, en dat is de reden dat dit
   script er nu staat. Drie van de zeven knopen grepen aan op `vast`, en die
   post is over alle sectoren 0,3 tot 5,1 procent van de omzet. Twintig procent
   van drie procent is niets. Een korting op een kleine post is een kleine
   korting, hoe groot het percentage ook oogt -- precies wat er eerder gebeurde
   met een leveringskorting van twaalf procent op een inkooppost van vijf.

   WAT DIT MEET, per knooppunt en per sector:
     UITROL   implementatie / besparing per maand. Dat is de vraag die een
              speler werkelijk stelt als hij het al weet: zet ik het hier neer?
     VOLLEDIG (onderzoek + N x implementatie) / (N x besparing). De vraag of de
              tak uberhaupt de moeite waard was. N is het aantal vestigingen
              waarover de kennis wordt uitgesmeerd -- kennis is van het bedrijf,
              dus wie er drie heeft betaalt het onderzoek een keer.

   Gebruik: node scripts/magnaat-onderzoek.js [aantal-vestigingen] */
'use strict';
const O = require('../server/kern/spellen/magnaat/onderzoek');
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { alles } = require('./magnaat-balans');

/* De band, en hij wordt op de MEDIAAN gemeten en niet op de beste sector. Dat
   is een correctie op deze meter zelf: op zijn beste sector hoort een uitvinding
   snel terug te verdienen -- dat is wat een specialisme is -- dus meet je daar
   niets mee. De vraag die telt is wat hij op een DOORSNEE zaak doet:

     korter dan 4 maanden -> overal uitrollen is altijd goed, en dan is het geen
       keuze maar een knop;
     langer dan 10 maanden -> niemand rolt het uit, want voor hetzelfde geld
       bouw je erbij.

   DE BOVENGRENS LIGT ONDER DE TWAALF VAN DE SECTORIJKING, en dat is geen
   toevallig getal maar de kern van deze laag. Een euro in een NIEUWE zaak
   verdient zichzelf in twaalf maanden terug EN levert capaciteit op; een euro in
   een uitrol verdient zichzelf terug en levert geen enkele stoel extra. Wie
   evenveel vraagt voor het tweede als voor het eerste, krijgt een tak die
   niemand ooit inslaat. Het toernooi zei dat ook precies zo: met een uitrol die
   zich in veertien maanden terugverdiende bleef `handwerk` -- dezelfde stijl
   zonder onderzoek -- er bijna twee keer zo goed voor staan.

   Daarvoor stond er een andere fout: drie knopen grepen aan op `vast`, een post
   van 0,3 tot 5,1 procent van de omzet, en verdienden hun uitrol NOOIT terug. */
const BAND = [4, 10];
const mediaan = (rij) => {
  const g = rij.slice().sort((a, b) => a - b);
  return g.length % 2 ? g[(g.length - 1) / 2] : (g[g.length / 2 - 1] + g[g.length / 2]) / 2;
};
const VESTIGINGEN = Number(process.argv[2]) || 3;
/* Hoeveel vrije capaciteit een zaak heeft als je de opbrengsttak meet; zie de
   uitleg bij `marge` hieronder. */
const RUIMTE = 0.25;

/* De cijfers van een op maat gebouwde vestiging, per sector, uit de
   balansmeter. Dezelfde bron als de sectorijking: twee meters die elk hun eigen
   vestiging verzinnen zouden twee antwoorden op dezelfde vraag geven. */
function cijfers(r) {
  const s = SECTOREN[r.sleutel];
  return {
    vast: r.omvang * s.vast,
    inkoop: r.omzet * s.inkoop,
    lonen: r.personeel * s.loon,
    /* DE MARGE IS BEGRENSD DOOR WAT ERBIJ KAN. Een uitvinding die de VRAAG
       verhoogt levert niets op in een zaak die al vol zit -- dan wordt het
       `gemist` en geen omzet. Zonder die begrenzing ziet de opbrengsttak eruit
       als de beste van de boom terwijl hij in de praktijk niets doet.

       RUIMTE is daarom een UITGESPROKEN AANNAME en geen meting: de balansmeter
       bouwt op maat, dus daar zit elke zaak voor 90 tot 100 procent vol en zou
       elke vraagverhoging op nul uitkomen. Dat is te streng -- wie de
       opbrengsttak in gaat breidt ook uit; dat is juist de strategie die deze
       tak mogelijk maakt. Een kwart ruimte is de zaak van iemand die net
       uitgebreid heeft. Wie de aanname wil zien bewegen, verzet dit getal. */
    marge: (r.omzet - r.omzet * s.inkoop) * RUIMTE
  };
}

function meet(stadsleutel = 'ijmuiden', n = VESTIGINGEN) {
  const perSector = alles(stadsleutel).map(r => ({ r, c: cijfers(r) }));
  return O.KNOPEN.map(sleutel => {
    const k = O.BOOM[sleutel];
    const onderzoek = k.kosten * k.duur;
    const rijen = perSector.map(({ r, c }) => {
      const perMaand = O.opbrengstVan(sleutel, c);
      // de uitrol is een deel van de bouwsom, dus per sector een ander bedrag
      const impl = O.uitrolkosten({ gebouwdVoor: r.bouw }, sleutel);
      return { sector: r.sleutel, perMaand, impl,
        uitrol: perMaand > 0 ? impl / perMaand : Infinity,
        volledig: perMaand > 0 ? (onderzoek + n * impl) / (n * perMaand) : Infinity };
    });
    const beste = rijen.reduce((a, b) => (b.uitrol < a.uitrol ? b : a));
    const mid = mediaan(rijen.map(x => x.uitrol));
    return { sleutel, naam: k.naam, tak: k.tak, onderzoek, deel: k.implementatie,
      /* EEN UITVINDING HOEFT NIET OVERAL TE WERKEN -- dat is juist de bedoeling:
         brandstof is voor een vervoerder een grote post en voor een kantoor
         niets. Er wordt daarom gemeten op de sector waar hij het BESTE past, en
         de eis is dat die sector bestaat. */
      beste: beste.sector, implementatie: beste.impl, uitrol: beste.uitrol, volledig: beste.volledig,
      mediaan: mid,
      // hoe breed hij werkt: op hoeveel sectoren hij binnen de band valt
      breedte: rijen.filter(x => x.uitrol <= BAND[1]).length, rijen };
  });
}

/* `bouwmethode` verdient zich niet per MAAND terug maar per NIEUWE ZAAK, en
   daarom staat hij apart. Hem in dezelfde tabel zetten met "nooit" erachter zou
   suggereren dat hij stuk is; hij is een andere soort. */
const EENMALIG = new Set(O.KNOPEN.filter(s => Object.keys(O.BOOM[s].effect).every(v => v === 'bouw')));

if (require.main === module) {
  const stad = process.argv[3] || 'ijmuiden';
  console.log('Magnaat-onderzoek voor ' + stad + ' (' + VESTIGINGEN + ' vestigingen)\n');
  console.log('knooppunt          | tak          | onderzoek | uitrol | beste sector | op zijn best | mediaan | volledig | breed');
  const rijen = meet(stad);
  for (const r of rijen) {
    if (EENMALIG.has(r.sleutel)) continue;
    console.log(r.sleutel.padEnd(18) + ' | ' + r.tak.padEnd(12) + ' | ' +
      String(r.onderzoek).padStart(9) + ' | ' + String(Math.round(r.deel * 100) + '%').padStart(6) + ' | ' +
      r.beste.padEnd(12) + ' | ' +
      (Number.isFinite(r.uitrol) ? r.uitrol.toFixed(1) + ' mnd' : 'NOOIT').padStart(12) + ' | ' +
      (Number.isFinite(r.mediaan) ? r.mediaan.toFixed(1) + ' mnd' : 'NOOIT').padStart(7) + ' | ' +
      (Number.isFinite(r.volledig) ? r.volledig.toFixed(1) + ' mnd' : 'NOOIT').padStart(8) + ' | ' +
      r.breedte + '/7');
  }
  for (const r of rijen.filter(x => EENMALIG.has(x.sleutel))) {
    const s = SECTOREN.horeca, korting = 1 - O.BOOM[r.sleutel].effect.bouw;
    console.log('\n' + r.sleutel + ' (' + r.naam + ') werkt EENMALIG, op wat je nog bouwt:');
    console.log('  onderzoek ' + r.onderzoek + ' + uitrol ' + r.implementatie +
      ' (' + Math.round(r.deel * 100) + '% van de bouwsom) = ' + (r.onderzoek + r.implementatie) + ', en bespaart ' +
      Math.round(korting * 100) + '% van elke volgende bouwsom' +
      ' (een restaurant van 44 stoelen: ' + Math.round(44 * s.bouw * korting) + ')');
  }
  const stuk = rijen.filter(r => !EENMALIG.has(r.sleutel) && !(r.mediaan >= BAND[0] && r.mediaan <= BAND[1]));
  console.log('\n' + (stuk.length
    ? 'BUITEN DE BAND (' + BAND[0] + '-' + BAND[1] + ' maanden uitrol): ' +
      stuk.map(r => r.sleutel + ' ' + (Number.isFinite(r.mediaan) ? r.mediaan.toFixed(0) : 'nooit')).join(', ')
    : 'elke uitvinding verdient zijn uitrol terug binnen ' + BAND[0] + ' tot ' + BAND[1] +
      ' maanden op een doorsnee zaak'));
}

module.exports = { meet, cijfers, BAND, EENMALIG, VESTIGINGEN };
