/* Zaakregie leest een bestaande eigen zaak in een expliciet gekozen
   werkruimte. De drie bestaande deuren blijven onafhankelijk: RTG-account,
   actief WorkOS-lidmaatschap en eigendom in Bureau of Service. De projectie
   bewaart geen context en verleent geen bevoegdheid. */
'use strict';

const CONTRACTEN = {
  'POST /api/bedrijf/zaakregie': {
    mutatieId: 'bedrijf.zaakregie.lees',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: {
      klasse: 'OBJECT_SCOPED',
      objectVeld: 'werkruimte + domain + id',
      uitleg: 'Account, actief WorkOS-lidmaatschap en exact eigendom van de bronzaak moeten tegelijk passen.'
    },
    stand: 'NOT_APPLICABLE',
    bewijs: {
      gemeten: 'test/zaakregie-workos-route.test.js: eigen Service- en Bureauzaak zijn leesbaar; ' +
        'vreemd account, vreemde zaak, losse tenant en ingetrokken membership blijven gesloten. ' +
        'De gebruikte servicemachtiging-lezer schept bij afwezigheid geen opslag.',
      op: '2026-10-16'
    },
    nagekeken: 'Codex, 2026-10-16: server/bedrijf/zaakregie.js projecteert uitsluitend via lezers; ' +
      'bureau.cases, serviceZaken.vind, tenantbrug, concern-, vertegenwoordiging- en ' +
      'servicemachtigingbronnen schrijven geen zaakregiecontext. De gedeelde werkruimtedeur houdt ' +
      'alleen haar bestaande begrensde operationele organisatiemeting bij.',
    afgetekend: {
      door: 'Codex: handler, gebruikte bronlezers en gerichte HTTP-isolatietests beoordeeld',
      op: '2026-10-16'
    }
  }
};

module.exports = { CONTRACTEN };
