/* Routes die een kale credential precies eenmaal in hun antwoord mogen zetten.

   Geen van de drie generieke antwoordcaches (dubbeltik, body-idempotentie en
   Idempotency-Key-poort) mag zo'n antwoord bewaren of herhalen. Het domein
   voorkomt zelf dubbele uitgifte of roteert naar een nieuw geheim; een retry
   krijgt een conflict zonder kale code. */
'use strict';

const ROUTES = new Set([
  /* Account- en personeelsroutes geven een sessie/PIN eenmalig terug. Een
     generieke retrycache zou die na intrekking vóór de echte deur herhalen. */
  'POST /api/auth/register',
  'POST /api/werving/verbind',
  'POST /api/supplier/staff/add',
  'POST /api/supplier/staff/reset-pin',
  'POST /api/office/reisbureau/klaarzetten',
  'POST /api/office/reisbureau/uitnodiging-roteer',
  'POST /api/reis/uitnodiging/nodig-uit',
  'POST /api/reis/uitnodiging/roteer',
  'POST /api/festival/groep',
  'POST /api/festival/groep/code',
  'POST /api/meet/maak',
  'POST /api/meet/code',
  'POST /api/samen/maak',
  'POST /api/samen/code',
  'POST /api/rtf/samen/maak',
  'POST /api/rtf/samen/code',
  'POST /api/supplier/apply/decide',
  'POST /api/supplier/staff/invite',
  'POST /api/supplier/staff/invite/roteer',
  'POST /api/member/spel/projectie-open',
  'POST /api/rtf/spel/projectie-open',
  'POST /api/projectie/koppel',
  'POST /api/rtgid/start',
  'POST /api/rtgid/roteer',
  'POST /api/salon/deal/claim',
  'POST /api/salon/deal/claim/roteer',
  'POST /api/supplier/vracht/maak',
  'POST /api/supplier/vracht/volgcode/roteer',
  'POST /api/member/vluchten/incheck',
  'POST /api/member/vluchten/pass/roteer'
]);

const isEenmalig = (methode, pad) => ROUTES.has(
  String(methode || '').toUpperCase() + ' ' + String(pad || '').replace(/\/$/, '')
);

module.exports = { ROUTES, isEenmalig };
