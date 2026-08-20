/* DE KEURING VAN EEN VOORNEMEN -- over het TOTAAL, en niet per stap.

   DE FOUT DIE DIT VOORKOMT. Een agent die vijf boekingen doet, vraagt vandaag
   vijf keer los "mag dit". Bij de vierde is het budget op. Er staan dan drie
   boekingen, een boze klant en een half-uitgevoerde handeling die niemand heeft
   besloten. Het beleid heeft gewerkt en het resultaat is een puinhoop.

   Dus wordt hier de SOM gewogen. Vijf keer 190 euro is geen vijf kleine besluiten
   maar een van 950, en de zin die een mens hoort te lezen komt VOORDAT er iets
   gebeurt:

       922 euro totaal; beleid staat 900 toe -> goedkeuring nodig

   BEPERKT IS VOOR EEN PLAN GEEN JA. Bij een enkele handeling betekent het "tot
   hier mag het wel", maar een plan van vijf stappen kun je niet voor zestig
   procent uitvoeren zonder te weten welke stappen sneuvelen -- en dat is een
   keuze van de aanvrager, niet van het systeem.

   ONBEKEND WORDT HIER OOK EEN AFWIJZING, en dat spreekt ../besluit.js niet
   tegen. DAAR is het verschil tussen "het mag niet" en "we weten het niet"
   belangrijk; HIER gaat waarde bewegen en dan valt het dicht. Dezelfde regel als
   `veiligeUitkomst`, met de reden erbij zodat een storing als storing te lezen
   blijft.

   EEN NEE WORDT GEEN JA DOOR HET NOG EENS TE VRAGEN. Er is geen overgang van
   AFGEWEZEN naar GEKEURD (./plan.js). Wie het anders wil, stelt een nieuw
   voornemen op, met een eigen sleutel en een eigen keuring. */
'use strict';

const P = require('./plan');
const { UITKOMST, DOOR } = require('../besluit');

function maakKeuring({ vind, zet, publiek, save, tijd, beslis }) {

  /* KEUREN. Het besluit gaat over het TOTAAL. `beslis` komt van de aanroeper:
     deze laag weet niet waar bevoegdheden wonen en hoort dat niet te weten. */
  function keur(id, opties) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Dit voornemen bestaat niet.' };
    if (v.stand !== P.STAND.OPGESTELD && v.stand !== P.STAND.WACHT)
      return { status: 409, error: 'Een voornemen in stand ' + v.stand + ' wordt niet opnieuw gekeurd.' };
    if (!beslis) return { status: 503, error: 'Er is geen beslislaag om dit voornemen langs te leggen.' };

    const o = opties || {};
    const b = beslis({ actor: v.actor, handeling: v.handeling, doel: v.doel,
      waardeCenten: v.totaalCenten, context: o.context || {} });
    v.besluit = { uitkomst: b.uitkomst, reden: b.reden, beleid: b.beleid, at: tijd() };
    if (b.bewijstoken) v.bewijstoken = b.bewijstoken;

    if (DOOR.has(b.uitkomst)) {
      /* BEPERKT is voor een PLAN geen ja. Bij een enkele handeling betekent het
         "tot hier mag het wel", maar een plan van vijf stappen kun je niet voor
         zestig procent uitvoeren zonder te weten welke stappen sneuvelen. Dat is
         een keuze van de aanvrager en niet van deze laag. */
      if (b.uitkomst === UITKOMST.BEPERKT) {
        zet(v, P.STAND.AFGEWEZEN, { reden: 'Het plan past niet in zijn geheel (' + b.reden +
          '). Stel een kleiner voornemen op; welke stappen eraf gaan is niet aan het systeem.' });
        return { status: 200, ok: true, voornemen: publiek(v) };
      }
      zet(v, P.STAND.GEKEURD, { reden: b.reden });
      return { status: 200, ok: true, voornemen: publiek(v) };
    }
    if (b.uitkomst === UITKOMST.GOEDKEURING || b.uitkomst === UITKOMST.EXTRA_BEWIJS ||
        b.uitkomst === UITKOMST.UITSTELLEN) {
      zet(v, P.STAND.WACHT, { reden: b.reden });
      return { status: 200, ok: true, voornemen: publiek(v) };
    }
    /* WEIGEREN en ONBEKEND. Ook ONBEKEND wordt hier een afwijzing, en dat is
       geen tegenspraak met besluit.js: DAAR is het verschil tussen "het mag niet"
       en "we weten het niet" belangrijk, HIER gaat waarde bewegen en dan valt
       het dicht. Dezelfde regel als `veiligeUitkomst`, met de reden erbij zodat
       een storing als storing te lezen blijft. */
    zet(v, P.STAND.AFGEWEZEN, { reden: b.reden });
    return { status: 200, ok: true, voornemen: publiek(v) };
  }

  /* AFTEKENEN. De tweede handtekening. Zet het voornemen niet zelf op GEKEURD:
     het gaat terug langs `keur`, nu met de goedkeuring in de context, zodat het
     beleid het laatste woord houdt en niet deze functie. */
  function tekenAf(id, { door, context }) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Dit voornemen bestaat niet.' };
    if (v.stand !== P.STAND.WACHT)
      return { status: 409, error: 'Alleen een wachtend voornemen wordt afgetekend; deze staat op ' + v.stand + '.' };
    const wie = String(door || '').slice(0, 60);
    if (!wie) return { status: 400, error: 'Wie tekent er af?' };
    if (wie === v.actor)
      return { status: 400, error: 'Een tweede handtekening van dezelfde persoon is er geen.' };
    v.goedgekeurdDoor = wie;
    save();
    return keur(id, { context: { ...(context || {}), goedgekeurdDoor: wie, bevestigingVers: true, omkeerbaar: true } });
  }

  return { keur, tekenAf };
}

module.exports = { maakKeuring };
