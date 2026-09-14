/* HET AANVOERCONTRACT -- en vooral: wat een bron NIET mag meeleveren.

   server/kern/knelpunt/aanvoer.js zegt wat een BRON minimaal moet leveren om
   een vondst te heten. De vorm ervan is niet gekozen maar gemeten: 
   AANVOERVORM.json legt de vijf terreinen naast elkaar en vindt 0 velden in
   alle terreinen, onder twee verschillende domeinlijsten. Daarom is dit een
   afspraak over etiketten en geen objecttype met verplichte velden.

   DE SCHERPSTE TOETSEN ZIJN 5 EN 6. De laag krijgt de mens niet -- niet als
   afspraak maar in de handtekening -- en dat is wat een geschiktheidstoets hier
   structureel onmogelijk maakt in plaats van verboden. Zakt toets 6, dan is dat
   niet een regel die is overtreden maar een deur die is opengezet.

   Draai los: node --test test/aanvoer.test.js
   De vormmeting: npm run aanvoervorm */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { keur, ETIKETTEN, VERPLICHT, MENSVELDEN } = require('../server/kern/knelpunt/aanvoer');
const { maakAanvoer } = require('../server/kern/knelpunt/aanvoer-bronnen');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt', 'aanvoer.js'), 'utf8');
/* De handtekening van vondsten() woont sinds de splitsing in aanvoer-bronnen.js.
   Toets 5 zakte daarop, en terecht: hij las het verkeerde bestand en zou bij een
   zwakkere bewering stil groen zijn gebleven. */
const bronnenBron = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt', 'aanvoer-bronnen.js'), 'utf8');

const GOED = { terrein: 'werk', wat: 'Keukenhulp bij een partner', ingang: '/api/rtf/vacatures',
  dektNiet: 'Een vacature is nog geen inkomen.' };

test('1. een volledige vondst komt erdoor en draagt de herkomst van de LAAG', () => {
  const a = maakAanvoer({ werkbron: () => [GOED] });
  const uit = a.vondsten({ id: 'v1', wat: 'werk hebben' });
  assert.equal(uit.vondsten.length, 1);
  assert.equal(uit.vondsten[0].herkomst, 'werkbron',
    'de herkomst komt niet van de laag; dan kan een bron zich voordoen als een andere');
  assert.equal(uit.vondsten[0].beschikbaarheid, null,
    'een bron die geen aantal noemt, hoort null te krijgen en geen verzonnen getal');
});

test('2. een bron die zijn eigen herkomst opschrijft, krijgt die niet', () => {
  const a = maakAanvoer({ echt: () => [Object.assign({}, GOED, { herkomst: 'iemand-anders' })] });
  const uit = a.vondsten({});
  /* `herkomst` staat in ETIKETTEN, dus hij valt niet af als onbekend etiket --
     hij wordt OVERSCHREVEN. Dat is het punt. */
  assert.equal(uit.vondsten.length, 1);
  assert.equal(uit.vondsten[0].herkomst, 'echt');
});

test('3. dektNiet is verplicht -- de duurste van de vijf', () => {
  /* openingen-kaart.js: de gevaarlijkste lezer is niet degene die een leegte
     voor een gat aanziet, maar degene die aanbod leest als "dit is geregeld". */
  const zonder = Object.assign({}, GOED); delete zonder.dektNiet;
  const a = maakAanvoer({ b: () => [zonder] });
  const uit = a.vondsten({});
  assert.equal(uit.vondsten.length, 0);
  assert.match(uit.geweigerd[0].reden, /ontbreekt: dektNiet/);
  assert.ok(VERPLICHT.includes('dektNiet'));
});

test('4. een ingang is een pad en nooit een handeling', () => {
  const a = maakAanvoer({
    url: () => [Object.assign({}, GOED, { ingang: 'https://voorbeeld.nl/vacature' })],
    werkwoord: () => [Object.assign({}, GOED, { ingang: 'solliciteer' })]
  });
  const uit = a.vondsten({});
  assert.equal(uit.vondsten.length, 0);
  assert.equal(uit.geweigerd.length, 2);
  for (const g of uit.geweigerd) assert.match(g.reden, /ingang is geen pad/);
});

test('5. de laag krijgt de mens niet -- dat staat in de handtekening', () => {
  /* Niet een regel om te onthouden maar een vorm die het onmogelijk maakt.
     Een tweede argument erbij is een BESLUIT, en deze toets dwingt dat af. */
  assert.match(bronnenBron, /function vondsten\(voorwaarde\) \{/,
    'vondsten() heeft een tweede argument gekregen; dan kan er een mens in');
  assert.match(bronnenBron, /fn\(voorwaarde\)/, 'de bron krijgt meer dan de randvoorwaarde mee');
  for (const b of [bron, bronnenBron])
    assert.doesNotMatch(b, /require\(.*accounts|kluis|codenaamVan/,
      'deze laag raakt de identiteitskluis aan');
});

test('6. een vondst die een gegeven over de mens draagt, wordt GEWEIGERD', () => {
  /* Geweigerd en niet gefilterd: de bouwer van die bron hoort het te zien in
     plaats van dat het stil wordt weggepoetst. */
  for (const veld of ['codenaam', 'leeftijd', 'postcode', 'score', 'geschikt']) {
    const a = maakAanvoer({ b: () => [Object.assign({}, GOED, { [veld]: 'x' })] });
    const uit = a.vondsten({});
    assert.equal(uit.vondsten.length, 0, veld + ' kwam er gewoon doorheen');
    assert.match(uit.geweigerd[0].reden, /draagt een gegeven over de mens/);
  }
  assert.ok(MENSVELDEN.includes('bsn') && MENSVELDEN.includes('profielId'));
});

test('7. niets hebben is een uitslag en geen stilte', () => {
  /* Zonder deze regel is een bron die stuk is niet te onderscheiden van een
     bron die leeg is -- dezelfde fout als `if (!a.key) return`. */
  const a = maakAanvoer({ leeg: () => [], kapot: () => { throw new Error('boem'); } });
  const uit = a.vondsten({});
  assert.deepEqual(uit.vondsten, []);
  assert.equal(uit.geenBron.length, 1);
  assert.equal(uit.geenBron[0].herkomst, 'leeg');
  assert.equal(uit.geweigerd.length, 1, 'een kapotte bron laat geen spoor na');
  assert.match(uit.geweigerd[0].reden, /bron-brak/);
});

test('8. een kapotte bron neemt de andere niet mee', () => {
  const a = maakAanvoer({ kapot: () => { throw new Error('boem'); }, goed: () => [GOED] });
  const uit = a.vondsten({});
  assert.equal(uit.vondsten.length, 1, 'de goede bron is weggevallen nadat de andere brak');
});

test('9. er wordt niet gesorteerd -- een rangorde is een oordeel', () => {
  const a = maakAanvoer({
    een: () => [Object.assign({}, GOED, { wat: 'A' }), Object.assign({}, GOED, { wat: 'B' })],
    twee: () => [Object.assign({}, GOED, { terrein: 'opvang', wat: 'C' })]
  });
  const uit = a.vondsten({});
  assert.deepEqual(uit.vondsten.map((m) => m.wat), ['A', 'B', 'C'],
    'de volgorde is veranderd; dan wordt er ergens gewogen');
  /* Op het GEDRAG en niet op het woord: `score` en `rangorde` staan in
     MENSVELDEN, juist om ze te weigeren. Een woordtoets zou die lijst
     verbieden. */
  for (const b of [bron, bronnenBron])
    assert.doesNotMatch(b, /\.sort\(/, 'er wordt gesorteerd in de aanvoerlaag');
});

test('10. de etiketlijst is gesloten en bevroren', () => {
  assert.deepEqual(ETIKETTEN, ['terrein', 'wat', 'ingang', 'dektNiet', 'herkomst', 'beschikbaarheid']);
  assert.ok(Object.isFrozen(ETIKETTEN) && Object.isFrozen(VERPLICHT) && Object.isFrozen(MENSVELDEN));
  const a = maakAanvoer({ b: () => [Object.assign({}, GOED, { prijs: 12 })] });
  assert.match(a.vondsten({}).geweigerd[0].reden, /etiket onbekend: prijs/);
});

test('11. de vormmeting draagt de conclusie, en die is niet overgetypt', () => {
  /* De reden dat dit een afspraak over etiketten is en geen objecttype, staat
     in een MEETUITSLAG en niet in een mening. Verandert die uitslag, dan hoort
     dit contract te worden heroverwogen -- vandaar deze koppeling. */
  const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AANVOERVORM.json'), 'utf8'));
  assert.equal(j.geenGedeeldeVorm, true,
    'AANVOERVORM.json vindt nu WEL een gedeelde vorm; dan is de keuze voor etiketten niet meer gedekt');
  assert.equal(j.ruim.inAlleTerreinen.length, 0);
  assert.equal(j.smal.inAlleTerreinen.length, 0);
  assert.ok(j.stempel && j.stempel.commit, 'de meting draagt geen commit en is dus niet na te lopen');
  assert.match(keur(GOED, 'x').ok ? 'ok' : 'nee', /ok/);
});

/* ---------------------------------------------------------------------------
   DE BEDRADING, TEGEN EEN ECHTE SERVER.

   De toetsen hierboven bewijzen het CONTRACT en niets over de aansluiting. Dat
   onderscheid is hier duur betaald: bij het bouwen gaf de werkbron stilletjes
   een lege lijst, en dat zag er precies zo uit als "er zijn geen vacatures".
   De oorzaak was late binding -- `const { openVacatures } = kern` bevriest
   `undefined` op montagemoment, waar de kop van opzet/aanbouw3.js letterlijk
   voor waarschuwt. Geen enkele toets hierboven kon dat zien.
   ------------------------------------------------------------------------- */
const { startServer, stop } = require('./helper');
const os = require('os');

const roep = async (base, pad, lijf, token) => {
  const r = await fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, d: await r.json().catch(() => ({})) };
};

test('12. een echte vacature komt als vondst achter het knelpunt vandaan', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvoer-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    /* De wereld wordt langs de GEWONE route opgezet -- dezelfde regel als in
       scripts/lib/herstelwereld.js. De zaadgegevens dragen namelijk NUL open
       vacatures, dus zonder deze stap meet je een lege wereld en noemt de bron
       terecht `bronLeeg`. */
    const ro = await roep(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = ((ro.d && ro.d.staff) || []).find((x) => x.role === 'manager');
    assert.ok(man, 'geen manager in de zaadgegevens; dan kan deze toets niets opzetten');
    const inlog = await roep(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    assert.ok(inlog.d.token, 'de zaak kon niet inloggen');

    const vac = await roep(base, '/api/supplier/vacature', { func: 'Keukenhulp', soort: 'bijbaan',
      minLeeftijd: 16, omschrijving: 'Meehelpen in de keuken', plaats: 'Amsterdam',
      uren: '8 uur per week', open: true }, inlog.d.token);
    assert.equal(vac.status, 200, 'de vacature is niet geplaatst');

    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const r = await roep(base, '/api/knelpunt', {
      doel: 'werk vinden zodat ik inkomen heb',
      randvoorwaarden: [{ id: 'baan', wat: 'een baan met inkomen', stand: 'ontbreekt' }],
      manieren: [{ id: 'werken', wat: 'gaan werken', nodig: ['baan'] }]
    }, lid.d.token);

    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.d.vondsten), 'de route geeft geen vondsten terug');
    /* DE WERKVONDSTEN, NIET DE HELE LIJST -- zie de reden bij toets 13: een
       toets die op `length === 1` staat, zakt zodra er een bron bij komt en
       zegt dan iets over de bronnenlijst in plaats van over de vacature. */
    const werk = r.d.vondsten.filter((x) => x.terrein === 'werk');
    assert.equal(werk.length, 1, 'de geplaatste vacature komt er niet uit -- de bron is niet bedraad');
    const v = werk[0];
    assert.equal(v.terrein, 'werk');
    assert.equal(v.herkomst, 'werk');
    /* Wat de vacature van zichzelf EIST staat er zichtbaar bij en wordt nooit
       op de mens toegepast: de aanvoerlaag kent hem niet. */
    assert.match(v.wat, /Keukenhulp/);
    assert.match(v.wat, /vanaf 16 jaar/);
    assert.equal(v.beschikbaarheid, null, 'er is beschikbaarheid verzonnen die geen bron noemt');
    assert.match(v.dektNiet, /nog geen inkomen/);
    assert.deepEqual(r.d.vondstenGeweigerd, []);
    /* `werk` heeft nu een bron, dus hij hoort NIET meer in zonderBron te staan. */
    assert.ok(!(r.d.vondstenZonderBron || []).some((z) => z.terrein === 'werk'));
  } finally { await stop(child); }
});

test('13. een lege wereld heet bronLeeg en niet "geen vondsten"', async () => {
  /* Niets hebben is een uitslag en geen stilte -- de spiegel van toets 7, maar
     nu over de hele keten. Zonder vacature in de wereld hoort de route te
     zeggen DAT de bron leeg was, en van wie. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanvoer-leeg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const r = await roep(base, '/api/knelpunt', {
      doel: 'werk vinden zodat ik inkomen heb',
      randvoorwaarden: [{ id: 'baan', wat: 'een baan met inkomen', stand: 'ontbreekt' }],
      manieren: [{ id: 'werken', wat: 'gaan werken', nodig: ['baan'] }]
    }, lid.d.token);
    assert.equal(r.status, 200);
    /* OVER DE WERKBRON, NIET OVER DE HELE LIJST. Hier stond `deepEqual(vondsten,
       [])`, en dat hield alleen zolang er EEN bron was: de derde bron (opvang)
       levert in de demowereld wel degelijk plekken, en toen zakte deze toets op
       een uitslag die precies klopte. Een toets die aan de bronnenLIJST vastzit,
       verbiedt een vierde bron zonder dat iemand dat heeft besloten. */
    assert.deepEqual(r.d.vondsten.filter((v) => v.terrein === 'werk'), [],
      'er is geen vacature in deze wereld, dus de werkbron hoort niets te leveren');
    assert.ok((r.d.vondstenBronLeeg || []).some((b) => b.herkomst === 'werk'),
      'de lege bron meldt zich niet; dan is "geen vacatures" niet te onderscheiden van "niet aangesloten"');
    assert.deepEqual(r.d.vondstenGeweigerd, [], 'een lege wereld is geen weigering');
  } finally { await stop(child); }
});

/* ---------------------------------------------------------------------------
   DE TWEEDE BRON -- de eigenlijke proef op het contract.

   Een contract dat op EEN bron past, is geen contract maar een adapter met een
   mooie naam. Leerstof is daarom met opzet maximaal anders gekozen dan
   vacatures: geen lijst (2 x 1.000.000 procedureel), geen aanbieder, geen eis,
   geen schaarste -- en dus een selectie die fundamenteel anders werkt.
   ------------------------------------------------------------------------- */
const bronnenContract = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt',
  'aanvoer-bronnen.js'), 'utf8');

test('14. de contractlaag kent geen enkele domeinnaam', () => {
  /* DIT IS DE PROEF DAT ER GEEN VERVORMING NODIG WAS. Zodra aanvoer-bronnen.js
     of de keuring in aanvoer.js iets weet van vacatures, leerpaden of beroepen,
     is het contract meegebogen met zijn eerste bron -- en dan meet de tweede
     bron niets meer. `vacature` mag in aanvoer.js alleen in de UITLEG staan
     ("een vacature is geen inkomen"), nooit in code. */
  const codeVan = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [naam, tekst] of [['aanvoer.js', bron], ['aanvoer-bronnen.js', bronnenContract]]) {
    assert.doesNotMatch(codeVan(tekst), /vacature|leerpad|beroep|openVacatures|beroepenbieb|opvangwijzer|kinderopvang|groep|nanny/i,
      naam + ' kent een domeinbegrip; het contract is meegebogen met een bron');
  }
});

test('15. een tweede, totaal andere bron past zonder wijziging in hetzelfde contract', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron2-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const vw = { id: 'diploma', wat: 'een diploma als lasser om te kunnen werken', stand: 'ontbreekt' };
    const r = await roep(base, '/api/knelpunt', { doel: 'aan het werk komen',
      randvoorwaarden: [vw], manieren: [{ id: 'w', wat: 'werken', nodig: ['diploma'] }] }, lid.d.token);
    assert.equal(r.status, 200);
    const v = (r.d.vondsten || []).filter((x) => x.terrein === 'opleiding');
    assert.ok(v.length > 0, 'de opleidingsbron levert niets op een randvoorwaarde die een vak noemt');
    assert.equal(v[0].herkomst, 'opleiding');
    assert.match(v[0].wat, /Lasser/i, 'er is niet op het woord uit de randvoorwaarde gezocht');
    /* De bibliotheek kent geen schaarste EN noemt geen aantal. "Onbeperkt" zou
       een bewering zijn die de bron zelf niet doet. */
    assert.equal(v[0].beschikbaarheid, null);
    assert.match(v[0].dektNiet, /leerSTOF en geen inschrijving/);
    assert.deepEqual(r.d.vondstenGeweigerd, []);
  } finally { await stop(child); }
});

test('16. zonder een woord om op te zoeken grijpt de bron NIET in het wilde weg', async () => {
  /* Twee miljoen combinaties: de "eerste 25" zijn geen vondsten maar willekeur
     met een net randje. Een verzonnen beroep is een verzonnen advies, dus de
     eerlijke uitkomst is leeg MET reden -- en die reden noemt de bron. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron2-leeg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const vw = { id: 'diploma', wat: 'een diploma nodig voor de opleiding', stand: 'ontbreekt' };
    const r = await roep(base, '/api/knelpunt', { doel: 'aan het werk komen',
      randvoorwaarden: [vw], manieren: [{ id: 'w', wat: 'werken', nodig: ['diploma'] }] }, lid.d.token);
    assert.equal(r.status, 200);
    assert.equal((r.d.vondsten || []).filter((x) => x.terrein === 'opleiding').length, 0);
    assert.ok((r.d.vondstenBronLeeg || []).some((b) => b.herkomst === 'opleiding'),
      'de lege opleidingsbron meldt zich niet; dan lijkt "geen leerstof" op "niet aangesloten"');
    assert.deepEqual(r.d.vondstenGeweigerd, [], 'een lege uitkomst is geen weigering');
  } finally { await stop(child); }
});

test('17. een bron mag zijn GEVONDEN totaal melden, en zwijgen is null', () => {
  /* Dit gat liep door beide bronnen en niet door een domein: de werkbron kapt
     af op een eindige lijst, de opleidingsbron op twee miljoen. Zonder het
     gevonden aantal leest "24 leerpaden" als "er zijn er 24".

     Een kale lijst blijft geldig en betekent dan NIET NAGEGAAN -- nooit
     stilzwijgend gelijk aan wat er getoond wordt. */
  const a = maakAanvoer({
    zwijgt: () => [GOED, GOED],
    meldt: () => ({ vondsten: [GOED], gevonden: 10000 })
  });
  const uit = a.vondsten({ id: 'werk', wat: 'werk' });
  const zwijgt = uit.geleverd.find((g) => g.herkomst === 'zwijgt');
  const meldt = uit.geleverd.find((g) => g.herkomst === 'meldt');
  assert.deepEqual(zwijgt, { herkomst: 'zwijgt', getoond: 2, gevonden: null },
    'een bron die zijn totaal niet noemt, krijgt er stilzwijgend een');
  assert.deepEqual(meldt, { herkomst: 'meldt', getoond: 1, gevonden: 10000 });
});

test('18. getoond telt wat DOORKWAM en niet wat de bron aanbood', () => {
  /* Een geweigerde vondst staat niet op het scherm. Hem meetellen zou het getal
     een belofte maken die de lezer niet ziet. */
  const slecht = Object.assign({}, GOED); delete slecht.dektNiet;
  const a = maakAanvoer({ b: () => ({ vondsten: [GOED, slecht, GOED], gevonden: 3 }) });
  const uit = a.vondsten({ id: 'werk', wat: 'werk' });
  assert.equal(uit.vondsten.length, 2);
  assert.deepEqual(uit.geleverd, [{ herkomst: 'b', getoond: 2, gevonden: 3 }]);
  assert.equal(uit.geweigerd.length, 1);
});

test('19. de laag herverdeelt niets tussen bronnen', () => {
  /* Een bron met een grote catalogus verdringt er een met weinig. Dat mag
     zichtbaar zijn en het mag NIET worden gladgestreken: herverdelen is een
     rangorde, en kern/knelpunt/index.js regel 4 verbiedt die. */
  const a = maakAanvoer({
    veel: () => ({ vondsten: Array.from({ length: 9 }, () => GOED), gevonden: 9 }),
    weinig: () => ({ vondsten: [GOED], gevonden: 1 })
  });
  const uit = a.vondsten({ id: 'werk', wat: 'werk' });
  assert.equal(uit.vondsten.length, 10, 'er is iets weggelaten of bijgeteld');
  const som = uit.geleverd.reduce((n, g) => n + g.getoond, 0);
  assert.equal(som, uit.vondsten.length, 'de telling per bron klopt niet met de lijst');
  /* Geen enkele bron wordt op een aandeel gezet. */
  assert.doesNotMatch(bronnenContract, /quota|aandeel|evenredig|balans/i);
});

test('20. een echte vraag raakt beide werelden, met een identieke vondstvorm', async () => {
  /* DE PROEF DIE ER TOE DOET: een doel van een mens, twee onafhankelijke
     domeinen, en dezelfde minimale vorm. Lukt dit zonder dat de vondsten uit
     het ene domein er anders uitzien dan uit het andere, dan is de projectie
     echt en geen vacature-flow met een tweede tak. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samen-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const ro = await roep(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = ((ro.d && ro.d.staff) || []).find((x) => x.role === 'manager');
    const inlog = await roep(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    await roep(base, '/api/supplier/vacature', { func: 'Lasser', soort: 'vast', minLeeftijd: 18,
      omschrijving: 'Lassen in de werkplaats', plaats: 'Rotterdam', uren: '38 uur', open: true },
      inlog.d.token);

    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const vw = { id: 'vak', wat: 'een diploma als lasser om te kunnen werken', stand: 'ontbreekt' };
    const r = await roep(base, '/api/knelpunt', { doel: 'aan het werk als lasser',
      randvoorwaarden: [vw], manieren: [{ id: 'w', wat: 'gaan werken', nodig: ['vak'] }] }, lid.d.token);

    const v = r.d.vondsten || [];
    const terreinen = new Set(v.map((x) => x.terrein));
    assert.ok(terreinen.has('werk') && terreinen.has('opleiding'),
      'een randvoorwaarde die beide terreinen raakt levert niet uit beide bronnen: ' + [...terreinen]);
    /* EEN vorm over beide domeinen -- geen onderwijsveld erbij, geen werkveld
       erbij. Zodra deze verzameling er twee bevat, is de projectie gebroken. */
    const vormen = new Set(v.map((x) => Object.keys(x).sort().join(',')));
    assert.equal(vormen.size, 1, 'de twee domeinen leveren een verschillende vondstvorm: ' + [...vormen]);
    assert.equal([...vormen][0], 'beschikbaarheid,dektNiet,herkomst,ingang,terrein,wat');

    /* En het verschil in AANTAL is leesbaar in plaats van suggestief: een
       vacature van een gevonden vacature is iets heel anders dan
       vierentwintig leerpaden van tienduizend. */
    const g = r.d.vondstenGeleverd || [];
    const werk = g.find((x) => x.herkomst === 'werk');
    const opl = g.find((x) => x.herkomst === 'opleiding');
    assert.ok(werk && opl, 'niet beide bronnen melden wat ze leverden');
    assert.equal(werk.getoond, werk.gevonden, 'de werkbron toont niet alles wat hij vond');
    assert.ok(opl.gevonden > opl.getoond, 'de opleidingsbron meldt geen afkapping terwijl hij afkapt');
  } finally { await stop(child); }
});

/* ---------------------------------------------------------------------------
   DE FOUNDATION-DEUR -- een besluit van de eigenaar, 13 september 2026.

   Een gezin mag zijn eigen vraag laten beantwoorden met vondsten. Wat hier
   bewaakt wordt is niet dat de deur OPEN is (dat meet DOELGROEPBEREIK.json)
   maar dat hij niet MEER opent dan besloten.
   ------------------------------------------------------------------------- */

test('21. een gezin krijgt hetzelfde antwoord als een lid, en niets extra', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfknel-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    /* De gezinssessie langs de ECHTE route, met dezelfde oproep als
       scripts/lib/proefsessies.js -- wie de inlog van een gezin twee keer
       opschrijft, heeft over een half jaar twee verschillende gezinnen. */
    const gezin = await roep(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Proefgezin',
      naam: 'Papa', pin: '1234', bevoegdGezin: true, privacyAkkoord: true });
    const code = gezin.d && gezin.d.code, token = gezin.d && gezin.d.token;
    assert.ok(code && token, 'geen gezinssessie; dan zet deze toets niets op');

    const vraag = { doel: 'verder leren of werken',
      randvoorwaarden: [{ id: 'vak', wat: 'een diploma als lasser om te kunnen werken', stand: 'ontbreekt' }],
      manieren: [{ id: 'w', wat: 'aan de slag', nodig: ['vak'] }] };

    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const alsLid = await roep(base, '/api/knelpunt', vraag, lid.d.token);
    const alsGezin = await roep(base, '/api/rtf/knelpunt', Object.assign({ code, token }, vraag));

    assert.equal(alsGezin.status, 200, 'de gezinsdeur gaat niet open');
    /* EEN handler achter twee deuren: een gezin mag nooit een ander antwoord
       krijgen dan een lid, want dat zou een stille tweedeling zijn. */
    assert.deepEqual(alsGezin.d.vondsten, alsLid.d.vondsten);
    assert.deepEqual(alsGezin.d.terreinen, alsLid.d.terreinen);

    /* En de deur geeft niets van de sessie door: geen enkel veld uit MENSVELDEN
       komt in een vondst terecht. */
    for (const v of (alsGezin.d.vondsten || []))
      for (const m of MENSVELDEN)
        assert.ok(!Object.prototype.hasOwnProperty.call(v, m), 'een vondst draagt ' + m);
  } finally { await stop(child); }
});

test('22. zonder gezinsprofiel gaat de deur niet open', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfknel-dicht-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const vraag = { doel: 'verder leren of werken',
      randvoorwaarden: [{ id: 'vak', wat: 'werk', stand: 'ontbreekt' }],
      manieren: [{ id: 'w', wat: 'aan de slag', nodig: ['vak'] }] };
    const kaal = await roep(base, '/api/rtf/knelpunt', vraag);
    assert.equal(kaal.status, 403, 'de gezinsdeur staat open zonder profiel');
    /* Een verzonnen code en token komen er evenmin langs: het PROFIEL achter
       het token beslist, niet de code in het verzoek. */
    const vals = await roep(base, '/api/rtf/knelpunt',
      Object.assign({ code: 'ZZZZZZ', token: 'nep' }, vraag));
    assert.equal(vals.status, 403);
  } finally { await stop(child); }
});

test('23. de grant staat in het register, op EEN functie en met beide deuren', () => {
  /* Zonder het tweede pad valt de Foundation-ingang onder `rtf-contacten`
     (paden /api/rtf), en dan schakelt het bord de ene helft van deze functie
     wel uit en de andere niet -- precies de `social`-fout die
     DOELGROEPBEREIK.json aanwijst. */
  const { FUNCTIES } = require('../server/functies/register');
  const { functieVoorPad } = require('../server/functies/toegangpad');
  const f = FUNCTIES.find((x) => x.id === 'knelpunt');
  assert.ok(f.doelgroepen.includes('foundation'), 'de grant is uit het register verdwenen');
  assert.deepEqual(f.paden, ['/api/knelpunt', '/api/rtf/knelpunt']);
  for (const pad of f.paden)
    assert.equal((functieVoorPad(pad) || {}).id, 'knelpunt',
      pad + ' valt onder een andere functie; dan is de schakelaar gesplitst');
  /* En de grant blijft SMAL: er is geen tweede functie die de foundation op de
     hele knelpuntlaag zet. */
  const breed = FUNCTIES.filter((x) => (x.paden || []).some((p) => p === '/api/knelpunt') && x.id !== 'knelpunt');
  assert.deepEqual(breed, [], 'een tweede functie claimt /api/knelpunt');
});

/* ---------------------------------------------------------------------------
   DE DERDE BRON -- want twee punten liggen altijd op een lijn.

   Werk en leerstof waren met opzet elkaars tegenpool, en het contract paste op
   allebei. Dat bewijst dat het op TWEE vormen past, niet dat het past.
   Kinderopvang deelt met geen van beide zijn vorm: wel een aanbieder (anders dan
   leerstof), geen eis aan de mens (anders dan een vacature), en schaarste als
   een GEMETEN bezetting in plaats van een aantal rijen.
   ------------------------------------------------------------------------- */

test('24. de derde bron vult als eerste het etiket `beschikbaarheid`', async () => {
  /* HET ETIKET DAT NOOIT BEPROEFD WAS. `beschikbaarheid` staat sinds dag een in
     ETIKETTEN en blijft `null` tenzij een bron hem noemt -- en geen van de eerste
     twee bronnen kon hem noemen. Een etiket dat nooit gevuld werd, is een etiket
     waarvan niemand weet of het werkt.

     DE MUTATIE: haal `beschikbaarheid` uit de vondst in aanvoer-opvang.js -> deze
     toets zakt, en toets 12 (die op `null` staat voor werk) blijft groen. Dat
     verschil is het punt: het veld is optioneel en toch beproefd. */
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bron3-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  try {
    const lid = await roep(base, '/api/login', { tier: 'rtg' });
    const r = await roep(base, '/api/knelpunt', {
      doel: 'weer aan het werk',
      randvoorwaarden: [{ id: 'opvang', wat: 'opvang voor mijn kind', stand: 'ontbreekt' }],
      manieren: [{ id: 'werken', wat: 'gaan werken', nodig: ['opvang'] }]
    }, lid.d.token);
    assert.equal(r.status, 200);
    const plekken = (r.d.vondsten || []).filter((v) => v.terrein === 'opvang');
    assert.ok(plekken.length > 0, 'de opvangbron levert niets; is hij bedraad?');
    for (const v of plekken) {
      assert.equal(v.herkomst, 'opvang');
      assert.ok(typeof v.beschikbaarheid === 'string' && /\d+ van \d+/.test(v.beschikbaarheid),
        'de beschikbaarheid is geen geteld getal maar "' + v.beschikbaarheid + '"');
      /* De zin die de ouderlaag in zijn eigen antwoord zet, reist mee: een
         vondst komt verder dan de route die hem maakte. */
      assert.match(v.dektNiet, /niet dat u hem heeft/);
      assert.match(v.dektNiet, /kinderopvangtoeslag bestaat in deze code niet/);
    }
    assert.deepEqual(r.d.vondstenGeweigerd, [], 'de derde bron werd geweigerd door de keuring');
  } finally { await stop(child); }
});

test('25. de derde bron krijgt geen mens, en kan dat structureel niet', () => {
  /* De ouderlaag geeft het aanbod EN wat er op de eigen codenaam openstaat.
     `opvangwijzerOverzicht(codenaam)` neemt dus een mens aan -- en juist daarom
     staat hier een toets: de bron roept hem ZONDER argument aan en pakt alleen
     `.opvangen`. Wie er ooit een codenaam in schrijft, laat deze zakken.

     Dit is dezelfde grens als de handtekening `vondsten(voorwaarde)`, maar een
     laag dieper: daar kan een mens er niet IN, hier mag hij er niet UIT gehaald
     worden. */
  const tekst = fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt', 'aanvoer-opvang.js'), 'utf8');
  const code = tekst.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /codenaam|\.mijn\b|sess/i,
    'de opvangbron raakt een mens aan; de aanvoerlaag mag er structureel geen kennen');
  assert.match(code, /overzicht\(\)/, 'overzicht() wordt niet zonder argument aangeroepen');
});
