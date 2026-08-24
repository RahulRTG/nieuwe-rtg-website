/* HET LOKET VAN DE ZAKENKLOK: kan een zaak zijn eigen dag echt instellen?

   server/kern/zakenklok/ rekent uit bij welke periode een moment hoort;
   test/zakenklok.test.js bewaakt die rekenkunde. Deze toets gaat over de andere
   helft van de belofte -- dat een ondernemer die keuze ook kan MAKEN, en dat het
   Z-rapport er daarna anders uitziet. Een instelling die nergens doorwerkt is
   een veld, geen keuze.

   Draai los: node --experimental-sqlite --test test/zakenklok-loket.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopNet } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

const verseDataDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-klok-'));
async function api(base, pad, body, token, methode) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: methode || 'POST', headers: h,
    body: methode === 'GET' ? undefined : JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function manager(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  return (await api(base, '/api/supplier/login', { code, staffId: mgr.id, pin: '1234' })).body.token;
}

test('een zaak leest zijn klok, verzet hem, en zet hem weer terug op het voorstel', async (t) => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  t.after(async () => { await stopNet(child, 10000); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
  const tok = await manager(base, 'KIKUNOI');
  assert.ok(tok, 'een managersessie op de demozaak');

  const eerst = await api(base, '/api/supplier/klok', null, tok, 'GET');
  assert.equal(eerst.status, 200);
  const sleutels = eerst.body.soorten.map(s => s.soort);
  for (const nodig of ['horecadag', 'boekhoudperiode', 'payrollperiode', 'schooldag'])
    assert.ok(sleutels.includes(nodig), 'het loket toont ' + nodig);
  const dag = eerst.body.soorten.find(s => s.soort === 'horecadag');
  assert.equal(dag.eigenKeuze, false, 'een zaak die nooit iets instelde heeft geen eigen keuze');
  assert.ok(dag.keuzes && dag.keuzes.omslag.length,
    'het loket zegt zelf welke waarden er mogen; anders moet een scherm dat raden en staat de ' +
    'waarheid op twee plekken');
  assert.ok(eerst.body.nu.horecadag && eerst.body.nu.horecadag.sleutel,
    'en welke periode er NU loopt -- daar gaat het scherm over');

  const gezet = await api(base, '/api/supplier/klok', { code: 'KIKUNOI', soort: 'horecadag',
    instelling: { omslag: '04:00' } }, tok);
  assert.equal(gezet.status, 200, JSON.stringify(gezet.body));
  assert.equal(gezet.body.keuze.eigenKeuze, true);
  assert.equal(gezet.body.keuze.geldt.omslag, '04:00');

  /* Een LEGE instelling is "terug naar het voorstel van RTG". Zonder die weg zou
     een zaak zijn eigen keuze nooit meer kwijtraken, en dan is een voorstel geen
     voorstel meer. */
  const terug = await api(base, '/api/supplier/klok', { code: 'KIKUNOI', soort: 'horecadag', instelling: {} }, tok);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.keuze.eigenKeuze, false, 'de eigen keuze is weer weg');
  assert.equal(terug.body.keuze.geldt.omslag, terug.body.keuze.standaard.omslag, 'en het voorstel geldt weer');
});

test('een onbruikbare waarde wordt bij het OPSLAAN geweigerd, met de reden erbij', async (t) => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  t.after(async () => { await stopNet(child, 10000); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
  const tok = await manager(base, 'KIKUNOI');

  /* Het verschil met de leeslaag is met opzet. instellingVan() NEGEERT een
     onleesbaar veld -- een bestaande zaak mag niet omvallen over data die er al
     staat. Maar iets NIEUWS opslaan dat niet klopt hoort terug te komen met de
     reden, in plaats van stil te worden weggegooid en later te ontbreken. */
  const fout = await api(base, '/api/supplier/klok', { code: 'KIKUNOI', soort: 'horecadag',
    instelling: { omslag: 'vier uur' } }, tok);
  assert.equal(fout.status, 400);
  assert.deepEqual(fout.body.velden, ['omslag'], 'de melding noemt WELK veld');
  const na = await api(base, '/api/supplier/klok', null, tok, 'GET');
  assert.equal(na.body.soorten.find(s => s.soort === 'horecadag').eigenKeuze, false,
    'en er is niets opgeslagen: een geweigerde invoer laat geen half ingevulde instelling achter');

  const onbekend = await api(base, '/api/supplier/klok', { code: 'KIKUNOI', soort: 'bestaatniet',
    instelling: {} }, tok);
  assert.equal(onbekend.status, 400, 'een periode die niet bestaat wordt niet stilletjes aangemaakt');
});

test('het loket is dicht zonder managersessie', async (t) => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  t.after(async () => { await stopNet(child, 10000); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
  const zonder = await api(base, '/api/supplier/klok', { code: 'KIKUNOI', soort: 'horecadag',
    instelling: { omslag: '04:00' } });
  assert.ok(zonder.status === 401 || zonder.status === 403,
    'het omslaguur bepaalt op welke dag de omzet valt -- dat is geen voorkeur van wie er die avond ' +
    'achter de bar staat (kreeg ' + zonder.status + ')');
});
