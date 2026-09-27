/* VRIJHEID: DE BRUG NAAR HET VERZUIMREGISTER -- de `rooster`-adapter van de
   motor (index.js, roosterPas).

   WAAROM HET VERZUIMREGISTER. Een toegekende vrije dag moet aankomen op de
   loonstrook (die mag hem niet als gewerkt of juist als ontbrekend tellen) en
   bij wie plant. Beide lezen al EEN register -- kern/payroll/verzuim.js, met
   `voorPayroll()` voor de loonrun en `voorPlanning()` voor het
   afwezigheidsoverzicht van de leidinggevende (/api/supplier/verzuim/planning)
   -- en de oude verlofroute schrijft er al een goedgekeurd verlof in. Let op
   wat dat NIET is: geen roostermotor leest dit register (PLANNING.md par. 7),
   dus een roostervoorstel kan iemand op zijn vrije dag nog steeds inplannen. Een tweede plek voor dezelfde afwezigheid zou de fout zijn die
   verzuim.js in zijn kop beschrijft: twee opslagen lopen uit elkaar.

   WAT ER DOOR KOMT: alleen hele dagen, met een soort die de payroll kent. Een
   RTG Day en een verjaardag krijgen hun EIGEN soort (100% doorbetaald), want
   op de strook hoort te staan waarom iemand betaald vrij was, en `vakantie`
   zou suggereren dat het van het vakantiesaldo ging.

   WAT ER NIET DOOR KOMT, en dat staat erbij in plaats van stil weg te vallen:
   eerder weg, later beginnen en hersteltijd. De payroll rekent in werkdagen;
   een deel van een dag heeft er geen vorm. Voor een vaste kracht maakt dat
   niets uit (hij wordt uit zijn contract betaald), voor een oproepkracht wel,
   en die rekening verzinnen we niet. Stand NIET_DOORGEZET, met de reden.

   Een fout aan de andere kant gooit, zodat de motor ONBEKEND zet en
   `reconcile()` het later opnieuw kan proberen -- nooit "gelukt". */
'use strict';

const SOORT = Object.freeze({
  STATUTORY_LEAVE: 'vakantie', CONTRACTUAL_LEAVE: 'vakantie',
  SPECIAL_LEAVE: 'bijzonder', UNPAID_LEAVE: 'onbetaald',
  RTG_DAY: 'rtgdag', BIRTHDAY_LEAVE: 'verjaardag'
});

module.exports = function maakVerzuimbrug({ verzuim }) {
  const register = () => {
    const v = verzuim();
    if (!v || typeof v.meld !== 'function') throw new Error('Het verzuimregister (payrollOS.verzuim) is er niet.');
    return v;
  };

  function pas(code, w) {
    const soort = w && w.dag ? SOORT[w.categorie] : null;
    if (!soort) return { stand: 'NIET_DOORGEZET', reden: 'Een deel van een dag heeft geen vorm in de payroll (die rekent in werkdagen); ' +
      'deze vrije tijd staat wel in Mijn tijd maar niet op de strook of in het verzuimregister.' };
    const r = register().meld(code, w.persoon, { soort, van: w.datum, tot: w.datum, bron: w.bron }, 'vrijheid');
    if (r && r.error) throw new Error(r.error + (r.bezwaren ? ' ' + r.bezwaren.join(' ') : ''));
    return { stand: 'BIJGEWERKT' };
  }

  /* Staat hij er? Voor reconcile: eerst kijken, dan pas opnieuw proberen. */
  const heeft = (code, w) => register().heeftBron(code, w.persoon, w.bron);

  function terug(code, w) {
    const r = register().bronWeg(code, w.persoon, w.bron);
    if (r && r.error && r.status !== 404) throw new Error(r.error);
    return { stand: 'TERUGGEDRAAID' };
  }

  return { pas, heeft, terug, SOORT };
};
