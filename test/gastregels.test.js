/* De gast-regels bij eten bestellen: een gratis account mag thuisbezorgd
   bestellen (met EUR 2,50 ex btw servicekosten; leden betalen die nooit),
   mag pas een restaurant reserveren als het ID geverifieerd is, telt tot
   die verificatie standaard als "onder de 18" (geen alcohol), en kan wel
   gewoon met een QR-kassacode betalen.
   Draai: node --test test/gastregels.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gast-'));
let child, gastToken, gastId, lidToken, managerToken, officeToken, prodId;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();
const overWeek = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  // een GRATIS account (gast): volwassen volgens de eigen opgave, maar nog niet geverifieerd
  const gast = await json(await api('/api/auth/register', { name: 'Gratis Gast', email: 'gast@x.nl', phone: '0612345677',
    password: 'geheim123', geboortedatum: '1995-05-05', tier: 'guest', pasApp: 'rtg' }));
  gastToken = gast.token; gastId = gast.state.user.id;
  // een betalend lid ter vergelijking
  lidToken = (await json(await api('/api/auth/register', { name: 'Betalend Lid', email: 'lid@x.nl', phone: '0612345676',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' }))).token;
  // Sal de Mar: bezorgdienst aan
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const man = roster.staff.find(x => x.role === 'manager');
  managerToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' }))).token;
  await api('/api/supplier/bezorg/product', { name: 'Paella thuis', price: 24 }, managerToken);
  await api('/api/supplier/bezorg/instellingen', { aan: true, ophalen: true, bezorgen: true }, managerToken);
  prodId = (await json(await api('/api/bezorg/partners', {}, lidToken))).partners.find(x => x.code === 'KIKUNOI').producten[0].id;
  officeToken = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('servicekosten: de gast betaalt EUR 2,50 ex btw bovenop het eten; het lid niets', async () => {
  const gastB = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'ophalen',
    items: [{ id: prodId, qty: 1 }] }, gastToken));
  assert.equal(gastB.order.servicekosten.exBtw, 2.5);
  assert.equal(gastB.order.servicekosten.btwPct, 21);
  assert.equal(gastB.order.total, 27.03, 'EUR 24 eten + EUR 3,03 servicekosten incl. btw');
  /* HET BEDRAG STOND DRIE KEER. exBtw 2.5, inBtw 3.03 met de hand uitgerekend,
     en nog eens als tekst in de app ("incl. EUR 2,50 servicekosten"). Wie het
     tarief wijzigde, kreeg een bevestigingsscherm met het oude bedrag bij een
     nieuw totaal. Deze bewering vergelijkt twee dingen die de server los van
     elkaar meldt: loopt inBtw weg van exBtw + btwPct, dan zakt hij. */
  const sk = gastB.order.servicekosten;
  assert.equal(sk.inBtw, Math.round(sk.exBtw * (1 + sk.btwPct / 100) * 100) / 100,
    'het bedrag inclusief btw volgt uit tarief en percentage, het staat er niet los ingetikt');
  const lidB = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'ophalen',
    items: [{ id: prodId, qty: 1 }] }, lidToken));
  assert.equal(lidB.order.servicekosten, undefined, 'leden betalen geen servicekosten');
  assert.equal(lidB.order.total, 24);
});

/* DE TWEEDE BESTELWEG, EN WAAROM DIE HIER STAAT.

   Het tarief stond twee keer los ingetikt: in kern/lidacties/bestellen.js
   (afhalen en aan tafel) en in routes/member/kopen/bezorg.js (thuisbezorgd).
   Dat bleef verborgen omdat de toets hierboven alleen de BEZORGweg raakt: ik
   zette het tarief in bestellen.js op 3,50 en deze toets bleef vrolijk groen.

   Twee wegen die hetzelfde tarief los intikken lopen uiteen zodra iemand er een
   aanpast, en dan betaalt dezelfde gast een ander bedrag afhankelijk van of hij
   afhaalt of laat bezorgen. Deze toets vergelijkt de twee wegen daarom
   RECHTSTREEKS met elkaar, in plaats van allebei met een getal: zo zakt hij ook
   als iemand het tarief netjes op beide plekken wijzigt maar op een ervan een
   typefout maakt. */
test('afhalen en bezorgen rekenen hetzelfde tarief -- twee wegen, een bedrag', async () => {
  const bezorgd = await json(await api('/api/bezorg/bestel', { supplierCode: 'KIKUNOI', levering: 'bezorgen',
    adres: 'Teststraat 1', items: [{ id: prodId, qty: 1 }] }, gastToken));
  /* De twee wegen matchen op VERSCHILLENDE catalogi: de bezorgweg op
     s.bezorg.producten, de afhaalweg op s.menu. Vandaar hier een eigen id;
     precies dat verschil is ook de reden dat de dubbeling zo lang onzichtbaar
     bleef -- geen toets liep over allebei. */
  const kaart = await json(await api('/api/supplier/menu/get', { code: 'KIKUNOI' }, gastToken));
  const menuItem = ((kaart.menu || []).find(x => !x.uitverkocht && x.station !== 'bar') || (kaart.menu || [])[0] || {}).id;
  assert.ok(menuItem, 'er is een gerecht op de kaart om mee te bestellen');
  const afgehaald = await json(await api('/api/order', { supplierCode: 'KIKUNOI',
    items: [{ id: menuItem, qty: 1 }] }, gastToken));

  assert.ok(bezorgd.order && bezorgd.order.servicekosten, 'de bezorgweg rekent servicekosten');
  assert.ok(afgehaald.order && afgehaald.order.servicekosten,
    'en de afhaalweg ook: ' + JSON.stringify(afgehaald).slice(0, 160));
  assert.deepEqual(afgehaald.order.servicekosten, bezorgd.order.servicekosten,
    'allebei exact hetzelfde tarief, tot en met het bedrag inclusief btw');
});

test('reserveren: dicht tot het ID geverifieerd is, daarna open; bestellen kon al die tijd al', async () => {
  const dicht = await api('/api/reserveer', { supplierCode: 'KIKUNOI', datum: overWeek(), tijd: '20:00', personen: 2 }, gastToken);
  assert.equal(dicht.status, 403);
  assert.match((await json(dicht)).error, /geverifieerd/i);
  // RTG keurt het paspoort goed (KYC in de backoffice)
  const vrf = await api('/api/office/verify', { userId: gastId, decision: 'approve', faceMatch: true }, officeToken);
  assert.equal(vrf.status, 200);
  const open = await api('/api/reserveer', { supplierCode: 'KIKUNOI', datum: overWeek(), tijd: '20:00', personen: 2 }, gastToken);
  assert.equal(open.status, 200, 'na verificatie mag de gast reserveren');
});

test('standaard onder de 18: zonder geverifieerd ID geen alcohol, ook al zegt de gast volwassen te zijn', async () => {
  // een tweede, ongeverifieerde gast
  const g2 = await json(await api('/api/auth/register', { name: 'Tweede Gast', email: 'gast2@x.nl', phone: '0612345675',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg' }));
  const kaart = await json(await api('/api/supplier/menu/get', { code: 'KIKUNOI' }, g2.token));
  const bar = (kaart.menu || []).find(m => m.station === 'bar');
  assert.ok(bar, 'Sal de Mar heeft een bar-item op de kaart');
  const nee = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: bar.id, qty: 1 }] }, g2.token);
  assert.equal(nee.status, 403);
  assert.match((await json(nee)).error, /onder de 18/i);
  // de zojuist geverifieerde volwassen gast mag wel
  const ja = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: bar.id, qty: 1 }] }, gastToken);
  assert.equal(ja.status, 200, 'geverifieerd en volwassen: alcohol mag');
});

test('betalen met QR kan wel gewoon: de gast krijgt een kassacode en de zaak int hem', async () => {
  const r = await api('/api/pay/kascode', { maxCenten: 3000 }, gastToken);
  assert.equal(r.status, 200);
  const d = await json(r);
  assert.ok(d.code && d.code.length >= 6, 'de kassacode is er; de app toont hem als QR');
  // de zaak int de code aan de kassa (het saldo laadt automatisch bij)
  const inn = await api('/api/supplier/pay/in', { code: d.code, centen: 500, oms: 'Lunch', idem: 'gasttest-1' }, managerToken);
  assert.equal(inn.status, 200, 'de QR-betaling van de gast wordt gewoon geind');
});
