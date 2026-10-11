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
    /* De risicogoedkeuring komt ALLEEN uit het voornemen: wie hem via de context
       meegeeft, ontloopt de eisen van risicoGoedkeur (voor het besluit, op naam, met
       reden). Wat de aanroeper stuurt, wordt dus vervangen. */
    const ctx = Object.assign({}, o.context || {});
    delete ctx.risicogoedkeuring;
    /* En alleen de EIGEN: een risicogoedkeuring geldt voor precies dit voornemen (een
       ronde), zodat een kopie op een volgende ronde niets opent (eigenaarsbesluit 2C). */
    if (v.risicogoedkeuring && v.risicogoedkeuring.voornemen === v.id) ctx.risicogoedkeuring = v.risicogoedkeuring;
    /* En `omkeerbaar` komt uit de TABEL (../geldomkeer.js) en nooit van de aanroeper:
       een context met `omkeerbaar: true` opende anders de grens voor elke handeling,
       ook voor een teruggave. Onbekend is dicht. */
    ctx.omkeerbaar = require('../geldomkeer').voor(v.handeling).omkeerbaar === true;
    const b = beslis({ actor: v.actor, handeling: v.handeling, doel: v.doel,
      waardeCenten: v.totaalCenten, context: ctx });
    /* EEN LEEG ANTWOORD IS GEEN ANTWOORD, en dit is geen theoretisch geval.
       ../../opzet/kernlaag3c.js geeft deze laag `(vraag) => (kern.beslis ?
       kern.beslis(vraag) : null)` mee. Die wrapper is ALTIJD een functie, dus de
       controle `if (!beslis)` hierboven sloeg nooit aan zolang er geen beslislaag
       gemount was: hij werd aangeroepen, gaf `null`, en de volgende regel las
       `uitkomst` uit null. Een TypeError op exact de plek waar de kop van dit
       bestand een nette 503 belooft -- onvindbaar, want er was geen aanroeper.
       Nu valt het dicht zoals beloofd, en een storing blijft een storing. */
    if (!b || !b.uitkomst)
      return { status: 503, error: 'De beslislaag gaf geen uitkomst; er wordt niets goedgekeurd.' };
    v.besluit = { uitkomst: b.uitkomst, reden: b.reden, beleid: b.beleid, at: tijd() };
    if (b.uitzondering) v.besluit.uitzondering = b.uitzondering;
    /* Wat er over omkeerbaarheid is gewogen, staat bij het besluit: de uitvoering kijkt
       er nog een keer naar (een voornemen van voor 2B-aangepast droeg nooit `true`). */
    v.besluit.omkeerbaar = ctx.omkeerbaar === true;
    if (Number.isFinite(b.omkeerbaarBovenCenten)) v.besluit.omkeerbaarBovenCenten = b.omkeerbaarBovenCenten;
    if (b.bewijstoken) v.bewijstoken = b.bewijstoken;

    if (DOOR.has(b.uitkomst)) {
      /* BEPERKT is voor een PLAN geen ja. Bij een enkele handeling betekent het
         "tot hier mag het wel", maar een plan van vijf stappen kun je niet voor
         zestig procent uitvoeren zonder te weten welke stappen sneuvelen. Dat is
         een keuze van de aanvrager en niet van deze laag. */
      /* OMKEERBAAR is "het mag, MITS terug te draaien" -- en dat mits werd hier nooit
         nagekeken: zo'n voornemen ging gewoon op GEKEURD. Voor een voornemen is het
         antwoord al bekend, want het domein geeft `omkeerbaar` mee in de context; komt
         OMKEERBAAR toch terug, dan HEEFT het domein het niet aangetoond. Dan is het een
         weigering met de reden (eigenaarsbesluit 2B-aangepast, 11 oktober 2026). */
      if (b.uitkomst === UITKOMST.OMKEERBAAR) {
        zet(v, P.STAND.AFGEWEZEN, { reden: b.reden });
        return { status: 200, ok: true, voornemen: publiek(v) };
      }
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
    const wie = String(door || '').slice(0, 80);
    if (!wie) return { status: 400, error: 'Wie tekent er af?' };
    if (wie === v.actor)
      return { status: 400, error: 'Een tweede handtekening van dezelfde persoon is er geen.' };
    v.goedgekeurdDoor = wie;
    save();
    /* GEEN `omkeerbaar: true` MEER (eigenaarsbesluit 2B-aangepast, 11 oktober 2026):
       een tweede handtekening is autorisatie en geen omkeerbaarheid. Of een handeling
       terug kan, zegt het domein in de context van de aanroeper -- en anders niet. */
    return keur(id, { context: { ...(context || {}), goedgekeurdDoor: wie, bevestigingVers: true } });
  }

  /* DE RISICOGOEDKEURING: een eigen stap, op naam, met reden (../uitzondering.js). Hij
     KEURT NIET: hij legt vast, en de volgende keuring (na de tweede handtekening) weegt
     hem mee. Alleen zolang er nog geen besluit is -- een nee wordt geen ja -- en alleen
     voor een handeling die ../risicouitzondering.js toelaat (2C: de incassoronde). */
  function risicoGoedkeur(id, { door, naam, reden }) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Dit voornemen bestaat niet.' };
    const t = require('../risicouitzondering').stand(v.handeling);
    if (!t.open) return { status: 409, error: t.reden };
    if (v.stand !== P.STAND.OPGESTELD && v.stand !== P.STAND.WACHT)
      return { status: 409, error: 'Een risicogoedkeuring hoort voor het besluit; dit voornemen staat op ' + v.stand + '.' };
    const wie = String(door || '').slice(0, 60);
    const waarom = String(reden || '').trim().slice(0, 400);
    if (!wie || waarom.length < 10) return { status: 400, error: 'Een risicogoedkeuring draagt een naam en een reden van ten minste tien tekens.' };
    if (wie === v.actor || (naam && String(naam) === v.actor))
      return { status: 400, error: 'Wie de handeling aanvraagt, geeft er niet zelf de risicogoedkeuring voor.' };
    if (v.risicogoedkeuring) return { status: 409, error: 'Voor dit voornemen is de risicogoedkeuring al gegeven.' };
    v.risicogoedkeuring = { door: wie, naam: naam ? String(naam).slice(0, 80) : null, reden: waarom,
      voornemen: v.id, bron: t.bron, at: tijd() };
    save();
    return { status: 200, ok: true, voornemen: publiek(v) };
  }

  return { keur, tekenAf, risicoGoedkeur };
}

module.exports = { maakKeuring };
