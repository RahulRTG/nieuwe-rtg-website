/* ============================================================================
   DE POORT PER ROUTE, DEEL TWEE -- DE VIJFENTWINTIG VAN 30 AUGUSTUS 2026.

   Deel van ./buiten.js; ./buiten-routes.js draagt deel een. Zie de kop van
   ./buiten.js voor de drie soorten blindheid en voor het verschil met de
   publieke lijst.

   Wat deze vijfentwintig gemeen hebben: hun poort is een BENOEMDE functie die
   als handler wordt doorgegeven (`router.post(pad, maak)`), of hij staat inline
   zonder de vorm van een poort. Geen enkele lezer die de brontekst afzoekt komt
   bij hun lichaam.

   Ze staan in vier groepen, en die groepen zijn geen ordening maar vier
   verschillende soorten toegang: een apparaatsleutel, een gezinscode, een
   bewuste publieke deur, en een pas die iets MAG zijn.
   ========================================================================== */
'use strict';

const ROUTEPOORTEN = {
  /* ---- de laatste vijfentwintig, gelezen op 30 augustus 2026 ----

     Vier soorten, en ze staan hier omdat geen vorm ze vindt: de poort is een
     BENOEMDE functie die als handler wordt doorgegeven (`router.post(pad, maak)`),
     of hij staat inline zonder poortvorm.

     DE DOOS. `doosSleutelOk` staat in ./lijst-identiteit.js als geen-deur, en dat
     was te kort door de bocht: hij telt afketsers per IP EN vergelijkt daarna de
     doossleutel uit de kop `x-doos-sleutel` in constante tijd. De rem is de eerste
     helft, de deur de tweede. Hier staat wat hij werkelijk is; de naam-ingang
     blijft geen-deur, want aan de naam alleen is niet te zien welke helft een
     aanroeper bedoelt. */
  'POST /api/doos/meting': { toegang: 'SERVICE_TO_SERVICE',
    wat: 'de doossleutel uit de kop x-doos-sleutel, timingSafeEqual, met een afketsrem per IP' },
  'POST /api/doos/rapport': { toegang: 'SERVICE_TO_SERVICE', wat: 'dezelfde doossleutel' },
  'POST /api/doos/buurmelding': { toegang: 'SERVICE_TO_SERVICE', wat: 'dezelfde doossleutel' },
  'POST /api/doos/update/status': { toegang: 'SERVICE_TO_SERVICE', wat: 'dezelfde doossleutel' },

  /* HET GEZIN. gezinVan / familieVan zoeken het gezin bij de code in het lichaam.
     De handlers zijn benoemde functies die als handler worden doorgegeven, dus
     geen enkele lezer ziet hun lichaam bij de route. */
  'POST /api/foundation/gezin/uitnodiging/maak': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinVan(code) plus beheerderVan(); alleen de beheerder nodigt uit' },
  'POST /api/foundation/gezin/uitnodigingen': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinVan(code) plus beheerderVan()' },
  'POST /api/foundation/gezin/uitnodiging/intrek': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinVan(code) plus beheerderVan()' },
  'POST /api/foundation/gezin/uitnodiging/bekijk': { toegang: 'OBJECT_SCOPED', veld: 'uitnodiging',
    wat: 'de uitnodigingscode zelf is de sleutel, met een rem per IP ervoor' },
  'POST /api/foundation/gezin/uitnodiging/accepteer': { toegang: 'OBJECT_SCOPED', veld: 'uitnodiging',
    wat: 'dezelfde uitnodigingscode' },
  'POST /api/foundation/hulp/ai': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'familieVan(code, token): een gezinsprofiel' },
  'POST /api/foundation/kosten': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinVan(code) plus beheerderVan(); KOSTEN.md: alleen de beheerder ziet wat het kost' },
  'POST /api/foundation/mail/inbox': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'sessie() op het gezinsprofiel; het adres volgt uit dat profiel' },
  'POST /api/foundation/mail/overzicht': { toegang: 'OBJECT_SCOPED', veld: 'code', wat: 'zelfde sessie' },
  'POST /api/foundation/mail/verzonden': { toegang: 'OBJECT_SCOPED', veld: 'code', wat: 'zelfde sessie' },
  'POST /api/foundation/mail/lees': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'zelfde sessie, plus het bericht moet in DIT postvak staan' },
  'POST /api/foundation/mail/stuur': { toegang: 'OBJECT_SCOPED', veld: 'code', wat: 'zelfde sessie' },

  /* PUBLIEK MET REDEN, en hier hoort het wel -- anders dan bij de inlogdeuren
     staat er bij deze werkelijk niets tussen. */
  'POST /api/foundation/les/maak': { toegang: 'PUBLIC',
    waarom: 'de lesmaker maakt een verse lescode plus docenttoken en geeft die terug; er is nog niets ' +
      'om toegang toe te hebben' },
  'POST /api/foundation/gezin/maak': { toegang: 'PUBLIC',
    waarom: 'een gezin dat nog niet bestaat heeft nog geen code; de maker krijgt hem, met een rem per IP' },
  'POST /api/foundation/reis/aanvraag': { toegang: 'PUBLIC',
    waarom: 'een aanvraag of voordracht van buiten; er is nog geen relatie met dit huis' },
  'POST /api/foundation/school/school/maak': { toegang: 'PUBLIC',
    waarom: 'gesloten buiten de toets (410 met de verwijzing naar de registratiebalie); de route blijft ' +
      'bestaan zodat een oude app leest waarom het niet meer kan' },
  'POST /api/foundation/school/personeel/aanmeld': { toegang: 'PUBLIC',
    waarom: 'net als school/maak gesloten met een 410 en een verwijzing naar de persoonlijke uitnodiging' },

  /* DE PARTNERKANT. partnerSessie(req) eist een pas die partner MAG zijn; zonder
     die pas volgt 403 met de tredennamen erbij. */
  'POST /api/partner/apply': { toegang: 'AUTHENTICATED',
    wat: 'partnerSessie(req): een pas met can_be_partner, anders 403 met de treden erbij' },
  'POST /api/partner/types': { toegang: 'AUTHENTICATED', wat: 'dezelfde partnerSessie' },
  'POST /api/partner/applications/mijn': { toegang: 'AUTHENTICATED', wat: 'dezelfde partnerSessie' },

  'POST /api/werkplek/mijn': { toegang: 'AUTHENTICATED',
    wat: 'wie(req) levert key of baas; zonder allebei een 401' }
};

module.exports = { ROUTEPOORTEN };
