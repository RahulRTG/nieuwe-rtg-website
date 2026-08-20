/* MAG DIT GEBEUREN? EEN VRAAG, EEN ANTWOORD, EEN VORM.

   Dit huis stelt die vraag op tientallen plekken en beantwoordt hem elke keer
   anders: een pas-id vergelijken, een rol nakijken, een saldo checken, een
   percentage aftrekken. Zo ontstaan acht autorisatiesystemen die elk net iets
   anders denken -- en dat is precies hoe kern/thuis/zakelijk.js aan een eigen
   commissie van 10 procent kwam terwijl de rest 12 gebruikte.

   Deze module stelt de vraag een keer:

       beslis({ actor, handeling, doel, waardeCenten, context })

   ACHT UITKOMSTEN, EN "NEE" IS ER MAAR EEN VAN. Dat is het punt. Een
   autorisatielaag die alleen ja of nee kent, dwingt elke aanroeper om zelf te
   verzinnen wat er dan wel kan -- en dan staat er in het ene scherm "verboden"
   en in het andere "vraag je manager".

     TOESTAAN            het mag, zonder meer
     BEPERKT             het mag tot een lager bedrag dan gevraagd
     OMKEERBAAR          het mag, mits terug te draaien
     GOEDKEURING         een mens moet tekenen; de aanvraag staat klaar
     EXTRA_BEWIJS        het mag na een sterkere bevestiging (step-up)
     UITSTELLEN          niet nu -- een grens per dag, een gesloten periode
     WEIGEREN            het mag niet, met de reden
     ONBEKEND            de vraag kon niet worden beantwoord

   Die laatste is met opzet geen synoniem van WEIGEREN. "We weten het niet" en
   "het mag niet" zijn verschillende dingen, en wie ze samenvoegt, bouwt een
   systeem dat bij een storing net zo klinkt als bij een overtreding. De
   aanroeper beslist wat hij met ONBEKEND doet -- en voor geld hoort dat dicht te
   zijn (zie `veiligeUitkomst`).

   ELK ANTWOORD DRAAGT ZIJN BEWIJS. Niet alleen de uitkomst maar ook waarom: op
   welke bevoegdheid hij steunt, welke keten daaronder ligt, wat er is getoetst.
   Daarmee is achteraf verantwoorden geen archeologie meer maar een veld.

   WAT DIT NIET IS: een plek waar rechten ONTSTAAN. Deze module leest wat er is
   -- de trede, het abonnement, de bevoegdheid -- en weegt. Zou zij zelf rechten
   toekennen, dan is er een negende autorisatiesysteem bij in plaats van een
   minder. */
'use strict';

const klok = require('../../lib/klok');
const bev = require('./bevoegdheid');

const UITKOMST = {
  TOESTAAN: 'TOESTAAN',
  BEPERKT: 'BEPERKT',
  OMKEERBAAR: 'OMKEERBAAR',
  GOEDKEURING: 'GOEDKEURING',
  EXTRA_BEWIJS: 'EXTRA_BEWIJS',
  UITSTELLEN: 'UITSTELLEN',
  WEIGEREN: 'WEIGEREN',
  ONBEKEND: 'ONBEKEND'
};

// welke uitkomsten betekenen dat de handeling (in enige vorm) door mag
const DOOR = new Set([UITKOMST.TOESTAAN, UITKOMST.BEPERKT, UITKOMST.OMKEERBAAR]);

/* Wat een aanroeper met ONBEKEND doet. Voor alles wat waarde verplaatst is dat
   dicht; voor een leesvraag mag het open. De regel staat HIER zodat niet elke
   aanroeper hem opnieuw bedenkt -- en zodat "fail closed waar het moet, fail
   useful waar het kan" een besluit is en geen toeval. */
function veiligeUitkomst(uitkomst, { raaktWaarde }) {
  if (uitkomst !== UITKOMST.ONBEKEND) return uitkomst;
  return raaktWaarde ? UITKOMST.WEIGEREN : UITKOMST.TOESTAAN;
}

/* De drempel waarboven een handeling een tweede paar ogen vraagt, ook als de
   bevoegdheid het toestaat. Dit is geen bevoegdheidsgrens maar een BELEIDSregel:
   hij hangt aan het bedrag en niet aan de persoon. */
const BELEID = {
  versie: 'v1-2026',
  goedkeuringBovenCenten: 100000,      // vanaf 1.000 euro tekent er een mens mee
  extraBewijsBovenCenten: 50000,       // vanaf 500 euro een sterkere bevestiging
  omkeerbaarBovenCenten: 250000        // vanaf 2.500 euro alleen als het terug kan
};

/* De kern. `zoekBevoegdheid` komt van de aanroeper: deze module weet niet waar
   bevoegdheden wonen, en dat hoort ze ook niet te weten. */
function maakBesluit({ zoekBevoegdheid, dagverbruik, beleid, nu }) {
  const tijd = nu || klok.nu;
  const B = { ...BELEID, ...(beleid || {}) };

  function beslis({ actor, handeling, doel, waardeCenten, context }) {
    const ctx = context || {};
    const bedrag = Math.round(Number(waardeCenten) || 0);
    const raaktWaarde = bedrag > 0;
    const basis = { actor: actor || null, handeling, doel: doel == null ? null : String(doel),
      waardeCenten: bedrag, beleid: B.versie, at: tijd() };

    if (!handeling) return { ...basis, uitkomst: UITKOMST.ONBEKEND, reden: 'Er is geen handeling opgegeven.' };

    /* 1. IS ER EEN BEVOEGDHEID? Niet gevonden is ONBEKEND en niet WEIGEREN: het
          verschil tussen "deze actor mag dit niet" en "we konden het niet
          nakijken" is het verschil tussen een overtreding en een storing. */
    let b = null;
    try { b = zoekBevoegdheid ? zoekBevoegdheid({ actor, handeling, doel, context: ctx }) : null; }
    catch (e) {
      return { ...basis, uitkomst: UITKOMST.ONBEKEND,
        reden: 'De bevoegdheid kon niet worden nagekeken: ' + String((e && e.message) || e).slice(0, 120) };
    }
    if (!b) return { ...basis, uitkomst: UITKOMST.WEIGEREN,
      reden: 'Deze handeling hoort niet bij de bevoegdheden van deze actor.' };

    const bewijs = { bevoegdheid: b.capability, scope: b.scope, keten: bev.herkomst(b) };

    /* 2. PAST HET BINNEN DE BEVOEGDHEID? Een bedrag boven de grens is geen plat
          nee: als er een grens IS, kan het tot die grens wel. Dat is BEPERKT, en
          het scheelt de aanvrager een tweede poging. */
    const bezwaar = bev.past(b, { scope: doel, waardeCenten: bedrag, context: ctx });
    if (bezwaar) {
      const grens = b.grenzen.maxCenten;
      if (Number.isFinite(grens) && grens > 0 && bedrag > grens && !bezwaarIsHard(bezwaar))
        return { ...basis, uitkomst: UITKOMST.BEPERKT, totCenten: grens, reden: bezwaar, bewijs };
      return { ...basis, uitkomst: UITKOMST.WEIGEREN, reden: bezwaar, bewijs };
    }

    /* 3. PAST HET BINNEN VANDAAG? Een dagtotaal dat vol is, is geen weigering
          maar een UITSTEL: morgen mag het wel, en dat hoort de aanvrager te
          horen in plaats van "verboden". */
    if (dagverbruik) {
      let dag = null;
      try { dag = dagverbruik({ actor, handeling, doel }); } catch (e) { dag = null; }
      if (dag) {
        const dagbezwaar = bev.pastBinnenDag(b, { ...dag, waardeCenten: bedrag });
        if (dagbezwaar) return { ...basis, uitkomst: UITKOMST.UITSTELLEN, reden: dagbezwaar, bewijs };
      }
    }

    /* 4. HET BELEID BOVENOP DE BEVOEGDHEID. Dit hangt aan het BEDRAG en niet aan
          de persoon: ook wie ruim bevoegd is, tekent bij een groot bedrag niet
          alleen. De volgorde is van zwaar naar licht, want het zwaarste eist het
          meest. */
    if (bedrag >= B.goedkeuringBovenCenten && ctx.goedgekeurdDoor == null)
      return { ...basis, uitkomst: UITKOMST.GOEDKEURING, bewijs,
        reden: 'Vanaf ' + bev.euro(B.goedkeuringBovenCenten) + ' tekent er een tweede persoon mee.' };

    if (bedrag >= B.omkeerbaarBovenCenten && ctx.omkeerbaar !== true)
      return { ...basis, uitkomst: UITKOMST.OMKEERBAAR, bewijs,
        reden: 'Vanaf ' + bev.euro(B.omkeerbaarBovenCenten) + ' alleen als de handeling terug te draaien is.' };

    if (bedrag >= B.extraBewijsBovenCenten && ctx.bevestigingVers !== true)
      return { ...basis, uitkomst: UITKOMST.EXTRA_BEWIJS, bewijs,
        reden: 'Vanaf ' + bev.euro(B.extraBewijsBovenCenten) + ' vraagt RTG een verse bevestiging.' };

    return { ...basis, uitkomst: UITKOMST.TOESTAAN, bewijs, reden: 'Binnen de bevoegdheid en het beleid.' };
  }

  /* Een bezwaar dat NIET met een lager bedrag op te lossen is. Een vertrouwd
     apparaat wordt niet vertrouwd door minder te vragen. */
  function bezwaarIsHard(zin) {
    return /vestiging|apparaat|terug te draaien|geldt voor/.test(String(zin || ''));
  }

  return { UITKOMST, DOOR, beslis, veiligeUitkomst, beleid: B };
}

module.exports = { maakBesluit, UITKOMST, DOOR, BELEID, veiligeUitkomst };
