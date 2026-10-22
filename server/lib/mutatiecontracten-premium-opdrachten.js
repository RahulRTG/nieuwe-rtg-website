/* Eigenaarsbesluit 21 oktober 2026, MUTATIECONTRACT.md §9.
   De bedoeling is vastgesteld en op 22 oktober afgesloten met de echte
   replay-, conflict-, client-, worker- en herstelproeven die hieronder per
   contract worden genoemd. Een productbesluit alleen was geen bewijs; deze
   regels verwijzen daarom naar de uitvoerbare tegenproeven. */
'use strict';
const besluit = { door: 'RTG-eigenaar, expliciet productbesluit in Deep Green', op: '2026-10-21' };
const contract = (mutatieId, klasse, toegang, stand, gemeten, waarom) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang,
  stand,
  bewijs: { gemeten, op: '2026-10-22' },
  waarom,
  afgetekend: besluit
});
const CONTRACTEN = {
  'POST /api/aanmelding/aanvraag': contract('aanmelding.aanvraag', 'sleutelVereist',
    { klasse: 'PUBLIC', waarom: 'Een nieuwe aanvrager kan nog geen account hebben; deze bestaande intake verleent zelf geen toegang of goedkeuring.' },
    'PROTECTED', 'test/aanmeldbesluit.test.js, test/aanmelding-transport.test.js, test/aanmelding-workers.pg.test.js en test/aanmelding-crash.pg.test.js',
    'Unieke opdrachtidentiteit per bewuste aanvraag; gebonden aan de geverifieerde aanvrager wanneer aanwezig. Geen identiteit op naam/contact alleen.'),
  'POST /api/member/bureau/zaak/open': contract('bureau.zaak.open', 'sleutelVereist',
    { klasse: 'AUTHENTICATED' }, 'PROTECTED',
    'test/bureau-case-idem.test.js en test/bureau-case-workers.pg.test.js',
    'Ledenidentiteit en opdrachtidentiteit bepalen een zaak; gewijzigde inhoud onder dezelfde sleutel is conflict. Een retry verruimt geen eerder mandaat.'),
  'POST /api/office/bank/rekening/open': contract('office.bank.rekening.open', 'sleutelVereist',
    { klasse: 'AUTHENTICATED' }, 'PROTECTED',
    'test/office-bank-open-idem.test.js en test/office-bank-open-workers.pg.test.js',
    'Kantooractor en opdrachtidentiteit bepalen de opening. Rekeninghouder, soort en naam zijn gebonden inhoud; autorisatie blijft voor iedere herhaling vereist.'),
  'POST /api/werkplek/taak': contract('werkplek.taak', 'sleutelVereist',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'bedrijf' }, 'PROTECTED',
    'test/werkplek-taak-idem.test.js en test/werkplek-taak-workers.pg.test.js',
    'Huis, bevoegde actor en opdrachtidentiteit bepalen de taak. Dezelfde tekst met een nieuwe opdrachtidentiteit mag een nieuwe taak zijn.'),
  'POST /api/labfonds/scheidsrechter': contract('labfonds.scheidsrechter', 'nietHerhaalbaar',
    { klasse: 'AUTHENTICATED' }, 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/premium-analysecontracten.test.js',
    'Elke bewuste activering rekent met de actuele voorstelgegevens en locatiepot. Een advies keert geen geld uit en neemt geen besluit.'),
  'POST /api/office/magnaat/scan': contract('office.magnaat.scan', 'nietHerhaalbaar',
    { klasse: 'AUTHENTICATED' }, 'INTENTIONALLY_NON_IDEMPOTENT',
    'test/premium-analysecontracten.test.js',
    'Elke bewuste activering scant opnieuw. Afgeleide voorstellen houden hun eigen identiteit; geen dubbele neveneffecten of automatische productie-uitrol.'),
  'POST /api/rtf/onboarding/teken': contract('rtf.onboarding.teken', 'idempotent',
    { klasse: 'AUTHENTICATED' }, 'PROTECTED',
    'test/onboarding.test.js, test/onboarding-workers.pg.test.js en test/rtf-onboarding-client.test.js',
    'Profiel, scope en exacte onveranderlijke contractversie binden de ontvangst. De eerste geldige tijd blijft; gewijzigde naam of verouderde versie is conflict. Nieuwe tekst vereist nieuw akkoord.')
};
module.exports = { CONTRACTEN };
