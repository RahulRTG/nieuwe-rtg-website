/* HET LEDENVOORDEEL, MET VIER BEDRAGEN DIE MOETEN KLOPPEN.

   De belofte staat in de partnervoorwaarden en in kern/geldregie.js: "RTG legt
   bij, dus de zaak houdt het volle bedrag". Tot 20 augustus 2026 werd daar
   precies EEN van de vier bedragen van vastgelegd -- de korting zelf -- en die
   werd alleen op het scherm gezet. Er was geen boeking die geld van RTG naar de
   zaak bewoog, en in `betaalRekeningVoor` was het bedrag dat als betaald werd
   gerapporteerd `subtotaal + fooi`: de korting ging er aan geen van beide
   kanten af. De toets die dit had moeten vangen (test/geldregie.test.js 3)
   controleerde `order.total` en `regieKorting` -- precies de twee velden die
   ook kloppen als er niets gebeurt.

   EEN VOORDEEL HEEFT VIER BEDRAGEN, en ze horen bij elkaar:

       bruto            22,00   wat de dienst kost
       lid betaalt      19,80   bruto min het voordeel
       RTG legt bij      2,20   het voordeel, ten laste van RTG
       zaak ontvangt    22,00   het volle bedrag, want dat is de belofte

   De invariant die dit bestand bewaakt:

       lid betaalt + RTG legt bij === bruto === zaak ontvangt

   Zou een van de vier los kunnen worden geschreven, dan ontstaat precies de
   situatie van hiervoor: drie velden die kloppen en een die ontbreekt, zonder
   dat iets het merkt. Vandaar dat `splits()` ze alle vier tegelijk teruggeeft en
   zelf narekent; wie hier een bedrag uit haalt, krijgt ze alle vier of geen.

   WAT DIT BESTAND NIET DOET: het geld verplaatsen. Deze laag rekent en legt de
   verplichting vast; het daadwerkelijk overmaken hoort bij de betaal-naad
   (kern/betaalopdracht/), net als bij de 30%-afdracht van kern/fonds.js. Het
   verschil met de oude situatie is dat de verplichting nu BESTAAT en een bedrag
   heeft, in plaats van dat er een korting op een scherm staat die niemand
   betaalt. Zolang de uitbetaalkant niet is bedraad, staat een subsidie op
   'te_verrekenen' -- gereserveerd en zichtbaar, precies zoals de afdracht aan
   de RTFoundation op 'te_storten' staat zolang RTF_IBAN leeg is.

   Alles in CENTEN. De bestelstroom rekent historisch in euro's met twee
   decimalen; centen in en centen uit voorkomt dat een halve cent zich verstopt
   in een afronding en de invariant hierboven laat wankelen. */
'use strict';

const centenVan = euro => Math.round((Number(euro) || 0) * 100);
const euroVan = centen => Math.round(centen) / 100;

/* De vier bedragen van een transactie met ledenvoordeel.

   `brutoCenten` is wat de dienst kost; `voordeelCenten` wat RTG bijlegt. Een
   voordeel groter dan het bedrag wordt afgekapt: RTG legt nooit meer bij dan de
   dienst kost, want dan zou een zaak geld verdienen aan een gratis bestelling. */
function splits(brutoCenten, voordeelCenten) {
  const bruto = Math.max(0, Math.round(Number(brutoCenten) || 0));
  const voordeel = Math.min(bruto, Math.max(0, Math.round(Number(voordeelCenten) || 0)));
  const rij = {
    brutoCenten: bruto,
    lidBetaaltCenten: bruto - voordeel,
    rtgLegtBijCenten: voordeel,
    zaakOntvangtCenten: bruto
  };
  const bezwaar = keur(rij);
  if (bezwaar) throw new Error('subsidie: ' + bezwaar);   // een rekenfout hier is geld
  return rij;
}

/* De invariant, apart en aanroepbaar, zodat een toets hem op een OPGESLAGEN rij
   kan draaien en niet alleen op een verse berekening. Geeft null als het klopt.

   Waarom dit een eigen functie is en geen assert in splits(): de bedragen worden
   opgeslagen op de bestelling, en de vraag die ertoe doet is niet "rekende de
   functie goed" maar "klopt wat er in de database staat". */
function keur(rij) {
  if (!rij || typeof rij !== 'object') return 'geen prijsopbouw';
  const { brutoCenten: b, lidBetaaltCenten: l, rtgLegtBijCenten: r, zaakOntvangtCenten: z } = rij;
  for (const [naam, v] of Object.entries({ brutoCenten: b, lidBetaaltCenten: l, rtgLegtBijCenten: r, zaakOntvangtCenten: z }))
    if (!Number.isInteger(v) || v < 0) return naam + ' is geen heel aantal centen (' + v + ')';
  if (l + r !== b) return 'lid (' + l + ') plus RTG (' + r + ') is ' + (l + r) + ' en niet het brutobedrag ' + b;
  if (z !== b) return 'de zaak ontvangt ' + z + ' in plaats van het volle bedrag ' + b;
  return null;
}

/* De vorm zoals hij op een bestelling wordt opgeslagen: de vier bedragen in
   centen (rauw, want daar wordt mee gerekend), de euro's erbij voor het scherm,
   en de staat van de verrekening.

   `status` is nadrukkelijk geen boolean. 'te_verrekenen' betekent: RTG is dit
   bedrag verschuldigd aan de zaak en de betaal-naad heeft het nog niet
   opgepakt. Een boolean `betaald: false` zou hetzelfde lijken en het verschil
   tussen "nog niet" en "niet nodig" wegpoetsen. */
function opbouwVan(brutoEuro, voordeelEuro) {
  const rij = splits(centenVan(brutoEuro), centenVan(voordeelEuro));
  return {
    ...rij,
    lidBetaalt: euroVan(rij.lidBetaaltCenten),
    rtgLegtBij: euroVan(rij.rtgLegtBijCenten),
    zaakOntvangt: euroVan(rij.zaakOntvangtCenten),
    status: rij.rtgLegtBijCenten > 0 ? 'te_verrekenen' : 'geen_voordeel'
  };
}

module.exports = { splits, keur, opbouwVan, centenVan, euroVan };
