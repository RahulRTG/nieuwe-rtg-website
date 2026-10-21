/* Eigenaarsbesluit 21 oktober 2026, MUTATIECONTRACT.md §9.
   De bedoeling is vastgesteld; de bestaande conservatieve bewijsstand blijft
   staan totdat ook de echte worker-, herstel- en clientproeven kwalificeren. */
'use strict';
const besluit = { door: 'RTG-eigenaar, expliciet productbesluit in Deep Green', op: '2026-10-21' };
const contract = (mutatieId, klasse, toegang, waarom) => ({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang,
  stand: 'LEGACY_PENDING_CLASSIFICATION',
  waarom: waarom + ' Productbesluit vastgesteld; integrale implementatie en kwalificatie nog open.',
  afgetekend: besluit
});
const CONTRACTEN = {
  'POST /api/aanmelding/aanvraag': contract('aanmelding.aanvraag', 'sleutelVereist',
    { klasse: 'PUBLIC', waarom: 'Een nieuwe aanvrager kan nog geen account hebben; deze bestaande intake verleent zelf geen toegang of goedkeuring.' }, 'Unieke opdrachtidentiteit per bewuste aanvraag; gebonden aan de geverifieerde aanvrager wanneer aanwezig. Geen identiteit op naam/contact alleen.'),
  'POST /api/member/bureau/zaak/open': contract('bureau.zaak.open', 'sleutelVereist',
    { klasse: 'AUTHENTICATED' }, 'Ledenidentiteit en opdrachtidentiteit bepalen een zaak; gewijzigde inhoud onder dezelfde sleutel is conflict. Een retry verruimt geen eerder mandaat.'),
  'POST /api/office/bank/rekening/open': contract('office.bank.rekening.open', 'sleutelVereist',
    { klasse: 'AUTHENTICATED' }, 'Kantooractor en opdrachtidentiteit bepalen de opening. Rekeninghouder, soort en naam zijn gebonden inhoud; autorisatie blijft voor iedere herhaling vereist.'),
  'POST /api/werkplek/taak': contract('werkplek.taak', 'sleutelVereist',
    { klasse: 'OBJECT_SCOPED', objectVeld: 'bedrijf' }, 'Huis, bevoegde actor en opdrachtidentiteit bepalen de taak. Dezelfde tekst met een nieuwe opdrachtidentiteit mag een nieuwe taak zijn.'),
  'POST /api/labfonds/scheidsrechter': contract('labfonds.scheidsrechter', 'nietHerhaalbaar',
    { klasse: 'AUTHENTICATED' }, 'Elke bewuste activering rekent met de actuele voorstelgegevens en locatiepot. Een advies keert geen geld uit en neemt geen besluit.'),
  'POST /api/office/magnaat/scan': contract('office.magnaat.scan', 'nietHerhaalbaar',
    { klasse: 'AUTHENTICATED' }, 'Elke bewuste activering scant opnieuw. Afgeleide voorstellen houden hun eigen identiteit; geen dubbele neveneffecten of automatische productie-uitrol.'),
  'POST /api/rtf/onboarding/teken': contract('rtf.onboarding.teken', 'idempotent',
    { klasse: 'AUTHENTICATED' }, 'Profiel, scope en exacte onveranderlijke contractversie binden de ontvangst. De eerste geldige tijd blijft; gewijzigde naam of verouderde versie is conflict. Nieuwe tekst vereist nieuw akkoord.')
};
module.exports = { CONTRACTEN };
