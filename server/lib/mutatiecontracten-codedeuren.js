/* Nagekeken contracten van de nieuwe routes van vier codedeuren (27 september
   2026, RELEASEKANDIDAAT.md B9): de concernuitnodiging, de kantooruitnodiging,
   de terugvalcode van de supportbevestiging en de toegangscode van een
   Magnaat-teamkamer. Roteren en opvragen zijn met opzet nooit dezelfde uitkomst
   (elke oproep een nieuwe code, de vorige ingetrokken); intrekken is een stand
   die een tweede keer niets meer verandert. */
'use strict';
const AF = { door: 'Claude, de vier codekernen en hun routes gelezen en beproefd', op: '2026-09-27' };
const OP = '2026-09-27';
const obj = (veld, uitleg) => ({ klasse: 'OBJECT_SCOPED', objectVeld: veld, uitleg });
const ROTEER = (mutatieId, toegang, waarom, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' }, toegang, stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom: waarom + ' Een herhaling die de vorige code teruggaf zou een geheim uit een cache heronthullen; ' +
    'daarom staat de route ook in lib/eenmalig-geheim-routes.js.',
  bewijs: { gemeten, op: OP }, afgetekend: AF });
const INTREK = (mutatieId, toegang, gemeten) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED', bewijs: { gemeten, op: OP }, afgetekend: AF });

const UITNODIGING = obj('uitnodiging', 'de uitnodiging moet bij een entiteit van DEZE sessie horen; een andere eigenaar krijgt 404');
const KAMER = obj('id', 'alleen de host van DEZE teamkamer; een deelnemer krijgt 403, een vreemde 403 en een onbekende kamer 404');
const VERZOEK = obj('id', 'het verzoek moet op naam van DEZE melder staan (lid of zaak uit de sessie); anders 403');

const CONTRACTEN = {
  'POST /api/concern/uitnodiging/roteer': ROTEER('concern.uitnodiging.roteren', UITNODIGING,
    'Roteren geeft elke keer een nieuwe 128-bit code en trekt de vorige in, in een collectietransactie op concern.',
    'test/concern-uitnodiging-credential.test.js 5 en 9: na roteren opent de oude code niets (404) en de nieuwe wel'),
  'POST /api/office/kantoor/uitnodiging/intrek': INTREK('office.kantoor.uitnodiging.intrekken',
    { klasse: 'CAPABILITY_GATED', bevoegdheid: 'eigenaar van RTG (boardroomBaas)' },
    'test/kantooruitnodiging-credential.test.js 4 en 7: intrekken zet ingetrokken_at eenmaal; daarna koppelt de code niet (401), een gebruikte geeft 409'),
  'POST /api/member/magnaat/teamkamer/code': ROTEER('magnaat.teamkamer.code.roteren', KAMER,
    'Roteren geeft de host elke keer een nieuwe 128-bit toegangscode en trekt de vorige in.',
    'test/magnaat-teamkamer-credential.test.js 5: na roteren opent de oude code niets (404) en de nieuwe wel; 8 tegen een echte server'),
  'POST /api/member/magnaat/teamkamer/code/intrek': INTREK('magnaat.teamkamer.code.intrekken', KAMER,
    'test/magnaat-teamkamer-credential.test.js 5: intrekken zet ingetrokken_at eenmaal en de code opent niets meer; 8 tegen een echte server'),
  'POST /api/service/bevestiging/toon': ROTEER('service.bevestiging.code.tonen', VERZOEK,
    'Opvragen is roteren: elke oproep maakt een nieuwe zescijferige code en maakt de vorige ongeldig, hooguit drie keer per verzoek.',
    'test/service-bevestigingscode.test.js 5, 6 en 9: de vorige code werkt niet meer, en de vierde oproep geeft 429'),
  'POST /api/supplier/service/bevestiging/toon': ROTEER('supplier.service.bevestiging.code.tonen', VERZOEK,
    'Zelfde als de ledenkant: opvragen is roteren, met dezelfde teller in de kern.',
    'test/servicezaak.test.js "een zaak bevestigt toegang net als een lid": de zaak vraagt zelf een zescijferige code op')
};
module.exports = { CONTRACTEN };
