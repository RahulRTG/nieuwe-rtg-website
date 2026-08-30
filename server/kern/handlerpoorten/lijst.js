/* ============================================================================
   DE LIJST, DEEL EEN -- DE OBJECTPOORTEN.

   Een code of token uit het LICHAAM wijst het object aan: een gezin, een school,
   een klas, een doos. De identiteit komt hier niet uit een kop maar uit wat de
   aanroeper meestuurt, en daarom is de klasse OBJECT_SCOPED -- rollen kruisen
   meet hier niets.

   Deel twee staat in ./lijst-identiteit.js: de poorten die een REEDS vaststaande
   identiteit versmallen, de genre-eisen, en de dingen die eruitzien als een deur
   maar er geen zijn. Gesplitst omdat dit bestand over de grens van keuringsregel
   13 ging, en langs DEZE naad omdat het de naad is die er al in stond -- niet
   langs een willekeurige regel. ./index.js voegt de twee weer samen, zodat er
   voor wie een poort opzoekt nog steeds EEN lijst is.

   De uitleg staat in ./index.js: waarom deze lijst bestaat, waarom de sleutel de
   NAAM is (en niet bestand:naam, wat de eerste poging was), en waarom een
   genre-eis hier geen CAPABILITY_GATED heet.

   naam -> { toegang, veld?, versmalt?, genre?, soort?, wat }
   ========================================================================== */
'use strict';

const POORTEN = {
  /* ---- OBJECT_SCOPED: een code of token uit het lichaam wijst het object aan ---- */

  'familieVan': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinssessie (code + token) en daarbinnen geen gast: dit hoort bij de privezaken van het gezin' },
  'sessieVan': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinssessie: gezinVan(req.body.code) plus profielVan(token)' },
  'gezinVan': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'zoekt het gezin bij req.body.code; 404 als het niet bestaat' },
  'gezinSessie': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezin + profiel, met de vraag of dit een beheerder of ouder is' },
  'klasVan': { toegang: 'OBJECT_SCOPED', veld: 'klasCode',
    wat: 'klas bij req.body.klasCode, met leraar-, personeel- of beheertoken' },
  'personeelVan': { toegang: 'OBJECT_SCOPED', veld: 'schoolCode',
    wat: 'school bij schoolCode plus een personeelToken dat daarin bestaat' },
  'schoolVan': { toegang: 'OBJECT_SCOPED', veld: 'schoolCode',
    wat: 'school bij schoolCode plus het beheerToken van die school' },
  'poort': { toegang: 'OBJECT_SCOPED', veld: 'schoolCode',
    wat: 'school plus beheer- of personeelToken, en daarna een recht binnen die school' },
  'mijn': { toegang: 'OBJECT_SCOPED', veld: 'schoolCode',
    wat: 'personeelVan() plus het eigen mailadres binnen die school' },
  'lesVan': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'de les bij req.body.code; 404 op een onbekende lescode' },
  'rtfSociaal': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel (code + token) en geen gast' },
  'profiel': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel via rtf.verifieerProfiel(code, token)' },
  'profiel': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel via rtf.verifieerProfiel(code, token)' },
  'profiel': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel via rtf.verifieerProfiel(code, token)' },
  'samenSess': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel en geen gast: Samen is voor het gezin en vrienden' },
  'rtfSpeler': { toegang: 'OBJECT_SCOPED', veld: 'code',
    wat: 'gezinsprofiel en geen gast' },
  'werkPoort': { toegang: 'OBJECT_SCOPED', veld: 'werkruimte',
    wat: 'beheerToken of lidToken binnen een werkruimte, plus een recht' },
  'lidVan': { toegang: 'OBJECT_SCOPED', veld: 'werkruimte',
    wat: 'lidToken binnen een werkruimte -- NIET kern/agenda-pro.js:lidVan, die knipt een prefix' },
  'beheerVan': { toegang: 'OBJECT_SCOPED', veld: 'werkruimte',
    wat: 'beheerToken van een werkruimte -- NIET kern/office/samen.js:beheerVan, die normaliseert velden' },
  'viaBeheerOfDirectie': { toegang: 'OBJECT_SCOPED', veld: 'werkruimte',
    wat: 'beheerToken van de werkruimte, of de directie erboven' },
  'rekVan': { toegang: 'OBJECT_SCOPED', veld: 'rekeningId',
    wat: 'de rekening bij rekeningId, binnen de eigen zaak' },
  'rekeningVan': { toegang: 'OBJECT_SCOPED', veld: 'rekeningId',
    wat: 'de order bij rekeningId, binnen de eigen zaak' },
  'eventVan': { toegang: 'OBJECT_SCOPED', veld: 'eventId',
    wat: 'het event bij eventId, binnen de eigen zaak' },
  'eigenRekening': { toegang: 'OBJECT_SCOPED', veld: 'zaak',
    wat: 'de zaak uit het lichaam, en daarbinnen de eigen rekening' },
  'zaakVan': { toegang: 'OBJECT_SCOPED', veld: 'zaak',
    wat: 'de zaak uit het lichaam; 404 op een onbekende code' },
  'zaakVan': { toegang: 'OBJECT_SCOPED', veld: 'zaak',
    wat: 'de zaak uit het lichaam; 404 op een onbekende code' },
  'mijnCharter': { toegang: 'OBJECT_SCOPED', veld: 'ref',
    wat: 'de charterboeking bij ref, en die moet van deze sessie zijn' },
  'mijnHuur': { toegang: 'OBJECT_SCOPED', veld: 'ref',
    wat: 'de huurboeking bij ref, en die moet van deze sessie zijn' },
  'ritVanZaak': { toegang: 'OBJECT_SCOPED', veld: 'ref',
    wat: 'de opdracht bij ref, en de vervoerder moet de eigen zaak zijn' },
  'werktDaar': { toegang: 'OBJECT_SCOPED', veld: 'werkgever',
    wat: 'de werkgever uit het lichaam, en dit lid moet daar werken' },
  'lijnVan': { toegang: 'OBJECT_SCOPED', veld: 'key',
    wat: 'het gesprek uit de sleutel in het lichaam, en dat moet van de eigen zaak zijn' },
  'dmCollega': { toegang: 'OBJECT_SCOPED', veld: 'staffId',
    wat: 'een collega bij staffId, binnen dezelfde zaak en niet jezelf' },
  'eigenPostvak': { toegang: 'OBJECT_SCOPED', veld: 'adres',
    wat: 'het postvak uit het lichaam moet bij de persoonlijke inlog horen' }
};

module.exports = { POORTEN };
