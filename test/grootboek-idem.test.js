/* EEN RETRY MAG HET GROOTBOEK NIET TWEE KEER RAKEN -- EN TWEE OPDRACHTEN WEL.

   WAAROM DEZE TOETS BESTAAT NAAST retrygedrag.test.js. Die telt de schrijfacties
   van de BETAALLAAG (server/betaal.js) en bewijst daar exact een mutatie. Dat is
   niet hetzelfde als het grootboek, en het verschil was een echte bug:

     de betaling zag een herhaling  (server/sleutelvorm.js canoniseerde al)
     het grootboek zag een nieuw verzoek (server/lib/idem.js kreeg de sleutel rauw)

   Gemeten met een echte server, voor de reparatie: twee keer /api/pay/oplaad met
   idem 'probe-1' en ' probe-1 ' gaf saldo 10000 in plaats van 5000. Vijftig euro
   werd honderd. Een toets op de betaallaag alleen had dat nooit gezien.

   EN DE PLEK VAN DE REPARATIE WAS NIET DE EERSTE DIE IK KOOS. Canoniseren in
   server/lib/idem.js -- waar de vergelijking gebeurt -- werkte niet: de
   client-sleutel staat MIDDEN in de samengestelde sleutel ('oplaad:' + codenaam
   + ':' + idem), dus trimmen van het geheel laat de spatie binnenin staan. Die
   reparatie is gebouwd, gemeten en zien falen. Het moet VOOR het samenstellen,
   en dan is er precies een plek: de body-poort (server/opzet/lijfpoort.js).

   Deze toets gaat daarom via HTTP en niet via de module: hij moet de hele keten
   raken -- body-poort, route, idem-laag, betaalnaad, grootboek -- want juist
   tussen die lagen zat het gat.

   Gemuteerd en zien zakken: de canonisatie uit de body-poort halen (toets 1 en 3
   rood: dubbel geboekt), en er een toLowerCase() bij zetten (toets 2 rood: twee
   legitieme opladingen vallen samen tot een).
   Draai los: node --experimental-sqlite --test test/grootboek-idem.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grootboek-idem-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* EEN LID, EN DAAROM METEN WE VERSCHILLEN.

   /api/login met dezelfde tier geeft steeds HETZELFDE demo-lid terug (Amberen
   Vos). Mijn eerste versie maakte per toets een "nieuw lid" aan en vergeleek
   absolute saldi; die stapelden dus over de vier gevallen heen en drie toetsen
   zakten op een fout die in de TOETS zat en niet in de code. Een delta is hier
   ook inhoudelijk de juiste maat: de vraag is niet wat het saldo IS maar hoeveel
   deze verzoeken eraan hebben toegevoegd. */
async function lidToken() {
  const r = await fetch(base + '/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
  });
  return (await r.json()).token;
}
const saldoVan = async (token) => (await api('pay/overzicht', {}, token)).body.saldo;

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een oplaad-retry met andere witruimte boekt EEN keer', async () => {
  const token = await lidToken();
  const voor = await saldoVan(token);
  const eerste = await api('pay/oplaad', { centen: 5000, idem: 'laad:een' }, token);
  assert.equal(eerste.status, 200);

  const retry = await api('pay/oplaad', { centen: 5000, idem: '  laad:een  ' }, token);
  assert.equal(retry.body.herhaald, true,
    'dezelfde sleutel met witruimte is dezelfde oplading, en hoort als herhaling herkend te worden');
  assert.equal(await saldoVan(token) - voor, 5000,
    'er hoort 5000 bij te komen; 10000 betekent dat het grootboek de retry als tweede oplading heeft geboekt');
});

test('twee opladingen die alleen in hoofdletters verschillen, worden ALLEBEI geboekt', async () => {
  const token = await lidToken();
  const voor = await saldoVan(token);
  await api('pay/oplaad', { centen: 1000, idem: 'laad:aB' }, token);
  const tweede = await api('pay/oplaad', { centen: 1000, idem: 'laad:Ab' }, token);
  assert.ok(!tweede.body.herhaald, 'dit is een andere opdracht, geen herhaling');
  assert.equal(await saldoVan(token) - voor, 2000,
    'allebei horen geboekt te worden; 1000 zou betekenen dat een legitieme oplading stil is verdwenen');
});

test('een derde en vierde poging op dezelfde sleutel voegen niets toe', async () => {
  const token = await lidToken();
  const voor = await saldoVan(token);
  for (const vorm of ['laad:drie', 'laad:drie ', ' laad:drie', '\tlaad:drie\n']) {
    await api('pay/oplaad', { centen: 2500, idem: vorm }, token);
  }
  assert.equal(await saldoVan(token) - voor, 2500,
    'idempotent betekent onbeperkt herhaalbaar; elke extra 2500 is een dubbele boeking');
});

test('een idem-sleutel die geen sleutel is, wordt geweigerd in plaats van genegeerd', async () => {
  const token = await lidToken();
  const voor = await saldoVan(token);
  const r = await api('pay/oplaad', { centen: 1000, idem: '   ' }, token);
  assert.equal(r.status, 400,
    'een sleutel die alleen witruimte is, mag niet stilzwijgend als "geen sleutel" doorgaan -- ' +
    'dan draait het werk ongegrendeld en is elke retry een nieuwe boeking');
  assert.equal(await saldoVan(token) - voor, 0, 'en er is niets geboekt');
});
