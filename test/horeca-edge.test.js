/* RTG Horeca: VENUE EDGE -- de bestelling die zonder lijn is opgenomen.

   De kassa had zijn offline-rij al; de zaal en de PDA niet, en daar zat een
   echte reden onder: een kassabon is EEN verzoek, een rekening leeft over
   tientallen aanroepen. Opnieuw versturen lost daar niets op.

   De uitweg is niet alles offline maken maar KIEZEN. Van alles wat een
   bediening doet is het OPNEMEN het enige waarbij een netwerkstoring de
   bestelling werkelijk kwijtmaakt; een gang vrijgeven zonder keuken is zinloos,
   en een verzoek komt niet binnen als de telefoon van de gast ook offline is.

   Wat hier vastligt aan de serverkant:

   1. EEN OPGENOMEN BESTELLING KOMT BINNEN ALS "BESTELD", niet als
      "uitgegeven". De keuken moet hem nog maken. Zou hij als geserveerd
      binnenkomen, dan staat er een bord "geserveerd" dat niemand heeft gemaakt.
   2. DE ALLERGIE, DE GANG, HET STATION EN DE STOEL REIZEN MEE. Zonder die
      velden is dit een offline-vangnet dat een gast in gevaar brengt.
   3. ER WORDT NIETS VRIJGEGEVEN. De zaal beslist zelf wanneer de keuken eraan
      begint -- tussen het opnemen en het terugkeren van de lijn kan er van
      alles veranderd zijn.
   4. EEN OPGENOMEN BESTELLING IS NOOIT BETAALD. Een verkochte bardoos mag zijn
      betaling meebrengen; een bestelling waar de gast nog op wacht niet.
   5. DEZELFDE clientId IS DEZELFDE BESTELLING. Twee keer versturen geeft een
      rekening, en de tweede keer wordt GETELD -- stil overslaan zou betekenen
      dat een toestel denkt te hebben opgenomen wat er niet staat.
   6. DE OUDE SOORT VERANDERT NIET. Een verkochte bardoos gedraagt zich precies
      zoals hij zich altijd gedroeg.

   Draai: node --experimental-sqlite --test test/horeca-edge.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-edge-'));
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

const rekVanTafel = async (tafel) => {
  const lijst = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen || [];
  const kort = lijst.find(x => x.tafel === tafel);
  return kort ? (await H('/api/supplier/horeca/rekening', { rekeningId: kort.id })).body.rekening : null;
};

const OPGENOMEN = {
  clientId: 'edge-1', soort: 'opgenomen', kanaal: 'tafel', tafel: 'EDGE-1', gasten: 3,
  regels: [
    { naam: 'Tournedos', centen: 3450, aantal: 2, gang: 2, station: 'grill', allergie: 'noten', stoel: 'bij het raam' },
    { naam: 'Gazpacho', centen: 1600, aantal: 1, gang: 1, station: 'koud' }
  ]
};

test('1. een opgenomen bestelling komt binnen als "besteld"', async () => {
  const r = await H('/api/supplier/horeca/offline/sync', { bonnen: [OPGENOMEN] });
  assert.equal(r.status, 200);
  assert.equal(r.body.nieuw, 1);

  const rek = await rekVanTafel('EDGE-1');
  assert.ok(rek, 'de rekening staat er');
  assert.equal(rek.gasten, 3, 'met het aantal gasten');
  assert.equal(rek.regels.length, 2);
  for (const regel of rek.regels) {
    assert.equal(regel.stand, 'besteld', regel.naam + ' moet nog gemaakt worden');
  }
});

test('2. allergie, gang, station en stoel reizen mee', async () => {
  const rek = await rekVanTafel('EDGE-1');
  const t = rek.regels.find(x => x.naam === 'Tournedos');
  assert.equal(t.allergie, 'noten', 'de allergie is het veld dat hier het meest toe doet');
  assert.equal(t.gang, 2);
  assert.equal(t.station, 'grill');
  assert.equal(t.stoel, 'bij het raam');
  assert.equal(t.aantal, 2);
  assert.equal(t.centen, 3450);
});

test('3. er wordt niets vrijgegeven: de keuken ziet hem nog niet', async () => {
  const rek = await rekVanTafel('EDGE-1');
  for (const regel of rek.regels) assert.ok(!regel.vrijAt, regel.naam + ' is niet vrijgegeven');

  const bord = (await H('/api/supplier/horeca/keuken/bord', {})).body.bonnen || [];
  assert.equal(bord.find(x => x.tafel === 'EDGE-1'), undefined,
    'de keuken ziet hem pas als de zaal hem doorstuurt');

  // en de zaal kan hem gewoon doorsturen als zij dat wil
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: rek.id, gang: 1 });
  const na = (await H('/api/supplier/horeca/keuken/bord', {})).body.bonnen || [];
  assert.ok(na.find(x => x.tafel === 'EDGE-1'), 'na de tik van de zaal wel');
});

test('4. een opgenomen bestelling is nooit betaald', async () => {
  await H('/api/supplier/horeca/offline/sync', { bonnen: [Object.assign({}, OPGENOMEN,
    { clientId: 'edge-2', tafel: 'EDGE-2', betaald: true, wijze: 'contant' })] });
  const rek = await rekVanTafel('EDGE-2');
  assert.ok(rek, 'hij staat er');
  assert.equal(rek.status, 'open', 'en hij staat open');
  assert.equal(rek.betalingen.length, 0, 'een gast die nog moet eten, heeft nog niet betaald');
});

test('5. dezelfde clientId is dezelfde bestelling, en dat wordt geteld', async () => {
  const voor = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen.length;
  const r = await H('/api/supplier/horeca/offline/sync', { bonnen: [OPGENOMEN] });
  assert.equal(r.body.nieuw, 0, 'geen tweede rekening');
  assert.equal(r.body.dubbel, 1, 'en de herhaling wordt geteld, niet stil overgeslagen');
  const na = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen.length;
  assert.equal(na, voor, 'er kwam niets bij');
});

test('6. een verkochte bardoos gedraagt zich precies zoals altijd', async () => {
  await H('/api/supplier/horeca/offline/sync', { bonnen: [{ clientId: 'edge-bar', kanaal: 'bar', tafel: 'EDGE-BAR',
    betaald: true, wijze: 'contant',
    regels: [{ naam: 'Gin-tonic', centen: 1200, aantal: 2, gang: 3, station: 'bar', allergie: 'kinine' }] }] });
  const rek = await rekVanTafel('EDGE-BAR') || (await H('/api/supplier/horeca/rekeningen', { status: 'betaald' })).body.rekeningen
    .find(x => x.tafel === 'EDGE-BAR');
  const vol = (await H('/api/supplier/horeca/rekening', { rekeningId: rek.id })).body.rekening;
  assert.equal(vol.status, 'betaald', 'aan de bar is al betaald');
  assert.equal(vol.regels[0].stand, 'uitgegeven', 'en er valt niets meer te maken');
  assert.equal(vol.regels[0].gang, 0, 'gang, station en allergie horen niet op een bon die niemand meer leest');
  assert.equal(vol.regels[0].station, null);
  assert.equal(vol.regels[0].allergie, null);
});
