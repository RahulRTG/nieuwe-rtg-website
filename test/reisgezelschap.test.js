/* HET REISGEZELSCHAP -- de tabel uit kern/reisgezelschap.js, als toets.

   WAAROM DIT BESTAAD ER. De poort van die module is het enige dat tussen de
   boekingsgegevens van een reiziger en het scherm van zijn schoonmoeder staat.
   Een tabel in een kop is een belofte; deze toets is de handhaving. Hij zakt
   zodra iemand een veld aan de witte lijst toevoegt zonder erbij na te denken,
   en -- belangrijker -- zodra iemand de poort omdraait naar een zwarte lijst.

   DE SCHERPSTE TOETS IS DE LAATSTE: er komt een NIEUW veld op een reisonderdeel
   (een adres, een stoel, een prijs), en de vraag is of dat vanzelf meelekt.
   Met een witte lijst is het antwoord nee. Dat is precies de fout die een
   zwarte lijst een keer maakt, en het is de reden dat de poort staat zoals hij
   staat. Draai de lijst om en deze toets valt om.

   Er is geen server nodig: de module krijgt zijn db en zijn reizen mee. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const REIS = {
  id: 'R-ibiza-2026-09-02',
  bestemming: 'Ibiza',
  venster: { van: '2026-09-02', tot: '2026-09-06' },
  personen: 2,
  sig: 'gezond',
  telling: { onderdelen: 2, aandacht: 0, wachtend: 0, onbekend: 0 },
  grond: '2 onderdelen met dezelfde bestemming.',
  apps: ['Invoerbalie'], herkomsten: ['handmatig'],
  onderdelen: [
    { soort: 'vlucht', titel: 'KL 1697', bestemming: 'Ibiza', van: '2026-09-02', tot: null,
      kenmerk: 'XR7T2K', herkomst: 'handmatig', sig: 'gezond', prijs: 412.50, stoel: '12A' },
    { soort: 'verblijf', titel: 'Villa', bestemming: 'Ibiza', van: '2026-09-02', tot: '2026-09-06',
      kenmerk: 'HTL-99812', herkomst: 'partner', sig: 'gezond', adres: 'Carrer de la Mar 4' }
  ]
};

function maak() {
  const db = { data: {} };
  const save = () => {};
  const mod = require('../server/kern/reisgezelschap').maakReisgezelschap({
    db, save, crypto,
    mijnReizen: (key) => ({ reizen: key === 'user-1' ? [REIS] : [] }),
    codenaamVan: (key) => ({ 'user-1': 'Zilverreiger', 'user-2': 'Nachtvlinder', 'user-3': 'Steenmarter' })[key] || key,
    /* De ledengids van het huis, in het klein: een codenaam terug naar een
       sleutel. Een lid kent de sleutel van een ander niet, dus die vertaling
       hoort erbij -- ook in de toets. */
    keyVanCodenaam: async (c) => ({ Zilverreiger: { key: 'user-1', codename: 'Zilverreiger' },
      Nachtvlinder: { key: 'user-2', codename: 'Nachtvlinder' },
      Steenmarter: { key: 'user-3', codename: 'Steenmarter' } })[String(c)] || null
  });
  return mod.reisgezelschap;
}

/* Alles wat een uitgifte bevat, plat als tekst -- zo vindt de toets een
   boekingsnummer ook als het drie lagen diep in een nieuw veld zit. */
const alsTekst = (x) => JSON.stringify(x);

test('een meekijker ziet de bestemming en de periode, en geen draaiboek', () => {
  const g = maak();
  const uit = g.zicht(REIS, 'meekijker');
  assert.equal(uit.bestemming, 'Ibiza');
  assert.deepEqual(uit.venster, { van: '2026-09-02', tot: '2026-09-06' });
  assert.deepEqual(uit.onderdelen, [], 'een meekijker krijgt geen draaiboek');
  assert.ok(uit.nietZichtbaar.includes('draaiboek'), 'en hij hoort te lezen dat er iets is dat hij niet ziet');
});

test('geen enkel boekingskenmerk, adres of bedrag bereikt een meekijker of een reisgenoot', () => {
  const g = maak();
  for (const rol of ['meekijker', 'reisgenoot']) {
    const tekst = alsTekst(g.zicht(REIS, rol));
    assert.ok(!tekst.includes('XR7T2K'), rol + ' ziet het vluchtkenmerk niet');
    assert.ok(!tekst.includes('HTL-99812'), rol + ' ziet het verblijfkenmerk niet');
    assert.ok(!tekst.includes('412.5'), rol + ' ziet de prijs niet');
    assert.ok(!tekst.includes('Carrer'), rol + ' ziet het adres niet');
  }
  assert.ok(alsTekst(g.zicht(REIS, 'eigenaar')).includes('XR7T2K'), 'de reiziger zelf ziet zijn eigen boeking wel');
});

test('een reisgenoot ziet het draaiboek: soort, naam en datum, en verder niets', () => {
  const g = maak();
  const uit = g.zicht(REIS, 'reisgenoot');
  assert.equal(uit.onderdelen.length, 2);
  /* `tot` staat erbij en is null: een vlucht is een dag. Dat is een gegeven
     en geen leeg veld -- de poort laat het staan zoals het domein het geeft. */
  assert.deepEqual(Object.keys(uit.onderdelen[0]).sort(),
    ['bestemming', 'sig', 'soort', 'titel', 'van', 'tot'].sort());
});

/* DE SCHERPSTE. Een nieuw veld op een onderdeel mag nergens vanzelf opduiken.
   Dit is de toets die omvalt zodra de poort een zwarte lijst wordt. */
test('een nieuw veld op een reisonderdeel lekt niet vanzelf naar het gezelschap', () => {
  const g = maak();
  const metNieuw = JSON.parse(JSON.stringify(REIS));
  metNieuw.onderdelen[0].paspoortnummer = 'NL-XYZ-0099';
  metNieuw.betaalwijze = 'rekening eindigend op 4417';
  for (const rol of ['meekijker', 'reisgenoot']) {
    const tekst = alsTekst(g.zicht(metNieuw, rol));
    assert.ok(!tekst.includes('NL-XYZ-0099'), rol + ' krijgt een nieuw onderdeelveld niet te zien');
    assert.ok(!tekst.includes('4417'), rol + ' krijgt een nieuw reisveld niet te zien');
  }
});

test('een uitnodiging doet niets tot de ander hem zelf aanvaardt', async () => {
  const g = maak();
  const uit = await g.nodigUit('user-1', REIS.id, 'Nachtvlinder', 'meekijker');
  assert.equal(uit.status, 200);
  assert.equal(uit.lid.stand, 'gevraagd');
  assert.equal(g.rolVan(REIS.id, 'user-1', 'user-2'), null, 'gevraagd is nog geen toegang');
  assert.equal(g.reisVoor('user-2', REIS.id).status, 404, 'en de reis bestaat voor hem nog niet');

  assert.equal(g.antwoord('user-3', uit.lid.id, true).status, 404, 'een derde kan niet voor hem aanvaarden');
  assert.equal(g.antwoord('user-2', uit.lid.id, true).status, 200);
  assert.equal(g.rolVan(REIS.id, 'user-1', 'user-2'), 'meekijker');
  assert.equal(g.reisVoor('user-2', REIS.id).status, 200);
});

test('wie eruit gaat, ziet ook niet meer wat er eerder stond', async () => {
  const g = maak();
  const uit = await g.nodigUit('user-1', REIS.id, 'Nachtvlinder', 'reisgenoot');
  g.antwoord('user-2', uit.lid.id, true);
  assert.equal(g.schrijf('user-1', REIS.id, 'Aangekomen.').status, 200);
  assert.equal(g.tijdlijn('user-2', REIS.id).posts.length, 1, 'hij leest de tijdlijn zolang hij erbij hoort');

  assert.equal(g.verwijder('user-1', uit.lid.id).status, 200);
  assert.equal(g.tijdlijn('user-2', REIS.id).status, 404, 'daarna niets meer -- ook niet het oude bericht');
  assert.equal(g.reisVoor('user-2', REIS.id).status, 404);
  assert.equal(g.schrijf('user-2', REIS.id, 'Nog een bericht').status, 403);
});

test('wie niet is uitgenodigd, bestaat de reis niet voor', async () => {
  const g = maak();
  assert.equal(g.reisVoor('user-3', REIS.id).status, 404);
  assert.equal(g.tijdlijn('user-3', REIS.id).status, 404);
  assert.equal(g.gezelschap('user-3', REIS.id).status, 404);
  assert.equal((await g.nodigUit('user-3', REIS.id, 'Nachtvlinder', 'meekijker')).status, 404,
    'en hij kan er niemand voor uitnodigen');
});

/* LIFE.md par. 4: er komt geen stip die meeloopt. Dat hoort niet alleen niet
   getoond te worden -- het veld hoort niet te bestaan, want een veld dat er is
   wordt op een dag gevuld. */
test('de module kent geen live locatie, ook niet als veld', () => {
  const bron = require('node:fs').readFileSync(require.resolve('../server/kern/reisgezelschap.js'), 'utf8');
  const code = bron.split('\n').filter(r => !/^\s*(\*|\/\*|\/\/)/.test(r)).join('\n');
  for (const woord of ['latitude', 'longitude', 'coord', 'gps', 'positie']) {
    assert.ok(!new RegExp(woord, 'i').test(code), 'geen ' + woord + ' in de code van het gezelschap');
  }
});

test('er komt geen cijfer op het leven tussen mensen', async () => {
  const g = maak();
  const uit = await g.nodigUit('user-1', REIS.id, 'Nachtvlinder', 'meekijker');
  g.antwoord('user-2', uit.lid.id, true);
  g.schrijf('user-1', REIS.id, 'Aangekomen.');
  const post = g.tijdlijn('user-1', REIS.id).posts[0];
  for (const veld of ['likes', 'score', 'punten', 'reacties', 'gezien', 'kijkers']) {
    assert.equal(post[veld], undefined, 'een bericht draagt geen ' + veld);
  }
});
