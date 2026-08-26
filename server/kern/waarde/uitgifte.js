/* WAARDE IN OMLOOP BRENGEN: een werkgever geeft een maaltijdbudget, een
   gemeente een sporttegoed, RTG een tegemoetkoming.

   ER WORDT HIER GEEN GELD GEMAAKT, en dat is de belangrijkste zin van dit
   bestand. Deze module maakt alleen de POSITIE: de rekening, de klasse, de
   eigenaar, het beleid en de vervaldatum. De euro's moeten er daarna in, en die
   komen van de rekening van de uitgever via het gewone pay-grootboek -- dubbel
   geboekt, langs dezelfde poort als elke andere betaling.

   Dat is geen omslachtigheid maar de kernregel uit kern/pay/index.js: geld
   ontstaat nooit uit het niets. Een werkgever die 500 euro maaltijdbudget
   uitdeelt, is 500 euro kwijt. Zou deze module zelf mogen bijschrijven, dan
   bestond er een tweede manier om saldo te laten ontstaan, en dan is de
   sluitcontrole (de som van alle saldi is nul) niet langer een bewijs maar een
   gewoonte. Vandaar de tweetrapsvorm: `bereidVoor()` geeft de positie terug,
   de aanroeper boekt.

   DE VERVALDATUM KOMT UIT DE KLASSE en niet uit de wens van de uitgever. Een
   werkgever kan een budget korter laten lopen dan de klasse toestaat, nooit
   langer: anders is "vervalt na een jaar" een suggestie in plaats van een
   eigenschap, en dan staat er een eeuwige verplichting op de balans van iemand
   die dacht dat hij er vanaf was.

   WAT ER NIET IN MAG. Een klasse die uitbetaalbaar is (PARTNER_SETTLEMENT) is
   hier niet uit te geven. Zou dat wel kunnen, dan is uitgifte een manier om
   uitbetaalbaar tegoed te maken zonder de bevoegdheid die daarvoor bestaat, en
   dan is de bevoegdhedenlijst een formaliteit geworden. */
'use strict';

const MAX_PER_LID = 25;   // meer open budgetten per lid is een lek, geen gebruik

module.exports = ({ api, crypto, nu }) => {
  const { KLASSEN, registreer, positie, positiesVan } = api;

  /* De rekening van een uitgegeven positie. De vorm 'waarde:' + id is een regel
     van dit domein, net als 'lid:' en 'partner:' dat zijn -- wie hem nodig heeft
     vraagt hem hier op en tikt hem niet na. */
  const rekVan = id => 'waarde:' + id;

  function bereidVoor({ klasse, aanCodenaam, centen, uitgever, beleid, vervaltOp, oms }) {
    const spec = KLASSEN[klasse];
    if (!spec) return { status: 400, error: 'Onbekende waardeklasse.' };
    if (spec.uitbetaalbaar) return { status: 403,
      error: 'Deze klasse is uitbetaalbaar en wordt niet uitgegeven; daar bestaat een bevoegdheid voor.' };
    const aan = String(aanCodenaam || '').trim();
    if (!aan) return { status: 400, error: 'Aan wie?' };
    if (!uitgever) return { status: 400, error: 'Van wie komt dit?' };
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (Number.isFinite(spec.plafondCenten) && c > spec.plafondCenten) return { status: 409,
      error: 'Boven het maximum van ' + (spec.plafondCenten / 100).toFixed(0) + ' euro voor ' + spec.naam.toLowerCase() + '.' };
    if (positiesVan(aan).length >= MAX_PER_LID) return { status: 429,
      error: 'Dit lid heeft te veel open posities.' };

    /* Korter mag, langer niet. `vervaltNaDagen` van de klasse is het plafond op
       de looptijd en niet een standaardwaarde die je kunt overschrijven. */
    const max = spec.vervaltNaDagen ? nu() + spec.vervaltNaDagen * 86400000 : null;
    let verval = Number.isFinite(vervaltOp) ? vervaltOp : max;
    if (Number.isFinite(max) && (!Number.isFinite(verval) || verval > max)) verval = max;
    if (Number.isFinite(verval) && verval <= nu()) return { status: 400, error: 'Die vervaldatum is al geweest.' };

    const id = 'VAL' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const rek = rekVan(id);
    const r = registreer({ rek, klasse, uitgever: String(uitgever).slice(0, 60),
      eigenaar: aan, beleid: beleid || {}, vervaltOp: verval });
    if (r.error) return r;
    return { ok: true, rek, id, klasse, aan, centen: c, vervaltOp: verval,
      oms: String(oms || spec.naam).slice(0, 80), positie: positie(rek) };
  }

  return { uitgifteVoorbereiden: bereidVoor, rekVanWaarde: rekVan, MAX_PER_LID };
};
