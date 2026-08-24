/* SLIM BETALEN: welke potjes gaan er op, en in welke volgorde?

   Zodra een lid meer dan één positie heeft -- eigen saldo, een maaltijdbudget
   van de werkgever, een sporttegoed van de gemeente -- is "betaal 72 euro" geen
   opdracht meer maar een vraag. Het lid hoort die vraag niet te krijgen. Hij
   tikt één keer; deze module bepaalt de samenstelling.

   DE VOLGORDE IS DE HELE INHOUD, en hij is precies omgekeerd aan wat een
   systeem uit zichzelf zou doen. Een naïeve implementatie pakt het grootste
   potje eerst, of het eerste dat past. Beide zijn fout, want dan blijft het
   gebonden geld staan en gaat het vrije geld op -- en het gebonden geld is nou
   juist wat vervalt. Het lid ziet dan aan het eind van de maand een budget van
   veertig euro verlopen dat hij had kunnen gebruiken, terwijl hij zijn eigen
   geld heeft uitgegeven aan precies datgene waar het budget voor was.

   Dus: het meest beperkte eerst. Wat het snelst vervalt vóór wat later vervalt,
   gebonden vóór vrij, en de eigen wallet altijd als laatste. Die is de
   opvangbak en als enige bij te laden.

   WAT DEZE MODULE NIET DOET: boeken. Ze rekent uit, meer niet. De aanroeper
   (kern/pay/samen.js) voert het uit langs dezelfde poort als elke andere
   betaling -- ook de delen die uit een budget komen. Een samenstelling die haar
   eigen delen zou boeken, zou de poort omzeilen voor precies die betalingen
   waar het beleid het strengst is. */
'use strict';

/* De tijd uit de huisklok (server/lib/klok.js) voor het geval de aanroeper er
   geen meegeeft: welke potjes bijna vervallen bepaalt de volgorde, en die vraag
   hoort met een verzette klok gesteld te kunnen worden. */
const { nu: klokNu } = require('../../lib/klok');

module.exports = ({ KLASSEN, positie, positiesVan, beschikbaar, toets }) => {

  /* Hoe beperkt is deze positie? Hoger = eerder opmaken. De volgorde is een
     oordeel en geen natuurwet, dus hij staat hier op één plek in plaats van
     verspreid door een sorteerfunctie. */
  function beperktheid(p, nu) {
    let punten = 0;
    const b = p.beleid || {};
    if (Array.isArray(b.genres) && b.genres.length) punten += 2;
    if (b.venster) punten += 1;
    if (Number.isFinite(b.dagMaxCenten)) punten += 1;
    if (KLASSEN[p.klasse] && KLASSEN[p.klasse].bestedingsgebied !== 'rtg') punten += 2;
    // wat binnen dertig dagen vervalt, weegt zwaar: dat is geld dat anders weg is
    if (Number.isFinite(p.vervaltOp)) punten += (p.vervaltOp - nu) < 30 * 86400000 ? 4 : 2;
    return punten;
  }

  /* `saldoVan` en `dagBestedVan` komen van de aanroeper: RTG Pay houdt de saldi
     en het grootboek bij, deze laag niet. Zo blijft er één bron voor het geld. */
  function samenstellen({ codenaam, centen, genre, ontvanger, soort, saldoVan, dagBestedVan, eigenBeleid, nu }) {
    const doel = Math.round(Number(centen) || 0);
    const klok = Number(nu) || klokNu();
    if (doel <= 0) return { status: 400, error: 'Dat bedrag kan niet.' };
    const eigenRek = 'lid:' + codenaam;

    const kandidaten = [];
    for (const rek of positiesVan(codenaam)) {
      const p = positie(rek);
      if (!p) continue;
      const vrij = beschikbaar(rek, saldoVan(rek));
      const dag = dagBestedVan ? Math.round(Number(dagBestedVan(rek)) || 0) : 0;
      /* De beleidstoets krijgt hier BEWUST het volledige doelbedrag mee en niet
         het deel dat we uit deze positie zouden halen. Anders zou een dagmax van
         veertig euro te omzeilen zijn door hem in twee delen van twintig te
         knippen -- de toets zou allebei de delen goedkeuren en samen zijn ze
         boven de grens. Een grens die je met een schaar kunt halveren is geen
         grens. */
      const o = toets(p, { centen: Math.min(doel, Math.max(vrij, 0)), genre, soort: soort || 'besteden',
        ontvanger, dagBesteed: dag, nu: klok }, rek === eigenRek ? eigenBeleid : null);
      if (!o.mag) continue;
      if (vrij <= 0 && rek !== eigenRek) continue;
      kandidaten.push({ rek, klasse: p.klasse, vrij: Math.max(0, vrij), eigen: rek === eigenRek,
        rang: beperktheid(p, klok), vervaltOp: p.vervaltOp });
    }

    kandidaten.sort((a, b) => {
      if (a.eigen !== b.eigen) return a.eigen ? 1 : -1;          // de eigen wallet altijd laatst
      if (a.rang !== b.rang) return b.rang - a.rang;             // het meest beperkte eerst
      const av = Number.isFinite(a.vervaltOp) ? a.vervaltOp : Infinity;
      const bv = Number.isFinite(b.vervaltOp) ? b.vervaltOp : Infinity;
      return av - bv;                                            // en daarbinnen: wat het eerst vervalt
    });

    const delen = [];
    let rest = doel;
    for (const k of kandidaten) {
      if (rest <= 0) break;
      // de eigen wallet mag bijladen; de rest kan alleen geven wat hij heeft
      const neem = k.eigen ? rest : Math.min(k.vrij, rest);
      if (neem <= 0) continue;
      delen.push({ rek: k.rek, centen: neem, klasse: k.klasse, eigen: k.eigen });
      rest -= neem;
    }
    if (rest > 0) return { status: 402, error: 'Onvoldoende beschikbaar.', tekort: rest, delen };
    return { ok: true, delen, gebonden: delen.filter(x => !x.eigen).reduce((s, x) => s + x.centen, 0) };
  }

  return { samenstellen, beperktheid };
};
