/* BTW: welk tarief geldt, en waarom staat het niet meer op vier plekken.

   HET GAT (PRIJZEN.md 4.10). `* 1.21` stond hard in kern/fonds.js en in
   kern/lid/facturen.js, terwijl dit platform landen KENT: er is een landtabel
   met tarieven (kern/fiscaal/landen.js), en kern/thuis/zakelijk.js haalt het
   logiestarief daar keurig uit op. Twee manieren om dezelfde vraag te
   beantwoorden, en de simpelste won op de plek waar het het meeste uitmaakt --
   de factuur van een lid.

   Gevolg: een Lifestyle-lid buiten Nederland kreeg 21% Nederlandse btw op een
   bijdrage van 20.000 euro per maand. Dat is geen afrondingsfout.

   WAT DIT BESTAND WEL EN NIET DOET. Het geeft het TARIEF dat bij een profiel
   hoort en rekent er netto/bruto mee. Het bepaalt NIET waar een dienst
   belastbaar is -- dat is een juridische vraag (plaats van dienst, B2B of B2C,
   verleggingsregeling) die van meer afhangt dan een landcode, en die hoort bij
   een fiscalist en niet in een tabel. Vandaar dat een contract een
   `btwProfiel` draagt dat IEMAND heeft gekozen, in plaats van dat deze module
   uit een landcode een tarief afleidt en doet alsof dat het antwoord is.

   Dat onderscheid is de hele reden dat het een profiel heet en geen land. */
'use strict';

/* De profielen. Elk profiel is een BESLUIT dat op een contract wordt gezet, niet
   een afleiding uit een adres. `verlegd` betekent: er wordt geen btw in rekening
   gebracht omdat de afnemer hem zelf aangeeft -- het tarief is dan nul en dat is
   iets anders dan vrijgesteld. */
const PROFIELEN = {
  'nl-21': { id: 'nl-21', land: 'NL', pct: 21, naam: 'Nederland, algemeen tarief', verlegd: false },
  'nl-9': { id: 'nl-9', land: 'NL', pct: 9, naam: 'Nederland, verlaagd tarief', verlegd: false },
  'eu-b2b-verlegd': { id: 'eu-b2b-verlegd', land: null, pct: 0, verlegd: true,
    naam: 'EU, zakelijke afnemer met btw-nummer: btw verlegd' },
  'buiten-eu': { id: 'buiten-eu', land: null, pct: 0, verlegd: false,
    naam: 'Buiten de EU: geen Nederlandse btw' },
  'es-21': { id: 'es-21', land: 'ES', pct: 21, naam: 'Spanje, algemeen tarief', verlegd: false },
  'es-10': { id: 'es-10', land: 'ES', pct: 10, naam: 'Spanje, verlaagd tarief', verlegd: false }
};

const STANDAARD = 'nl-21';

function profiel(id) { return PROFIELEN[String(id || '')] || PROFIELEN[STANDAARD]; }
function pctVan(id) { return profiel(id).pct; }

/* Van een bedrag EX btw naar de opbouw. Alles in centen, want een half procent
   van een half cent is precies waar een afronding zich verstopt. */
function overNetto(nettoCenten, profielId) {
  const p = profiel(profielId);
  const netto = Math.max(0, Math.round(Number(nettoCenten) || 0));
  const btw = Math.round(netto * p.pct / 100);
  return { profiel: p.id, pct: p.pct, verlegd: p.verlegd,
    nettoCenten: netto, btwCenten: btw, brutoCenten: netto + btw };
}

/* En terug: van een bedrag INCLUSIEF btw naar de opbouw. Dit is de kant waar de
   oude code zat (`bedrag / 1.21`), en waar de fout het hardst aankwam. */
function overBruto(brutoCenten, profielId) {
  const p = profiel(profielId);
  const bruto = Math.max(0, Math.round(Number(brutoCenten) || 0));
  const netto = Math.round(bruto / (1 + p.pct / 100));
  return { profiel: p.id, pct: p.pct, verlegd: p.verlegd,
    nettoCenten: netto, btwCenten: bruto - netto, brutoCenten: bruto };
}

/* De controle die de oude code niet had: telt de opbouw op? Bij een tarief van
   nul is btw nul en netto gelijk aan bruto -- dat lijkt triviaal tot iemand
   `bruto / 1.21` toepast op een verlegde factuur. */
function keur(o) {
  if (!o) return 'geen opbouw';
  if (!Number.isInteger(o.nettoCenten) || !Number.isInteger(o.btwCenten) || !Number.isInteger(o.brutoCenten))
    return 'de bedragen zijn geen hele centen';
  if (o.nettoCenten + o.btwCenten !== o.brutoCenten)
    return 'netto (' + o.nettoCenten + ') plus btw (' + o.btwCenten + ') is niet bruto (' + o.brutoCenten + ')';
  if (o.pct === 0 && o.btwCenten !== 0) return 'een tarief van nul hoort geen btw op te leveren';
  if (o.verlegd && o.btwCenten !== 0) return 'bij verlegde btw wordt er niets in rekening gebracht';
  return null;
}

function lijst() {
  return Object.values(PROFIELEN).map(p => ({ id: p.id, naam: p.naam, pct: p.pct, land: p.land, verlegd: p.verlegd }));
}

module.exports = { PROFIELEN, STANDAARD, profiel, pctVan, overNetto, overBruto, keur, lijst };
