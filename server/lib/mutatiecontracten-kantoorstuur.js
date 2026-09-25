/* ============================================================================
   MUTATIECONTRACT -- HET KANTOOR AAN HET STUUR (besluit C2, 25 september 2026).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand omdat deze twee routes bij een besluit horen en niet bij een
   meetronde: het kantoor krijgt het stuur uitsluitend op tonen, dus beide
   routes kunnen per constructie alleen LEZEN. Dat is hier niet aangenomen maar
   gemeten (test/stuur-kantoor.test.js) en met de hand nagelezen.
   ========================================================================== */
'use strict';

const AF = { door: 'Claude Code, handler met de hand nagelezen en tegen een server gemeten', op: '2026-09-25' };

const CONTRACTEN = {
  'POST /api/office/doe': {
    mutatieId: 'office.doe',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/stuur-kantoor.test.js toets 3 tot en met 6): 403 voor de ' +
      'gedeelde code, 200 op naam, de schrijvende kantoorroutes geweigerd door het stuur, en twee keer dezelfde ' +
      'lezing van de vier werelden geeft twee keer 200 met hetzelfde antwoord', op: '2026-09-25' },
    nagekeken: 'met de hand, 2026-09-25: server/routes/stuur.js doeHandler roept alleen stuurRoep() aan. Voor de ' +
      'rol office staat kern/stuur/beleid-lijsten.js uitsluitend op LEZEN (drie paden die niets schrijven) en is ' +
      'KLEIN en VOORSTEL leeg, dus stuurToets laat geen schrijvend pad door en maakt geen voorstel. De ' +
      'frictieschaduw telt in het geheugen (kern/stuur/frictieschaduw-telling.js) en slaat niets op',
    afgetekend: AF
  },
  'POST /api/office/doe/kaart': {
    mutatieId: 'office.doe.kaart',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'NOT_APPLICABLE',
    bewijs: { gemeten: 'tegen een draaiende server (test/stuur-kantoor.test.js toets 4 en 6): de kaart is precies ' +
      'de tonen-lijst, en twee keer vragen geeft dezelfde lijst', op: '2026-09-25' },
    nagekeken: 'met de hand, 2026-09-25: de handler roept alleen stuurPaden(app, office, null) aan, die de routetabel ' +
      'leest en filtert op beleidVoor() -- geen save(), geen toewijzing',
    afgetekend: AF
  }
};

/* De stand van de bedrijfsmaten woont hier mee: dezelfde ronde, hetzelfde
   besluit (C2, tonen), en ook deze route kan per constructie alleen lezen. */
CONTRACTEN['POST /api/office/bedrijfsmaat'] = {
  mutatieId: 'office.bedrijfsmaat',
  herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' },
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'tegen een draaiende server (test/bedrijfsmaat-stand.test.js toets 1): 401 zonder sessie, 403 voor de ' +
    'gedeelde code, 200 voor de eigenaar, en twee keer lezen geeft dezelfde maten', op: '2026-09-25' },
  nagekeken: 'met de hand, 2026-09-25: de handler roept alleen bedrijfsmaat.stand() aan (server/kern/bedrijfsmaat/stand.js). ' +
    'Die leest via pasgeschiedenis.pasOvergangen() en aanwezigheid.laatstActief() (eigencollectie.kijk: afwezig blijft ' +
    'afwezig) en via db.data.rides, .orders en .lidmaatschapBetalingen -- geen save(), geen toewijzing',
  afgetekend: AF
};

module.exports = { CONTRACTEN };
