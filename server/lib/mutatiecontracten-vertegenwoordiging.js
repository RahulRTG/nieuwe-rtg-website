/* ============================================================================
   DE MUTATIECONTRACTEN VAN RTG VERTEGENWOORDIGING (kern/vertegenwoordiging).

   EERST HET CONTRACT, DAN DE ROUTE -- de volgorde uit ./mutatiecontracten.js is
   hier gevolgd: deze acht stonden er voordat de routes werden opgehangen.

   DE STANDEN ZIJN GEMETEN EN NIET BEREDENEERD. Er is een dubbeltik-ronde
   gedraaid op de kern zelf (elke schrijfweg twee keer met hetzelfde lijf, en
   tellen wat er in de collectie `vertegenwoordigingen` bij kwam). De uitkomst
   staat per route in `bewijs.gemeten` en is de reden dat drie van de vier
   schrijfwegen PROTECTED heten en de vierde niet.

   EN DRIE ERVAN ZIJN EEN TOESTANDSCONTROLE EN GEEN DUPLICAATLAAG. Dat verschil
   wordt hier niet weggepoetst (MUTATIECONTRACT.md par. 5o): wat vaststaat is
   dat er geen tweede effect KAN ontstaan, niet dat een dubbeltik wordt herkend.
   Dezelfde formulering als bij ./mutatiecontracten-beschermzaak.js, en om
   dezelfde reden. */
'use strict';

const OP = '2026-09-11';

/* DE AFTEKENING IS EERLIJK OVER WAT ZE IS. Deze contracten zijn opgesteld door
   Claude op grond van een dubbeltik-ronde die in dezelfde sessie is gedraaid --
   niet door een mens die ze een voor een heeft nagelezen. Dat verschil hoort in
   het register te staan; wie ze naleest, vervangt deze regel door zijn naam. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van een gedraaide dubbeltik-ronde op kern/vertegenwoordiging; ' +
    'niet door een mens nagelezen',
  op: OP
};

const TOEGANG = { klasse: 'AUTHENTICATED', deur: 'auth' };

/* Een LEESweg: hij raakt de opslag niet. `kijk()` in kern/vertegenwoordiging
   is met opzet gekozen boven `bak()` zodat een blik geen lege rij achterlaat --
   zie de kop van kern/eigencollectie.js. */
const leest = (route, mutatieId, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: TOEGANG,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'leesweg: de handler roept alleen kijk() aan, dat een ontbrekende collectie ' +
    'niet aanmaakt. ' + hoe, op: OP },
  nagekeken: 'de handler is in server/routes/vertegenwoordiging.js herleid en bevat geen schrijfvorm',
  afgetekend: AFGETEKEND
}];

/* Een SCHRIJFweg waarvan de tweede oproep dezelfde stand achterlaat. `hoe` zegt
   HOE dat komt -- een toewijzing of een toestandscontrole -- want dat verschil
   is precies wat par. 5o verbiedt weg te poetsen. */
const zelfdeStand = (route, mutatieId, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: TOEGANG,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'dubbeltik-ronde 2026-09-11: dezelfde aanroep twee keer liet dezelfde stand ' +
    'achter in de collectie vertegenwoordigingen. ' + hoe, op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('POST /api/vertegenwoordiging/bevoegdheden', 'vertegenwoordiging.bevoegdheden',
    'De route geeft de gesloten lijst plus de NOOIT-lijst terug en kent geen lid.'),
  leest('POST /api/vertegenwoordiging/mijn', 'vertegenwoordiging.mijn',
    'Het team om mij heen, beide kanten, plus het spoor.'),
  leest('POST /api/vertegenwoordiging/simulatie', 'vertegenwoordiging.simulatie',
    'kern/vertegenwoordiging/simulatie.js kent geen db; hij rekent uit wat er ZOU veranderen ' +
    'en boekt niets -- dezelfde vorm als kern/commercie/voornemen.js.'),

  zelfdeStand('POST /api/vertegenwoordiging/voorstel', 'vertegenwoordiging.voorstel',
    'De tweede oproep kwam terug met 409 ("Er staat al een voorstel van u open bij dit lid") en er ' +
    'bleef EEN machtiging en EEN spoorregel staan. Dat is een toestandscontrole en geen ' +
    'duplicaatlaag (par. 5o): wat vaststaat is dat er geen tweede voorstel kan ontstaan van ' +
    'dezelfde vertegenwoordiger, niet dat een dubbeltik wordt herkend.'),

  zelfdeStand('POST /api/vertegenwoordiging/aanvaard', 'vertegenwoordiging.aanvaard',
    'De tweede oproep kwam terug met 409 ("Deze machtiging is actief") en liet geen tweede ' +
    'spoorregel na. Ook hier een toestandscontrole, geen duplicaatlaag (par. 5o).'),

  zelfdeStand('POST /api/vertegenwoordiging/intrek', 'vertegenwoordiging.intrek',
    'De tweede oproep kwam terug met 409 ("Deze machtiging is al ingetrokken") en de intrekking van ' +
    'de eerste bleef staan. Een toestandscontrole, geen duplicaatlaag (par. 5o).'),

  zelfdeStand('POST /api/vertegenwoordiging/grens', 'vertegenwoordiging.grens',
    'De route ZET de eigen grens van het lid (een toewijzing, geen toevoeging). De tweede oproep gaf ' +
    '200 met dezelfde grens en liet GEEN tweede spoorregel na, want er versmalde niets meer. Dit is ' +
    'dus echte idempotentie en geen toestandscontrole: de route weigert niet, hij antwoordt hetzelfde.'),

  ['POST /api/vertegenwoordiging/handel', {
    mutatieId: 'vertegenwoordiging.handel', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: TOEGANG,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Elke aanroep zet een regel in het spoor van de cliënt, en dat IS de bedoeling. Twee ' +
      'keer namens iemand handelen zijn twee handelingen, en de cliënt hoort ze allebei te zien -- ' +
      'ook als ze op elkaar lijken. Ze samenvouwen zou betekenen dat een tweede, latere handeling ' +
      'verdwijnt in de eerste, en juist het AANTAL keren dat er namens u iets gebeurde is wat een ' +
      'cliënt wil weten. Datzelfde geldt voor een GEWEIGERDE poging: die wordt bewust gelogd, want ' +
      'een vertegenwoordiger die drie keer iets probeerde wat hij niet mocht, is een gesprek waard.',
    bewijs: { gemeten: 'dubbeltik-ronde 2026-09-11: twee keer dezelfde handeling gaf TWEE ' +
      'spoorregels (log 2 -> 4), met verschillende ids', op: OP },
    afgetekend: AFGETEKEND
  }]
]);

module.exports = { CONTRACTEN };
