/* ============================================================================
   MUTATIECONTRACTEN -- de drie routes die de integratietak toevoegde.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.
   MUTATIECONTRACT.md verbiedt `onbekend` voor wat nieuw publiek aanroepbaar
   wordt: een schrijfroute hoort een contract te krijgen VOORDAT hij bestaat.
   Deze drie kregen dat niet, en test/mutatiecontract.test.js vond ze -- precies
   waarvoor die toets er is.

   HET WEGBRENGEN IS DE ENIGE MET EEN EFFECT, EN DAT EFFECT LIGT BUITEN DIT
   HUIS. Dat maakt de indeling lastiger dan hij lijkt, en de verleiding is om
   `NOT_APPLICABLE` te schrijven omdat er in RTG niets verandert. Dat zou de
   waarheid halveren: er ontstaat wel degelijk iets, alleen op de tweede
   machine, en twee aanroepen zijn daar twee ankermomenten. Het contract zegt
   dus `nietHerhaalbaar` en `INTENTIONALLY_NON_IDEMPOTENT`, met de reden erbij,
   en niet "deze route verandert niets".

   De andere twee lezen werkelijk. De ankerdienst LEEST de koppen van de vier
   auditjournalen; de objectpagina leest de objectlaag, die per ontwerp niets
   bezit. Een anker dat deze software zelf op dezelfde schijf wegschrijft is
   geen anker maar een tweede regel om te wijzigen (server/lib/ankerdienst.js),
   en daarom raakt geen van de drie een journaal aan.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  /* HET WEGBRENGEN. Een POST die naar buiten praat en hier niets aanraakt.

     WAAROM NIET `INTENTIONALLY_NON_IDEMPOTENT`, terwijl lib/idemsleutels.js hem
     wel zo verklaart? Omdat die twee assen over verschillende dingen gaan
     (MUTATIECONTRACT.md: vijf assen, elk met een huis). Daar staat het
     DUPLICAATgedrag: twee blokken achter elkaar wegbrengen zijn twee eerlijke
     ankermomenten, en een laag die de tweede opslikt maakt een gat in precies
     de reeks die kopafknipping zichtbaar moet maken. Hier staat de SEMANTIEK
     binnen RTG, en die is: er verandert niets. Beide zijn waar. */
  'POST /api/office/anker/post': {
    mutatieId: 'office.anker.post',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Twee keer wegbrengen zijn twee ankermomenten op de tweede machine, en dat hoort zo: een ' +
      'laag die de tweede opslikt maakt een gat in precies de reeks die kopafknipping zichtbaar moet ' +
      'maken. Binnen RTG verandert er niets -- het effect ligt volledig buiten dit huis, en dat is de ' +
      'reden dat hier NOT_APPLICABLE zou hebben gelogen.',
    bewijs: {
      gemeten: 'test/integratie-routes.test.js toets 2 (over HTTP, tegen een wegwerpserver): zonder ' +
        'RTG_ANKERPOST_URL antwoordt de route 200 met inBedrijf: false en er wordt niets weggebracht; ' +
        'het blok komt mee terug maar wordt nergens bewaard. test/ankerpost.test.js toets 4 meet met ' +
        'een nagebootste bestemming dat een aanroep een POST naar buiten doet.',
      op: '2026-09-03'
    },
    nagekeken: 'de handler is gelezen: hij roept ankerpost.post() aan, en die doet een fetch naar ' +
        'buiten. test/ankerpost.test.js toets 8 houdt vast dat server/lib/ankerpost.js geen db.data ' +
        'aanraakt en niets pusht -- de post raakt geen enkel journaal aan, want dan zou hij de keten ' +
        'repareren die hij moest controleren.',
    afgetekend: {
      door: 'Claude (Opus 5), op grond van de HTTP-meting en de bron van server/lib/ankerpost.js; ' +
        'niet door een mens nagelezen',
      op: '2026-09-03'
    }
  },

  /* HET AFREKENEN. Haalt het laatst weggebrachte blok op en legt het naast de
     huidige koppen. Wat terugkomt is INVOER en geen waarheid: het gaat
     ongewijzigd naar ankerdienst.reken() en raakt nooit een journaal aan. */
  'POST /api/office/anker/post/reken': {
    mutatieId: 'office.anker.post.reken',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'test/integratie-routes.test.js toets 1: zonder kantoorcode 401, en met code levert hij ' +
        'een oordeel zonder iets te schrijven.',
      op: '2026-09-03'
    },
    nagekeken: 'de handler is gelezen: ankerpost.afrekenen() haalt op en geeft door aan ' +
        'ankerdienst.reken(), die vergelijkt en niets bewaart. test/ankerpost.test.js toets 5 houdt ' +
        'vast dat een antwoord dat niet op een blok lijkt een BEVINDING wordt en geen reparatie.',
    afgetekend: {
      door: 'Claude (Opus 5), op grond van de HTTP-meting en de bron van ankerpost.afrekenen(); ' +
        'niet door een mens nagelezen',
      op: '2026-09-03'
    }
  },

  /* DE OBJECTPAGINA. Een leesbeeld over de objectlaag, die per ontwerp niets
     bezit (server/kern/objectlaag/index.js regel 1: geen opslag, geen
     schrijffunctie). De bijdragers krijgen alleen wat object() al teruggaf. */
  'POST /api/sociaal/object/pagina': {
    mutatieId: 'sociaal.object.pagina',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id',
      /* `soort` zegt WELKE lijst, `id` welk object daarin -- samen wijzen ze het
         object aan, en een proefopstelling heeft ze allebei nodig. */
      objectVeldExtra: 'soort' },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'test/integratie-routes.test.js toets 4 en 5 (over HTTP): zonder sessie 401, een onbekend ' +
        'object 404, en een geldig object levert tien secties zonder dat er iets wordt bewaard.',
      op: '2026-09-03'
    },
    nagekeken: 'test/objectpagina.test.js toets 8 leest de bron van kern/objectlaag/pagina.js zonder ' +
        'commentaar en eist dat er geen db.data en geen save() in staat; test/objectlaag.test.js houdt ' +
        'de sleutellijst van de laag exact, zodat er niet ongemerkt een schrijffunctie tussen schuift.',
    afgetekend: {
      door: 'Claude (Opus 5), op grond van de HTTP-meting plus de twee bronbewakende toetsen; ' +
        'niet door een mens nagelezen',
      op: '2026-09-03'
    }
  }
};

module.exports = { CONTRACTEN };
