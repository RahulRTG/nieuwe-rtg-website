/* "WAAROM BETAAL IK DIT?" -- de keten van een bedrag terug naar de factuur van
   onze eigen leverancier.

   Elke kostenregel droeg al een bron: een zin die iemand in de boardroom had
   ingetikt. Dat is beter dan niets en het is geen bewijs. Deze toetsen leggen
   vast dat die zin nu AFGELEID kan worden uit een echte leveranciersfactuur --
   met nummer en bedrag -- en dat de keten eerlijk zegt waar hij ophoudt.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostenherkomst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Herkomst Toets', email: 'herkomst-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registratie gaf geen token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}
const nu = async () => (await api('/api/office/kosten/overzicht', {}, kantoor)).body.periode;

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');
});
test.after(() => stop(srv));

/* MUTATIE: in providerfactuur.js de nummer-eis weggehaald -- deze toets zakt dan
   op de eerste helft; de dubbelcontrole weghalen laat de derde zakken. */
test('een leveranciersfactuur heeft een leverancier en een nummer, en bestaat maar een keer', async () => {
  const p = await nu();
  const zonderNummer = await api('/api/office/kosten/leveranciersfactuur/zet',
    { leverancier: 'Hoster BV', periode: p, centen: 1849218 }, kantoor);
  assert.equal(zonderNummer.status, 400);
  assert.match(zonderNummer.body.error, /nummer/i);

  const goed = await api('/api/office/kosten/leveranciersfactuur/zet',
    { leverancier: 'Hoster BV', nummer: 'INV-88219', periode: p, centen: 1849218 }, kantoor);
  assert.equal(goed.status, 200);
  assert.ok(goed.body.factuur.id, 'de factuur kreeg geen id');
  assert.match(goed.body.factuur.zegtNiet, /niet de factuur zelf/i,
    'het record hoort zelf te zeggen dat het een overname is en geen geverifieerde bron');

  const nogmaals = await api('/api/office/kosten/leveranciersfactuur/zet',
    { leverancier: 'hoster bv', nummer: 'inv-88219', periode: p, centen: 1849218 }, kantoor);
  assert.equal(nogmaals.status, 409, 'dezelfde factuur ging er een tweede keer in; dan telt een maand dubbel');

  /* En hij staat in de lijst van die maand -- een register waar je niets uit
     terugkrijgt, is geen register. */
  const lijst = await api('/api/office/kosten/leveranciersfacturen', { periode: p }, kantoor);
  assert.equal(lijst.status, 200);
  const erin = lijst.body.facturen.find(f => f.nummer === 'INV-88219');
  assert.ok(erin, 'de factuur staat niet in de lijst van deze maand');
  assert.equal(erin.leverancier, 'Hoster BV');
  assert.equal(erin.centen, 1849218);
});

/* MUTATIE: in huisrekening.js en tarieven.js de factuurId-tak weggehaald (de
   bron niet meer afleiden) -- deze toets zakt dan, want dan staat er weer een
   ingetikte zin onder het bedrag in plaats van een factuurnummer. */
test('een tarief en een nota lenen hun bron van de factuur, en de keten loopt door', async () => {
  const p = await nu();
  const f = await api('/api/office/kosten/leveranciersfactuur/zet',
    { leverancier: 'Modelaanbieder', nummer: 'MA-2026-08', periode: p, centen: 500000 }, kantoor);
  assert.equal(f.status, 200);
  const fid = f.body.factuur.id;

  /* GEEN bron meegegeven, alleen het factuurnummer: de bron hoort eruit te
     komen. Dat is het hele punt -- een herkomst die je intikt, loopt uiteen van
     de herkomst die je bedoelt. */
  const tar = await api('/api/office/kosten/tarief/zet',
    { soort: 'verzoek', perEenheid: 100000, factuurId: fid }, kantoor);
  assert.equal(tar.status, 200, JSON.stringify(tar.body).slice(0, 160));
  assert.match(tar.body.tarief.bron, /MA-2026-08/, 'de bron is niet uit de factuur afgeleid');
  assert.equal(tar.body.tarief.factuurId, fid);

  const lid = await versLid();
  for (let i = 0; i < 3; i++) await api('/api/kosten/mij', {}, lid);

  const h = await api('/api/kosten/herkomst', { soort: 'verzoek', periode: p }, lid);
  assert.equal(h.status, 200, JSON.stringify(h.body).slice(0, 200));
  const stappen = h.body.keten.map(x => x.stap);
  assert.deepEqual(stappen, ['bedrag', 'verbruik', 'tarief', 'leveranciersfactuur'],
    'de keten heeft niet alle vier de schakels');
  const laatste = h.body.keten[3];
  assert.equal(laatste.gevonden, true, 'de keten eindigt niet bij een factuur');
  assert.equal(laatste.nummer, 'MA-2026-08');
  assert.ok(laatste.door, 'er staat niet bij WIE de factuur heeft ingevoerd');
  assert.match(laatste.zegtNiet, /niet de factuur zelf/i,
    'de laatste schakel hoort te zeggen waar de keten ophoudt');
});

/* MUTATIE: in herkomst.js de `gevonden: false`-tak vervangen door een lege lijst
   -- deze toets zakt dan, want dan leest een ontbrekende factuur als een
   afgeronde keten. */
test('zonder factuur zegt de keten waar hij ophoudt, in plaats van te doen alsof', async () => {
  const p = await nu();
  await api('/api/office/kosten/tarief/zet',
    { soort: 'ai-invoer', perEenheid: 300, bron: 'Met de hand ingetikt, geen factuur' }, kantoor);

  const lid = await versLid();
  await api('/api/kosten/mij', {}, lid);
  const drager = (await api('/api/kosten/mij', {}, lid)).body.overzicht.drager;

  /* Een soort waar dit lid niets van verbruikte: de keten hoort dan een REDEN te
     geven en geen lege lijst die als "gratis" leest. */
  const leeg = await api('/api/office/kosten/herkomst', { drager, soort: 'ai-invoer', periode: p }, kantoor);
  assert.equal(leeg.status, 200);
  /* De REDEN is de bewering, niet de lege keten: dat laatste slaagt ook als de
     keten nooit iets teruggeeft (scripts/tandeloos.js). */
  assert.match(leeg.body.waarom, /geen ai, invoer gemeten|niet gemeten|geen/i);

  // en bij een soort die hij wel verbruikte, maar met een tarief zonder factuur
  const h = await api('/api/office/kosten/herkomst', { drager, soort: 'verzoek', periode: p }, kantoor);
  const laatste = h.body.keten[h.body.keten.length - 1];
  assert.equal(laatste.stap, 'leveranciersfactuur');
  if (!laatste.gevonden) assert.match(laatste.waarom, /geen leveranciersfactuur/i);
});

/* MUTATIE: in routes/kosten.js de drager van /api/kosten/herkomst uit het
   lichaam halen -- deze toets zakt dan, want dan leest een lid de herkomst van
   een ander. */
test('een lid vraagt alleen zijn eigen herkomst op', async () => {
  const p = await nu();
  const a = await versLid(); const b = await versLid();
  for (let i = 0; i < 3; i++) await api('/api/kosten/mij', {}, a);
  const dragerA = (await api('/api/kosten/mij', {}, a)).body.overzicht.drager;
  const gluur = await api('/api/kosten/herkomst', { soort: 'verzoek', periode: p, drager: dragerA }, b);
  assert.equal(gluur.status, 200);
  assert.notEqual(gluur.body.drager, dragerA, 'lid B las de herkomst van lid A');
});
