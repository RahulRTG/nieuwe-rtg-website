/* DE ZWARE POORT: vraagt een eigenaarshandeling opnieuw om de passkey?

   Dit bestand bestaat omdat de vorige twee niet genoeg zijn. test/webauthn.test.js
   toetst de randen, test/webauthn-ceremonie.test.js bewijst dat registreren en
   inloggen echt werken -- maar geen van beide kijkt of een HANDELING erdoor
   beschermd wordt. Precies daar zit de belofte: een gestolen open sessie mag de
   eigendom van dit platform niet kunnen overdragen.

   DE VIER BEWERINGEN DIE HIER MOETEN ZAKKEN ALS IEMAND ZE SLOOPT:
   1. de ratel -- zonder passkey loopt een zware handeling door (anders sluit de
      eerste installatie zichzelf buiten), MET passkey wordt hij hard;
   2. de binding aan de ACTIE -- een assertie voor de ene handeling bevestigt de
      andere niet;
   3. de scheiding van de woordenlijsten -- een PIN-ceremonie is geen zware
      ceremonie, ook al delen ze een motor en een opslag;
   4. `passkey-weg` is zelf zwaar -- anders is de ratel van bovenaf open te
      zetten door de sleutels weg te halen.

   Draai los: node --test test/eigenaarbevestiging.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');
const { PIN_ACTIES, ZWARE_ACTIES } = require('../server/kern/webauthn-acties');

const OWNER = 'zwaar-eigenaar@x.nl';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zwaar-'));
let srv, base, tech, lid, gast, rpID, origin, sleutel;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* Een complete zware ceremonie: opties halen op de technische pagina, tekenen
   met de nagespeelde authenticator, en de twee velden teruggeven die de
   handeling meestuurt. De teller loopt op, want een authenticator die twee keer
   hetzelfde getal stuurt is een gekloonde authenticator. */
let teller = 10;
async function bevestig(actie) {
  const o = await api('/api/techniek/bevestig/opties', { actie }, tech);
  assert.equal(o.status, 200, 'ceremonie voor ' + actie + ': ' + JSON.stringify(o.body).slice(0, 160));
  return { ceremonie: o.body.ceremonie,
    antwoord: sleutel.loginAntwoord(o.body.opties.challenge, origin, ++teller) };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER } });
  base = srv.base;
  const url = new URL(base);
  rpID = url.hostname;
  origin = url.origin;
  sleutel = maakAuthenticator(rpID);

  // Het eigenaarsaccount wordt in demostand geseed op RTG_OWNER_EMAIL.
  const t = await api('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' });
  tech = t.body.token;
  assert.ok(tech, 'de eigenaar komt op de technische pagina: ' + JSON.stringify(t.body).slice(0, 160));

  const l = await api('/api/auth/login', { login: OWNER, password: 'Imran', pasApp: 'business' });
  lid = l.body.token;
  assert.ok(lid, 'diezelfde eigenaar heeft een ledensessie: ' + JSON.stringify(l.body).slice(0, 160));

  // een tweede account om toegang aan te geven (anders is de route een 404)
  const u = Date.now().toString().slice(-8);
  const g = await api('/api/auth/register', { name: 'Gast Z', email: 'gastz' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  gast = 'gastz' + u + '@x.nl';
  assert.ok(g.body.token, 'het tweede account staat er');
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('0. de woordenlijsten delen geen enkel woord', () => {
  const overlap = ZWARE_ACTIES.filter(a => PIN_ACTIES.includes(a));
  assert.deepEqual(overlap, [],
    'een gedeelde naam maakt een PIN-ceremonie inwisselbaar voor een zware handeling');
  assert.ok(ZWARE_ACTIES.includes('passkey-weg'),
    'zonder deze staat de ratel van bovenaf open');
});

test('1. de ratel staat open zolang er geen passkey is', async () => {
  const r = await api('/api/techniek/toegang', { email: gast, actie: 'geef' }, tech);
  assert.equal(r.status, 200,
    'een installatie zonder passkey moet zichzelf kunnen inrichten: ' + JSON.stringify(r.body).slice(0, 160));
  // meteen weer terugdraaien, zodat de volgende toets dezelfde beginstand heeft
  await api('/api/techniek/toegang', { email: gast, actie: 'intrek' }, tech);
});

test('2. met een passkey wordt dezelfde handeling hard', async () => {
  const opties = await api('/api/webauthn/registreer/opties', {}, lid);
  assert.equal(opties.status, 200, JSON.stringify(opties.body).slice(0, 160));
  const reg = await api('/api/webauthn/registreer',
    { antwoord: sleutel.registratieAntwoord(opties.body.opties.challenge, origin),
      naam: 'Toestel van de eigenaar' }, lid);
  assert.equal(reg.status, 200, 'de passkey van de eigenaar staat er: ' + JSON.stringify(reg.body).slice(0, 160));

  const kaal = await api('/api/techniek/toegang', { email: gast, actie: 'geef' }, tech);
  assert.equal(kaal.status, 401, 'nu weigert dezelfde route zonder bewijs');
  assert.equal(kaal.body.bevestigingNodig, true,
    'het scherm hoort te weten dat het een ceremonie moet starten, niet dat het opnieuw moet proberen');
  assert.equal(kaal.body.actie, 'eigenaar-techniektoegang');
});

test('3. met een geldige, verse assertie gaat hij wel door', async () => {
  const b = await bevestig('eigenaar-techniektoegang');
  const r = await api('/api/techniek/toegang', { email: gast, actie: 'geef', ...b }, tech);
  assert.equal(r.status, 200, 'bevestigd = uitgevoerd: ' + JSON.stringify(r.body).slice(0, 160));

  /* EENMALIG. Dezelfde ceremonie nog eens is precies wat een onderschepte
     assertie zou proberen. */
  const nogmaals = await api('/api/techniek/toegang', { email: gast, actie: 'intrek', ...b }, tech);
  assert.equal(nogmaals.status, 400, 'een ceremonie gaat maar één keer op');
});

test('4. een assertie voor de ene handeling bevestigt de andere niet', async () => {
  const b = await bevestig('eigenaar-techniektoegang');
  const r = await api('/api/techniek/bewaren/veeg', { bevestig: 'WIS', ...b }, tech);
  assert.notEqual(r.status, 200,
    'een vinger voor toegangsbeheer mag geen onomkeerbare veegronde afmaken');
  assert.equal(r.status, 400);
});

test('5. een PIN-ceremonie is geen zware ceremonie', async () => {
  const r = await api('/api/techniek/bevestig/opties', { actie: 'rtg-pin-vernieuw' }, tech);
  assert.equal(r.status, 400,
    'de zware poort kent de PIN-woordenlijst niet, ook al delen ze een opslag');
});

test('6. de proefronde van de veegronde blijft vrij, de echte niet', async () => {
  const proef = await api('/api/techniek/bewaren/veeg', {}, tech);
  assert.equal(proef.status, 200, 'kijken wat er zou verdwijnen kost geen vinger');
  const echt = await api('/api/techniek/bewaren/veeg', { bevestig: 'WIS' }, tech);
  assert.equal(echt.status, 401, 'de onomkeerbare ronde wel');
  assert.equal(echt.body.actie, 'eigenaar-bewaarveeg');
});

test('7. de noodrem AAN zetten mag altijd, UIT zetten vraagt de vinger', async () => {
  const aan = await api('/api/techniek/beveiliging/auto', { aan: true }, tech);
  assert.ok(aan.status === 200 || aan.status === 503,
    'strenger maken mag nooit stuklopen op een ontbrekend toestel');
  const uit = await api('/api/techniek/beveiliging/auto', { aan: false }, tech);
  if (uit.status !== 503) {
    assert.equal(uit.status, 401, 'de rem uitzetten is een zware handeling');
    assert.equal(uit.body.actie, 'eigenaar-noodrem-uit');
  }
});

test('8. een passkey weghalen is zelf zwaar', async () => {
  const lijst = await api('/api/webauthn/lijst', {}, lid);
  const id = (lijst.body.sleutels || [])[0] && lijst.body.sleutels[0].id;
  assert.ok(id, 'er staat een passkey om te proberen weg te halen');
  const kaal = await api('/api/webauthn/weg', { id }, lid);
  assert.equal(kaal.status, 401,
    'anders haalt een gestolen sessie eerst de sleutels weg en is de ratel open');
  assert.equal(kaal.body.actie, 'passkey-weg');
});

test('9. de eigendomsoverdracht vraagt het wachtwoord EN de passkey', async () => {
  const fout = await api('/api/techniek/eigenaar', { email: gast, wachtwoord: 'nietgoed' }, tech);
  assert.equal(fout.status, 401, 'een fout wachtwoord blijft het eerste slot');
  const geen = await api('/api/techniek/eigenaar', { email: gast, wachtwoord: 'Imran' }, tech);
  assert.equal(geen.status, 401, 'het juiste wachtwoord alleen is niet meer genoeg');
  assert.equal(geen.body.actie, 'eigenaar-overdracht');
});
