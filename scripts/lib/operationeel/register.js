'use strict';
/* Contracten van menselijke ketens, geen tweede functie- of routecatalogus.
   null betekent dat een benodigde proef nog ontbreekt; nooit impliciet groen. */
const DIMENSIES = ['ENTRY', 'AUTHORITY', 'HANDOFF', 'DECISION', 'STATE', 'RESULT', 'RETURN', 'RECALL',
  'CHANGE', 'REVOKE', 'FAILURE', 'RECOVERY', 'REPLAY', 'DEGRADED', 'PROOF'];
const PROEVEN = {
  'mall-api': 'test/operationeel-aanvraag.test.js',
  'betaalstop-api': 'test/operationeel-aanvraag.test.js',
  'mall-failure': 'test/mall-aanvraag-levensloop.test.js',
  'mall-ui': 'test/operationeel-aanvraag.e2e.js',
  'mall-ui-postgres': 'test/operationeel-aanvraag.e2e.js',
  'installatie-inventaris': null,
  'mall-authority': 'test/operationeel-herstel.test.js',
  'mall-crash': 'test/operationeel-herstel.test.js',
  'mall-route-failure': 'test/operationeel-herstel.test.js',
  'mall-policy': 'test/operationeel-aanvraag.e2e.js',
  'mall-productie': 'test/operationeel-productie.test.js',
  'mall-postgres': 'test/postgres-requestcommit.pg.test.js'
};
const aanvragen = Object.fromEntries(DIMENSIES.map(d => [d, ['mall-api']]));
aanvragen.ENTRY.push('mall-ui', 'mall-ui-postgres');
aanvragen.AUTHORITY.push('mall-authority', 'mall-policy', 'mall-productie');
aanvragen.STATE.push('mall-crash', 'mall-postgres');
aanvragen.REVOKE.push('mall-authority', 'mall-productie');
aanvragen.FAILURE = ['mall-failure', 'mall-route-failure', 'mall-postgres'];
aanvragen.RECOVERY = ['mall-failure', 'mall-route-failure', 'mall-postgres'];
aanvragen.REPLAY.push('mall-crash', 'mall-postgres');
const KETENS = [
  { id: 'mall-aanvraag', naam: 'Saloon → aanvraag → zaak → antwoord → Saloon → wijziging',
    functies: ['wereld', 'dom-mall'], vereist: aanvragen,
    actor: 'Eigen lid; medewerker met actuele leveranciersbevoegdheid',
    eigenaar: 'De daadwerkelijk gekozen zaak; vóór die keuze de vraagmarkt, zonder toegewezen behandelaar',
    bron: 'mallAanvragen', resultaat: 'Gedocumenteerd antwoord op de aanvraag; geen boeking, geleverde dienst of betaling',
    herstel: 'Teruggeven met reden, intrekken en opnieuw openen; opslagfout mag niet worden bevestigd' },
  { id: 'event-deelname', naam: 'Saloon → event → organisator → agenda → personeel → toegang → deelname → afronding', functies: [] },
  { id: 'journalistiek-correctie', naam: 'Redactie → publicatie → Saloon → correctie/intrekking → lezer', functies: [] },
  { id: 'creator-relatie', naam: 'Creator → werk → ontdekking → relatie → beheer/intrekking', functies: [] },
  { id: 'document-goedkeuring', naam: 'Document → bevoegde beoordelaar → besluit → nieuwe versie → betrokkenen', functies: [] },
  { id: 'personeel-bevoegdheid', naam: 'Opleiding → bevoegdheid → taak → uitvoering → intrekking', functies: [] },
  { id: 'offerte-opdracht', naam: 'Aanvraag → offerte → akkoord → uitvoering → wijziging/intrekking', functies: [] },
  { id: 'leverancier-overname', naam: 'Externe aanvraag → storing → veilig wachten → menselijke eigenaar → herstel', functies: [] },
  { id: 'offline-werk', naam: 'Lokale handeling → synchronisatie → conflictbesluit → resultaat → terugvinden', functies: [] }
];
// Een gekoppelde deelketen certificeert nooit automatisch de hele Mall of Wereld.
const CONTRACTEN = [{ functie: 'wereld', volledig: false, ketens: ['mall-aanvraag'] },
  { functie: 'dom-mall', volledig: false, ketens: ['mall-aanvraag'] }];
module.exports = { DIMENSIES, PROEVEN, KETENS, CONTRACTEN };
