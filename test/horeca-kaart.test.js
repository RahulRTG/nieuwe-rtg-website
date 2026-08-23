/* RTG Horeca: DE KAART VAN EEN ZAAK -- één opbouw, twee deuren.

   De kaart stond in routes/gast/tafel.js en werd aan de kern gehangen. Zodra de
   bediening op de PDA dezelfde kaart nodig had, bleek hij aan de verkeerde kant
   van de domeingrens te staan. Hij is verhuisd naar kern/horeca/kaart.js -- niet
   omdat de grens in de weg zat, maar omdat de kaart van een zaak geen gastbegrip
   is: het is een eigenschap van de ZAAK, en beide deuren zijn lezers.

   Wat hier vastligt:

   1. DEZELFDE KAART, DEZELFDE PRIJZEN. Als deze toets zakt, wijst de gast op
      zijn scherm terwijl de bediening iets anders ziet.
   2. UITVERKOCHT WORDT GETOOND EN NIET VERBORGEN VOOR DE BEDIENING. De gast kan
      het niet bestellen; de bediening hoort te zien dat iets op is en mag na
      overleg met de keuken alsnog aanslaan. Wegfilteren maakt van "op" een
      geheim.
   3. EEN ITEM VAN DE KAART DRAAGT ZIJN PRIJS NIET UIT DE CLIENT. Wie `itemId`
      stuurt krijgt de kaartprijs, ook als hij er een eigen prijs bij doet.
      Zonder deze regel bepaalt een telefoon wat een biertje kost.
   4. VRIJ TYPEN BLIJFT KUNNEN. Een special of een gang uit een arrangement is
      echt werk en geen misbruik.

   Draai: node --experimental-sqlite --test test/horeca-kaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaart-'));
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

const zaakKaart = async () => {
  const g = (await H('/kaart', {})).body.groepen || [];
  return g.reduce((uit, x) => uit.concat(x.items), []);
};
async function gastKaart(tafel) {
  const qr = (await H('/gast/qr', { tafel })).body;
  return (await api('/api/gast/tafel', { token: qr.token })).body.kaart || [];
}

test('1. de gast en de bediening lezen dezelfde kaart met dezelfde prijzen', async () => {
  const zaak = await zaakKaart();
  const gast = await gastKaart('K1');
  assert.ok(zaak.length, 'de demozaak heeft een kaart');
  assert.deepEqual(zaak.map(x => x.id).sort(), gast.map(x => x.id).sort(), 'dezelfde gerechten');
  for (const item of zaak) {
    const bij = gast.find(x => x.id === item.id);
    assert.equal(item.centen, bij.centen, item.naam + ' kost aan beide kanten hetzelfde');
    assert.equal(item.naam, bij.naam);
  }
});

test('2. uitverkocht staat op de kaart van de bediening en is voor de gast dicht', async () => {
  const eerste = (await zaakKaart())[0];
  await H('/gast/uitverkocht', { itemId: eerste.id, uit: true });

  const zaak = await zaakKaart();
  const bij = zaak.find(x => x.id === eerste.id);
  assert.ok(bij, 'de bediening ziet het gerecht nog steeds');
  assert.equal(bij.uitverkocht, true, 'met de vlag erop');

  const gast = await gastKaart('K2');
  assert.equal(gast.find(x => x.id === eerste.id).uitverkocht, true,
    'en de gast ziet dezelfde vlag');

  // en de bediening mag hem na overleg met de keuken alsnog aanslaan
  const rek = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'K-UIT', gasten: 1 })).body.rekening;
  const r = await H('/rekening/regel', { rekeningId: rek.id, itemId: eerste.id, aantal: 1 });
  assert.equal(r.status, 200, 'de bediening wordt niet tegengehouden: ' + JSON.stringify(r.body).slice(0, 120));

  await H('/gast/uitverkocht', { itemId: eerste.id, uit: false });
});

test('3. de prijs komt van de kaart, ook als de client er een meestuurt', async () => {
  const item = (await zaakKaart())[0];
  const rek = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'K-PRIJS', gasten: 1 })).body.rekening;

  const eigen = await H('/rekening/regel', { rekeningId: rek.id, itemId: item.id, prijs: 0.01, aantal: 1 });
  assert.equal(eigen.body.regel.centen, item.centen, 'een euro-prijs van de client wordt genegeerd');

  const centen = await H('/rekening/regel', { rekeningId: rek.id, itemId: item.id, centen: 1, aantal: 1 });
  assert.equal(centen.body.regel.centen, item.centen, 'en een centenprijs ook');

  assert.equal(centen.body.regel.naam, item.naam, 'de naam komt eveneens van de kaart');
});

test('4. een onbekend item is een fout en geen regel van nul', async () => {
  const rek = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'K-ONB', gasten: 1 })).body.rekening;
  const r = await H('/rekening/regel', { rekeningId: rek.id, itemId: 'bestaat-niet' });
  assert.equal(r.status, 404);
  assert.match(r.body.error, /staat niet op de kaart/);
  const na = (await H('/rekening', { rekeningId: rek.id })).body.rekening;
  assert.equal(na.regels.length, 0, 'en er staat niets op de rekening');
});

test('5. vrij typen blijft kunnen, want een special is echt werk', async () => {
  const rek = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'K-VRIJ', gasten: 1 })).body.rekening;
  const r = await H('/rekening/regel', { rekeningId: rek.id, naam: 'Special van de chef', prijs: 27.5, aantal: 1 });
  assert.equal(r.status, 200);
  assert.equal(r.body.regel.naam, 'Special van de chef');
  assert.equal(r.body.regel.centen, 2750);
});
