/* RTG Horeca: het gezelschap aan een rekening, van de kant van de BEDIENING.

   De data bestond al -- een rekening kent `deelnemers`, een regel kent
   `gastNr`, en kern/gast/verdeling.js splitst er al mee. Alleen kwam je er
   uitsluitend via de gastendeur bij. Wat hier bewezen wordt, is dat de tweede
   deur op DEZELFDE data uitkomt en geen tweede waarheid maakt:

   1. EEN STOEL VAN DE BEDIENING IS GEEN INLOG. Hij krijgt geen sleutel, en
      een gastsessie kan hem dus niet herkennen. Zonder die grens is "voeg een
      stoel toe" een achterdeur naar een vreemde rekening.
   2. EEN STOEL WEGHALEN HAALT GEEN GELD WEG. De regels vallen terug op de
      tafel, worden geteld en gemeld -- ze verdampen niet.
   3. NUMMERS WORDEN NIET HERGEBRUIKT, want een bon bij de pas die "stoel 2"
      zegt mag na een wisseling niet naar iemand anders wijzen.
   4. HET GEZELSCHAPSBEELD TELT OP TOT DE REKENING. Wat op stoelen staat plus
      wat gedeeld is, is exact het bruto bedrag -- anders staat er ergens geld
      dat niemand betaalt.
   5. EEN GAST MET EIGEN TELEFOON KAN DE BEDIENING NIET WEGKLIKKEN.
   6. DE STOEL STAAT OP DE KEUKENBON, met zijn naam en niet als nummer.
   7. DE GASTKANT EN DE ZAALKANT ZIEN ELKAAR. Wie via de QR aanschuift, staat
      op het bedieningsscherm; wat de bediening op zijn naam zet, ziet hij.

   Draai: node --experimental-sqlite --test test/horeca-gezelschap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezelschap-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);

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

// een tafel met een paar regels; geeft de rekening terug
async function tafel(naam, regels) {
  const r = (await H('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  for (const x of (regels || [])) await H('/rekening/regel', Object.assign({ rekeningId: r.id }, x));
  return (await H('/rekening', { rekeningId: r.id })).body.rekening;
}

test('de bediening zet stoelen aan tafel, en die stoel is geen inlog', async () => {
  const r = await tafel('S1');
  const een = (await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Bij het raam' })).body;
  const twee = (await H('/gezelschap/stoel', { rekeningId: r.id })).body;

  assert.equal(een.stoel.nr, 1);
  assert.equal(een.stoel.handle, 'Bij het raam');
  assert.equal(twee.stoel.nr, 2);
  assert.equal(twee.stoel.handle, 'Stoel 2', 'zonder naam krijgt hij zijn nummer');

  // DE GRENS: geen sleutel, dus geen sessie
  assert.equal(een.stoel.eigenSessie, false);
  assert.equal(twee.stoel.eigenSessie, false);
  const beeld = (await H('/gezelschap', { rekeningId: r.id })).body.gezelschap;
  assert.ok(!JSON.stringify(beeld).includes('hash'), 'de sleutelafdruk komt nooit naar buiten');
  assert.equal(beeld.gasten, 2);
});

test('een regel gaat naar een stoel, en het beeld telt op tot de rekening', async () => {
  const r = await tafel('S2', [
    { naam: 'Entrecote', prijs: 46, aantal: 1, gang: 2, station: 'grill' },
    { naam: 'Zeebaars', prijs: 38, aantal: 1, gang: 2, station: 'warm' },
    { naam: 'Fles wijn', prijs: 42, aantal: 1, gang: 0, station: 'bar' }
  ]);
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Anne' });
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Sam' });

  const entrecote = r.regels.find(x => x.naam === 'Entrecote');
  const zeebaars = r.regels.find(x => x.naam === 'Zeebaars');
  const naar1 = (await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: entrecote.id, nr: 1 })).body;
  assert.equal(naar1.naar, 1);
  assert.equal(naar1.handle, 'Anne');
  await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: zeebaars.id, nr: 2 });

  const g = (await H('/gezelschap', { rekeningId: r.id })).body.gezelschap;
  const anne = g.stoelen.find(s => s.nr === 1), sam = g.stoelen.find(s => s.nr === 2);
  assert.equal(anne.centen, 4600);
  assert.equal(sam.centen, 3800);
  assert.equal(g.gedeeld.regels, 1, 'de fles wijn staat op niemands naam');
  assert.equal(g.gedeeld.centen, 4200);

  // punt 4: stoelen plus gedeeld is exact het bruto bedrag van de rekening
  const rek = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  const som = g.stoelen.reduce((t, s) => t + s.centen, 0) + g.gedeeld.centen;
  assert.equal(som, rek.totalen.bruto);
  assert.equal(g.centenTotaal, rek.totalen.bruto);
});

test('een regel kan ook terug naar de tafel', async () => {
  const r = await tafel('S3', [{ naam: 'Koffie', prijs: 4, aantal: 1, gang: 3, station: 'koffie' }]);
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Kim' });
  const koffie = r.regels[0];
  await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: koffie.id, nr: 1 });
  const terug = (await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: koffie.id, nr: 0 })).body;
  assert.equal(terug.naar, null);
  assert.equal(terug.gezelschap.gedeeld.regels, 1);
  assert.equal(terug.gezelschap.stoelen[0].centen, 0);
});

test('een stoel weghalen haalt geen geld weg, en zegt wat er is gebeurd', async () => {
  const r = await tafel('S4', [
    { naam: 'Oesters', prijs: 24, aantal: 2, gang: 1, station: 'koud' },
    { naam: 'Tartaar', prijs: 26, aantal: 1, gang: 1, station: 'koud' }
  ]);
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Robin' });
  for (const x of r.regels) await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: x.id, nr: 1 });

  const voor = (await H('/rekening', { rekeningId: r.id })).body.rekening.totalen.bruto;
  assert.equal(voor, 2 * 2400 + 2600);

  const weg = (await H('/gezelschap/stoel/weg', { rekeningId: r.id, nr: 1 })).body;
  assert.equal(weg.losgemaakt, 2);
  assert.match(weg.let, /staan nu op de tafel/);
  assert.match(weg.let, /Robin/);

  const na = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  assert.equal(na.totalen.bruto, voor, 'het bedrag verandert niet');
  assert.equal(na.regels.length, 2, 'de regels staan er nog');
  assert.equal(weg.gezelschap.gedeeld.regels, 2);
  assert.equal(weg.gezelschap.stoelen.length, 0);

  /* EN DE INVARIANT ZELF, en niet alleen wat je ervan ziet. Het beeld telt een
     regel die naar een verdwenen stoel wijst defensief als "gedeeld", dus het
     ZIET er goed uit ook als de verwijzing blijft staan -- een mutatie die het
     opruimen weghaalde, liet geen enkele toets zakken. Daarom hier de harde
     eigenschap: na afloop wijst geen enkele regel meer naar een stoel die niet
     bestaat. */
  const nummers = new Set((na.deelnemers || []).map(d => d.nr));
  for (const x of na.regels)
    assert.ok(!x.gastNr || nummers.has(x.gastNr),
      'regel "' + x.naam + '" wijst nog naar stoel ' + x.gastNr + ', die niet meer bestaat');
});

test('een nummer wordt nooit hergebruikt', async () => {
  const r = await tafel('S5');
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Een' });
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Twee' });
  await H('/gezelschap/stoel/weg', { rekeningId: r.id, nr: 2 });
  const nieuw = (await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Drie' })).body;
  assert.equal(nieuw.stoel.nr, 3, 'niet opnieuw 2: een bon die "stoel 2" zei wijst dan naar iemand anders');
});

test('een stoel hernoemen kan; een onbekende stoel niet', async () => {
  const r = await tafel('S6');
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Gast 1' });
  const her = (await H('/gezelschap/stoel', { rekeningId: r.id, nr: 1, handle: 'De jarige' })).body;
  assert.equal(her.stoel.handle, 'De jarige');
  assert.equal(her.stoel.nr, 1, 'hernoemen maakt geen nieuwe stoel');

  const mis = await H('/gezelschap/stoel', { rekeningId: r.id, nr: 9, handle: 'Niemand' });
  assert.equal(mis.status, 404);
  assert.match(mis.body.error, /zit niet aan deze rekening/);

  const leeg = await H('/gezelschap/stoel', { rekeningId: r.id, nr: 1, handle: '' });
  assert.equal(leeg.status, 400, 'hernoemen naar niets is geen hernoemen');
});

test('de keukenbon draagt de stoel met zijn naam, niet als nummer', async () => {
  const r = await tafel('S7', [{ naam: 'Ribeye', prijs: 46, aantal: 1, gang: 2, station: 'grill' }]);
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Bij het raam' });
  await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: r.regels[0].id, nr: 1 });
  await H('/gang/vrij', { rekeningId: r.id, gang: 2 });

  const bord = (await H('/keuken/bord', {})).body;
  const bon = bord.bonnen.find(b => b.tafel === 'S7');
  assert.ok(bon, 'de bon staat op het bord');
  assert.equal(bon.gastNr, 1);
  assert.equal(bon.stoel, 'Bij het raam', 'de runner leest een naam, geen nummer');
});

test('wie via de QR aanschuift staat op het bedieningsscherm, en andersom', async () => {
  const qr = (await H('/gast/qr', { tafel: 'S8' })).body;
  assert.ok(qr.token, 'de zaak maakt een tafeltoken');
  const aan = (await api('/api/gast/aanschuiven', { token: qr.token, naam: 'Noor' })).body;
  assert.ok(aan.sleutel, 'de gast krijgt een sleutel');

  // de bediening vindt dezelfde rekening en ziet Noor zitten
  const open = (await H('/rekeningen', { status: 'open' })).body.rekeningen.find(x => x.tafel === 'S8');
  assert.ok(open, 'de gastrekening staat gewoon in de lijst van de zaal');
  const g = (await H('/gezelschap', { rekeningId: open.id })).body.gezelschap;
  const noor = g.stoelen.find(s => s.handle === 'Noor');
  assert.ok(noor, 'Noor zit aan tafel');
  assert.equal(noor.eigenSessie, true, 'hij heeft wel een eigen telefoon');

  // punt 5: die kan de bediening niet zomaar wegklikken
  const weg = await H('/gezelschap/stoel/weg', { rekeningId: open.id, nr: noor.nr });
  assert.equal(weg.status, 409);
  assert.match(weg.body.error, /eigen telefoon/);

  // en wat de bediening op zijn naam zet, telt bij hem
  const r = (await H('/rekening/regel', { rekeningId: open.id, naam: 'Bier', prijs: 6, aantal: 2, gang: 0, station: 'bar' })).body.regel;
  await H('/rekening/regel/stoel', { rekeningId: open.id, regelId: r.id, nr: noor.nr });
  const na = (await H('/gezelschap', { rekeningId: open.id })).body.gezelschap;
  assert.equal(na.stoelen.find(s => s.nr === noor.nr).centen, 1200);
});

test('een regel naar een stoel die niet bestaat, gaat niet door', async () => {
  const r = await tafel('S9', [{ naam: 'Water', prijs: 3, aantal: 1, gang: 0, station: 'bar' }]);
  const mis = await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: r.regels[0].id, nr: 7 });
  assert.equal(mis.status, 404);
  const g = (await H('/gezelschap', { rekeningId: r.id })).body.gezelschap;
  assert.equal(g.gedeeld.regels, 1, 'de regel staat nog gewoon op de tafel');
});

test('een allergie hangt aan de persoon die hem heeft', async () => {
  const r = await tafel('S10', [
    { naam: 'Pasta', prijs: 22, aantal: 1, gang: 2, station: 'warm', allergie: 'noten' },
    { naam: 'Salade', prijs: 16, aantal: 1, gang: 2, station: 'koud' }
  ]);
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Jules' });
  await H('/gezelschap/stoel', { rekeningId: r.id, handle: 'Max' });
  await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: r.regels[0].id, nr: 1 });
  await H('/rekening/regel/stoel', { rekeningId: r.id, regelId: r.regels[1].id, nr: 2 });

  const g = (await H('/gezelschap', { rekeningId: r.id })).body.gezelschap;
  assert.deepEqual(g.stoelen.find(s => s.nr === 1).allergieen, ['noten']);
  assert.deepEqual(g.stoelen.find(s => s.nr === 2).allergieen, [], 'niet de hele tafel krijgt het label');
});
