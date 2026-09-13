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
    assert.equal(r.d.vondsten.length, 1, 'de geplaatste vacature komt er niet uit -- de bron is niet bedraad');
    const v = r.d.vondsten[0];
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
    assert.deepEqual(r.d.vondsten, []);
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
    assert.doesNotMatch(codeVan(tekst), /vacature|leerpad|beroep|openVacatures|beroepenbieb/i,
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
