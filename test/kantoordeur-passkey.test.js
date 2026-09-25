'use strict';
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
   een dossier dat nu RONd is omdat de as `assurance` bewezen is. test/
   tweedehandtekening.test.js toets 6 houdt de andere kant vast: zonder passkey
   blijft de as `vermoed` en heet de keten niet rond. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoorpasskey-'));
const CODE = 'KANTOOR-PASSKEY-1';
let srv, base, origin, gedeeld;

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
  origin = new URL(base).origin;
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

  // A zet een passkey op zijn eigen account
  const sleutel = maakAuthenticator(new URL(base).hostname);
  const regOpties = await api('/api/webauthn/registreer/opties', {}, a.lid);
  assert.equal(regOpties.status, 200, JSON.stringify(regOpties.body).slice(0, 160));
  const reg = await api('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(regOpties.body.opties.challenge, origin), naam: 'Toestel kantoor' }, a.lid);
  assert.equal(reg.status, 200, 'passkey geregistreerd: ' + JSON.stringify(reg.body).slice(0, 160));

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
  const opties = await api('/api/office/bank/incasso/opties', { tot }, a.kantoor);
  assert.equal(opties.status, 200, 'de kantoordeur opent geen ceremonie voor de incassoronde: ' +
    JSON.stringify(opties.body).slice(0, 160));
  const antwoord = sleutel.loginAntwoord(opties.body.opties.challenge, origin, 1);
  const r = await api('/api/office/bank/incasso', { tot, ceremonie: opties.body.ceremonie, antwoord }, a.kantoor);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.equal(r.body.needsAuth, true, 'de ronde ging zonder tweede mens door');

  // een ceremonie voor een andere grens dekt deze ronde niet
  const ander = await api('/api/office/bank/incasso/opties', { tot: tot + 1 }, a.kantoor);
  const verkeerd = await api('/api/office/bank/incasso', { tot,
    ceremonie: ander.body.ceremonie, antwoord: sleutel.loginAntwoord(ander.body.opties.challenge, origin, 2) }, a.kantoor);
  assert.notEqual(verkeerd.status, 200, 'een ceremonie voor een andere grens werd aanvaard');

  // de tweede mens tekent, en het geld beweegt
  const saldo = async () => Number(((await api('/api/bank/rekening', { iban: ontvanger.iban }, ontvanger.token)).body.rekening || {}).saldoCenten);
  const voor = await saldo();
  const ok = await api('/api/office/bank/handtekening/bevestig', { id: r.body.aanvraag.id }, b.kantoor);
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

test('de ceremonie-deur staat niet open voor de gedeelde code', async () => {
  const r = await api('/api/office/bank/incasso/opties', { tot: Date.now() }, gedeeld);
  assert.equal(r.status, 403, JSON.stringify(r.body).slice(0, 160));
});
