/* WAT KOST EEN AI-BUNDEL? EEN BEREKENING, GEEN GEKOZEN GETAL.

   In kern/commercie/tegoed.js staan de bundels met capaciteit en een naam, en
   NADRUKKELIJK zonder prijs. Dat was eerlijk: de verkoopprijs hoort gerekend te
   worden en niet gekozen, en de inkoopkant bestond niet. Een bedrag verzinnen
   zou precies de fout van PRIJZEN.md 4.12 zijn -- een prijs waar geen som onder
   ligt.

   Maar "geen prijs" is ook geen eindstand: de klant krijgt te horen dat hij een
   bundel kan kopen, en dan hoort er te staan wat die kost. Vandaar deze module.

   DE KETEN, en elke stap heeft een reden:

       inkoopkosten          wat de capaciteit RTG werkelijk kost
       + veiligheidsmarge    modelprijzen bewegen; een bundel loopt maanden door
       + platformmarge       waar RTG aan verdient
       = verkoopprijs        afgerond op een bedrag dat een mens kan lezen

   DE INKOOPKOSTEN ZIJN EEN INSTELLING, GEEN AANNAME. Ze komen uit de boardroom,
   want alleen daar is bekend wat er werkelijk wordt betaald. Staat er niets, dan
   is er GEEN PRIJS -- en dat is een antwoord, geen fout. Wie dan toch een bedrag
   toont, verzint het. Zelfde regel als bij een contractuele pas: null betekent
   "hier is nog niets afgesproken", en nul zou "gratis" betekenen.

   DE VEILIGHEIDSMARGE IS ER OM EEN REDEN DIE TERUGKOMT. Een klant koopt
   capaciteit en geen model (zie tegoed.js), dus RTG mag het model onder een
   verkochte bundel vervangen. Dat is een vrijheid met een prijs: wordt het model
   duurder voordat de bundel op is, dan draagt RTG dat verschil. De marge is
   precies die verzekering, en zonder haar is de belofte "u koopt capaciteit"
   een open risico in plaats van een productkeuze.

   AFRONDEN GAAT OMHOOG, altijd. Een bundel die na afronding onder de kostprijs
   plus marges uitkomt, is een bundel die geld kost bij elke verkoop -- en dat
   merk je pas bij volume. */
'use strict';

const tegoed = require('./tegoed');

/* De marges. Percentages van de inkoopprijs, en ze staan hier en niet in een
   instelling: een platformmarge die per bundel te zetten is, wordt een
   onderhandeling met zichzelf. Verandert het model, dan is dat een besluit met
   een commit eronder. */
const VEILIGHEIDSMARGE = 0.25;   // 25% buffer op bewegende modelprijzen
const PLATFORMMARGE = 0.40;      // 40% waar RTG aan verdient

/* Afronden op hele euro's naar BOVEN, en bij grotere bedragen op vijf euro --
   een bundel van 137,44 leest als een rekenfout, ook als hij klopt. */
function nettePrijs(centen) {
  if (centen <= 5000) return Math.ceil(centen / 100) * 100;
  return Math.ceil(centen / 500) * 500;
}

/* De inkoopkosten per 1000 credits, uit de boardroom. `null` als er niets is
   ingesteld -- en dan is er geen prijs. */
function inkoopPer1000(instellingen) {
  const c = (instellingen || {}).inkoopCentenPer1000;
  return Number.isFinite(c) && c >= 0 ? Math.round(c) : null;
}

/* De prijs van een bundel, met de hele som erbij. De som hoort in het antwoord
   omdat een prijs zonder onderbouwing precies is wat we niet meer doen: wie hem
   opvraagt, kan zien waar hij vandaan komt. */
function prijsVan(bundelId, instellingen) {
  const b = tegoed.BUNDELS[String(bundelId || '')];
  if (!b) return { error: 'Deze bundel bestaat niet.' };
  if (!b.credits)
    return { bundel: b.id, naam: b.naam, contractueel: true, centen: null,
      reden: b.naam + ' is een contractafspraak en wordt niet los verkocht.' };

  const per1000 = inkoopPer1000(instellingen);
  if (per1000 === null)
    return { bundel: b.id, naam: b.naam, credits: b.credits, centen: null,
      reden: 'De inkoopkosten staan niet ingesteld; zonder die som is er geen prijs. ' +
        'Zet ze in de boardroom.' };

  const inkoop = Math.round(b.credits / 1000 * per1000);
  const naVeiligheid = Math.round(inkoop * (1 + VEILIGHEIDSMARGE));
  const naPlatform = Math.round(naVeiligheid * (1 + PLATFORMMARGE));
  const verkoop = nettePrijs(naPlatform);
  return {
    bundel: b.id, naam: b.naam, credits: b.credits, wat: b.wat,
    centen: verkoop,
    som: {
      inkoopCenten: inkoop,
      veiligheidsmarge: VEILIGHEIDSMARGE, naVeiligheidCenten: naVeiligheid,
      platformmarge: PLATFORMMARGE, naPlatformCenten: naPlatform,
      afrondingCenten: verkoop - naPlatform
    },
    /* De marge in centen, apart. Dit is het getal waar een bundel op omvalt:
       zakt hij onder nul, dan kost elke verkoop geld. */
    margeCenten: verkoop - inkoop
  };
}

function lijst(instellingen) {
  return Object.keys(tegoed.BUNDELS).map(id => prijsVan(id, instellingen));
}

/* De keuring: verkoopt geen enkele bundel onder de kostprijs? Geeft null als het
   goed is. Dit is de bewering die telt -- de rest van dit bestand is de som die
   haar waarmaakt. */
function keur(instellingen) {
  for (const p of lijst(instellingen)) {
    if (p.error || p.centen === null) continue;
    if (p.centen < p.som.inkoopCenten)
      return p.naam + ' verkoopt onder de inkoopprijs (' + p.centen + ' tegen ' + p.som.inkoopCenten + ' centen)';
    if (p.margeCenten <= 0)
      return p.naam + ' levert geen marge op';
  }
  return null;
}

module.exports = { prijsVan, lijst, keur, VEILIGHEIDSMARGE, PLATFORMMARGE, nettePrijs, inkoopPer1000 };
