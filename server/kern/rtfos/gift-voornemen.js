/* Foundation OS, deel "gift-voornemen": wat er ZOU gebeuren als deze gift werd
   gedaan.

   AFGESPLITST VAN ./gift.js toen die over de 10 KB ging, en de naad zit waar hij
   in de deur ook zit: hiernaast staat wat de EIGENAAR zet (de stand, de
   ontvanger, de ANBI-status -- boardroom), hier staat wat een GEVER te zien
   krijgt (ledendeur). Twee lezers, twee bestanden.

   DIT BETAALT NIETS. Het rekent uit of iets een gift of sponsoring is, of het
   eerst beoordeeld wordt, en welk stuk de gever terugkrijgt -- en boekt niets.
   test/rtfos-gift.test.js zakt zodra dit bestand de betaallaag aanroept. */
'use strict';

/* De drempel komt uit ./herkomst.js en staat hier niet nog een keer: twee
   plekken met hetzelfde drempelbedrag lopen uiteen (LAT.md regel 4). */
const herkomstDrempels = require('./herkomst');

/* VORMEN komt van hiernaast en staat hier niet nog een keer. Een tweede lijst
   met dezelfde drie woorden is precies hoe twee bestanden uiteen gaan lopen. */
const { VORMEN } = require('./gift-vormen');

module.exports = (ctx, { standVan, uitlegVan, ontbreektVan }) => {
  const { schoon, naarCenten, euro } = ctx;

  /* ---------------------------------------------------------------------
     Het voornemen: wat zou er gebeuren als deze gift werd gedaan.

     Dit is de hele reden dat dit deel nu al bestaat. Een gever hoort de
     gevolgen te zien VOORDAT hij iets bevestigt: is dit een gift of
     sponsoring, wordt het eerst beoordeeld, en krijgt hij een aftrekbaar
     bewijs of niet. Er beweegt geen cent. */
  function voorbereid(b) {
    b = b || {};
    const g = standVan();
    if (g.stand !== 'open') {
      return { status: 409, error: uitlegVan(), stand: 'dicht', ontbreekt: ontbreektVan() };
    }

    const centen = naarCenten(b.euro);
    if (!centen) return { status: 400, error: 'Welk bedrag wil je geven?' };

    const vorm = VORMEN.includes(b.vorm) ? b.vorm : 'eenmalig';
    if (!g.vormen.includes(vorm)) {
      return { status: 409, error: 'Deze vorm staat niet open. Wel: ' + g.vormen.join(', ') + '.' };
    }
    if (vorm === 'geoormerkt' && !schoon(b.project, 60)) {
      return { status: 400, error: 'Waar moet deze gift heen? Een geoormerkte gift wijst een project aan.' };
    }

    /* GRENDEL: de vraag naar de tegenprestatie komt VOOR het bedrag, en het
       antwoord verandert wat dit is. ./herkomst.js weigert een donatie met
       tegenprestatie al; hier wordt dat vooraf gezegd in plaats van achteraf. */
    const tegenprestatie = b.tegenprestatie === true;

    const drempel = herkomstDrempels.DREMPEL_CENTEN || 1000000;
    const beoordeeld = centen >= drempel;

    const aftrekbaar = !tegenprestatie && g.anbi === 'ja';
    return { ok: true,
      voornemen: {
        euro: euro(centen), vorm, project: schoon(b.project, 60) || null,
        anoniem: b.anoniem === true,
        /* Wat dit IS, en niet wat de gever hoopte. */
        soort: tegenprestatie ? 'sponsoring' : (vorm === 'periodiek' ? 'maandelijkse_donatie' : 'donatie'),
        beoordeeldVooraf: beoordeeld,
        aftrekbaar,
        /* DRIE STUKKEN EN NIET TWEE. Bij een tegenprestatie is het geen gift maar
           sponsoring, en dan hoort er een FACTUUR uit te gaan -- dat belooft
           ./donateur.js: bewijsbaar() ook met zoveel woorden. Hier stond
           'ontvangstbevestiging', en dan zou dit scherm iets anders zeggen dan
           het portaal een maand later. */
        stuk: tegenprestatie ? 'factuur' : (aftrekbaar ? 'giftbewijs' : 'ontvangstbevestiging')
      },
      /* Wat de gever te horen krijgt, in gewone zinnen en zonder gunstige
         afronding. De volgorde is die van het gesprek: wat het is, wat er
         daarna gebeurt, en wat hij terugkrijgt. */
      zegt: [
        tegenprestatie
          ? 'Hier staat iets tegenover, dus dit is sponsoring en geen gift. Je krijgt er een factuur voor en het is voor jou zakelijke kosten.'
          : 'Dit is een gift: er staat niets tegenover.',
        beoordeeld
          ? 'Dit bedrag wordt eerst beoordeeld door het landelijke bestuur. Zolang dat loopt, wordt er niets mee gedaan.'
          : 'Dit bedrag gaat direct naar de stichting.',
        /* VIER ANBI-STANDEN, VIER ZINNEN. De knop van de eigenaar en de zin die
           de gever leest, bewegen samen -- dat was de opdracht. `aangevraagd`
           zegt wat we weten (de aanvraag loopt) en niet wat we hopen (dat het
           straks alsnog aftrekbaar is): of dat zo is, hangt af van de
           beschikking en haar datum, en dat stelt dit systeem niet vast. */
        tegenprestatie
          ? 'Je krijgt een factuur en geen giftbewijs. Een sponsorbedrag is geen aftrekbare gift.'
          : (aftrekbaar
            ? 'Je krijgt een giftbewijs; de RTFoundation is een ANBI (RSIN ' + g.rsin + ').'
            : (g.anbi === 'aangevraagd'
              ? 'Je krijgt een ontvangstbevestiging. De RTFoundation is op dit moment geen ANBI; de aanvraag loopt. Of deze gift daarmee alsnog aftrekbaar wordt, hangt af van de beschikking -- dat zeggen wij niet toe.'
              : (g.anbi === 'onbekend'
                ? 'Je krijgt een ontvangstbevestiging. Of deze gift aftrekbaar is, ligt niet vast; wij zeggen daar niets over dat wij niet weten.'
                : 'Je krijgt een ontvangstbevestiging. Deze gift is niet aftrekbaar.'))),
        vorm === 'periodiek'
          ? 'Een periodieke gift loopt ten minste vijf jaar en vraagt een vastgelegde overeenkomst. Zonder die overeenkomst is het een gewone gift.'
          : null
      ].filter(Boolean),
      /* EN DIT IS GEEN BETALING. Het staat in het antwoord zelf, zodat een
         scherm dat het overslaat, het alsnog toont. */
      nietGedaan: 'Er is niets betaald en niets vastgelegd. Dit is wat er zou gebeuren.' };
  }

  return { voorbereid };
};
