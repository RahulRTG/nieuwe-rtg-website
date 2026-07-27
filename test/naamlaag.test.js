/* De persoonlijke naamlaag + het bedrijfsdorp per genre. Getoetst:
   (1) een lid geeft een verbonden vriend een eigen naam en ziet die naam
   in de eigen lijsten, vindt de vriend onder die naam, en Rahul-resolutie
   (naam/wie) wijst de juiste codenaam aan; de privacygrens: de vriend
   zelf en derden zien het etiket NOOIT, en een etiket kan alleen voor een
   echte connectie. (2) elke zaak heeft een dorp: het retail-genre krijgt
   de winkelvloer-indeling, het restaurant houdt zijn eigen dorp.
   Draai los: node --experimental-sqlite --test test/naamlaag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-naam-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
async function lid() {
  const t = Date.now() + '' + (teller++);
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'n' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' }));
  return r.token;
}
const eigenCodenaam = async t => (await json(await raw('/member/connections', {}, t))).codename;

test('1. eigen naam voor een vriend: overal in het eigen account, nergens bij een ander', async () => {
  const a = await lid(), b = await lid();
  const bCode = await eigenCodenaam(b);
  // verbinden: A zoekt B, stuurt een verzoek, B accepteert
  const zoek = await json(await raw('/member/find', { q: bCode }, a));
  const bKey = (zoek.results || []).find(x => x.codename === bCode).key;
  await raw('/member/connect', { key: bKey }, a);
  const verzoeken = (await json(await raw('/member/connections', {}, b))).requests;
  await raw('/member/connect/respond', { key: verzoeken[0].key, action: 'accept' }, b);

  // een etiket voor een vreemde codenaam mag niet
  let r = await raw('/member/naam/zet', { codenaam: 'ONBEKEND-99', naam: 'Iemand' }, a);
  assert.equal(r.status, 403, 'alleen voor verbonden vrienden');

  // A geeft B de eigen naam "Ravi"
  r = await json(await raw('/member/naam/zet', { codenaam: bCode, naam: 'Ravi' }, a));
  assert.equal(r.ok, true);

  // de eigen lijsten dragen het etiket
  const conA = await json(await raw('/member/connections', {}, a));
  const vriend = conA.connections.find(c => c.codename === bCode);
  assert.equal(vriend.eigenNaam, 'Ravi', 'de vriendenlijst toont de eigen naam');
  // zoeken op de eigen naam vindt de vriend
  const vind = await json(await raw('/member/find', { q: 'Ravi' }, a));
  assert.ok((vind.results || []).some(x => x.codename === bCode), 'vindbaar onder de eigen naam');
  // en Rahul-resolutie begrijpt een hele zin
  const wie = await json(await raw('/member/naam/wie', { tekst: 'stuur Ravi vanavond een berichtje' }, a));
  assert.equal(wie.codenaam, bCode, 'de AI-resolutie wijst de juiste codenaam aan');

  // de privacygrens: B ziet het etiket nergens
  const conB = await json(await raw('/member/connections', {}, b));
  assert.ok(conB.connections.every(c => !('eigenNaam' in c)), 'B ziet geen etiket van A');
  const lijstB = await json(await raw('/member/naam/lijst', {}, b));
  assert.deepEqual(lijstB.namen, {}, 'B heeft zelf geen etiketten');
  // en na wissen is het weg
  await raw('/member/naam/zet', { codenaam: bCode, naam: '' }, a);
  const lijstA = await json(await raw('/member/naam/lijst', {}, a));
  assert.deepEqual(lijstA.namen, {}, 'wissen werkt');
});

test('2. elke zaak een dorp: retail krijgt de winkelvloer, het restaurant houdt zijn keuken', async () => {
  async function dorpVan(code) {
    const roster = (await json(await raw('/supplier/roster', { code }))).staff;
    const mgr = roster.find(x => x.role === 'manager');
    const sup = (await json(await raw('/supplier/login', { code, staffId: mgr.id, pin: '1234' }))).token;
    const d = await json(await raw('/supplier/dorp', {}, sup));
    return (d.afdelingen || []).map(a => a.key);
  }
  const maison = await dorpVan('MAISON');
  assert.ok(maison.includes('winkelvloer') && maison.includes('paskamers'), 'het modehuis heeft een winkeldorp');
  assert.ok(maison.includes('kantoor'), 'met de gedeelde bedrijfsstaart');
  const kikunoi = await dorpVan('KIKUNOI');
  assert.ok(kikunoi.includes('keuken') && kikunoi.includes('host'), 'het restaurant houdt het eigen dorp');
  assert.ok(!kikunoi.includes('winkelvloer'), 'en krijgt geen winkelafdelingen');
});
