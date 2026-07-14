/* End-to-end tests voor de ervaring-laag (kern/ervaring.js): tafelreserveringen,
   annuleren, reviews, favorieten, fooi, de reisagenda, rekening splitsen,
   wachtlijsten, RTG-punten en meldingsvoorkeuren. Tegen een echte server met
   een verse datamap. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const overWeek = () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

let srv, base, sup, lidA, lidB;
let seq = 0;
async function nieuwLid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: naam, email: naam.toLowerCase() + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  assert.ok(reg.body.token, 'registratie ' + naam);
  const st = await api(base, '/api/state', {}, reg.body.token);
  return { token: reg.body.token, codename: st.body.state.user.codename };
}

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-erv-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // leverancier (KIKUNOI, manager-demo) met een vaste kaart
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  sup = { token: login.body.token, code: 'KIKUNOI' };
  await api(base, '/api/supplier/menu', { menu: [
    { id: 'ramen', name: 'Tonkotsu Ramen', price: 22, publiekePrijs: 22, cat: 'Warm', station: 'keuken', sectie: 'warm' },
    { id: 'omakase', name: 'Omakase Deluxe', price: 260, publiekePrijs: 260, cat: 'Menu', station: 'keuken', sectie: 'warm' }
  ] }, sup.token);
  lidA = await nieuwLid('Erva');
  lidB = await nieuwLid('Ring');
});
test.after(() => stop(srv && srv.child));

// een betaalde bestelling plaatsen; geeft de order terug
async function bestel(token, items, betaalBody) {
  const plaats = await api(base, '/api/order', { supplierCode: sup.code, items }, token);
  assert.equal(plaats.status, 200, 'bestelling geplaatst');
  const betaal = await api(base, '/api/order/pay', { ref: plaats.body.order.ref, ...(betaalBody || {}) }, token);
  assert.equal(betaal.status, 200, 'bestelling betaald');
  return betaal.body.order;
}

test('1. tafelreserveren: aanvragen, de zaak bevestigt, en hij staat in de agenda', async () => {
  const r = await api(base, '/api/reserveer', { supplierCode: sup.code, datum: overWeek(), tijd: '20:00', personen: 4, notitie: 'raamtafel' }, lidA.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reservering.status, 'aangevraagd');
  // dubbel voor hetzelfde moment: tegengehouden
  const dubbel = await api(base, '/api/reserveer', { supplierCode: sup.code, datum: overWeek(), tijd: '20:00', personen: 2 }, lidA.token);
  assert.equal(dubbel.status, 409);
  // de zaak ziet hem en bevestigt
  const st = await api(base, '/api/supplier/state', {}, sup.token);
  const open = (st.body.state.reserveringen || []).find(x => x.id === r.body.reservering.id);
  assert.ok(open, 'de zaak ziet de aanvraag');
  const beslis = await api(base, '/api/supplier/reservering/beslis', { id: r.body.reservering.id, action: 'bevestig' }, sup.token);
  assert.equal(beslis.status, 200);
  const mijn = await api(base, '/api/reserveringen/mijn', {}, lidA.token);
  assert.equal(mijn.body.reserveringen[0].status, 'bevestigd');
  // 6. reisagenda: de bevestigde tafel staat op de juiste dag
  const ag = await api(base, '/api/agenda/mijn', {}, lidA.token);
  const dag = (ag.body.dagen || []).find(d => d.datum === overWeek());
  assert.ok(dag && dag.items.some(i => i.soort === 'reservering' && /Tafel bij/.test(i.titel)), 'agenda toont de tafel');
});

test('2. annuleren: een betaalde bestelling wordt terugbetaald; in bereiding kan niet meer', async () => {
  const o = await bestel(lidA.token, [{ id: 'ramen', qty: 2 }]);
  const ann = await api(base, '/api/annuleer', { soort: 'order', ref: o.ref }, lidA.token);
  assert.equal(ann.status, 200, JSON.stringify(ann.body));
  assert.equal(ann.body.terugbetaald, 44, 'het volle bedrag komt terug');
  // en een bestelling die al in bereiding is: geweigerd
  const o2 = await bestel(lidA.token, [{ id: 'ramen', qty: 1 }]);
  await api(base, '/api/supplier/order/status', { ref: o2.ref, status: 'in bereiding' }, sup.token);
  const ann2 = await api(base, '/api/annuleer', { soort: 'order', ref: o2.ref }, lidA.token);
  assert.equal(ann2.status, 409, 'in bereiding annuleert niet meer');
});

test('3. reviews: pas na afronding, een keer, en het gemiddelde is publiek zichtbaar', async () => {
  const o = await bestel(lidA.token, [{ id: 'ramen', qty: 1 }]);
  // te vroeg: de bestelling loopt nog
  const teVroeg = await api(base, '/api/review', { soort: 'order', ref: o.ref, score: 5 }, lidA.token);
  assert.equal(teVroeg.status, 409);
  await api(base, '/api/supplier/order/status', { ref: o.ref, status: 'geserveerd' }, sup.token);
  const rev = await api(base, '/api/review', { soort: 'order', ref: o.ref, score: 5, tekst: 'De beste ramen van Ibiza.' }, lidA.token);
  assert.equal(rev.status, 200, JSON.stringify(rev.body));
  const dubbel = await api(base, '/api/review', { soort: 'order', ref: o.ref, score: 1 }, lidA.token);
  assert.equal(dubbel.status, 409, 'een review per dienst');
  const pub = await api(base, '/api/reviews', { supplierCode: sup.code }, lidA.token);
  assert.equal(pub.body.rating.score, 5);
  assert.ok(pub.body.reviews.some(x => /beste ramen/i.test(x.tekst)));
  // het gemiddelde staat ook op de publieke partnerkaart
  const sups = await api(base, '/api/suppliers', {}, lidA.token);
  const kiku = sups.body.suppliers.find(s => s.code === sup.code);
  assert.deepEqual(kiku.rating, { score: 5, aantal: 1 });
});

test('4. favorieten: hartje aan en uit, zichtbaar op de partnerkaart', async () => {
  const aan = await api(base, '/api/favoriet', { supplierCode: sup.code }, lidA.token);
  assert.equal(aan.body.favoriet, true);
  let sups = await api(base, '/api/suppliers', {}, lidA.token);
  assert.equal(sups.body.suppliers.find(s => s.code === sup.code).favoriet, true);
  const lijst = await api(base, '/api/favorieten', {}, lidA.token);
  assert.ok(lijst.body.favorieten.some(f => f.code === sup.code));
  const uit = await api(base, '/api/favoriet', { supplierCode: sup.code }, lidA.token);
  assert.equal(uit.body.favoriet, false);
});

test('5. fooi: telt op de bestelling en in het Z-rapport van de zaak', async () => {
  const o = await bestel(lidA.token, [{ id: 'ramen', qty: 1 }], { fooi: 4 });
  assert.equal(o.fooi, 4, 'de fooi staat op de bestelling');
  const st = await api(base, '/api/supplier/state', {}, sup.token);
  assert.ok(st.body.state.pos.fooien >= 4, 'het Z-rapport telt de fooi van vandaag: ' + st.body.state.pos.fooien);
});

test('9. RTG-punten: sparen bij betalen, verzilveren naar tegoed, tegoed verrekent', async () => {
  // 4 x Omakase Deluxe = 1040 euro -> 104 punten
  await bestel(lidB.token, [{ id: 'omakase', qty: 4 }]);
  let p = await api(base, '/api/punten', {}, lidB.token);
  assert.ok(p.body.saldo >= 104, 'punten gespaard: ' + p.body.saldo);
  const fout = await api(base, '/api/punten/verzilver', { punten: 50 }, lidB.token);
  assert.equal(fout.status, 400, 'verzilveren kan per 100');
  const zilver = await api(base, '/api/punten/verzilver', { punten: 100 }, lidB.token);
  assert.equal(zilver.body.tegoed, 10, '100 punten = 10 euro tegoed');
  // volgende betaling: het tegoed wordt automatisch verrekend (RTG legt bij)
  const o = await bestel(lidB.token, [{ id: 'ramen', qty: 1 }]);
  assert.equal(o.puntenKorting, 10, 'tegoed verrekend bij het betalen');
  p = await api(base, '/api/punten', {}, lidB.token);
  assert.equal(p.body.tegoed, 0, 'het tegoed is op');
});

test('7. splitsen: betaalverzoek naar een verbonden vriend, die zijn deel betaalt', async () => {
  // A en B verbinden (vind op codenaam, verzoek, accepteren)
  const zoek = await api(base, '/api/member/find', { q: lidB.codename }, lidA.token);
  const trefB = (zoek.body.results || []).find(r => r.codename === lidB.codename);
  assert.ok(trefB, 'A vindt B');
  assert.equal((await api(base, '/api/member/connect', { key: trefB.key }, lidA.token)).status, 200);
  const zoekA = await api(base, '/api/member/find', { q: lidA.codename }, lidB.token);
  const trefA = (zoekA.body.results || []).find(r => r.codename === lidA.codename);
  assert.equal((await api(base, '/api/member/connect/respond', { key: trefA.key, action: 'accept' }, lidB.token)).status, 200);
  // A betaalt 44 en splitst met B: ieder 22
  const o = await bestel(lidA.token, [{ id: 'ramen', qty: 2 }]);
  const split = await api(base, '/api/splits', { ref: o.ref, metKeys: [trefB.key] }, lidA.token);
  assert.equal(split.status, 200, JSON.stringify(split.body));
  assert.equal(split.body.splits.delen[0].bedrag, 22);
  // B ziet het verzoek en betaalt zijn deel
  const mijnB = await api(base, '/api/splitsen/mijn', {}, lidB.token);
  const openDeel = mijnB.body.splitsen.find(s => s.orderRef === o.ref);
  assert.ok(openDeel, 'B ziet het betaalverzoek');
  const betaal = await api(base, '/api/splits/betaal', { id: openDeel.id }, lidB.token);
  assert.equal(betaal.body.rond, true, 'alle delen zijn binnen');
  const nogEens = await api(base, '/api/splits/betaal', { id: openDeel.id }, lidB.token);
  assert.equal(nogEens.status, 409, 'dubbel betalen kan niet');
});

test('8. wachtlijst: vol event, plek vrij na afmelding, de eerste is aan de beurt', async () => {
  // de zaak maakt een event met 1 plek en publiceert het
  const maak = await api(base, '/api/supplier/event', { action: 'add', event: { name: 'Chef’s Table', date: morgen(), time: '19:00', capacity: 1 } }, sup.token);
  assert.equal(maak.status, 200, JSON.stringify(maak.body));
  const st = await api(base, '/api/supplier/state', {}, sup.token);
  const ev = (st.body.state.events || []).find(e => e.name === 'Chef’s Table');
  await api(base, '/api/supplier/event', { action: 'publish', id: ev.id }, sup.token);
  // A pakt de laatste plek; B wil op de wachtlijst
  assert.equal((await api(base, '/api/event/rsvp', { supplierCode: sup.code, eventId: ev.id, qty: 1 }, lidA.token)).status, 200);
  const vol = await api(base, '/api/event/rsvp', { supplierCode: sup.code, eventId: ev.id, qty: 1 }, lidB.token);
  assert.equal(vol.status, 409, 'het event is vol');
  const w = await api(base, '/api/wachtlijst', { supplierCode: sup.code, eventId: ev.id }, lidB.token);
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal(w.body.positie, 1);
  assert.equal((await api(base, '/api/wachtlijst', { supplierCode: sup.code, eventId: ev.id }, lidB.token)).status, 409, 'niet dubbel op de lijst');
  // A meldt zich af: de plek komt vrij en B is van de lijst (kreeg bericht)
  assert.equal((await api(base, '/api/event/rsvp/annuleer', { supplierCode: sup.code, eventId: ev.id }, lidA.token)).status, 200);
  const mijnW = await api(base, '/api/wachtlijst/mijn', {}, lidB.token);
  assert.equal(mijnW.body.wachtlijst.length, 0, 'B is gemeld en van de wachtlijst af');
  // en de plek is echt vrij
  assert.equal((await api(base, '/api/event/rsvp', { supplierCode: sup.code, eventId: ev.id, qty: 1 }, lidB.token)).status, 200);
});

test('10. meldingsvoorkeuren: per scope uit en weer aan', async () => {
  let v = await api(base, '/api/meldingen/voorkeur', {}, lidA.token);
  assert.equal(v.body.voorkeur.orders, true, 'standaard staat alles aan');
  v = await api(base, '/api/meldingen/voorkeur', { zet: { salon: false } }, lidA.token);
  assert.equal(v.body.voorkeur.salon, false);
  assert.equal(v.body.voorkeur.orders, true, 'andere scopes blijven aan');
  v = await api(base, '/api/meldingen/voorkeur', { zet: { salon: true } }, lidA.token);
  assert.equal(v.body.voorkeur.salon, true);
});
