/* Nagekeken contracten van de asset-aanvraag (eigenaarsbesluit 19 oktober 2026,
   server/kern/assets/aanvraag.js en aanvraag-betaal.js): een koop is een
   aanvraag, een mens van RTG op naam keurt, en pas een bevestigde betaling geeft
   tickets. Vier routes; /api/asset/koop en /api/asset/herroep hadden al een rij. */
'use strict';
const AF = { door: 'Claude (LivingOS-A), kern, routes en toetsen van de asset-aanvraag gelezen en beproefd', op: '2026-10-19' };
const OPNAAM = { klasse: 'CAPABILITY_GATED',
  bevoegdheid: 'een kantoorsessie OP NAAM (req.officeKey); de gedeelde kantoorcode heeft geen sleutel en krijgt 403, de aanvrager zelf ook' };
const CONTRACTEN = {
  'POST /api/asset/aanvragen': {
    mutatieId: 'asset.aanvragen.mijn', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', uitleg: 'alleen de aanvragen van de eigen sessiesleutel; er komt geen object uit het verzoek' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/assets.test.js "kern: herroepen na betaling meldt pas terugbetaald als de bank het bevestigt": de lijst rondt een door de bank bevestigde herroeping af (bijwerken) en een tweede blik verandert niets meer; "een koop is een aanvraag" 2: een ander lid ziet 0 aanvragen', op: '2026-10-19' },
    afgetekend: AF
  },
  'POST /api/asset/aanvraag/betaal': {
    mutatieId: 'asset.aanvraag.betalen', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'id', uitleg: 'de id moet een aanvraag van DEZE sessie zijn; een aanvraag van een ander lid geeft 404' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/assets.test.js "kern: goedkeuring plus een bevestigde betaling geeft precies een keer tickets": dezelfde en een nieuwe betaalsleutel na betaling geven herhaald en geen ticket erbij, ook een tweede afhandeling niet; een lopende betaling start niet opnieuw (aanvraag-betaal.js); voltooiproef assets herstelbaar: afgebroken en na SIGKILL opnieuw betalen geeft precies een keer tickets', op: '2026-10-19' },
    afgetekend: AF
  },
  'POST /api/office/asset/aanvragen': {
    mutatieId: 'asset.aanvragen.kantoor', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'officeAuth' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude (LivingOS-A), routes/office/veiligheid.js en kern/assets/aanvraag.js kantoorAanvragen gelezen: filtert en kopieert de open aanvragen, geen save() en geen toewijzing',
    bewijs: { gemeten: 'test/assets.test.js "een koop is een aanvraag": de kantoormens op naam ziet de open aanvraag in de lijst; de opslag verandert niet door de oproep', op: '2026-10-19' },
    afgetekend: AF
  },
  'POST /api/office/asset/aanvraag/beslis': {
    mutatieId: 'asset.aanvraag.beslissen', herkomst: 'mens',
    semantiek: { klasse: 'hooguitEens' },
    toegang: OPNAAM,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/assets.test.js "kern: alleen een mens op naam keurt": zonder sleutel 403, de aanvrager zelf 403, een tweede besluit 409 en de stand blijft; "een koop is een aanvraag": de gedeelde kantoorcode 403, een lid-token 401', op: '2026-10-19' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
