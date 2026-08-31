/* ============================================================================
   MUTATIECONTRACTEN -- DE LEESROUTES VAN DE IDENTITEITSLAAG.

   Deel van ./mutatiecontracten-leest.js, dat op zijn beurt deel is van
   ./mutatiecontracten.js; zie de kop daar voor de vorm en de regels. Geknipt op
   de 10 kB-grens uit het modulebeleid, en op een naad die er ook een is: dit
   zijn de leesroutes van de persoonlijke vertrouwenslaag (MIJNRTG.md), en die
   groeit met elk blok dat erbij komt terwijl de rest van dat bestand niet
   groeit.

   Bij allebei is "verandert niets" geen bijvangst maar een ONTWERPBESLUIT, en
   dat is de reden dat ze hier met een handmatige nalezing staan en niet met een
   meting alleen.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  /* DE GEGEVENSKAART. Dat deze route niets verandert is geen bijvangst maar een
     ONTWERPBESLUIT dat op de kaart zelf staat ("Deze kaart schrijft niets"), en
     het is de reden dat hem openen geen spoor achterlaat -- zou dat wel zo zijn,
     dan werd uw eigen kaart voller door ernaar te kijken. Dezelfde regel als bij
     de inzagekaart, en test/gegevenskaart.test.js toets 4 houdt hem vast met een
     saveMemberState die geen enkele keer wordt aangeroepen. */
  'POST /api/mijn/gegevens': {
    mutatieId: 'identiteit.gegevenskaart',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'test/gegevenskaart.test.js toets 4: twee opeenvolgende oproepen, en de ' +
      'saveMemberState-haak wordt geen enkele keer geraakt', op: '2026-08-31' },
    nagekeken: 'met de hand, 2026-08-31: server/routes/member/gegevenskaart.js roept alleen ' +
      'kaartVan() aan; die leest de kluis, het dossier en drie registers en stelt een antwoord ' +
      'samen -- geen save(), geen toewijzing, en met opzet geen wisknop (weghalen gebeurt waar ' +
      'het gegeven woont)',
    afgetekend: { door: 'Claude (Opus 5), handler met de hand nagelezen', op: '2026-08-31' }
  },
  /* DE SCHADUWMETER VAN DE DOELBINDING. Hij telt in het geheugen van het
     werkproces en raakt de database niet -- dat is met opzet: een gedragslogboek
     per lid is voor deze vraag niet nodig, en de tellers zeggen HOE VAAK er iets
     langskomt dat niet mag, niet wie het deed. Zelfde keuze als in
     kern/kosten/meterstand.js. */
  'POST /api/command/doelbinding': {
    mutatieId: 'identiteit.doelbinding.meter',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'de meter leest tellers uit een Map in het proces; er is geen db.data-tak ' +
      'en geen save() in kern/identiteit/doelpoort.js', op: '2026-08-31' },
    nagekeken: 'met de hand, 2026-08-31: server/routes/command/schaduwmeters.js geeft ' +
      'doelpoort.meter() terug; die functie leest twee tellers en sorteert een lijst',
    afgetekend: { door: 'Claude (Opus 5), handler met de hand nagelezen', op: '2026-08-31' }
  }
};

module.exports = { CONTRACTEN };
