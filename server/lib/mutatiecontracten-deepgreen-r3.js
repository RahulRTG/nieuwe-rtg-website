/* RTG Deep Green, ronde 3: de zes supplier-routes uit de open contractbak.

   Drie routes beschrijven een gewenste toestand. Een woordelijk of semantisch
   gelijke retry voert geen nieuwe opslag-, audit- of synchronisatiehandeling
   uit. Drie routes zijn bewuste momenten: een verse MEP- of roosterberekening
   en een tweede export zijn werkelijke nieuwe handelingen. De MEP-keten laat
   daarbij nooit twee automatische inkoopvoorstellen tegelijk uitvoerbaar. */
'use strict';

const AFGETEKEND = { door: 'RTG-eigenaar, Deep Green ronde 3 uitvoeringsbesluit', op: '2026-10-22' };
const AUTH = { klasse: 'AUTHENTICATED' };
const SCHOOL = { klasse: 'OBJECT_SCOPED', objectVeld: 'schoolCode' };
const contract = (mutatieId, klasse, stand, gemeten, waarom, toegang = AUTH) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang, stand,
  bewijs: { gemeten, op: '2026-10-22' }, waarom, afgetekend: AFGETEKEND
});

const CONTRACTEN = {
  'POST /api/supplier/onboarding/zet': contract('supplier.onboarding.zet', 'idempotent', 'PROTECTED',
    'test/zaak-kantoor.test.js: een identieke configuratie houdt het oorspronkelijke wijzigingstijdstip',
    'De volledige, genormaliseerde configuratie is de gewenste toestand; dezelfde toestand opnieuw ontvangen is een transportretry.'),
  'POST /api/supplier/poort/online': contract('supplier.poort.online', 'idempotent', 'PROTECTED',
    'test/ondernemerpoort-e2e.test.js: dezelfde toegestane online-stand geeft bij herhaling exact hetzelfde poortbeeld',
    'Online of offline is een gewenste stand. Een gelijke herhaling logt, bewaart en synchroniseert niet opnieuw.'),
  'POST /api/supplier/werkbeleid/zet': contract('supplier.werkbeleid.zet', 'idempotent', 'PROTECTED',
    'test/zaak-en-mensen.test.js: dezelfde volledige beleidsset behoudt het oorspronkelijke wijzigingstijdstip',
    'De lijst is de volledige gewenste beleidsstand; dezelfde set is geen tweede beleidsbesluit.'),

  'POST /api/supplier/mep/daily': contract('supplier.mep.daily', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/agent.test.js: twee bewuste berekeningen leveren een vers voorstel; het vorige automatische voorstel wordt onuitvoerbaar',
    'Iedere bewuste activering rekent de actuele dagcontext, orders en kaart opnieuw uit. Er blijft hooguit één automatisch inkoopvoorstel uitvoerbaar.'),
  'POST /api/supplier/rooster/voorstel': contract('supplier.rooster.voorstel', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/agent.test.js: twee bewuste activeringen worden beide uitgevoerd voordat het laatste voorstel wordt vastgesteld',
    'Iedere bewuste activering maakt een nieuw voorstel uit de actuele medewerkers, afwezigheid en weekcontext; vaststellen blijft een aparte manageractie.'),
  'POST /api/supplier/rtmail/export': contract('supplier.rtmail.export', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/rtmail-leiding-bestuur.test.js: twee bewuste exports geven exact twee afzonderlijke auditregels',
    'Iedere export is een afzonderlijke gegevensuitvoer die voor privacy en toezicht afzonderlijk in het journaal moet blijven staan.'),

  'POST /api/office/aidata/export': contract('office.aidata.export', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/aidata.test.js: twee bewuste datasetexports leveren exact twee duurzame boardroom-auditregels; opslagverlies sluit de uitvoer',
    'Iedere datasetexport is een afzonderlijke gegevensuitgifte. Deduplicatie zou een echte export uit het verplichte auditspoor verwijderen.'),
  'POST /api/ov/regie/zet': contract('ov.regie.zet', 'idempotent', 'PROTECTED',
    'test/ov-regie.test.js: een identieke toegestane voorkeur veroorzaakt na de eerste opslag geen tweede save',
    'De automaten, comfort- en privacyvelden beschrijven de volledige gewenste regiestand; een gelijke retry is geen nieuwe keuze.'),

  'POST /api/labfonds/doneer': contract('labfonds.doneer', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/labfonds-idem.test.js en test/rtf-labfonds-deur.test.js: zonder sleutel tellen twee toezeggingen op; met sleutel is replay veilig en afwijkende inhoud 409',
    'Een bewuste tweede toezegging is een nieuwe toezegging. De expliciete sleutel onderscheidt een technische retry van die zakelijke handeling.'),
  'POST /api/labfonds/voorstel/maak': contract('labfonds.voorstel.maak', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/labfonds-idem.test.js: de sleutel vergelijkt locatie, titel, doel, bedrag en canoniek onderzoek; test/rtf-labfonds-deur.test.js bewijst twee bewuste voorstellen',
    'Twee bewuste indieningen mogen twee voorstellen zijn; een expliciete sleutel beschermt de dubbeltik en weigert hergebruik voor afwijkende inhoud.'),
  'POST /api/labfonds/beslis': contract('labfonds.beslis', 'hooguitEens', 'PROTECTED',
    'test/appstore-lab-toestemming-routes.test.js en test/rtf-labfonds-deur.test.js: alleen de indiener beslist en een tweede besluit wordt 409',
    'Een besluit mag hooguit eenmaal de pot bewegen. De domeinkern bewaakt de actuele toestand en de generieke antwoordcache is voor deze route uitgeschakeld.'),

  'POST /api/command/uitrol/pauze': contract('command.uitrol.pauze', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/uitrolregie.test.js: twee bewuste pauzes leggen precies twee afzonderlijke geschiedenisregels vast; test/remduurzaam.test.js bewijst fail-closed opslag',
    'Iedere bewuste remactie is een zelfstandig operationeel auditmoment, ook wanneer de uitrol al stil staat.'),
  'POST /api/foundation/school/overdracht/pakket': contract('foundation.school.overdracht.pakket', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/overdracht.test.js: twee bewuste pakketinzages leveren precies twee journaalregels en versturen niets',
    'Het pakket is een gevoelige dossierinzage. Iedere bewuste blik moet afzonderlijk herleidbaar blijven.', SCHOOL),
  'POST /api/office/balie/zoek': contract('office.balie.zoek', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/ledenbaliespoor.test.js: twee bewuste zoekopdrachten vragen exact twee duurzame inzagesporen; opslagverlies sluit de resultaten',
    'Iedere ledenzoekopdracht is afzonderlijke inzage in persoonsgegevens en moet als zelfstandig auditmoment worden vastgelegd.'),
  'POST /api/office/techniek/integraties/noodstop': contract('office.integraties.noodstop', 'nietHerhaalbaar', 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/remduurzaam.test.js: iedere bewuste noodstop zet alle runtime-rails opnieuw uit, schrijft een eigen logregel en bevestigt uitsluitend na duurzame opslag',
    'Een herhaalde bewuste noodstop is een nieuwe veiligheidsactie: hij handhaaft de actuele runtime opnieuw en blijft afzonderlijk auditeerbaar.')
};

module.exports = { CONTRACTEN };
