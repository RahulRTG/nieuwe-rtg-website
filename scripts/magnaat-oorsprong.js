/* Magnaat-oorsprongsmeter: heeft wat er gekocht wordt een producent?

   ./magnaat-pomp.js bewaakt de ene helft van de eerste wet uit ECONOMIE.md --
   *iedere euro heeft een tegenpartij*. Dit script meet de andere helft:

     **Ieder product heeft een oorsprong. Iedere dienst heeft capaciteit.**

   EN HET IS EEN METER EN GEEN KEURING, want de wet betekent iets anders dan hij
   op het eerste gezicht lijkt te zeggen. IJmuiden is een stad en niet een
   wereld: een restaurant dat aardappelen koopt, koopt ze grotendeels van buiten,
   en dat hoort ook zo. Wat de wet verbiedt is niet dat er iets van buiten komt
   -- het is dat er iets uit het NIETS komt terwijl het van binnen lijkt te
   komen. Zolang dat verschil onbenoemd blijft, weet niemand hoe groot de eigen
   economie eigenlijk is.

   DUS MEET DIT SCRIPT DE GRENS ZELF: van alles wat de bedrijven in een stad
   inkopen, welk deel wordt geleverd door een bedrijf DAT ER IS -- en dat er dus
   capaciteit voor kwijt is? De rest komt van buiten de stad. Dat is een
   legitiem antwoord; het moet alleen hardop staan.

   WAT DE UITKOMST BETEKENT:

     endogeen laag   de stad is vooral een afzetmarkt. Prima voor een campagne
                     van een paar zaken, maar er is geen keten om te breken en
                     een storing bij een leverancier raakt niemand.
     endogeen hoog   er ontstaat een keten, en dan begint alles wat ECONOMIE.md
                     belooft: een misgelopen levering, een leverancier die
                     omvalt, een schaars onderdeel.

   Er staat GEEN GOEDE WAARDE bij, want die is er niet. Dit getal is een
   eigenschap van de wereld die gespeeld wordt, niet van de code.

   Draaien: node scripts/magnaat-oorsprong.js */
'use strict';

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { SECTOREN, SECTORLIJST } = require('../server/kern/spellen/magnaat/sectoren');
const HG = require('../server/kern/spellen/magnaat/handelsgoed');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const MAANDEN = 24;

/* Een stad met van elke sector een zaak. Dat is met opzet de GUNSTIGSTE
   opstelling voor de dekkingsgraad: elke leverende sector is aanwezig, dus wat
   hier niet gedekt wordt, wordt in een gewone partij zeker niet gedekt. */
function stad() {
  const m = maakMagnaat();
  const p = { id: 'oor', soort: 'magnaat', spelers: ['anna'], teams: [0], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  p.staat.geld.anna = 50000000;
  const kavels = kaart('ijmuiden').kavels.slice();
  let n = 0;
  for (const sector of SECTORLIJST) {
    /* Een kavel dat deze sector aankan; de kaart bepaalt waar wat mag. */
    const kav = kavels.find((k, i) => {
      const r = m.spel.zet(p, 'anna', { actie: 'open', kavel: k.id, sector, omvang: 30 });
      if (r.ok) { kavels.splice(i, 1); return true; }
      return false;
    });
    if (kav) n++;
  }
  for (let i = 0; i < MAANDEN; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
  return { m, p, zaken: p.staat.vestigingen.anna || [], n };
}

/* WAT ER GEKOCHT WORDT, per handelssoort, over de hele stad. Uit dezelfde
   functie waarmee het spel het rekent (handelsgoed.js `behoefte`), want een
   meter die zijn eigen som maakt, meet zichzelf. */
function gekocht(zaken) {
  const uit = Object.fromEntries(HG.HANDELSSOORTEN.map(s => [s, 0]));
  for (const v of zaken) {
    const omzet = v.maanden > 0 ? v.omzetTotaal / v.maanden : 0;
    for (const soort of HG.HANDELSSOORTEN) uit[soort] += HG.behoefte(v, omzet, soort);
  }
  return uit;
}

/* EN WAT ER GELEVERD KAN WORDEN. Alleen door zaken die de soort werkelijk
   LEVEREN, en begrensd op hun capaciteit -- want dat is de hele wet: een
   levering die geen capaciteit kost, is er geen. */
function geleverd(zaken) {
  const uit = Object.fromEntries(HG.HANDELSSOORTEN.map(s => [s, 0]));
  for (const v of zaken) {
    const soort = SECTOREN[v.sector].levert;
    if (!soort) continue;
    const omzet = v.maanden > 0 ? v.omzetTotaal / v.maanden : 0;
    /* Wat deze zaak in een maand aan de markt kan leveren, uitgedrukt in
       dezelfde handelseenheden als de behoefte. */
    uit[soort] += omzet / Math.max(1, HG.MARKTPRIJS[soort]);
  }
  return uit;
}

/* EN WAT ER WERKELIJK DOORHEEN LOOPT. Dit is het scherpste getal van deze
   meter, en het verschil met `leverbaar` is de hele bevinding: capaciteit die
   bestaat is niet hetzelfde als een keten die er is.

   TOEN DEZE METER WERD GEBOUWD STOND HIER 0%: zonder contract was de inkoop van
   een zaak een percentage van zijn eigen omzet en ging er geen euro naar een
   leverancier, ook niet als die op het kavel ernaast stond met capaciteit over.
   magnaat/keten.js verdeelt sindsdien wat de contracten niet dekken over de
   leveranciers die er zijn. Dit getal is dus de reden dat deze meter bestaat. */
function verbonden(st) {
  const uit = Object.fromEntries(HG.HANDELSSOORTEN.map(x => [x, 0]));
  for (const c of (st.contracten || []))
    if (c.status === 'loopt' && uit[c.soort] !== undefined) uit[c.soort] += c.eenheden;
  /* EN SINDS magnaat/keten.js OOK DE VRIJE MARKT. Dit is de regel waarvoor deze
     meter is gebouwd: hij stond op nul zolang alleen contracten telden. */
  for (const perSoort of Object.values((st.keten || {}).perAfnemer || {}))
    for (const [soort, x] of Object.entries(perSoort))
      if (uit[soort] !== undefined) uit[soort] += x.lokaal || 0;
  return uit;
}

const s = stad();
const koop = gekocht(s.zaken);
const lever = geleverd(s.zaken);
const echt = verbonden(s.p.staat);

console.log('\nMagnaat-oorsprongsmeter: heeft wat er gekocht wordt een producent?\n');
console.log(s.n + ' zaken, een van elke sector, ' + MAANDEN + ' maanden\n');
console.log('handelssoort | gevraagd/mnd | leverbaar hier | loopt er echt door | levert');
let totKoop = 0, totDek = 0, totEcht = 0;
for (const soort of HG.HANDELSSOORTEN) {
  const k = koop[soort], l = lever[soort], e = echt[soort] || 0;
  totKoop += k; totDek += Math.min(k, l); totEcht += Math.min(k, e);
  const leveranciers = SECTORLIJST.filter(x => SECTOREN[x].levert === soort);
  console.log(soort.padEnd(12) + ' | ' + Math.round(k).toString().padStart(12)
    + ' | ' + Math.round(l).toString().padStart(14)
    + ' | ' + Math.round(e).toString().padStart(18)
    + ' | ' + (leveranciers.join(', ') || '-'));
}
const kan = totKoop > 0 ? totDek / totKoop : 0;
const doet = totKoop > 0 ? totEcht / totKoop : 0;
console.log('\nKAN uit de stad komen : ' + Math.round(kan * 100) + '%   (er is capaciteit voor)');
console.log('LOOPT er werkelijk door: ' + Math.round(doet * 100)
  + '%   (contract of vrije markt)');
console.log('\nHet verschil tussen die twee is wat er niet lokaal geleverd KAN worden en');
console.log('dus van buiten de wereld komt. Dat is een legitiem antwoord -- IJmuiden is');
console.log('een stad en geen wereld -- zolang het maar hardop staat.');
for (const soort of HG.HANDELSSOORTEN) {
  const kr = (s.p.staat.keten || {}).krapte || {};
  if (kr[soort] > 0.001) console.log('  krap: ' + soort + ' -- '
    + Math.round(kr[soort] * 100) + '% van de vraag kan de stad niet leveren');
}
