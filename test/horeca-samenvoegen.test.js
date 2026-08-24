/* RTG Horeca: SAMENVOEGEN -- wat een toestel zonder lijn deed, en wat daarvan
   nog waar is.

   De kassa en de PDA sturen een PAKKET opnieuw: een bon, een opgenomen
   bestelling. Dat werkt omdat zo'n pakket iets NIEUWS is -- het bestond nog
   niet, dus het kan niet botsen. De zaal en de bar doen iets anders: daar wordt
   niet opgenomen maar BEWERKT. En dan is blind afspelen gevaarlijk, want tussen
   het moment van de handeling en het moment van aankomen kan een collega
   hetzelfde bord al verder hebben gezet.

   Wat hier vastligt:

   1. EEN STAND GAAT NOOIT ACHTERUIT. De enige regel die dit veilig maakt. Een
      bord dat is uitgeserveerd kan niet weer "klaar" worden.
   2. EEN GEWEIGERDE SAMENVOEGING KOMT MET DE REDEN TERUG. Stil laten vallen zou
      betekenen dat een medewerker denkt iets te hebben gedaan wat nooit is
      gebeurd -- precies de fout waarvoor een offline-laag bestaat.
   3. VOORUIT MAG WEL, en dat is het normale geval: het glas dat de bar zonder
      lijn op klaar zette, komt gewoon aan.
   4. DEZELFDE HANDELING TELT EEN KEER, en de tweede keer krijgt de uitkomst van
      de eerste terug -- niet opnieuw uitgevoerd.
   5. WAT NIET SAMENVOEGBAAR IS, GAAT NIET OFFLINE. Geld en een regel van de
      rekening halen worden geweigerd, met de reden.
   6. VRIJGEVEN IS IDEMPOTENT: wat al vrij is blijft vrij, en dat heet
      "al-gedaan" en geen fout.

   Draai: node --experimental-sqlite --test test/horeca-samenvoegen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samen-'));
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

async function tafel(naam, vrij) {
  const r = (await H('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: 2 })).body.rekening;
  const regel = (await H('/rekening/regel', { rekeningId: r.id, naam: 'Gin-tonic', prijs: 12,
    aantal: 1, gang: 1, station: 'bar' })).body.regel;
  if (vrij !== false) await H('/gang/vrij', { rekeningId: r.id, gang: 1 });
  return { id: r.id, regelId: regel.id };
}
const standVan = async (t) => ((await H('/rekening', { rekeningId: t.id })).body.rekening.regels[0] || {}).stand;
const voeg = (handelingen) => H('/offline/handelingen', { handelingen });

test('1. vooruit mag: het glas dat de bar zonder lijn op klaar zette, komt aan', async () => {
  const t = await tafel('SV-1');
  const r = await voeg([{ clientId: 'sv-1', soort: 'stand', rekeningId: t.id, regelId: t.regelId,
    naar: 'klaar', offlineVanaf: new Date(Date.now() - 8 * 60000).toISOString() }]);
  assert.equal(r.status, 200);
  assert.equal(r.body.gedaan, 1);
  assert.equal(r.body.uitkomsten[0].was, 'besteld');
  assert.equal(await standVan(t), 'klaar');
});

test('2. achteruit mag nooit, en het toestel hoort waarom', async () => {
  const t = await tafel('SV-2');
  // een collega is sneller: het bord is al de deur uit
  await H('/keuken/stand', { rekeningId: t.id, regelId: t.regelId, stand: 'uitgegeven' });

  const r = await voeg([{ clientId: 'sv-2', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'klaar' }]);
  assert.equal(r.body.geweigerd, 1);
  const u = r.body.uitkomsten[0];
  assert.equal(u.stand, 'geweigerd');
  assert.equal(u.was, 'uitgegeven', 'met wat er nu staat');
  assert.match(u.reden, /nooit achteruit/, 'en waarom: ' + u.reden);
  assert.equal(await standVan(t), 'uitgegeven', 'en er is niets teruggezet');
});

test('3. dezelfde handeling telt een keer, en geeft de eerste uitkomst terug', async () => {
  const t = await tafel('SV-3');
  const eerst = await voeg([{ clientId: 'sv-3', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'gestart' }]);
  assert.equal(eerst.body.gedaan, 1);

  // intussen zet een collega hem verder
  await H('/keuken/stand', { rekeningId: t.id, regelId: t.regelId, stand: 'klaar' });

  const weer = await voeg([{ clientId: 'sv-3', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'gestart' }]);
  assert.equal(weer.body.uitkomsten[0].herhaald, true, 'hij herkent de herhaling');
  assert.equal(weer.body.uitkomsten[0].stand, 'gedaan', 'en geeft de uitkomst van de eerste keer terug');
  assert.equal(await standVan(t), 'klaar', 'zonder iets terug te zetten');
});

test('4. dezelfde stand nog eens is "al-gedaan" en geen fout', async () => {
  const t = await tafel('SV-4');
  await voeg([{ clientId: 'sv-4a', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'klaar' }]);
  const weer = await voeg([{ clientId: 'sv-4b', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'klaar' }]);
  assert.equal(weer.body.alGedaan, 1);
  assert.equal(weer.body.geweigerd, 0, 'dit is geen fout: het staat er al zo op');
});

test('5. vrijgeven voegt samen en is idempotent', async () => {
  const t = await tafel('SV-5', false);
  const eerst = await voeg([{ clientId: 'sv-5a', soort: 'gangvrij', rekeningId: t.id, gang: 1 }]);
  assert.equal(eerst.body.gedaan, 1);
  assert.equal(eerst.body.uitkomsten[0].vrijgegeven, 1);

  const weer = await voeg([{ clientId: 'sv-5b', soort: 'gangvrij', rekeningId: t.id, gang: 1 }]);
  assert.equal(weer.body.alGedaan, 1, 'wat al vrij is blijft vrij');
  assert.equal(weer.body.geweigerd, 0);
});

test('6. wat niet samenvoegbaar is, gaat niet offline', async () => {
  const t = await tafel('SV-6');
  const voor = (await H('/rekening', { rekeningId: t.id })).body.rekening;

  const r = await voeg([
    { clientId: 'sv-6a', soort: 'korting', rekeningId: t.id, centen: 500, reden: 'sorry' },
    { clientId: 'sv-6b', soort: 'betaal', rekeningId: t.id, wijze: 'pin' },
    { clientId: 'sv-6c', soort: 'regelweg', rekeningId: t.id, regelId: t.regelId }
  ]);
  assert.equal(r.body.geweigerd, 3, 'geld en verwijderen gaan niet offline');
  for (const u of r.body.uitkomsten) assert.match(u.reden, /kan niet offline/, u.reden);

  const na = (await H('/rekening', { rekeningId: t.id })).body.rekening;
  assert.equal(na.totalen.korting, voor.totalen.korting, 'er is geen korting geboekt');
  assert.equal(na.betalingen.length, 0, 'geen cent verplaatst');
  assert.equal(na.regels.length, voor.regels.length, 'en geen regel weggehaald');
});

test('7. een regel die de zaal niet vrijgaf, is geen keukenwerk', async () => {
  const t = await tafel('SV-7', false);
  const r = await voeg([{ clientId: 'sv-7', soort: 'stand', rekeningId: t.id, regelId: t.regelId, naar: 'klaar' }]);
  assert.equal(r.body.geweigerd, 1);
  assert.match(r.body.uitkomsten[0].reden, /niet vrijgegeven/, r.body.uitkomsten[0].reden);
  assert.equal(await standVan(t), 'besteld', 'en de stand is niet aangeraakt');
});
