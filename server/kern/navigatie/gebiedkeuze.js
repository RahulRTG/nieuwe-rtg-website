/* WELK GEBIED LIGT ONDER DIT PUNT? Afgesplitst van ./gebieden.js, dat de
   catalogus en de licentiepoort houdt -- zelfde opzet als naad/haalbaar/gevolg
   in kern/move: een kleine module per vraag.

   EEN RECHTHOEK IS GEEN GRENS, en dat is de hele moeilijkheid. De contour van
   een land is een veelhoek; wat wij van de bron overhouden is het omhullende
   vak. Het Nederlandse vak bevat Belgisch en Duits land, dus twee landen
   overlappen echt.

   HIER STOND EERST "HET KLEINSTE VAK WINT", EN DAT WAS FOUT -- gemeten en niet
   bedacht: het Belgische vak is kleiner dan het Nederlandse, dus Maastricht
   kwam op `belgie` uit. Een lid had daar een route over het Belgische wegennet
   gekregen, met een echte reistijd en een bron eronder: de gevaarlijkste vorm
   van fout, want hij ziet compleet uit.

   WAT ER NU BESLIST IS VERKLAARDE OMVATTING EN GEEN OPPERVLAK. De bronindex
   geeft per gebied zijn OUDER (`europe/netherlands` hangt onder `europe`,
   `netherlands/noord-holland` onder `netherlands`). Ligt een kandidaat in de
   ouderketen van een andere kandidaat, dan is dat echte omvatting en wint het
   KIND -- de bron zegt dat, wij raden het niet.

   Blijven er daarna kandidaten over die geen familie zijn (Nederland en Belgie
   zijn buren), dan kiest deze module NIET. Is er van precies een een pakket
   gebouwd, dan is de keuze GEDWONGEN en heet hij zo; anders komt er null met de
   kandidaten. Dat is met opzet onbevredigend: het juiste gereedschap is een
   veelhoek. Zolang die er niet is, is "met een rechthoek niet te zeggen"
   eerlijker dan een lid over het net van het buurland laten rijden. */
'use strict';

/* Een vak is geldig als het vier eindige getallen heeft die de aarde niet
   verlaten EN niet omgekeerd staan. Een omgedraaid vak omvat NIETS en zou
   anders langskomen als "past nergens" in plaats van als fout in de data. */
function vakGeldig(v) {
  if (!v) return false;
  const n = [v.lat0, v.lat1, v.lng0, v.lng1].map(Number);
  if (!n.every(Number.isFinite)) return false;
  if (Math.abs(n[0]) > 90 || Math.abs(n[1]) > 90) return false;
  if (Math.abs(n[2]) > 180 || Math.abs(n[3]) > 180) return false;
  return n[0] < n[1] && n[2] < n[3];
}
const inVak = (v, p) => vakGeldig(v) && p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Number(p.lat) >= v.lat0 && Number(p.lat) <= v.lat1
  && Number(p.lng) >= v.lng0 && Number(p.lng) <= v.lng1;
const vakOppervlak = (v) => vakGeldig(v) ? (v.lat1 - v.lat0) * (v.lng1 - v.lng0) : Infinity;

/* De ouderketen van een gebied, binnen de meegegeven lijst. Een keten die naar
   zichzelf wijst of rondloopt, stopt: een stukke index mag geen oneindige lus
   worden, en dat is geen theoretisch bezwaar bij data van buiten. */
function ouders(code, perCode) {
  const uit = [];
  const gezien = new Set();
  let n = perCode.get(code);
  while (n && n.ouder && !gezien.has(n.ouder)) {
    gezien.add(n.ouder);
    uit.push(n.ouder);
    n = perCode.get(n.ouder);
  }
  return uit;
}

function gebiedVoor(punt, lijst) {
  const rij = (Array.isArray(lijst) ? lijst : []).filter(g => g && g.code);
  const passen = rij.filter(g => inVak(g.vak, punt));
  if (!passen.length) {
    return { gebied: null, grond: 'geen-vak', kandidaten: [],
      waarom: 'Geen aangeboden gebied omvat dit punt; RTG biedt hier (nog) geen kaart aan.' };
  }
  if (passen.length === 1) {
    return { gebied: passen[0], grond: 'enig-vak', vakIsGeenGrens: true, kandidaten: [] };
  }

  /* VERKLAARDE OMVATTING EERST: gooi elke kandidaat weg die de OUDER is van een
     andere kandidaat. Wat overblijft zijn de fijnste gebieden die de bron kent. */
  const perCode = new Map(rij.map(g => [g.code, g]));
  const isOuderVan = new Set();
  for (const g of passen) for (const o of ouders(g.code, perCode)) isOuderVan.add(o);
  const fijnste = passen.filter(g => !isOuderVan.has(g.code));

  if (fijnste.length === 1) {
    return { gebied: fijnste[0], grond: 'kind-in-ouder', vakIsGeenGrens: true,
      kandidaten: passen.filter(g => g !== fijnste[0]).map(g => g.code).sort() };
  }

  /* Geen familie: buren. Dan beslist een rechthoek niets -- tenzij er van
     precies een een pakket ligt, en dan is de keuze gedwongen en niet gemeten. */
  const gebouwd = fijnste.filter(g => g.gebouwd);
  if (gebouwd.length === 1) {
    return { gebied: gebouwd[0], grond: 'enige-gebouwde', vakIsGeenGrens: true,
      kandidaten: passen.filter(g => g !== gebouwd[0]).map(g => g.code).sort(),
      waarom: 'Meerdere vakken omvatten dit punt en ze zijn geen familie; alleen van ' +
        gebouwd[0].code + ' ligt er een pakket, dus die keuze is gedwongen en niet gemeten.' };
  }
  const namen = fijnste.map(g => g.code).sort();
  return { gebied: null, grond: 'meerdere-vakken', kandidaten: namen,
    waarom: 'Dit punt ligt in ' + namen.length + ' vakken die geen familie zijn (' + namen.join(', ') +
      '). Een rechthoek is geen grens en RTG kiest hier niet: een route over het net van het ' +
      'buurland is erger dan geen route.' };
}

module.exports = { gebiedVoor, vakGeldig, inVak, vakOppervlak, ouders };
