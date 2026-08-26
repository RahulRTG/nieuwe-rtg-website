/* DE TREASURY VAN EEN ZAAK -- geld dat binnenkomt is niet hetzelfde als geld
   dat van u is.

   WAAROM DEZE TOETS ER IS

   De klassieke manier waarop een horecazaak omvalt, is niet dat er te weinig
   binnenkwam maar dat er te veel uitging omdat het saldo eruitzag als winst. Er
   zat btw in die nog afgedragen moest worden en er kwam een loonrun aan. Een
   btw-reservering die de volgende uitbetaling gewoon meeneemt, lost dat niet op
   -- die maakt het erger, want nu denkt de ondernemer dat het geregeld is.

   Deze toets gaat dus over één vraag: heeft het apart zetten TANDEN?

   WAT HIER WORDT NAGETROKKEN

   1. ELKE ONTVANGST ZET METEEN APART, niet een keer per dag. Een dagelijkse
      taak is een taak die kan uitvallen.
   2. UITBETALEN NEEMT HET APART GEZETTE GELD NIET MEE. Dit is de hele toets;
      zonder deze regel is de rest decoratie.
   3. VRIJGEVEN MAAKT HET WEER UITBETAALBAAR -- de btw is afgedragen.
   4. MEER APART ZETTEN DAN ER STAAT KAN NIET. Dat is een boekhoudleugen.
   5. HET GROOTBOEK BEWEEGT NIET. Een oormerk is een voornemen, geen boeking.
   6. HET BORD LIEGT NIET over wat vrij is.

   Draai los: node --experimental-sqlite --test test/treasury.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-tres-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const stand = () => api('supplier/pay/treasury', {}, sup.token).then(r => r.body);
const int = async (centen, idem) => {
  const c = (await api('pay/kascode', { maxCenten: 200000 }, lid.token)).body.code;
  return api('supplier/pay/in', { code: c, centen, idem }, sup.token);
};
const sluit = async () => (await (await fetch(base + '/api/pay/gezond')).json()).klopt;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code };
  await api('pay/oplaad', { centen: 200000, idem: 't-start' }, lid.token);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder beleid verandert er niets', async () => {
  const s = await stand();
  assert.equal(s.beleid.btwPct, 0);
  assert.equal(s.apartGezet, 0);
  assert.equal(s.beschikbaar, s.saldo, 'alles is beschikbaar zolang er niets apart staat');
});

test('elke ontvangst zet meteen apart, niet een keer per dag', async () => {
  const zet = await api('supplier/pay/treasury/zet', { btwPct: 21, payrollPct: 10 }, sup.token);
  assert.equal(zet.status, 200, 'de zaak stelt 21% btw en 10% loonreserve in');

  const voor = await stand();
  const r = await int(10000, 'i1');
  assert.equal(r.status, 200, 'honderd euro binnen');
  const kosten = r.body.kosten;
  const netto = 10000 - kosten;
  assert.equal(r.body.apartGezet, Math.round(netto * 0.21) + Math.round(netto * 0.10),
    'btw en loon zijn meteen bij de ontvangst apart gezet');

  const na = await stand();
  assert.equal(na.saldo, voor.saldo + netto, 'het saldo is gewoon gegroeid');
  assert.equal(na.apartGezet, r.body.apartGezet);
  assert.equal(na.beschikbaar, na.saldo - na.apartGezet, 'maar beschikbaar is minder');
  assert.equal(na.oormerken.length, 2, 'twee oormerken: btw en loon');
  assert.equal(await sluit(), true, 'een oormerk is een voornemen; het grootboek beweegt niet');
});

test('uitbetalen neemt het apart gezette geld NIET mee -- dit is de hele toets', async () => {
  const voor = await stand();
  assert.ok(voor.apartGezet > 0, 'er staat iets apart');

  const uit = await api('supplier/pay/uitbetaal', { idem: 'u1' }, sup.token);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.uitbetaald, voor.beschikbaar, 'precies het beschikbare deel ging eruit');

  const na = await stand();
  assert.equal(na.saldo, voor.apartGezet, 'wat overblijft is exact wat apart stond');
  assert.equal(na.beschikbaar, 0, 'en daar is niets van beschikbaar');
  assert.equal(await sluit(), true);
});

test('nog een keer uitbetalen levert niets op zolang alles apart staat', async () => {
  const r = await api('supplier/pay/uitbetaal', { idem: 'u2' }, sup.token);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /beschikbaars/, 'en het zegt dat het om het BESCHIKBARE deel gaat');
});

test('vrijgeven maakt het weer uitbetaalbaar -- de btw is afgedragen', async () => {
  const voor = await stand();
  const btw = voor.oormerken.find(o => o.doel === 'btw');
  assert.ok(btw, 'de btw-reservering staat er');

  const vrij = await api('supplier/pay/treasury/vrij', { id: btw.id }, sup.token);
  assert.equal(vrij.status, 200);
  assert.equal(vrij.body.vrijgegeven, btw.centen);

  const na = await stand();
  assert.equal(na.beschikbaar, btw.centen, 'wat vrijkwam is nu uitbetaalbaar');
  assert.equal(na.oormerken.length, 1, 'de loonreserve staat er nog');
});

test('meer apart zetten dan er staat kan niet', async () => {
  const s = await stand();
  const teveel = await api('supplier/pay/treasury/apart',
    { naam: 'Onmogelijk', centen: s.saldo + 100000 }, sup.token);
  assert.equal(teveel.status, 409, 'apart zetten wat er niet is, is een boekhoudleugen');
  assert.equal((await stand()).apartGezet, s.apartGezet, 'en er is niets veranderd');
});

test('het bord liegt niet over de eigen bodem', async () => {
  await api('supplier/pay/treasury/zet', { bufferCenten: 100000 }, sup.token);
  const s = await stand();
  assert.equal(s.onderBuffer, true, 'de zaak zit onder zijn eigen bodem');
  assert.equal(s.vrijeLiquiditeit, 0, 'en vrije liquiditeit toont geen min-bedrag');
  assert.ok(s.uitleg.includes('schatting'), 'het bord zegt dat de percentages een schatting zijn');
});

test('onzinnige percentages worden geweigerd', async () => {
  assert.equal((await api('supplier/pay/treasury/zet', { btwPct: 80, payrollPct: 30 }, sup.token)).status, 400);
  assert.equal((await api('supplier/pay/treasury/zet', { btwPct: -5 }, sup.token)).status, 400);
});
