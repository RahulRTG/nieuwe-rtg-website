/* Contracten van de vijf roteerroutes van de codeportalen (eigenaarsbesluit 19
   oktober 2026: een code per medewerker, en roteren voor elk portaal). Dezelfde
   vorm als ./mutatiecontracten-codedeuren.js: roteren geeft elke keer een nieuwe
   code en sluit de vorige, dus een herhaling is met opzet een nieuwe uitkomst,
   en de route staat ook in ./eenmalig-geheim-routes.js. */
'use strict';
const OP = '2026-10-19';
const AF = { door: 'Claude, de roteerroutes en kern/rtfos/coderoteer.js gelezen en beproefd; niet door een mens nagelezen', op: OP };
const GEMETEN = 'test/toegang-portaalrotatie.test.js: na roteren opent de oude code niets (404), ook niet voor het gekoppelde ' +
  'account; de nieuwe koppelt opnieuw; een lid en de gedeelde kantoorcode roteren niet';
const ROTEER = (mutatieId, bevoegdheid) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang: { klasse: 'CAPABILITY_GATED', bevoegdheid }, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom: 'Roteren geeft elke keer een nieuwe code en sluit de vorige, en de koppeling van de vorige vervalt (kern/codekoppel.js). ' +
    'Een herhaling die de vorige code teruggaf zou een geheim uit een cache heronthullen.',
  bewijs: { gemeten: GEMETEN, op: OP }, afgetekend: AF });
const STAD = 'een kantoormens op naam met het recht op dit dossier in die stad (kern/rtfos/basis.js poort)';
const NAAM = 'een kantoormens op naam (boardroomWie); de gedeelde kantoorcode niet';

const CONTRACTEN = {
  'POST /api/rtfos/partner/code/roteren': ROTEER('rtfos.partner.code.roteren', STAD),
  'POST /api/rtfos/gemeente/code/roteren': ROTEER('rtfos.gemeente.code.roteren', STAD),
  'POST /api/rtfos/ondernemer/code/roteren': ROTEER('rtfos.ondernemer.code.roteren', STAD),
  'POST /api/rtfkantoor/club/code/roteren': ROTEER('rtfkantoor.club.code.roteren', NAAM),
  'POST /api/rtfkantoor/stadsraad/partner-code/roteren': ROTEER('rtfkantoor.stadsraad.partnercode.roteren', NAAM)
};

module.exports = { CONTRACTEN };
