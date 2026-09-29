/* ============================================================================
   DE MUTATIECONTRACTEN VAN DE POLITICAL CONNECTOR (kern/democratie/connector.js,
   stap 5) -- een deel van ./mutatiecontracten-democratie.js, apart omdat een
   productbestand onder de 10 KB blijft. Dezelfde klassen als daar: de kantoor-
   en ledenwegen zijn AUTHENTICATED, de partijdeur is met reden PUBLIC. */
'use strict';

const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
const KANTOOR = { klasse: 'AUTHENTICATED', deur: 'officeAuth' };

/* DE POLITICAL CONNECTOR (kern/democratie/connector.js, stap 5). Gemeten in
   test/democratie-partij.test.js toets 8 (de hele lus over HTTP) en toets 9
   (twee keer hetzelfde verzoek). De partijdeur heeft geen sessie maar een eigen
   geheim: een sleutel die een kantoormens op naam uitgeeft (kern/bearercode),
   alleen als hash bewaard, te vervangen via /partij/sleutel en te doven via /partij/uitschrijf. */
const PC_OP = '2026-09-29';
const PC_GETEKEND = { door: 'Claude, op grond van test/democratie-partij.test.js toets 8 en 9; niet door een mens nagelezen', op: PC_OP };
const PARTIJ = { klasse: 'PUBLIC', deur: 'geen bewakerslaag; de kop x-partij-sleutel is het geheim, 128 bits uit kern/bearercode, alleen als ' +
  'hash bewaard, een jaar geldig en door een kantoormens op naam te vervangen of te doven; rem 120/minuut per bron',
  waarom: 'een partij hangt met opzet niet aan een RTG-account (POLITIEK.md par. 7.3, proef P3): de sleutel uit ' +
    'het register is de geloofsbrief, en zonder geldige sleutel geeft de deur 401. De rem die deze klasse eist ' +
    'hangt ervoor: 120 verzoeken per ip per minuut (routes/democratie/partij.js).' };
const pc = (route, mutatieId, toegang, klasse, stand, bewijs, nagekeken) => [route, Object.assign({
  mutatieId, herkomst: 'mens', semantiek: { klasse }, toegang, stand,
  bewijs: { gemeten: 'test/democratie-partij.test.js (' + PC_OP + '): ' + bewijs, op: PC_OP },
  afgetekend: PC_GETEKEND }, nagekeken ? { nagekeken } : {})];
const LEEST = 'de handler roept alleen kijk() aan, dat een ontbrekende collectie niet aanmaakt';
const CONNECTOR = [
  pc('POST /api/member/democratie/kwestie/voorstellen', 'democratie.voorstellen', LID, 'idempotent', 'NOT_APPLICABLE',
    'toets 8: een buur, de inbrenger en het kantoor lezen byte voor byte dezelfde plekken.', LEEST),
  pc('POST /api/office/democratie/partij/lijst', 'democratie.partij.lijst', KANTOOR, 'idempotent', 'NOT_APPLICABLE',
    'toets 8: de lijst toont de ingeschreven partij met haar stand, zonder sleutel of hash.', LEEST),
  pc('POST /api/democratie/partij/wie', 'democratie.partij.wie', PARTIJ, 'idempotent', 'NOT_APPLICABLE',
    'toets 9: twee keer 200 met een byte voor byte gelijk antwoord.', LEEST),
  pc('POST /api/democratie/partij/kwesties', 'democratie.partij.kwesties', PARTIJ, 'idempotent', 'NOT_APPLICABLE',
    'toets 9: twee keer 200 met een byte voor byte gelijk antwoord.', LEEST),
  pc('POST /api/democratie/partij/voorstel/mijn', 'democratie.partij.voorstel.mijn', PARTIJ, 'idempotent', 'NOT_APPLICABLE',
    'toets 9: twee keer 200 met een byte voor byte gelijk antwoord.', LEEST),
  pc('POST /api/democratie/partij/voorstel/aanname', 'democratie.partij.voorstel.aanname', PARTIJ, 'idempotent', 'PROTECTED',
    'toets 9: dezelfde waarde met dezelfde bron nog eens gaf herhaling en geen nieuwe ketenregel; een ANDERE waarde is met opzet een nieuwe regel.'),
  pc('POST /api/office/democratie/partij/uitschrijf', 'democratie.partij.uitschrijf', KANTOOR, 'idempotent', 'PROTECTED',
    'toets 9: nog eens uitschrijven gaf 200 met herhaling en geen tweede regel in de historie.'),
  pc('POST /api/office/democratie/partij/registreer', 'democratie.partij.registreer', KANTOOR, 'idempotent', 'PROTECTED',
    'toets 9: de tweede gaf 409 en er bleef een partij. Een toestandscontrole: dezelfde aanduiding staat een keer per niveau.'),
  pc('POST /api/office/democratie/partij/sleutel', 'democratie.partij.sleutel', KANTOOR, 'nietHerhaalbaar', 'PROTECTED',
    'toets 8: elke oproep geeft een nieuwe sleutel en de vorige werkt daarna niet meer; toets 9: bij een uitgeschreven partij 409.'),
  pc('POST /api/democratie/partij/voorstel/plaats', 'democratie.partij.voorstel.plaats', PARTIJ, 'nietHerhaalbaar', 'PROTECTED',
    'toets 4: elke oproep is een nieuw voorstel en telt mee voor de daglimiet, die voor elke partij gelijk is (de 26e gaf 429).'),
  pc('POST /api/democratie/partij/voorstel/toelicht', 'democratie.partij.voorstel.toelicht', PARTIJ, 'nietHerhaalbaar', 'PROTECTED',
    'toets 3: een tweede toelichting is een nieuwe regel op de keten van het voorstel (DO-10).')
];

module.exports = { CONNECTOR };
