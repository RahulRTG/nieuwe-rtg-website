/* RTG Horeca: DE BAR -- welke drankgolf moet nu gemaakt worden?

   Een bar is geen keuken met andere gerechten. Een keuken groepeert op GANG; een
   bar groepeert op twee assen die met elkaar vechten: een ronde moet samen
   landen (de tafel proost samen), en dezelfde drank over meerdere tafels is EEN
   handeling achter de bar. Deze toets legt vast dat allebei die kanten zichtbaar
   zijn en dat er geen derde, verzonnen ordening tussen staat.

   1. EEN GOLF IS DE DRANK VAN EEN TAFEL, en eten hoort er niet in. Een bar die
      soep op zijn bord ziet, gaat het bord niet lezen.
   2. DE STAPEL TELT DEZELFDE DRANK OVER TAFELS HEEN, en telt alleen wat nog
      gemaakt moet worden -- een glas dat al staat, maak je niet nog eens.
   3. DE OUDSTE RONDE STAAT BOVENAAN. Niet tafel 1 en niet de grootste ronde:
      het enige waar op deze lijst tijd doorheen loopt is wachten.
   4. "STAAT" IS EEN FEIT EN GEEN OORDEEL: hoeveel minuten het eerste glas al
      wacht op de rest van zijn ronde. Er staat nergens een grens, want die is
      nergens vastgelegd (HORECA.md, grens 7).
   5. WAT DE ZAAL NIET HEEFT VRIJGEGEVEN, ZIET DE BAR NIET. Zelfde regel als de
      keuken: de zaal bepaalt het tempo.

   Draai: node --experimental-sqlite --test test/horeca-bar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bar-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api(pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een tafel met regels. `vrij` bepaalt of de zaal de gang doorstuurt. */
async function tafel(naam, regels, vrij) {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  const ids = [];
  for (const x of regels) {
    const reg = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: x.naam, prijs: x.prijs || 8,
      aantal: x.aantal || 1, gang: x.gang == null ? 1 : x.gang, station: x.station })).body.regel;
    ids.push(reg.id);
  }
  if (vrij !== false) await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.id, gang: regels[0].gang == null ? 1 : regels[0].gang });
  return { id: r.id, regels: ids };
}
const bord = async () => (await H('/api/supplier/horeca/bar', {})).body;
const golfVan = (b, t) => b.golven.find(g => g.tafel === t);

test('1. een golf is de drank van een tafel; eten hoort er niet in', async () => {
  await tafel('B1', [
    { naam: 'Gin-tonic', station: 'bar' },
    { naam: 'Espresso', station: 'koffie' },
    { naam: 'Gazpacho', station: 'koud' }
  ]);
  const g = golfVan(await bord(), 'B1');
  assert.ok(g, 'de tafel staat op het barbord');
  assert.deepEqual(g.regels.map(r => r.naam).sort(), ['Espresso', 'Gin-tonic'],
    'alleen bar en koffie; het gerecht blijft bij de keuken');
  assert.equal(g.totaal, 2);
  assert.equal(g.compleet, false);
});

test('2. de stapel telt dezelfde drank over tafels heen', async () => {
  await tafel('B2', [{ naam: 'Gin-tonic', station: 'bar', aantal: 2 }]);
  const b = await bord();
  const gt = b.stapel.find(x => x.naam.toLowerCase() === 'gin-tonic');
  assert.ok(gt, 'de stapel kent gin-tonic');
  assert.equal(gt.aantal, 3, '1 van B1 plus 2 van B2');
  assert.deepEqual(gt.tafels.sort(), ['B1', 'B2'], 'met de tafels erbij');
  assert.equal(gt.regelIds.length, 2, 'en de regels waar ze op staan');
});

test('3. wat al klaar staat, telt niet meer mee in de stapel', async () => {
  const t = await tafel('B3', [{ naam: 'Negroni', station: 'bar' }]);
  let b = await bord();
  assert.ok(b.stapel.find(x => x.naam === 'Negroni'), 'eerst staat hij te maken');

  await H('/api/supplier/horeca/keuken/stand', { rekeningId: t.id, regelId: t.regels[0], stand: 'klaar' });
  b = await bord();
  assert.equal(b.stapel.find(x => x.naam === 'Negroni'), undefined,
    'een glas dat al staat, maak je niet nog eens');
  const g = golfVan(b, 'B3');
  assert.ok(g, 'de golf staat er nog wel, want hij is niet uitgeserveerd');
  assert.equal(g.compleet, true);
});

test('4. "staat" telt hoe lang het eerste glas op de rest wacht', async () => {
  const t = await tafel('B4', [
    { naam: 'Aperol', station: 'bar' },
    { naam: 'Cappuccino', station: 'koffie' }
  ]);
  let g = golfVan(await bord(), 'B4');
  assert.equal(g.staat, 0, 'zolang er niets klaar is, staat er niets te wachten');

  await H('/api/supplier/horeca/keuken/stand', { rekeningId: t.id, regelId: t.regels[0], stand: 'klaar' });
  g = golfVan(await bord(), 'B4');
  assert.equal(g.klaar, 1);
  assert.equal(g.compleet, false);
  assert.equal(typeof g.staat, 'number', 'nu staat er een glas te wachten en dat is een getal');

  /* Een complete ronde wacht niet meer op zichzelf maar op een drager, en die
     staat op de pas. Anders zou hetzelfde wachten twee keer geteld worden. */
  await H('/api/supplier/horeca/keuken/stand', { rekeningId: t.id, regelId: t.regels[1], stand: 'klaar' });
  g = golfVan(await bord(), 'B4');
  assert.equal(g.staat, 0, 'een complete ronde wacht op de pas en niet op zichzelf');
});

test('5. wat de zaal niet vrijgaf, ziet de bar niet', async () => {
  await tafel('B5', [{ naam: 'Whisky sour', station: 'bar' }], false);
  const b = await bord();
  assert.equal(golfVan(b, 'B5'), undefined, 'niet vrijgegeven is niet zichtbaar');
  assert.equal(b.stapel.find(x => x.naam === 'Whisky sour'), undefined, 'ook niet in de stapel');
});

test('5b. "glazen te maken" telt glazen en geen regels', async () => {
  /* Een regel "2x gin-tonic" is EEN regel en TWEE glazen. Een getal dat iets
     anders telt dan zijn label zegt, is precies de fout die grens 7 verbiedt --
     en deze telling zat er eerst naast. */
  const voor = (await bord()).open;
  await tafel('B6', [{ naam: 'Sherry', station: 'bar', aantal: 3 }]);
  const na = (await bord()).open;
  assert.equal(na - voor, 3, 'drie glazen erbij, niet een regel');
});

test('6. er staat geen grens en geen score op het barbord', async () => {
  const b = await bord();
  const tekst = JSON.stringify(b);
  for (const woord of ['score', 'prioriteit', 'urgentie', 'grens', 'ranglijst', 'punten']) {
    assert.ok(!new RegExp('"[a-z]*' + woord, 'i').test(tekst), 'geen veld met "' + woord + '"');
  }
  for (const g of b.golven) {
    for (const [sleutel, waarde] of Object.entries(g)) {
      if (typeof waarde !== 'number') continue;
      assert.ok(['gang', 'sinds', 'klaar', 'totaal', 'staat'].includes(sleutel),
        'onverwacht getal "' + sleutel + '" op een golf: ' + waarde);
    }
  }
});

/* De volgorde is niet via de server te toetsen zonder de tijd vooruit te
   zetten: alle tafels hierboven zijn binnen dezelfde minuut geopend. Dus wordt
   de rekensom hier rechtstreeks gevoed, met ronden van verschillende leeftijd. */
test('7. de oudste ronde staat bovenaan, niet de grootste en niet tafel 1', () => {
  const MINUUT = 60000;
  const geleden = (m) => new Date(Date.now() - m * MINUUT).toISOString();
  const horeca = { nu: () => new Date().toISOString(), regelSom: (r) => (r.prijs || 0) * (r.aantal || 1) };
  const schoon = (t, n) => String(t == null ? '' : t).slice(0, n || 80);
  const bar = require('../server/kern/horeca/bar')({ horeca, schoon });

  const ronde = (id, tafel, hoeveel, minGeleden) => ({
    id, tafel, kanaal: 'tafel', status: 'open', deelnemers: [],
    regels: Array.from({ length: hoeveel }, (_, i) => ({
      id: id + '-' + i, naam: 'Drank ' + i, aantal: 1, gang: 1, station: 'bar',
      vrijAt: geleden(minGeleden), stand: 'besteld'
    }))
  });

  const g = bar.golven({ instel: {}, rekeningen: {
    A: ronde('A', 'Tafel 1', 6, 2),    // de grootste ronde, en tafel 1
    B: ronde('B', 'Tafel 9', 1, 14),   // de oudste, en de kleinste
    C: ronde('C', 'Tafel 4', 3, 7)
  } });
  assert.deepEqual(g.map((x) => x.tafel), ['Tafel 9', 'Tafel 4', 'Tafel 1'],
    'op wachttijd en niet op grootte of tafelnummer');
  assert.deepEqual(g.map((x) => x.sinds), [14, 7, 2], 'met het getal erbij, na te tellen');

  /* En de andere kant van punt 4, die met verse data niet te zien is: een ronde
     die AL EEN TIJD compleet is, wacht niet meer op zichzelf. Zou "staat" hier
     toch een getal geven, dan wordt hetzelfde wachten twee keer geteld -- een
     keer op het barbord en een keer op de pas. */
  const oud = (id, tafel, minGeleden, klaarMinGeleden, hoeveelKlaar) => ({
    id, tafel, kanaal: 'tafel', status: 'open', deelnemers: [],
    regels: Array.from({ length: 2 }, (_, i) => ({
      id: id + '-' + i, naam: 'Drank ' + i, aantal: 1, gang: 1, station: 'bar',
      vrijAt: geleden(minGeleden),
      stand: i < hoeveelKlaar ? 'klaar' : 'besteld',
      klaarAt: i < hoeveelKlaar ? geleden(klaarMinGeleden) : null
    }))
  });
  const [half, heel] = bar.golven({ instel: {}, rekeningen: {
    D: oud('D', 'Tafel 2', 20, 9, 1),   // half: een glas staat 9 minuten te wachten
    E: oud('E', 'Tafel 3', 12, 9, 2)    // compleet: wacht op een drager, niet op zichzelf
  } });
  assert.equal(half.tafel, 'Tafel 2');
  assert.equal(half.staat, 9, 'het eerste glas staat negen minuten op de rest te wachten');
  assert.equal(heel.tafel, 'Tafel 3');
  assert.equal(heel.compleet, true);
  assert.equal(heel.staat, 0, 'een complete ronde wacht op de pas en niet op zichzelf');
});
