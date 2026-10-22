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
  /* Drie deuren die de vormherkenning na de refactor naar bearercode v2
     (gezinssessie en lesstroom, #469/#475) niet meer zag: het geheim zelf is
     de sleutel, met een rem per IP en per gezin ervoor. */
  'POST /api/foundation/gezin/inloggen': { toegang: 'OBJECT_SCOPED', veld: 'gezinscode',
    wat: 'dragerVan(req): de 128-bit gezinscode, of code plus gezinstoken; daarna de eigen pincode' },
  'POST /api/foundation/gezin/profiel/kies': { toegang: 'OBJECT_SCOPED', veld: 'gezinscode',
    wat: 'dragerVan(req), zelfde drager als gezin/inloggen; daarna de pincode van dat profiel' },
  'POST /api/foundation/les/join': { toegang: 'OBJECT_SCOPED', veld: 'lescode',
    wat: 'toegang.claim(lescode): de lescode is de sleutel en telt een toetreding in de collectietransactie' },
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
    wat: 'wie(req) levert key of baas; zonder allebei een 401' },

  /* De app-gids controleert de gedeelde sessie inline. De routelezer ziet de
     aanroep van magSessie() niet als routermiddleware, maar zonder account,
     kantoor-, zaak- of gezinssessie antwoordt de handler zelf met 401. */
  'POST /api/gids/app': { toegang: 'AUTHENTICATED',
    wat: 'magSessie(req) in routes/gids.js eist een geldige gedeelde sessie voordat de app-gids wordt gelezen' },

  /* Living Lab: alle zogeheten publieke en bewonersdeuren vragen sinds het
     eigenaarsbesluit van 19 oktober 2026 een account of gezinsprofiel. De
     controle staat als !bewoner(req) inline in de handler en is daarom voor de
     routelezer onzichtbaar. De mijn-routes vragen daarbovenop de labpas: bezit
     van die code bepaalt welk onderzoeksobject bereikbaar is. */
  'POST /api/lab2/mijn': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) eist een account en livinglab.mensen.opPas(pas of code) begrenst het eigen onderzoek' },
  'POST /api/lab2/mijn/observatie': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code); de alias wordt uitsluitend uit die labpas afgeleid' },
  'POST /api/lab2/mijn/venster': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code) opent alleen het meetvenster van die deelnemer' },
  'POST /api/lab2/mijn/meting': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code) schrijft uitsluitend voor die deelnemer' },
  'POST /api/lab2/mijn/reflectie': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code); de deelnemeridentiteit komt niet uit vrije invoer' },
  'POST /api/lab2/mijn/terugtrekken': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code) trekt alleen de bij die labpas horende deelnemer terug' },
  'POST /api/lab2/mijn/terugtrekken/gevolg': { toegang: 'OBJECT_SCOPED', veld: 'pas',
    wat: 'bewoner(req) plus livinglab.mensen.opPas(pas of code) berekent alleen de gevolgen voor die deelnemer' },
  'POST /api/lab2/bewoner/klacht': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of geldig gezinsprofiel voordat een klacht bij een onderzoek wordt ingediend' },
  'POST /api/lab2/bewoner/overzicht': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of geldig gezinsprofiel; het overzicht bevat geen deelnemersidentiteit' },
  'POST /api/lab2/bewoner/themas': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of geldig gezinsprofiel voordat de buurtthema’s van een lab worden gelezen' },
  'POST /api/lab2/bewoner/thema': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of geldig gezinsprofiel; de schrijversidentiteit wordt uit die sessie afgeleid' },
  'POST /api/lab2/bewoner/stem': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of geldig gezinsprofiel en levert de gehashte, stabiele stemmerssleutel' },
  'POST /api/lab2/bewoner/paspoort': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'bewoner(req), de volwassenheidsgrens en livinglab.spel.paspoort(code, eigenaar) binden het paspoort aan het eigen account' },
  'POST /api/lab2/bewoner/paspoort-maak': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) en de volwassenheidsgrens binden een nieuw labpaspoort aan de uit de sessie afgeleide eigenaar' },
  'POST /api/lab2/publiek/apparatuur': { toegang: 'AUTHENTICATED',
    wat: 'ondanks de historische padnaam eist !bewoner(req) sinds 19 oktober 2026 een account of gezinsprofiel' },
  'POST /api/lab2/publiek/uitleen-aanvraag': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of gezinsprofiel voordat een uitleenaanvraag naar het lab wordt geschreven' },
  'POST /api/lab2/publiek/vragen': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of gezinsprofiel voordat de vragen en besluiten van een lab worden gelezen' },
  'POST /api/lab2/publiek/onderzoeken': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of gezinsprofiel voordat de onderzoekskaarten van een lab worden gelezen' },
  'POST /api/lab2/publiek/onderzoek': { toegang: 'AUTHENTICATED',
    wat: 'bewoner(req) eist een account of gezinsprofiel voordat een onderzoekskaart en fondssamenvatting worden gelezen' },

  /* De buurtweergave van FoundationOS draagt een historische naam "publiek",
     maar routes/rtfos/doelgroepen.js eist met magSessie() een account of
     gezinsprofiel. De id kiest alleen welke openbare stad wordt getoond en is
     geen bezitspoort. */
  'POST /api/rtfos/publiek/stad': { toegang: 'AUTHENTICATED',
    wat: 'magSessie(req) eist een geldige account-, kantoor-, zaak- of gezinssessie voor het stadsbeeld' }
};

module.exports = { ROUTEPOORTEN };
