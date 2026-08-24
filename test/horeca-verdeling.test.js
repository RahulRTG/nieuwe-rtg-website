/* RTG Horeca: DE VERDELING -- wie betaalt welk deel van één rekening.

   Deze rekensom stond in kern/gast/ en was daardoor alleen bereikbaar voor wie
   zelf de QR scande. De bediening had één knop: door drieën. Nu staat hij in
   kern/horeca/verdeling.js en gebruiken beide deuren hem.

   Wat hier bewezen wordt:

   1. DE TWEE DEUREN GEVEN HETZELFDE ANTWOORD. Dezelfde rekening, dezelfde
      wijze, exact dezelfde delen -- ongeacht of de gast of de bediening het
      doet. Dat is de hele reden van de verhuizing; zonder deze toets is het
      alleen een bestand dat verplaatst is.
   2. DE SOM IS HEILIG. 10,00 door drie is 3,34 + 3,33 + 3,33, en elke wijze
      telt exact op tot wat er te betalen is.
   3. EEN VERDELING DIE NIET OPTELT WORDT GEWEIGERD, met het getal erbij, en er
      verandert niets.
   4. PER PRODUCT betaalt ieder wat op zijn naam staat; de fles voor de tafel
      gaat gelijk over iedereen, en korting en fooi gaan evenredig mee in plaats
      van bij één iemand te blijven hangen.
   5. HET SPOOR DRAAGT WIE HET DEED. Een verdeling van de bediening staat op
      haar naam en niet als "gast" -- anders is achteraf niet na te gaan wie wat
      heeft afgesproken.
   6. VERDELEN IS GEEN SPLITSEN. Er komt geen tweede rekening bij.

   Draai: node --experimental-sqlite --test test/horeca-verdeling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verdeling-'));
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

/* Een tafel met stoelen en regels. `voor` is het stoelnummer of null (tafel). */
async function tafel(naam, stoelen, regels) {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: stoelen.length })).body.rekening;
  for (const s of stoelen) await H('/api/supplier/horeca/gezelschap/stoel', { rekeningId: r.id, handle: s });
  for (const x of (regels || [])) {
    const regel = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.id, naam: x.naam, prijs: x.prijs,
      aantal: x.aantal || 1, gang: 1, station: 'koud' })).body.regel;
    if (x.voor) await H('/api/supplier/horeca/rekening/regel/stoel', { rekeningId: r.id, regelId: regel.id, nr: x.voor });
  }
  return (await H('/api/supplier/horeca/rekening', { rekeningId: r.id })).body.rekening;
}

test('gelijk verdelen verliest geen cent: 10,00 door drie is 3,34 + 3,33 + 3,33', async () => {
  const r = await tafel('V1', ['A', 'B', 'C'], [{ naam: 'Deelgerecht', prijs: 10 }]);
  const v = (await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'gelijk' })).body;
  assert.equal(v.verdeling.teBetalen, 1000);
  assert.deepEqual(v.verdeling.delen.map(d => d.centen), [334, 333, 333]);
  assert.equal(v.verdeling.delen.reduce((t, d) => t + d.centen, 0), 1000);
  // en de namen staan erbij, want "nr 3 betaalt 3,33" laat de bediening zoeken
  assert.deepEqual(v.verdeling.delen.map(d => d.handle), ['A', 'B', 'C']);
});

test('per product betaalt ieder wat op zijn naam staat, en de tafel deelt de rest', async () => {
  const r = await tafel('V2', ['Anne', 'Sam'], [
    { naam: 'Entrecote', prijs: 46, voor: 1 },
    { naam: 'Zeebaars', prijs: 38, voor: 2 },
    { naam: 'Fles wijn', prijs: 42 }            // op niemands naam
  ]);
  const v = (await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'product' })).body;
  const bij = (naam) => v.verdeling.delen.find(d => d.handle === naam).centen;
  // 46 + 21 = 67 en 38 + 21 = 59, samen 126
  assert.equal(bij('Anne'), 6700);
  assert.equal(bij('Sam'), 5900);
  assert.equal(v.verdeling.delen.reduce((t, d) => t + d.centen, 0), 12600);
  assert.equal(v.verdeling.teBetalen, 12600);
});

test('korting en fooi gaan evenredig mee, niet bij een van de twee hangen', async () => {
  const r = await tafel('V3', ['Anne', 'Sam'], [
    { naam: 'Duur', prijs: 60, voor: 1 },
    { naam: 'Goedkoop', prijs: 40, voor: 2 }
  ]);
  // korting vraagt altijd een reden; die hoort bij het bedrag te staan
  const k = await H('/api/supplier/horeca/korting', { rekeningId: r.id, procent: 10, reden: 'stamgast' });
  assert.equal(k.status, 200, 'de korting gaat erop: ' + JSON.stringify(k.body).slice(0, 120));
  const v = (await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'product' })).body;
  const bij = (naam) => v.verdeling.delen.find(d => d.handle === naam).centen;
  assert.equal(v.verdeling.teBetalen, 9000, 'de rekening is 90 euro na korting');
  assert.equal(bij('Anne'), 5400, '60% van 90');
  assert.equal(bij('Sam'), 3600, '40% van 90');
  assert.equal(bij('Anne') + bij('Sam'), 9000);
});

test('een verdeling die niet optelt wordt geweigerd, met het getal erbij', async () => {
  const r = await tafel('V4', ['A', 'B'], [{ naam: 'Iets', prijs: 50 }]);
  const mis = await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'persoon',
    delen: [{ nr: 1, centen: 2000 }, { nr: 2, centen: 2000 }] });
  assert.equal(mis.status, 409);
  assert.match(mis.body.error, /40[.,]00/, 'het genoemde bedrag staat erin');
  assert.match(mis.body.error, /50[.,]00/, 'en waar het op had moeten uitkomen');
  assert.match(mis.body.error, /niets gewijzigd/);
  const na = (await H('/api/supplier/horeca/rekening', { rekeningId: r.id })).body.rekening;
  assert.ok(!na.verdeling, 'en er staat inderdaad geen verdeling op');
});

test('percentages moeten op honderd uitkomen', async () => {
  const r = await tafel('V5', ['A', 'B'], [{ naam: 'Iets', prijs: 50 }]);
  const mis = await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'percentage',
    delen: [{ nr: 1, procent: 60 }, { nr: 2, procent: 30 }] });
  assert.equal(mis.status, 400);
  assert.match(mis.body.error, /90%/);

  const goed = (await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'percentage',
    delen: [{ nr: 1, procent: 60 }, { nr: 2, procent: 40 }] })).body;
  assert.deepEqual(goed.verdeling.delen.map(d => d.centen), [3000, 2000]);
});

test('een tafel zonder stoelen krijgt een reden die zegt wat er moet gebeuren', async () => {
  const r = await tafel('V6', [], [{ naam: 'Iets', prijs: 20 }]);
  const mis = await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'gelijk' });
  assert.equal(mis.status, 409);
  assert.match(mis.body.error, /niemand op deze rekening/);
});

test('verdelen is geen splitsen: er komt geen tweede rekening bij', async () => {
  const voor = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen.length;
  const r = await tafel('V7', ['A', 'B'], [{ naam: 'Iets', prijs: 30 }]);
  await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'gelijk' });
  const na = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen;
  assert.equal(na.length, voor + 1, 'alleen de tafel zelf is erbij gekomen');
  assert.ok(na.find(x => x.tafel === 'V7'), 'en die staat er nog gewoon');
});

test('het spoor draagt wie het deed: de bediening is geen "gast"', async () => {
  const r = await tafel('V8', ['A', 'B'], [{ naam: 'Iets', prijs: 30 }]);
  await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: r.id, wijze: 'gelijk' });
  const na = (await H('/api/supplier/horeca/rekening', { rekeningId: r.id })).body.rekening;
  const regel = (na.audit || []).filter(x => x.wat === 'verdeling').pop();
  assert.ok(regel, 'er staat een auditregel voor de verdeling');
  assert.equal(regel.bron, 'zaak');
  assert.notEqual(regel.actor, 'gast', 'niet als gast geboekt');
  assert.ok(regel.actor && regel.actor.length > 1, 'maar met de naam van de medewerker: ' + regel.actor);
  assert.ok(na.verdeling.door, 'en de verdeling zelf draagt hem ook');
});

/* ---- DE KERN VAN DE VERHUIZING ---------------------------------------- */
test('de gastdeur en de zaaldeur geven exact dezelfde verdeling', async () => {
  // een tafel met een QR-gast erbij, zodat beide deuren op dezelfde rekening kijken
  const qr = (await H('/api/supplier/horeca/gast/qr', { tafel: 'V9' })).body;
  const noor = (await api('/api/gast/aanschuiven', { token: qr.token, naam: 'Noor' })).body;
  assert.ok(noor.sleutel, 'de gast schuift aan');
  const open = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen.find(x => x.tafel === 'V9');
  await H('/api/supplier/horeca/gezelschap/stoel', { rekeningId: open.id, handle: 'Kim' });

  const regels = [
    { naam: 'Oesters', prijs: 24, voor: noor.deelnemer ? noor.deelnemer.nr : 1 },
    { naam: 'Tartaar', prijs: 26, voor: 2 },
    { naam: 'Fles wijn', prijs: 42 }
  ];
  for (const x of regels) {
    const regel = (await H('/api/supplier/horeca/rekening/regel', { rekeningId: open.id, naam: x.naam, prijs: x.prijs,
      aantal: 1, gang: 1, station: 'koud' })).body.regel;
    if (x.voor) await H('/api/supplier/horeca/rekening/regel/stoel', { rekeningId: open.id, regelId: regel.id, nr: x.voor });
  }

  for (const wijze of ['gelijk', 'product']) {
    const zaak = (await H('/api/supplier/horeca/rekening/verdeel', { rekeningId: open.id, wijze: wijze })).body;
    const gast = (await api('/api/gast/verdeel', { sleutel: noor.sleutel, wijze: wijze })).body;
    /* De twee deuren geven hun antwoord in een andere VORM -- de gast krijgt
       het plat met "ben ik dit" erbij, de zaak genest met de hele rekening --
       maar de GETALLEN moeten identiek zijn. Alleen daar gaat deze toets over. */
    assert.ok(Array.isArray(gast.delen), 'de gastdeur antwoordt ook: ' + JSON.stringify(gast).slice(0, 140));
    assert.deepEqual(
      gast.delen.map(d => ({ nr: d.nr, centen: d.centen })),
      zaak.verdeling.delen.map(d => ({ nr: d.nr, centen: d.centen })),
      'wijze "' + wijze + '": dezelfde tafel hoort hetzelfde antwoord te geven, door welke deur je ook kijkt');
    assert.equal(gast.teBetalen, zaak.verdeling.teBetalen);
    assert.equal(gast.wijze, zaak.verdeling.wijze);
  }
});
