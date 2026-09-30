/* Routes die een kale credential precies eenmaal in hun antwoord mogen zetten.

   Geen van de drie generieke antwoordcaches (dubbeltik, body-idempotentie en
   Idempotency-Key-poort) mag zo'n antwoord bewaren of herhalen. Het domein
   voorkomt zelf dubbele uitgifte of roteert naar een nieuw geheim; een retry
   krijgt een conflict zonder kale code. */
'use strict';

const ROUTES = new Set([
  // De domeinbon controleert eerst de actuele rol; een antwoordcache mag die niet overslaan.
  'POST /api/bedrijf/praktijk/delen',
  'POST /api/bedrijf/praktijk/inrichten',
  'POST /api/bedrijf/praktijk/aanbod',
  'POST /api/bedrijf/praktijk/vraag',
  'POST /api/bedrijf/praktijk/stap',
  'POST /api/werk-gast/beeld',
  'POST /api/werk-gast/besluit',
  /* Account- en personeelsroutes geven een sessie/PIN eenmalig terug. Een
     generieke retrycache zou die na intrekking vóór de echte deur herhalen. */
  'POST /api/auth/register',
  /* De partijsleutel van DemocratieOS (kern/democratie/partijen.js): inschrijven
     en vervangen tonen hem een keer. Een herhaalde inschrijving krijgt 409, een
     herhaald vervangen een NIEUWE sleutel. */
  'POST /api/office/democratie/partij/registreer',
  'POST /api/office/democratie/partij/sleutel',
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
  /* Machine- en herstelsleutels (CODECREDENTIALS.json): API-poort, Stadsdoos,
     algemene pin, SCIM en IMAP. Elk antwoord draagt een geheim dat alleen als
     hash blijft, of trekt atomair een vorige in. */
  'POST /api/command/apipoort/sleutel',
  'POST /api/command/apipoort/roteer',
  'POST /api/office/stad/sleutel',
  'POST /api/office/stad/node/aanmeld',
  'POST /api/pin/vergeten',
  'POST /api/techniek/sso/scimsleutel',
  'POST /api/member/rtmail/imap/sleutel',
  'POST /api/supplier/rtmail/imap/sleutel',
  'POST /api/member/rtmail/imap/roteer',
  'POST /api/supplier/rtmail/imap/roteer',
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
  /* De vier restdeuren van B9: OV-incheckcode, bezorgcode, festivalpas en de
     incheckcode van een Foundation-activiteit. Elk antwoord hier draagt de kale
     code precies een keer (kern/ov/incheckcode.js, kern/modebezorg/bezorgcode.js,
     kern/festival/pas-toegang.js, kern/rtfos/activiteiten-deur.js). */
  'POST /api/ov/code',
  'POST /api/mode/bezorg/code',
  'POST /api/festival/pas',
  'POST /api/festival/verkoop/rond',
  'POST /api/festival/gast/pas/toon',
  'POST /api/rtfos/activiteit/inschrijven',
  'POST /api/rtfos/activiteit/incheckcode',
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
  'POST /api/account/start',
  /* De sleutel per Zaakdoos (kern/zaakdoos/sleutels.js): uitgeven is roteren, en
     het antwoord draagt de kale sleutel die daarna alleen als hash bestaat. */
  'POST /api/office/doos/sleutel',
  'POST /api/supplier/doos/sleutel',
  /* De horecabon en de polsband (kern/horeca/bon.js): de code staat alleen in
     het antwoord op maken, de eerste band-opwaardering en een rotatie; een
     herhaling krijgt de bon zonder code. */
  'POST /api/supplier/horeca/bon/maak',
  'POST /api/supplier/horeca/bon/roteer',
  'POST /api/supplier/horeca/club/band',
  /* De vier codedeuren van 27 september 2026 (lib/idemsleutels-nooit-codedeuren.js):
     elk van deze antwoorden draagt een kale code die alleen als hash blijft. */
  'POST /api/concern/uitnodigen', 'POST /api/concern/bulk/verstuur', 'POST /api/concern/uitnodiging/roteer',
  'POST /api/member/magnaat/teamkamer/maak', 'POST /api/member/magnaat/teamkamer/code',
  'POST /api/service/bevestiging/toon', 'POST /api/supplier/service/bevestiging/toon',
  'POST /api/office/kantoor/uitnodiging',
  /* De personeelscode van het partnerkanaal (kern/partnerpersoneelscode.js, B14):
     uitgeven en roteren dragen de kale 128-bit code, daarna alleen de hash. */
  'POST /api/office/partnerkanaal/personeelscode',
  'POST /api/office/partnerkanaal/personeelscode/roteer',
  // de RTG Link-drager (B15, kern/link/cap-bak.js): de 128-bit code staat alleen in dit antwoord
  'POST /api/link/cap/maak',
  /* Het SSO-clientgeheim (besluit B16): het VERZOEK draagt het geheim en het
     antwoord alleen de stand; geen cache mag een rotatie herhalen of onthouden. */
  'POST /api/techniek/sso', 'POST /api/techniek/sso/geheim', 'POST /api/techniek/sso/geheim/overlap/sluit',
  /* De lescredentials van RTFoundation-onderwijs (B17, foundation/onderwijs/toegang.js):
     maken toont lescode en leraarssleutel, meedoen de leerlingsleutel, roteren een
     nieuwe lescode -- elk precies een keer; daarna bestaat alleen de hash. */
  'POST /api/foundation/les/maak', 'POST /api/foundation/les/join', 'POST /api/foundation/les/code/roteer',
  /* Het gezinsprofieltoken (B17, foundation/gezinstoken.js): elk van deze
     antwoorden draagt een VERSE gezinssessie die daarna alleen als hash bestaat. */
  'POST /api/foundation/gezin/maak', 'POST /api/foundation/gezin/inloggen',
  'POST /api/foundation/gezin/profiel/kies', 'POST /api/foundation/gezin/uitnodiging/accepteer',
  'POST /api/foundation/gezin/sessie/roteer', 'POST /api/rtf/kanaal'
]);

const isEenmalig = (methode, pad) => ROUTES.has(
  String(methode || '').toUpperCase() + ' ' + String(pad || '').replace(/\/$/, '')
);

module.exports = { ROUTES, isEenmalig };
