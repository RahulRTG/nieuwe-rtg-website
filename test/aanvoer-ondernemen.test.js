/* HET ZESDE TERREIN -- ondernemen, en vooral: wat er NIET is.

   server/kern/knelpunt/aanvoer-ondernemen.js sluit kern/onderneming/ aan op de
   knelpuntmotor. Wie "ik wil een eigen bedrijf beginnen" intikt kreeg tot 11
   oktober 2026 werk-, opleiding- en opvangwegen en geen enkele ondernemersweg.

   DE SCHERPSTE TOETS IS 3. Dat er ondernemersvondsten komen is de helft; de
   andere helft is dat financiering en samenwerking, die op 11 oktober zijn
   nagezocht en NIET bestaan, er ook niet als vondst uit rollen -- en wel
   hardop in de `dektNiet` van het terrein staan. Een kaart die een bron
   verzint om een vraag compleet te laten lijken, is precies de opening die
   dit huis niet kan waarmaken.

   Draai los: node --test test/aanvoer-ondernemen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakOndernemenbron } = require('../server/kern/knelpunt/aanvoer-ondernemen');
const { maakAanvoer } = require('../server/kern/knelpunt/aanvoer-bronnen');
const { MENSVELDEN } = require('../server/kern/knelpunt/aanvoer');
const { KAART, TERREINEN, WOORDEN } = require('../server/kern/knelpunt/openingen-kaart');
const { terreinenVan } = require('../server/kern/knelpunt/openingen');
const { zonderCommentaar } = require('../scripts/lib/bron');
const { startServer, stop } = require('./helper');

const WORTEL = path.join(__dirname, '..');
const RV = { id: 'rv', wat: 'een rechtsvorm kiezen voor mijn eigen bedrijf', stand: 'ontbreekt' };

test('1. ondernemen staat op de kaart, met een bron, een ingang en wat het niet dekt', () => {
  assert.ok(TERREINEN.includes('ondernemen'));
  const k = KAART.ondernemen;
  assert.equal(k.stand, 'bron');
  assert.equal(k.ingang, '/api/onderneming/rechtsvormen',
    'de ingang hoort de OPEN voorlichting te zijn; het plan zit achter een account');
  for (const w of WOORDEN.ondernemen) assert.ok(terreinenVan({ wat: w }).includes('ondernemen'), w);
  /* `zaak` hoort er NIET in: een werkzoekende die "een zaak die mij aanneemt"
     schrijft, bedoelt een werkgever en geen eigen bedrijf. */
  assert.ok(!terreinenVan({ wat: 'een zaak die mij aanneemt' }).includes('ondernemen'));
});

test('2. de bron levert alleen op zijn eigen terrein, en elke vondst doorstaat de keuring', () => {
  const a = maakAanvoer({ ondernemen: maakOndernemenbron() });
  const op = a.vondsten(RV);
  assert.equal(op.vondsten.length, 2);
  assert.deepEqual(op.geweigerd, [], 'de keuring weigerde een ondernemersvondst');
  assert.deepEqual(op.geleverd, [{ herkomst: 'ondernemen', getoond: 2, gevonden: 2 }],
    'zonder `gevonden` leest de lijst als "niet nagegaan"');
  for (const v of op.vondsten) {
    assert.equal(v.terrein, 'ondernemen');
    assert.equal(v.beschikbaarheid, null, 'een beschikbaarheid die geen bron noemt, is verzonnen');
    for (const m of MENSVELDEN) assert.ok(!(m in v), 'een vondst draagt ' + m);
  }
  /* Een knelpunt dat niet over ondernemen gaat, krijgt hier niets -- anders
     staan er rechtsvormen onder een vraag over kinderopvang. */
  const naast = a.vondsten({ id: 'opvang', wat: 'opvang voor de kinderen' });
  assert.deepEqual(naast.vondsten, []);
});

test('3. wat er niet is, komt er niet uit -- en staat er wel bij', () => {
  const vondsten = maakOndernemenbron()(RV).vondsten;
  for (const v of vondsten) {
    /* Geen vondst BELOOFT financiering of een netwerk; noemen mag alleen als
       ontkenning ("geen financiering"). */
    assert.doesNotMatch(v.wat, /financier|lening|krediet|subsidie|investeer|netwerk|ondernemers vinden|samenwerk/i,
      'een vondst belooft iets waar dit huis geen bron voor heeft: ' + v.wat);
  }
  const niet = KAART.ondernemen.dektNiet;
  assert.match(niet, /Financiering .* bestaat in deze code niet/,
    'dat financiering ontbreekt hoort hardop op de kaart, anders vult de lezer het zelf in');
  assert.match(niet, /andere\s+ondernemers/);
  assert.match(niet, /eerste klant/);
  assert.match(niet, /geen advies welke vorm bij u past/);
});

test('4. de bron kiest geen rechtsvorm en kent de mens niet', () => {
  const code = zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'server', 'kern', 'knelpunt',
    'aanvoer-ondernemen.js'), 'utf8'));
  /* Een rechtsvorm wordt OPGEGEVEN en nooit afgeleid (kern/onderneming/rechtsvorm.js). */
  assert.doesNotMatch(code, /rechtsvormVan\(|\.sort\(|codenaam|sess\b|\.key\b/,
    'de ondernemersbron kiest, sorteert of kent een mens');
  assert.match(code, /function ondernemenbron\(voorwaarde\) \{/,
    'de bron heeft een tweede argument gekregen; dan kan er een mens in');
});

test('5. een leeg of onbereikbaar register is een storing en geen lege lijst', () => {
  const a = maakAanvoer({ ondernemen: maakOndernemenbron(() => ({}), () => ['x']) });
  const uit = a.vondsten(RV);
  assert.deepEqual(uit.vondsten, []);
  assert.equal(uit.geweigerd.length, 1, 'een leeg register verdween stil');
  assert.match(uit.geweigerd[0].reden, /bron-brak: .*rechtsvormregister/);
  assert.deepEqual(uit.geenBron, [], '"de bron is stuk" mag niet lezen als "de bron heeft niets"');
});

test('6. de tweede ingang bestaat, en zijn vondst zegt voor wie hij dicht is', () => {
  const routes = fs.readFileSync(path.join(WORTEL, 'server', 'routes', 'member', 'onderneming.js'), 'utf8');
  assert.match(routes, /app\.post\('\/api\/onderneming\/nieuw', auth,/);
  const plan = maakOndernemenbron()(RV).vondsten.find(v => v.ingang === '/api/onderneming/nieuw');
  assert.ok(plan, 'de verkenning en het plan zijn geen vondst meer');
  assert.match(plan.dektNiet, /RTG-account.*gezinsingang.*dicht/,
    'de vondst reist naar /api/rtf/knelpunt; daar is deze deur dicht, en dat hoort erbij te staan');
});

test('7. tegen een echte server: een kaal ondernemersdoel en een ondernemersknelpunt', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ondernemen-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP,
    NODE_ENV: 'test', RTG_DEMO: '1' } });
  const roep = async (pad, lijf, token) => {
    const r = await fetch(base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(lijf || {}) });
    return { status: r.status, d: await r.json().catch(() => ({})) };
  };
  try {
    const lid = await roep('/api/login', { tier: 'rtg' });

    /* Een kaal doel: de ondernemersweg staat ertussen, niets is weggelaten en
       niets doet zich voor als nagegaan. */
    const kaal = await roep('/api/knelpunt', { doel: 'ik wil een eigen bedrijf beginnen' }, lid.d.token);
    assert.equal(kaal.status, 200);
    const ids = (kaal.d.manieren || []).map(m => m.id);
    assert.ok(ids.includes('via-ondernemen'), 'geen ondernemersweg bij een ondernemersdoel: ' + ids.join(', '));
    assert.ok(ids.includes('via-werk'), 'een weg is weggelaten omdat het doel er niet naar klonk');
    assert.ok(kaal.d.manieren.every(m => m.stand !== 'open'), 'een samengestelde weg heet "open"');

    /* Een knelpunt op het terrein: de vondsten komen van de ondernemersbron. */
    const knel = await roep('/api/knelpunt', { doel: 'een eigen bedrijf', randvoorwaarden: [RV],
      manieren: [{ id: 'starten', wat: 'zelf starten', nodig: ['rv'] }] }, lid.d.token);
    assert.equal(knel.status, 200);
    const eigen = (knel.d.vondsten || []).filter(v => v.herkomst === 'ondernemen');
    assert.equal(eigen.length, 2);
    assert.deepEqual(knel.d.vondstenGeweigerd, []);
    assert.ok(!(knel.d.vondstenZonderBron || []).some(z => z.terrein === 'ondernemen'));

    /* De ingang van de kaart gaat open ZONDER account -- daarom is hij gekozen. */
    const open = await fetch(base + '/api/onderneming/rechtsvormen');
    assert.equal(open.status, 200, 'de voorlichting zit achter een deur; dan is hij geen ingang voor een gezin');
  } finally { await stop(child); }
});
