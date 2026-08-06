/* Payroll OS: DE REKENHULP BIJ HET SAMENSTELLEN.

   Afgesplitst van ./samenstellen.js, dat over de 10 KB ging. Drie pure functies
   met een grote rol: wat is een vaste omvang, welke dagen van een periode zijn
   werkdagen, en wat is het periodeloon.

   ALLE DRIE ZONDER KLOK EN ZONDER DATABASE. Dezelfde periode levert altijd
   hetzelfde aantal werkdagen, ook als je de run over een jaar overdoet -- dat
   is precies waarom een loonrun herhaalbaar is. */
'use strict';

const WEKEN_PER_MAAND = 52 / 12;

/* Een vaste omvang betekent: er is een afgesproken aantal uren per week, en het
   loon hangt niet af van hoeveel er is geklokt. Dat is wat een maandsalaris
   IS. De soorten staan met naam en niet als "alles behalve oproep": een nieuwe
   contractsoort hoort een keuze te zijn, geen stille aanname. */
const VASTE_OMVANG = ['vast', 'tijdelijk', 'minmax', 'stage'];
const heeftVasteOmvang = (c) => !!(c && VASTE_OMVANG.includes(c.soort) && Number(c.urenPerWeek) > 0);

/* De werkdagen van een periode. Maandag tot en met vrijdag, want dat is waar
   een maandsalaris naar rato op wordt gedeeld. Feestdagen tellen mee als
   werkdag: ze worden doorbetaald, dus ze verlagen het loon niet.

   Puur, en met opzet zonder new Date() van vandaag: dezelfde periode levert
   altijd hetzelfde aantal, ook als je de run over een jaar overdoet. */
function werkdagenVan(periode) {
  const [jaar, maand] = String(periode).split('-').map(Number);
  const dagen = [];
  const laatste = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
  for (let d = 1; d <= laatste; d++) {
    const dag = new Date(Date.UTC(jaar, maand - 1, d));
    const wd = dag.getUTCDay();
    if (wd !== 0 && wd !== 6) dagen.push(dag.toISOString().slice(0, 10));
  }
  return dagen;
}

/* Het periodeloon. Staat het als bedrag in het contract, dan is dat het --
   geen afleiding overheen. Staat het er niet, dan wordt het afgeleid uit het
   uurloon en de contracturen, en die afleiding komt als STAP mee zodat op de
   strook te zien is dat het een afleiding was en geen afspraak. */
function periodeloonVan(contract) {
  if (Number.isFinite(contract.maandloonCenten) && contract.maandloonCenten > 0)
    return { centen: Math.round(contract.maandloonCenten), afgeleid: false,
      uitleg: 'maandloon uit het contract' };
  const centen = Math.round(contract.uurloonCenten * contract.urenPerWeek * WEKEN_PER_MAAND);
  return { centen, afgeleid: true,
    uitleg: contract.uurloonCenten + ' cent x ' + contract.urenPerWeek + ' uur x ' +
      (Math.round(WEKEN_PER_MAAND * 100) / 100) + ' weken' };
}

module.exports = { WEKEN_PER_MAAND, VASTE_OMVANG, heeftVasteOmvang, werkdagenVan, periodeloonVan };
