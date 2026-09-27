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
  // Human approval is consumed once; replay must reach current auth and the approval store.
  'POST /api/member/doe/bevestig',
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
  'POST /api/member/vluchten/pass/roteer',
  /* De tegoedbon draagt geld: de kale code staat alleen in het antwoord op de
     koop en op een rotatie. De koop is wel idempotent (lib/idem.js), maar het
     bewaarde antwoord draagt met opzet geen code (kern/pay/tegoed-uitgifte.js). */
  'POST /api/pay/tegoed/koop',
  'POST /api/pay/tegoed/roteer',
  'POST /api/supplier/pay/tegoed/zet',
  'POST /api/supplier/pay/tegoed/roteer',
  // de afhaalcode van een bestelling: uitgeven is roteren (kern/afhaalcode.js)
  'POST /api/order/afhaalcode',
  /* De cadeaukaart (kern/cadeaukaart.js): de code staat alleen in het antwoord
     op de koop, de kassaverkoop en een rotatie; een herhaling krijgt de kaart
     zonder code. */
  'POST /api/giftcard/buy',
  'POST /api/giftcard/roteer',
  'POST /api/supplier/giftcard/sell',
  'POST /api/supplier/giftcard/roteer',
  // entreecode van een activiteitenticket en code van een vervoerbewijs:
  // tonen is roteren (kern/tickettoegang.js, kern/mobiliteit/kaarttoegang.js)
  'POST /api/ticket/toon',
  'POST /api/supplier/ticket/toon',
  'POST /api/supplier/ticket/deurverkoop',
  'POST /api/mob/kaart/toon',
  /* kascode en tikcode (kern/pay/kasbak.js): uitgeven is roteren, en een retry
     met dezelfde sleutel krijgt 409 zonder code in plaats van een kopie. */
  'POST /api/pay/kascode',
  'POST /api/pay/tikcode',
  // de Arrival Pass: aanvragen en roteren tonen een pass die de server maakt (kern/arrivalpas.js)
  'POST /api/arrival/request',
  'POST /api/arrival/pass/roteer',
  /* De sessiesleutels van een werkruimte buiten productie (bedrijf/sleutels.js):
     elk van deze antwoorden draagt een verse sessie die alleen als hash blijft. */
  'POST /api/bedrijf/werkruimte/maak',
  'POST /api/bedrijf/lid/aanmeld',
  'POST /api/bedrijf/mijn',
  'POST /api/bedrijf/sleutel/roteer',
  'POST /api/tenant/bootstrap/mijn',
  'POST /api/account/start'
]);

const isEenmalig = (methode, pad) => ROUTES.has(
  String(methode || '').toUpperCase() + ' ' + String(pad || '').replace(/\/$/, '')
);

module.exports = { ROUTES, isEenmalig };
