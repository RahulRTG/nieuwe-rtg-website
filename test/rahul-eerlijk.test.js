/* De eerlijkheidsdoctrine van Rahul: liever te hard dan een liegbeest.
   Deze bewaking houdt de doctrine in ALLE gespreks-prompts: het gedeelde
   karakter (RAHUL_LEAD), de leden-AI met het volledige verhaal, en de
   tool-lus van het AI-stuur. Valt de regel ergens weg, dan breekt deze
   test voordat het de assistenten bereikt. Draai los:
   node --experimental-sqlite --test test/rahul-eerlijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
// het volledige verhaal van de leden-AI staat in de ai-promptlaag: de assemblage
// in prompt.js plus het vaste karakterportret in het sibling-bestand karakter.js
const aiVerhaal = () => lees('server/kern/ai/prompt.js') + '\n' + lees('server/kern/ai/karakter.js');

test('het gedeelde karakter draagt de doctrine, met de concrete gedragsregels', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  assert.match(RAHUL_LEAD, /liever te hard dan een liegbeest/i, 'de doctrine staat in de lead');
  assert.match(RAHUL_LEAD, /verzint NOOIT een feit/i, 'nooit feiten verzinnen');
  assert.match(RAHUL_LEAD, /dat weet ik niet/i, 'niet weten mag gezegd worden');
  assert.match(RAHUL_LEAD, /eerste zin, zonder verzachting/i, 'mislukking eerst, onverzacht');
  assert.match(RAHUL_LEAD, /belooft niets wat je niet zeker/i, 'geen loze beloftes');
});

test('het karakter: rots in de branding, schijt aan ego\'s, beschermer, geen geroddel', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  assert.match(RAHUL_LEAD, /rots in de branding/i, 'kalm onder druk, altijd motiverend');
  assert.match(RAHUL_LEAD, /schijt aan ego/i, 'status imponeert hem niet');
  assert.match(RAHUL_LEAD, /op voor de zwakkere/i, 'de beschermer, ook tegen eigen vrienden');
  assert.match(RAHUL_LEAD, /islamitisch/i, 'zijn geloof, rustig gedragen');
  assert.match(RAHUL_LEAD, /roddel/i, 'nooit over anderen achter hun rug');
  assert.match(RAHUL_LEAD, /plaagt graag/i, 'de plaaggeest: warm en nooit gemeen');
  assert.match(RAHUL_LEAD, /nooit gemeen/i, 'plagen kent een harde grens');
  assert.match(RAHUL_LEAD, /lekker rebels/i, 'de rebel: eigenwijs eigen pad');
  assert.match(RAHUL_LEAD, /tornt je rebelsheid nooit/i, 'maar nooit aan eerlijkheid, discretie of veiligheid');
  const verhaal = aiVerhaal();
  assert.match(verhaal, /super populair/i, 'het jeugdverhaal staat in het volledige verhaal');
  assert.match(verhaal, /voor de zwakkere opkwam/i, 'en de kern ervan: de beschermer');
  assert.match(verhaal, /familie Zuidam/i, 'de boerderij waar hij als peuter woonde');
  assert.match(verhaal, /Teyler College/i, 'het vwo waar hij begon');
  assert.match(verhaal, /Schalkwijk/i, 'de voetbalvrienden uit de buurt');
  assert.match(verhaal, /nuchter/i, 'beide werelden kennen maakt hem nuchter');
});

test('de geschiedenis: van huis weg, de verliezen van 2024 en 2025, en de discretieregel', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  assert.match(RAHUL_LEAD, /vijftiende.*van huis weg/i, 'de weggelopen jaren staan in de lead');
  assert.match(RAHUL_LEAD, /2024 en 2025/i, 'de verliesjaren staan in de lead');
  assert.match(RAHUL_LEAD, /NOOIT uit jezelf/i, 'de discretieregel: nooit ongevraagd');
  const verhaal = aiVerhaal();
  assert.match(verhaal, /voetbalkleedkamers/i, 'overal en nergens gewoond, tot in de details');
  assert.match(verhaal, /zonder dat iemand daar iets doorhad/i, 'en op school had niemand iets door');
  assert.match(verhaal, /2024.*alles tegelijk/i, 'het verlies van 2024');
  assert.match(verhaal, /2025.*zestien jaar/i, 'en de vriendschappen van zestien jaar in 2025');
  assert.match(verhaal, /doel.*dit bedrijf/i, 'het doel dat hem overeind hield');
  assert.match(verhaal, /nooit uit jezelf/i, 'de discretieregel in het volledige verhaal');
  // de canon van nu: geen vriendin; hij wacht rustig tot de liefde vanzelf komt
  assert.match(verhaal, /vanzelf weer verliefd/i, 'hij jaagt niet, hij wacht op de echte');
  assert.match(verhaal, /trouwen en veel kinderen/i, 'en wil dan trouwen en veel kinderen');
  assert.doesNotMatch(verhaal, /je vriendin/i, 'er is nu geen vriendin in het verhaal');
});

test('de werkvloer-regel: in een werkomgeving nooit persoonlijke zaken, behalve die van de vraagsteller zelf', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  assert.match(RAHUL_LEAD, /werkomgeving.*nooit en te nimmer persoonlijke zaken/i, 'de regel staat in het gedeelde karakter');
  assert.match(RAHUL_LEAD, /uitzondering.*over zichzelf/i, 'met de ene uitzondering: de vraagsteller zelf');
  assert.match(RAHUL_LEAD, /buig je vriendelijk terug naar het werk/i, 'en de vriendelijke afbuiging');
});

test('de leden-AI (volledig verhaal) en het AI-stuur dragen de doctrine ook', () => {
  assert.match(aiVerhaal(), /liever te hard dan een liegbeest/i, 'leden-AI');
  assert.match(lees('server/kern/stuur.js'), /liever te hard dan een liegbeest/i, 'tool-lus van het stuur');
});

test('elke gespreks-assistent begint met het gedeelde karakter (RAHUL_LEAD)', () => {
  // rahulLeadVoor IS het gedeelde karakter, aangevuld met de omgangsvormen
  // voor het lid (kern/rahul.js); beide vormen dragen dezelfde vaste kern.
  for (const p of ['server/routes/supplier/ai/index.js', 'server/routes/member/persoonlijk.js',
    'server/routes/staff/dienst.js', 'server/routes/techniek/boardroom/ai.js', 'server/kern/fluister/gesprek.js'])
    assert.match(lees(p), /RAHUL_LEAD|rahulLeadVoor/, p + ' gebruikt het gedeelde karakter');
});
