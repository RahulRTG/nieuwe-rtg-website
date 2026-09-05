/* Gelezen contracten voor vrachtstatus en haar klantcredential. */
'use strict';
const AUTH = { klasse:'AUTHENTICATED' };
const PUBLIEK = { klasse:'PUBLIC', waarom:'de 128-bit volgcode is zelf de beperkte toegang tot alleen de statusprojectie' };
const AF = { door:'Codex, gelezen vrachtkern en gerichte lifecycle- plus retryproef', op:'2026-09-05' };
const beschermd = (id, klasse, toegang, uitspraak) => ({ mutatieId:id, herkomst:'mens',
  semantiek:{ klasse }, toegang, stand:'PROTECTED',
  bewijs:{ gemeten:'test/vracht.test.js ' + uitspraak, op:'2026-09-05' }, afgetekend:AF });

const CONTRACTEN = {
  'POST /api/supplier/vracht': beschermd('supplier.vracht', 'idempotent', AUTH,
    'herhaalt het overzicht zonder tweede zending of heronthuld geheim'),
  'POST /api/supplier/vracht/maak': beschermd('supplier.vracht.maak', 'sleutelVereist', AUTH,
    'herhaalt creatie met dezelfde sleutel: 409, een zending en geen tweede code'),
  'POST /api/supplier/vracht/volgcode/roteer': beschermd('supplier.vracht.volgcode.roteren', 'sleutelVereist', AUTH,
    'roteert atomair, doodt de oude code en heronthult bij retry geen geheim'),
  'POST /api/supplier/vracht/volgcode/intrek': beschermd('supplier.vracht.volgcode.intrekken', 'idempotent', AUTH,
    'trekt server-side in en herhalen laat dezelfde gesloten stand achter'),
  'POST /api/supplier/vracht/etappe': beschermd('supplier.vracht.etappe', 'sleutelVereist', AUTH,
    'bewijst dat een retry geen tweede etappe afvinkt'),
  'POST /api/supplier/vracht/douane': beschermd('supplier.vracht.douane', 'sleutelVereist', AUTH,
    'bindt de inklaring en opdrachtsleutel in dezelfde collectietransactie'),
  'POST /api/supplier/vracht/afleveren': beschermd('supplier.vracht.afleveren', 'sleutelVereist', AUTH,
    'bindt aflevering en opdrachtsleutel in dezelfde collectietransactie'),
  'POST /api/supplier/vracht/melding': beschermd('supplier.vracht.melding', 'sleutelVereist', AUTH,
    'bewijst dat een retry maar een klantmelding bewaart'),
  'POST /api/vracht/volg': {
    mutatieId:'vracht.volg', herkomst:'mens', semantiek:{ klasse:'nietHerhaalbaar' },
    toegang:PUBLIEK, stand:'INTENTIONALLY_NON_IDEMPOTENT',
    waarom:'iedere bewuste statusraadpleging telt als credentialgebruik; zij boekt geen zakelijke handeling en de limiet is een veiligheidsgrens',
    bewijs:{ gemeten:'test/vracht.test.js leest tweemaal veilig en beperkt, terwijl elke geldige raadpleging atomair gebruik telt', op:'2026-09-05' },
    afgetekend:AF
  }
};

module.exports = { CONTRACTEN };
