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
// de tool-lus van het stuur is afgesplitst: de dispatcher staat in stuur.js, de
// eigenlijke Claude-lus (met het doctrine-prompt) in de submodule stuur/lus.js.
// We lezen beide, zodat de bewaking klopt waar de doctrine ook precies leeft.
const stuurLus = () => lees('server/kern/stuur.js') + '\n' + lees('server/kern/stuur/lus.js');
/* Alleen de CODE, zonder het commentaar eromheen. Dit huis legt in commentaar
   uit wat er vroeger fout stond -- dat hoort er te staan -- maar een bewaking
   die op de uitleg aanslaat meet de verkeerde helft. */
const codeVan = p => lees(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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
  assert.match(RAHUL_LEAD, /klasse van de inlogpoort/i, 'de klasse van de poort: stille luxe');
  assert.match(RAHUL_LEAD, /stille luxe/i, 'ingetogen, zeker, nooit opzichtig');
  assert.match(RAHUL_LEAD, /duur ben je, juist door de eenvoud/i, 'de luxe zit in de eenvoud, niet in het vertoon');
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
  assert.match(stuurLus(), /liever te hard dan een liegbeest/i, 'tool-lus van het stuur');
});

test('de vertrouwelijkheid: de AI maakt nooit bedrijfsgeheimen openbaar, in elke promptlaag', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  // het gedeelde karakter draagt de regel, plus de resolutie met de eerlijkheid
  assert.match(RAHUL_LEAD, /bedrijfsgeheimen/i, 'de regel staat in het gedeelde karakter');
  assert.match(RAHUL_LEAD, /NOOIT openbaar/i, 'nooit openbaar maken');
  assert.match(RAHUL_LEAD, /de ene zaak gaan nooit naar een andere/i, 'geen lek tussen zaken');
  assert.match(RAHUL_LEAD, /vertrouwelijkheid/i, 'vertrouwelijkheid staat bij de hardste regels');
  // de leden-AI (volledig portret) en de tool-lus van het stuur dragen hem ook
  assert.match(aiVerhaal(), /bedrijfsgeheimen/i, 'leden-AI draagt de vertrouwelijkheid');
  assert.match(stuurLus(), /bedrijfsgeheimen/i, 'de tool-lus van het stuur draagt de vertrouwelijkheid');
});

test('elke gespreks-assistent begint met het gedeelde karakter (RAHUL_LEAD)', () => {
  // rahulLeadVoor IS het gedeelde karakter, aangevuld met de omgangsvormen
  // voor het lid (kern/rahul.js); beide vormen dragen dezelfde vaste kern.
  /* De personeelskant stond in routes/staff/dienst.js en is verhuisd naar
     ./dienst-fluister.js toen dat bestand de 10 KB passeerde. Deze test viel
     daar terecht over -- een pad dat niet meer klopt is precies wat hij hoort
     te merken. Let op de keerzijde: was het naar een bestand verhuisd waar de
     tekst toevallig al in stond, dan was hij stil blijven slagen. */
  for (const p of ['server/routes/supplier/ai/index.js', 'server/routes/member/persoonlijk.js',
    'server/routes/staff/dienst-fluister.js', 'server/routes/techniek/boardroom/ai.js', 'server/kern/fluister/gesprek.js'])
    assert.match(lees(p), /RAHUL_LEAD|rahulLeadVoor/, p + ' gebruikt het gedeelde karakter');
});

/* ============================================================================
   DE PROMPT DROEG RAHUL OP OM TE LIEGEN.

   Er stond letterlijk: 'Zegt het lid "ja" of iets vergelijkbaars, dan bevestig
   je kort dat het geregeld is'. Op een kale "ja" gebeurt er niets -- een gesprek
   is geen uitvoering -- dus deze zin liet Rahul melden dat iets verwerkt was
   terwijl er geen boeking, geen betaling en geen bericht de deur uit ging.

   Dat is niet een ongelukkige formulering maar een schending van de merkregel
   die letterlijk zegt: nooit claimen dat een boeking daadwerkelijk verwerkt is.
   Wrang detail: de doctrine hierboven ("belooft niets wat je niet zeker weet")
   stond er al, en werd door de instructie zelf tegengesproken. De hele bewaking
   in dit bestand keek naar het karakter en niet naar de opdrachten eronder.
   ========================================================================== */
test('de prompt draagt Rahul nooit op te zeggen dat iets al geregeld is', () => {
  const p = lees('server/kern/ai/prompt.js');
  // de zinnen die de AI aansturen, zonder het commentaar eromheen
  const instructies = p.split('\n').filter(r => /^\s*'/.test(r) || /^\s*`/.test(r)).join('\n');
  assert.doesNotMatch(instructies, /bevestig je kort dat het geregeld is/i,
    'de oude instructie is weg');
  assert.match(instructies, /Zeg nooit dat iets al geregeld, geboekt, bevestigd of betaald is/i,
    'en er staat expliciet dat hij dat NIET mag zeggen');
  assert.match(instructies, /alleen wat je zelf hebt uitgevoerd en teruggekregen/i,
    'met de grens erbij: alleen wat echt is uitgevoerd telt als gedaan');
});

/* Klantdata draait op codenamen; de echte naam ligt in de gescheiden kluis. De
   system prompt gaat woordelijk naar de modelaanbieder, dus dat is precies de
   plek waar dat ontwerp telt -- en juist daar stond persona.full. */
test('de leden-prompt noemt de codenaam, niet de volledige naam', () => {
  const p = codeVan('server/kern/ai/prompt.js');
  assert.doesNotMatch(p, /\$\{persona\.full\}/, 'de volledige naam gaat niet meer de prompt in');
  assert.match(p, /persona\.codename/, 'de codenaam wel');
});

/* De personeelskant deed hetzelfde met req.actor.name -- en die naam komt bij
   de zelfaanmelding uit accounts.realNameOf(), dus rechtstreeks uit de kluis. */
test('de personeels-assistent noemt een werk-aanduiding, niet de naam', () => {
  const p = codeVan('server/routes/staff/dienst-fluister.js');
  assert.doesNotMatch(p, /req\.actor\.name/, 'de persoonsnaam gaat niet naar de modelaanbieder');
  assert.match(p, /werkNaam\(req\)/, 'er gaat een werk-aanduiding mee');
});

/* Lifestyle en Business komen uitsluitend na een menselijke beoordeling; de AI
   mag toegang nooit zelf verlenen. Het stuur hangt aan de sessie van de beller,
   en officeAuth laat de eigenaar met zijn eigen accountlogin door -- dus zonder
   deze regel kende "Rahul, keur de wachtrij even goed" passen toe zonder dat
   iemand per geval had gekeken. */
test('het AI-stuur komt niet bij het pas-besluit', () => {
  const { VERBODEN } = require('../server/kern/stuur');
  const lijst = VERBODEN || require('../server/kern/stuur').VERBODEN;
  if (lijst) {
    assert.ok(lijst.some(re => re.test('/api/aanmelding/beslis')), 'aanmelding/beslis staat op de verbodslijst');
  } else {
    // de lijst is niet geexporteerd; dan toetsen we de bron
    assert.match(lees('server/kern/stuur.js'), /\/\^\\\/api\\\/aanmelding\\\//,
      'aanmelding staat op de VERBODEN-lijst in kern/stuur.js');
  }
});
