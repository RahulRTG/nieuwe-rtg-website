/* EEN KANTOORMEDEWERKER MET EEN PASSKEY KAN DE INCASSORONDE STARTEN, en dan is
   de geldketen rond.

   Gevonden bij het meten van "passkeys aan de kantoordeur" (25 september 2026):
   kern/zwaarbewijs.js eist voor `bank.incasso` een passkeyceremonie zodra het
   account van de medewerker een passkey HEEFT, gebonden aan 'incasso:' + de
   grens. Maar er was geen enkele kantoorroute die die ceremonie kon openen: de
   boardroom-deur bindt aan de sessie en staat alleen open voor de boardroom. Een
   medewerker die een passkey zette, kon de incassoronde dus nooit meer starten
   (401 bevestigingNodig, zonder weg naar de opties), terwijl een medewerker
   zonder passkey er op de terugval gewoon door kwam. De veiligere mens werd
   buitengesloten.

   Deze toets loopt de hele baan met een echte (software)passkey: registreren
   op het eigen account, de ceremonie openen op de kantoordeur, de ronde
   aanvragen met het antwoord, een tweede mens die tekent, geld dat beweegt, en
   een dossier dat nu ROND is omdat de as `assurance` bewezen is.

   En daarna besloot de eigenaar (25 september 2026) dat de terugval voor
   geldhandelingen dicht gaat, en dat de TWEEDE handtekening dezelfde ceremonie
   vraagt, gebonden aan de aanvraag (routes/kantoren/bank-passkey.js). De
   derde toets hieronder houdt die grens vast, met rood staan als tegenproef. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoorpasskey-'));
const CODE = 'KANTOOR-PASSKEY-1';
let srv, base, gedeeld, pk;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

const telefoon = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

/* Een medewerker op naam: zijn LEDENtoken (daar hangt de passkey aan) en zijn
   kantoortoken (daarmee staat hij in de backoffice). */
async function medewerker(merk) {
  const u = (Date.now() + merk * 7919).toString(36) + merk;
  const reg = await api('/api/auth/register', { name: 'Kantoormens ' + merk, email: 'kp' + u + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'medewerker ' + merk + ' geregistreerd');
  const kop = await api('/api/account/koppel', await kantoorKoppelBody(base, reg.body.token), reg.body.token);
  assert.equal(kop.status, 200, 'kantoorrol gekoppeld: ' + JSON.stringify(kop.body).slice(0, 120));
  const start = await api('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  assert.ok(start.body.token, 'medewerker ' + merk + ' staat op naam in de backoffice');
  return { lid: reg.body.token, kantoor: start.body.token };
}

async function lidMetRekening(naam) {
  const u = (Date.now() + Math.random()).toString(36).replace('.', '');
  const t = (await api('/api/auth/register', { name: naam, email: 'kr' + u + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const akk = await api('/api/bank/akkoord', {}, t);
  assert.equal(akk.status, 200, 'rekening voor ' + naam + ': ' + JSON.stringify(akk.body).slice(0, 140));
  return { token: t, iban: akk.body.rekening.iban };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  pk = kantoorPasskey(base);
  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorinlog werkt');
  const live = await api('/api/office/bank/leden', { aan: true, naam: 'RTG' }, gedeeld);
  assert.equal(live.status, 200, 'de leden-bank staat live: ' + JSON.stringify(live.body).slice(0, 140));
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een medewerker met passkey start de incassoronde met een ceremonie, en de keten is rond', async () => {
  const a = await medewerker(1);
  const b = await medewerker(2);

  // A en B zetten elk een passkey op hun eigen account: sinds 25 september 2026
  // vragen BEIDE handtekeningen onder een geldhandeling er een (bank-passkey.js)
  const sleutelA = await pk.zet(a.lid);
  const sleutelB = await pk.zet(b.lid);

  // een vaste betaling die aan de beurt is, zodat de ronde iets te innen heeft
  const betaler = await lidMetRekening('Betaler');
  const ontvanger = await lidMetRekening('Ontvanger');
  // de betaler heeft geld nodig, anders mislukt de inning bij zijn eigen post
  const stort = await api('/api/bank/storten', { iban: betaler.iban, centen: 1000, idem: 'kp-stort-' + Date.now() }, betaler.token);
  assert.equal(stort.status, 200, 'storten: ' + JSON.stringify(stort.body).slice(0, 160));
  const vast = await api('/api/bank/terugkerend/zet', { vanIban: betaler.iban, naarIban: ontvanger.iban,
    centen: 100, interval: 'maand', oms: 'Passkeyincasso', idem: 'kp-incasso-' + Date.now() }, betaler.token);
  assert.equal(vast.status, 200, 'de vaste betaling: ' + JSON.stringify(vast.body).slice(0, 160));
  const tot = Date.now() + 31 * 86400000;

  // zonder ceremonie: de deur vraagt er een, en zegt dat ook
  const zonder = await api('/api/office/bank/incasso', { tot }, a.kantoor);
  assert.equal(zonder.status, 401, JSON.stringify(zonder.body).slice(0, 160));
  assert.equal(zonder.body.bevestigingNodig, true);

  // DE CEREMONIE OPENEN OP DE KANTOORDEUR, voor precies deze handeling en grens
  const c = await pk.ceremonie(sleutelA, '/api/office/bank/incasso/opties', { tot }, a.kantoor);
  const r = await api('/api/office/bank/incasso', { tot, ...c }, a.kantoor);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.needsAuth, true, 'de ronde ging zonder tweede mens door');

  // een ceremonie voor een andere grens dekt deze ronde niet
  const ander = await pk.ceremonie(sleutelA, '/api/office/bank/incasso/opties', { tot: tot + 1 }, a.kantoor);
  const verkeerd = await api('/api/office/bank/incasso', { tot, ...ander }, a.kantoor);
  assert.notEqual(verkeerd.status, 200, 'een ceremonie voor een andere grens werd aanvaard');

  // de tweede mens tekent, en het geld beweegt
  const saldo = async () => Number(((await api('/api/bank/rekening', { iban: ontvanger.iban }, ontvanger.token)).body.rekening || {}).saldoCenten);
  const voor = await saldo();
  const id = r.body.aanvraag.id;
  // ook de TWEEDE handtekening vraagt een ceremonie, en zonder zegt de deur dat
  const kaal = await api('/api/office/bank/handtekening/bevestig', { id }, b.kantoor);
  assert.equal(kaal.status, 401, 'de tweede handtekening ging zonder passkey: ' + JSON.stringify(kaal.body).slice(0, 160));
  assert.equal(kaal.body.bevestigingNodig, true);
  // een ceremonie van de AANVRAGER dekt de handtekening van de tweede mens niet
  const vanA = await pk.ceremonie(sleutelA, '/api/office/bank/handtekening/opties', { id }, a.kantoor);
  assert.notEqual((await api('/api/office/bank/handtekening/bevestig', { id, ...vanA }, b.kantoor)).status, 200,
    'de ceremonie van de aanvrager werd aanvaard als handtekening van de tweede mens');
  const cB = await pk.ceremonie(sleutelB, '/api/office/bank/handtekening/opties', { id }, b.kantoor);
  const ok = await api('/api/office/bank/handtekening/bevestig', { id, ...cB }, b.kantoor);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
  assert.equal(await saldo() - voor, 100, 'de incassoronde heeft geen geld verplaatst');

  // EN NU IS DE KETEN ROND: de as assurance is bewezen, niet vermoed
  const dos = await api('/api/office/bank/incasso/dossier', { voornemen: r.body.voornemen.id }, b.kantoor);
  assert.equal(dos.status, 200, JSON.stringify(dos.body).slice(0, 160));
  const ass = dos.body.dossier.assen.find(x => x.as === 'assurance');
  assert.equal(ass.graad, 'bewezen', 'de assurance-as: ' + JSON.stringify(ass));
  // rond betekent in de geldketen: geen enkele verplichte as open (en dat slaagt niet op een leeg dossier)
  assert.equal(dos.body.dossier.rond, true, 'open assen: ' + (dos.body.dossier.open || []).join(', '));
});

test('de ceremonie-deuren staan niet open voor de gedeelde code', async () => {
  const r = await api('/api/office/bank/incasso/opties', { tot: Date.now() }, gedeeld);
  assert.equal(r.status, 403, JSON.stringify(r.body).slice(0, 160));
  const h = await api('/api/office/bank/handtekening/opties', { id: 'x' }, gedeeld);
  assert.equal(h.status, 403, JSON.stringify(h.body).slice(0, 160));
});

/* NU DICHT VOOR GELDHANDELINGEN (besluit eigenaar, 25 september 2026). Een
   medewerker zonder passkey kwam tot dan op de terugval door, met een melding aan
   de beveiliging. Dat is voor geld dicht: de weigering is 403 met de weg erheen
   (`passkey-zetten`), bij de aanvraag EN bij de tweede handtekening. Rood staan
   raakt geen geld en blijft op de oude regels -- dat is de tegenproef, want de
   goedkoopste implementatie van "dicht" is alles dicht. */
test('zonder passkey: geen incassoronde en geen tweede handtekening onder geld, wel onder rood staan', async () => {
  const c = await medewerker(3);
  const d = await medewerker(4);
  const incasso = await api('/api/office/bank/incasso', { tot: Date.now() + 31 * 86400000 }, c.kantoor);
  assert.equal(incasso.status, 403, JSON.stringify(incasso.body).slice(0, 160));
  assert.equal(incasso.body.watNu, 'passkey-zetten', 'de weigering zegt niet hoe het wel kan');

  // een geldaanvraag van iemand MET passkey, die een medewerker zonder niet mag aftekenen
  const e = await medewerker(5);
  const sleutelE = await pk.zet(e.lid);
  const betaler = await lidMetRekening('Betaler twee');
  const ontvanger = await lidMetRekening('Ontvanger twee');
  await api('/api/bank/storten', { iban: betaler.iban, centen: 500, idem: 'kp-stort2-' + Date.now() }, betaler.token);
  await api('/api/bank/terugkerend/zet', { vanIban: betaler.iban, naarIban: ontvanger.iban,
    centen: 100, interval: 'maand', oms: 'Zonder passkey', idem: 'kp-inc2-' + Date.now() }, betaler.token);
  const tot = Date.now() + 32 * 86400000;
  const aan = await api('/api/office/bank/incasso',
    { tot, ...(await pk.ceremonie(sleutelE, '/api/office/bank/incasso/opties', { tot }, e.kantoor)) }, e.kantoor);
  assert.equal(aan.body.needsAuth, true, JSON.stringify(aan.body).slice(0, 160));
  const bev = await api('/api/office/bank/handtekening/bevestig', { id: aan.body.aanvraag.id }, d.kantoor);
  assert.equal(bev.status, 403, JSON.stringify(bev.body).slice(0, 160));
  assert.equal(bev.body.watNu, 'passkey-zetten');

  // de tegenproef: rood staan raakt geen geld, en daar tekent een tweede mens zonder passkey gewoon af
  const rek = await lidMetRekening('Roodstaander');
  const rood = await api('/api/office/bank/rekening/rood', { iban: rek.iban, euro: 100 }, c.kantoor);
  assert.equal(rood.body.needsAuth, true, JSON.stringify(rood.body).slice(0, 160));
  const ok = await api('/api/office/bank/handtekening/bevestig', { id: rood.body.aanvraag.id }, d.kantoor);
  assert.equal(ok.status, 200, 'rood staan vraagt ineens een passkey: ' + JSON.stringify(ok.body).slice(0, 160));
});
