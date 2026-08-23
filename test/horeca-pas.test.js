/* RTG Horeca: DE PAS -- wie pakt een gereed staande gang op, en wie draagt hem.

   Het patroon bestond al voor gastverzoeken ("ik ga" en "gedaan" zijn twee
   knoppen), maar niet voor het eten bij de pas. Daar lopen twee mensen naar
   tafel 8, of geen.

   Wat hier bewezen wordt:

   1. ALLEEN EEN COMPLETE GANG STAAT OP DE PAS, en oppakken van een halve gang
      wordt geweigerd MET wat er nog mist. Een half bord dragen is precies wat
      gangregie hoort te voorkomen.
   2. EEN CLAIM IS VAN ÉÉN MENS. De tweede krijgt te horen wie hem heeft en hoe
      lang al -- de claim wordt niet stilzwijgend afgepakt.
   3. CLAIMEN VINKT NIETS AF. Na het oppakken staan de regels nog gewoon op
      "klaar"; pas een mens geeft uit.
   4. OVERNEMEN IS EEN EIGEN HANDELING met beide namen erin.
   5. LOSLATEN KAN ALLEEN WAT VAN JOU IS -- of door een manager.
   6. DE HELE GANG IN ÉÉN TIK UITGEVEN, en dan is de claim weg en staat de gang
      van de lijst af.
   7. DE STOEL REIST MEE: op de paslijst staat per bord waar het heen moet.

   Draai: node --experimental-sqlite --test test/horeca-pas.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tokA, tokB, naamA, naamB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pas-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
// twee collega's aan dezelfde zaak: A is manager, B is dat niet
const A = (pad, body) => api('/api/supplier/horeca' + pad, body, tokA);
const B = (pad, body) => api('/api/supplier/horeca' + pad, body, tokB);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const ander = roster.staff.find(x => x.id !== mgr.id);
  assert.ok(ander, 'de demozaak heeft meer dan één medewerker');
  naamA = mgr.name; naamB = ander.name;
  tokA = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    // manager is 1234, vloerpersoneel 5678 (server/kern/staffseed.js)
  tokB = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: ander.id, pin: '5678' })).body.token;
  assert.ok(tokA && tokB, 'beide collega\'s zijn ingelogd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een tafel met een vrijgegeven gang. `klaar` zegt hoeveel borden er klaar
   gemeld worden; de rest blijft in de keuken staan. */
async function gang(tafel, gerechten, klaar) {
  const r = (await A('/rekening/open', { kanaal: 'tafel', tafel, gasten: gerechten.length })).body.rekening;
  const ids = [];
  for (const g of gerechten) {
    const regel = (await A('/rekening/regel', { rekeningId: r.id, naam: g.naam, prijs: 20, aantal: 1,
      gang: 1, station: g.station || 'warm', allergie: g.allergie || '' })).body.regel;
    ids.push(regel.id);
    if (g.stoel) {
      await A('/gezelschap/stoel', { rekeningId: r.id, handle: g.stoel });
      const beeld = (await A('/gezelschap', { rekeningId: r.id })).body.gezelschap;
      const s = beeld.stoelen.find(x => x.handle === g.stoel);
      await A('/rekening/regel/stoel', { rekeningId: r.id, regelId: regel.id, nr: s.nr });
    }
  }
  await A('/gang/vrij', { rekeningId: r.id, gang: 1 });
  for (const id of ids.slice(0, klaar == null ? ids.length : klaar))
    await A('/keuken/stand', { rekeningId: r.id, regelId: id, stand: 'klaar' });
  return { id: r.id, regels: ids };
}

const paslijst = async (t) => (await (t === 'B' ? B : A)('/pas/gereed', {})).body;
const opDePas = async (tafel, t) => (await paslijst(t)).gereed.find(x => x.tafel === tafel);

test('alleen een complete gang staat op de pas', async () => {
  await gang('P1', [{ naam: 'Soep' }, { naam: 'Brood' }], 1);   // één van de twee klaar
  const half = await opDePas('P1');
  assert.equal(half, undefined, 'een halve gang is geen draagtaak');

  await gang('P2', [{ naam: 'Soep' }, { naam: 'Brood' }]);       // beide klaar
  const heel = await opDePas('P2');
  assert.ok(heel, 'een complete gang staat er wel');
  assert.equal(heel.borden, 2);
  assert.equal(heel.claim, null, 'en is nog van niemand');
});

test('een halve gang oppakken wordt geweigerd, met wat er nog mist', async () => {
  const g = await gang('P3', [{ naam: 'Tartaar' }, { naam: 'Zeebaars' }], 1);
  const mis = await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  assert.equal(mis.status, 409);
  assert.equal(mis.body.code, 'niet-compleet');
  assert.match(mis.body.error, /1 van de 2/);
  assert.match(mis.body.error, /Zeebaars/, 'en het noemt wat er nog staat');
});

test('een claim is van één mens, en de tweede hoort wie hem heeft', async () => {
  const g = await gang('P4', [{ naam: 'Oesters' }]);
  const eerst = await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  assert.equal(eerst.status, 200);
  assert.equal(eerst.body.claim.naam, naamA);

  const tweede = await B('/pas/pak', { rekeningId: g.id, gang: 1 });
  assert.equal(tweede.status, 409);
  assert.equal(tweede.body.code, 'al-geclaimd');
  assert.match(tweede.body.error, new RegExp(naamA), 'het zegt WIE hem heeft: ' + tweede.body.error);
  assert.match(tweede.body.error, /minuten geleden/);

  // en nog eens oppakken door dezelfde persoon is geen fout
  const nogeens = await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  assert.equal(nogeens.status, 200);
  assert.equal(nogeens.body.al, true);
});

test('claimen vinkt niets af: de borden staan nog op klaar', async () => {
  const g = await gang('P5', [{ naam: 'Ribeye' }]);
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  const rek = (await A('/rekening', { rekeningId: g.id })).body.rekening;
  assert.equal(rek.regels[0].stand, 'klaar', 'oppakken is geen uitgeven');
  assert.ok(!rek.regels[0].uitAt, 'en er staat geen uitgiftetijd op');
  const rij = await opDePas('P5');
  assert.ok(rij, 'de gang staat nog op de pas');
  assert.equal(rij.claim.naam, naamA);
});

test('van mij staat er als markering bij, niet als filter', async () => {
  const g = await gang('P6', [{ naam: 'Kaas' }]);
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  const bijA = (await paslijst()).gereed.find(x => x.tafel === 'P6');
  const bijB = (await paslijst('B')).gereed.find(x => x.tafel === 'P6');
  assert.equal(bijA.vanMij, true);
  assert.equal(bijB.vanMij, false);
  assert.ok(bijB, 'B ziet hem nog steeds staan -- anders loopt hij er alsnog heen');
});

test('overnemen is een eigen handeling, met beide namen erin', async () => {
  const g = await gang('P7', [{ naam: 'Tarte' }]);
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  const over = await B('/pas/overneem', { rekeningId: g.id, gang: 1 });
  assert.equal(over.status, 200);
  assert.equal(over.body.van, naamA);
  assert.equal(over.body.claim.naam, naamB);
  assert.equal(over.body.claim.overgenomenVan, naamA);

  const rij = await opDePas('P7');
  assert.equal(rij.claim.naam, naamB);
  assert.equal(rij.claim.overgenomenVan, naamA, 'de vorige naam blijft zichtbaar');

  // een gang die niemand heeft, hoef je niet over te nemen
  const g2 = await gang('P8', [{ naam: 'Koffie' }]);
  const mis = await B('/pas/overneem', { rekeningId: g2.id, gang: 1 });
  assert.equal(mis.status, 404);
  assert.match(mis.body.error, /gewoon oppakken/);
});

test('loslaten kan alleen wat van jou is; een manager mag deblokkeren', async () => {
  const g = await gang('P9', [{ naam: 'Bier' }]);

  // A (manager) pakt op; B (geen manager) mag hem NIET loslaten
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  const vreemd = await B('/pas/los', { rekeningId: g.id, gang: 1 });
  assert.equal(vreemd.status, 403, 'een collega klikt niet zomaar andermans claim weg');
  assert.match(vreemd.body.error, new RegExp(naamA), 'en hoort wie hem heeft');
  assert.match(vreemd.body.error, /Neem hem over/, 'met de weg vooruit erbij');
  assert.equal((await opDePas('P9')).claim.naam, naamA, 'de claim staat er nog');

  // wie hem zelf heeft, mag hem zelf loslaten
  const zelf = await A('/pas/los', { rekeningId: g.id, gang: 1 });
  assert.equal(zelf.status, 200);
  assert.equal(zelf.body.losgelaten, naamA);

  // en een manager mag een tafel deblokkeren die een ander heeft opgepakt
  await B('/pas/pak', { rekeningId: g.id, gang: 1 });
  const doorManager = await A('/pas/los', { rekeningId: g.id, gang: 1 });
  assert.equal(doorManager.status, 200, 'de manager kan een tafel deblokkeren');
  assert.equal(doorManager.body.losgelaten, naamB);
  assert.equal((await opDePas('P9')).claim, null);
});

test('de hele gang in één tik uitgeven; daarna is hij van de lijst af', async () => {
  const g = await gang('P10', [{ naam: 'Entrecote' }, { naam: 'Zeebaars' }, { naam: 'Risotto' }]);
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  const uit = await A('/pas/uit', { rekeningId: g.id, gang: 1 });
  assert.equal(uit.status, 200);
  assert.equal(uit.body.uitgegeven, 3, 'drie borden in één handeling');

  const rek = (await A('/rekening', { rekeningId: g.id })).body.rekening;
  for (const r of rek.regels) {
    assert.equal(r.stand, 'uitgegeven');
    assert.ok(r.uitAt, 'met een uitgiftetijd erop');
    assert.equal(r.uitDoor, naamA, 'en wie het deed');
  }
  assert.equal(await opDePas('P10'), undefined, 'de gang staat niet meer op de pas');
  assert.ok(!rek.pas || !rek.pas['1'], 'en de claim is opgeruimd');
});

test('een gang die nog niet compleet is, kan ook niet uitgegeven worden', async () => {
  const g = await gang('P11', [{ naam: 'Soep' }, { naam: 'Brood' }], 1);
  const mis = await A('/pas/uit', { rekeningId: g.id, gang: 1 });
  assert.equal(mis.status, 409);
  assert.match(mis.body.error, /Brood/, 'en het zegt wat er nog staat');
});

test('de claim verdwijnt ook als de laatste bon los wordt uitgegeven', async () => {
  const g = await gang('P12', [{ naam: 'Espresso' }]);
  await A('/pas/pak', { rekeningId: g.id, gang: 1 });
  // niet via /pas/uit maar via de losse standwissel van het keukenscherm
  await A('/keuken/stand', { rekeningId: g.id, regelId: g.regels[0], stand: 'uitgegeven' });
  const rek = (await A('/rekening', { rekeningId: g.id })).body.rekening;
  assert.ok(!rek.pas || !rek.pas['1'], 'een claim op een lege gang blijft niet staan');
});

test('op de paslijst staat per bord waar het heen moet', async () => {
  const g = await gang('P13', [
    { naam: 'Entrecote', station: 'grill', stoel: 'Bij het raam' },
    { naam: 'Risotto', station: 'warm', allergie: 'noten' }
  ]);
  const rij = await opDePas('P13');
  assert.ok(rij, 'de gang staat op de pas');
  const entrecote = rij.regels.find(r => r.naam === 'Entrecote');
  assert.equal(entrecote.stoel, 'Bij het raam', 'de runner leest een naam, geen nummer');
  assert.deepEqual(rij.allergieen, ['noten']);
  assert.deepEqual(rij.stations.sort(), ['grill', 'warm']);
  assert.equal(typeof rij.gereedSinds, 'number', 'en hoe lang hij al staat');
});
