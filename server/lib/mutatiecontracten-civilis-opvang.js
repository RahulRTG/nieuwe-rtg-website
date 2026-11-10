/* CIVILIS-opvang: contracten geschreven naast de eerste verticale keten.
   De gerichte proef is test/civilis-opvang.test.js; externe werking wordt hier
   nadrukkelijk niet mee afgetekend. */
'use strict';

const AF = { door: 'Codex, in opdracht van de eigenaar; handlers en gerichte integratietest gelezen',
  op: '2026-11-10' };
const toegang = { klasse: 'AUTHENTICATED' };
const bewijs = wat => ({ gemeten: 'test/civilis-opvang.test.js: ' + wat, op: '2026-11-10' });
const beschermd = (mutatieId, wat) => ({ mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' }, toegang, stand: 'PROTECTED',
  bewijs: bewijs(wat), afgetekend: AF });

const CONTRACTEN = {
  'POST /api/rtfos/opvang/voorzieningen': beschermd('rtfos.opvang.voorzieningen',
    'leest de stadscollectie; een verlopen acceptatie wordt eenmaal naar vervallen gezet'),
  'POST /api/rtfos/opvang/voorziening/maak': {
    mutatieId: 'rtfos.opvang.voorziening.maak', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Een tweede opdracht om een voorziening te registreren is een tweede voorziening. ' +
      'De kantoormens ziet beide en kan de verkeerde buiten gebruik zetten; stil samenvoegen op naam zou locaties verwarren.',
    bewijs: bewijs('de test maakt precies een voorziening en gebruikt het teruggegeven id'), afgetekend: AF
  },
  'POST /api/rtfos/opvang/aanvraag': beschermd('rtfos.opvang.aanvraag',
    'dezelfde idempotentiesleutel geeft hetzelfde reserverings-id terug'),
  'POST /api/rtfos/opvang/vervolgplan': beschermd('rtfos.opvang.vervolgplan',
    'zet hetzelfde plan en weigert vóór bevestigde aankomst'),
  'POST /api/rtfos/portaal/partner/opvang': beschermd('rtfos.portaal.partner.opvang',
    'leest alleen de eigen partnercollectie; verval kan eenmaal toestand zetten'),
  'POST /api/rtfos/portaal/partner/opvang/capaciteit': beschermd('rtfos.portaal.partner.opvang.capaciteit',
    'capaciteit is een toewijzing met vervaltijd; dezelfde invoer laat dezelfde stand'),
  'POST /api/rtfos/portaal/partner/opvang/besluit': beschermd('rtfos.portaal.partner.opvang.besluit',
    'na accepteren of weigeren blokkeert de toestandscontrole een tweede besluit'),
  'POST /api/rtfos/portaal/partner/opvang/aankomst': beschermd('rtfos.portaal.partner.opvang.aankomst',
    'na aankomst blokkeert de toestandscontrole een tweede aankomst')
};

module.exports = { CONTRACTEN };
