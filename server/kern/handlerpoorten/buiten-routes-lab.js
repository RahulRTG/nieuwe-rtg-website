'use strict';

/* Handgelezen account- en objectpoorten van Living Lab en de buurtweergave.
   Samengevoegd met dubbele-sleutelcontrole in buiten.js. */
const ROUTEPOORTEN = {
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
