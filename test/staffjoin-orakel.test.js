/* ============================================================================
   AANMELDEN BIJ EEN ZAAK VERRAADT GEEN WACHTWOORD -- regressie voor N29 uit de
   V1-audit.

   DE FOUT: POST /api/supplier/staff/join toetste e-mail en wachtwoord VOOR de
   bedrijfsnaam en de kassacode. Een goed wachtwoord met een verzonnen bedrijf
   gaf 404 ("We kennen geen bedrijf met die naam"), een fout wachtwoord 401: een
   wachtwoordorakel voor elk account, zonder ooit een uitnodiging te zien. De 409
   "U bent al aangemeld" kwam op een goed wachtwoord en een bedrijfsnaam, en
   verraadde zo wie bij welke zaak op het rooster staat. Het pad stond niet in de
   inlogpauze en remde alleen per adres. De eindkeuring van ronde 5 zag het zelf.

   DE FIX (server/routes/supplier/werving/personeel-aanmelden.js, besluit van de
   eigenaar): eerst het bedrijf en een kassacode die erbij hoort, dan het account,
   dan de code voor dit lid; tot alle drie kloppen is elke weigering hetzelfde
   antwoord. Een fout wachtwoord telt in de accountemmer van /api/auth/login, en
   het pad staat in INLOG_PADEN.

   Elke toets met een eigen lid, zodat ze niet van elkaars volgorde afhangen.
   Toets 5 laat de inlogpauze springen en staat daarom als laatste. Elk verzoek
   komt van een eigen adres, zodat de rem per adres en de quarantaine van De
   Wacht niet meten wat hier niet getoetst wordt.

   Draai los: node --test test/staffjoin-orakel.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { zwaarApi } = require('./zwaarpasskey');

const NORA = 'nora@rtg.example', NORA_WW = 'werk';
const EIGENAAR = 'roellie.i@gmail.com', EIGENAAR_WW = 'Imran';
const WW = 'geheim12';
const PAUZE = /Inloggen is enkele minuten gepauzeerd/;
/* Ruim boven een gewoon antwoord en ruim onder de twee seconden van de
   accountemmer, zoals in test/inlogrem.test.js. */
const VERTRAAGD_MS = 1500;
let srv, dir, kikunoi, ponto, zaakNaam;
let volgnummer = 1;

async function api(pad, body, token) {
  const n = volgnummer++;
  const headers = { 'Content-Type': 'application/json',
    'X-Forwarded-For': '198.18.' + (n >> 8) + '.' + (n & 255) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const t = Date.now();
  const r = await fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const tekst = await r.text();
  let json = {};
  try { json = JSON.parse(tekst); } catch (e) {}
  return { status: r.status, body: json, tekst, ms: Date.now() - t };
}
const kort = (r) => r.status + ' ' + r.tekst.slice(0, 160);
const join = (bedrijf, kassacode, login, password) =>
  api('/api/supplier/staff/join', { bedrijf, kassacode, login, password });

async function managerVan(code) {
  const roster = await api('/api/supplier/roster', { code });
  const manager = roster.body.staff.find(x => x.role === 'manager');
  const ml = await api('/api/supplier/login', { code, staffId: manager.id, pin: '1234' });
  assert.ok(ml.body.token, 'de manager van ' + code + ' logt in: ' + kort(ml));
  return { token: ml.body.token, naam: roster.body.supplier.name };
}
let uitnodigingen = 0;
async function kassacode(zaak) {
  // een eigen naam per uitnodiging: dezelfde naam geeft de zaak niet twee keer uit
  const inv = await api('/api/supplier/staff/invite', { name: 'Proef ' + (++uitnodigingen) + ' Orakel', func: 'Bediening' }, zaak.token);
  assert.equal(inv.status, 200, 'uitnodiging: ' + kort(inv));
  return inv.body.invite.kassacode;
}
async function lid(email) {
  const reg = await api('/api/auth/register', { name: 'Lid ' + email.split('@')[0], email, password: WW, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie van ' + email + ': ' + kort(reg));
  return email;
}

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-joinorakel-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '' } });
  kikunoi = await managerVan('KIKUNOI');
  ponto = await managerVan('PONTO');
  zaakNaam = kikunoi.naam;
  // vooraf, want de registratie gaat dicht zodra de noodrem drie bronnen telt
  for (const e of ['eva@orakel.test', 'ruben@orakel.test', 'vera@orakel.test', 'wout@orakel.test',
    'xander@orakel.test', 'tom@orakel.test', 'pim@orakel.test', 'uit@joinorg.test']) await lid(e);
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('1. tot alle drie kloppen, geeft elke weigering hetzelfde antwoord', async () => {
  const code = await kassacode(kikunoi), anderBedrijf = await kassacode(ponto);
  const EVA = 'eva@orakel.test';
  const gevallen = [
    ['goed wachtwoord, onbekend bedrijf', await join('Bestaat Niet BV', code, EVA, WW)],
    ['fout wachtwoord, goed bedrijf en geldige code', await join(zaakNaam, code, EVA, 'fout')],
    ['goed wachtwoord, foute kassacode', await join(zaakNaam, 'RTG-VERZONNEN', EVA, WW)],
    ['goed wachtwoord, kassacode van een ander bedrijf', await join(zaakNaam, anderBedrijf, EVA, WW)],
    ['fout wachtwoord, onbekend bedrijf, foute code', await join('Bestaat Niet BV', 'X', EVA, 'fout')],
    ['onbekend account, geldige code', await join(zaakNaam, code, 'niemand@orakel.test', WW)]
  ];
  const [, eerste] = gevallen[0];
  assert.equal(eerste.status, 401, 'de gedeelde weigering is een 401: ' + kort(eerste));
  for (const [naam, r] of gevallen) {
    assert.equal(r.status + ' ' + r.tekst, eerste.status + ' ' + eerste.tekst,
      naam + ' hoort exact hetzelfde antwoord te geven als een goed wachtwoord bij een onbekend bedrijf (kreeg ' + kort(r) + ')');
  }
  /* TEGENPROEF: dezelfde code met alle drie goed geeft een echte 200. Zo is
     "alles gelijk" niet ook "alles dicht", en is de code door de weigeringen
     hierboven niet verbruikt. */
  const goed = await join(zaakNaam, code, EVA, WW);
  assert.equal(goed.status, 200, 'met alle drie goed lukt de aanmelding: ' + kort(goed));
  assert.equal(goed.body.code, 'KIKUNOI');
});

test('2. "al aangemeld" pas na een geldige kassacode EN een goed wachtwoord', async () => {
  // Nora staat in de zaaiset bij Sal de Mar op het rooster
  const vers = await kassacode(kikunoi);
  // een code die een ander lid al heeft ingewisseld: geldig voor hem, niet voor Nora
  const vanRuben = await kassacode(kikunoi);
  const ruben = await join(zaakNaam, vanRuben, 'ruben@orakel.test', WW);
  assert.equal(ruben.status, 200, 'Ruben meldt zich aan: ' + kort(ruben));

  const zonderCode = await join(zaakNaam, 'RTG-VERZONNEN', NORA, NORA_WW);
  const foutWw = await join(zaakNaam, vers, NORA, 'fout');
  const geclaimd = await join(zaakNaam, vanRuben, NORA, NORA_WW);
  for (const [naam, r] of [['goed wachtwoord zonder geldige code', zonderCode],
    ['geldige code met fout wachtwoord', foutWw], ['goed wachtwoord met de code van een ander lid', geclaimd]]) {
    assert.equal(r.status, 401, naam + ' verraadt niet dat Nora hier werkt (kreeg ' + kort(r) + ')');
    assert.doesNotMatch(r.tekst, /al aangemeld/, naam);
  }
  assert.equal(geclaimd.tekst, zonderCode.tekst, 'dezelfde weigering');

  const beide = await join(zaakNaam, vers, NORA, NORA_WW);
  assert.equal(beide.status, 409, 'met een geldige code en een goed wachtwoord mag het gezegd: ' + kort(beide));
  assert.match(beide.tekst, /al aangemeld bij dit bedrijf/);
  // en wie zijn EIGEN ingewisselde code nog eens gebruikt, hoort het ook
  const eigen = await join(zaakNaam, vanRuben, 'ruben@orakel.test', WW);
  assert.equal(eigen.status, 409, 'Ruben met zijn eigen code: ' + kort(eigen));
});

test('3. een gok op het wachtwoord telt in de accountemmer van de gewone inlog', async () => {
  const VERA = 'vera@orakel.test', WOUT = 'wout@orakel.test';
  const inlog = (login, password) => api('/api/auth/login', { login, password });
  const voor = await inlog(VERA, 'fout');
  assert.equal(voor.status, 401);
  assert.ok(voor.ms < VERTRAAGD_MS, 'nog niets aan de hand: een fout wachtwoord is snel (' + voor.ms + 'ms)');
  const code = await kassacode(kikunoi), vanXander = await kassacode(kikunoi);
  assert.equal((await join(zaakNaam, vanXander, 'xander@orakel.test', WW)).status, 200, 'Xander wisselt zijn code in');

  /* Vijfentwintig gokken met een geldige code, elk van een eigen adres: de rem
     per adres ziet er niets van, de accountemmer wel. */
  for (let i = 0; i < 25; i++) {
    const r = await join(zaakNaam, code, VERA, 'gok' + i);
    assert.equal(r.status, 401, 'gok ' + i + ': ' + kort(r));
  }
  const na = await inlog(VERA, 'fout');
  assert.equal(na.status, 401);
  assert.ok(na.ms >= VERTRAAGD_MS, 'de gokken bij de aanmelding telden mee: /api/auth/login wacht nu (' + na.ms + 'ms)');
  const ookHier = await join(zaakNaam, code, VERA, 'gok-na');
  assert.ok(ookHier.ms >= VERTRAAGD_MS, 'en de aanmelding wacht zelf ook (' + ookHier.ms + 'ms)');
  /* ONDER VUUR IS EEN GOED WACHTWOORD NIET SNELLER. Met de code van een ander
     lid valt Vera pas in stap 3 af, na een goed wachtwoord. Zou de vertraging
     alleen bij een fout wachtwoord gelden, dan verraadde het snelle antwoord
     hier dat het wachtwoord klopte. */
  const goedMaarGeclaimd = await join(zaakNaam, vanXander, VERA, WW);
  assert.equal(goedMaarGeclaimd.tekst, ookHier.tekst, 'hetzelfde antwoord als een fout wachtwoord');
  assert.ok(goedMaarGeclaimd.ms >= VERTRAAGD_MS, 'en net zo traag (' + goedMaarGeclaimd.ms + 'ms)');
  // wie alle drie heeft, wacht niet, en ruimt de emmer op zoals de gewone inlog
  const gelukt = await join(zaakNaam, code, VERA, WW);
  assert.equal(gelukt.status, 200, 'met alle drie goed lukt het: ' + kort(gelukt));
  assert.ok(gelukt.ms < VERTRAAGD_MS, 'zonder te wachten (' + gelukt.ms + 'ms)');
  const daarna = await inlog(VERA, 'fout');
  assert.ok(daarna.ms < VERTRAAGD_MS, 'de geslaagde aanmelding leegde de accountemmer (' + daarna.ms + 'ms)');

  /* TEGENPROEF: zonder geldige kassacode wordt het wachtwoord niet eens
     getoetst, dus zulke pogingen zijn geen gok en tellen niet. */
  for (let i = 0; i < 25; i++) await join(zaakNaam, 'RTG-VERZONNEN', WOUT, 'gok' + i);
  const wout = await inlog(WOUT, 'fout');
  assert.equal(wout.status, 401);
  assert.ok(wout.ms < VERTRAAGD_MS, 'pogingen zonder geldige code raakten het account niet (' + wout.ms + 'ms)');
});

test('4. een account dat zijn organisatie uit dienst meldde, koppelt zich niet', async () => {
  // de eigenaar koppelt een organisatie met een domein en haalt een SCIM-sleutel
  const eig = await api('/api/auth/login', { login: EIGENAAR, password: EIGENAAR_WW, pasApp: 'business' });
  assert.ok(eig.body.token, 'de eigenaar logt in: ' + kort(eig));
  const zw = await zwaarApi((p, b, t) => api(p, b, t), srv.base, eig.body.token);
  const sso = await zw('/api/techniek/sso', { org: 'joinorg', naam: 'Join BV', issuer: 'https://login.joinorg-idp.test',
    clientId: 'rtg-join', clientSecret: 'join-geheim', domeinen: ['joinorg.test'], actief: true }, eig.body.token);
  assert.equal(sso.status, 200, 'SSO-koppeling: ' + kort(sso));
  const sleutel = await api('/api/techniek/sso/scimsleutel', { org: 'joinorg' }, eig.body.token);
  assert.equal(sleutel.status, 200, 'SCIM-sleutel: ' + kort(sleutel));
  const scimKop = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sleutel.body.sleutel || sleutel.body.token) };
  const zoek = await fetch(srv.base + '/api/scim/v2/Users?filter=' + encodeURIComponent('userName eq "uit@joinorg.test"'), { headers: scimKop });
  const lijst = await zoek.json();
  const id = lijst.Resources && lijst.Resources[0] && lijst.Resources[0].id;
  assert.ok(id, 'de organisatie vindt haar medewerker: ' + JSON.stringify(lijst).slice(0, 200));
  const uit = await fetch(srv.base + '/api/scim/v2/Users/' + encodeURIComponent(id), { method: 'PATCH', headers: scimKop,
    body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', path: 'active', value: false }] }) });
  assert.equal(uit.status, 200, 'de organisatie meldt hem uit dienst');

  const code = await kassacode(kikunoi);
  const r = await join(zaakNaam, code, 'uit@joinorg.test', WW);
  const fout = await join(zaakNaam, 'RTG-VERZONNEN', 'uit@joinorg.test', WW);
  assert.equal(r.status + ' ' + r.tekst, fout.status + ' ' + fout.tekst,
    'uit dienst, met het goede wachtwoord en een geldige code: dezelfde weigering (kreeg ' + kort(r) + ')');
  // TEGENPROEF: de code is niet verbruikt; een actief lid wisselt hem gewoon in
  const tom = await join(zaakNaam, code, 'tom@orakel.test', WW);
  assert.equal(tom.status, 200, 'dezelfde code werkt voor een actief lid: ' + kort(tom));
});

/* De pauze laten springen zoals een echte aanval: zes bronnen, elk elf mislukte
   pogingen op een eigen naam (zie test/inlogpauze-spelling.test.js). */
async function laatPauzeSpringen() {
  for (let i = 1; i <= 6; i++) {
    for (let j = 0; j < 11; j++) {
      await fetch(srv.base + '/api/auth/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.' + i },
        body: JSON.stringify({ login: 'doel' + i + '@orakel.test', password: 'fout' + j }) });
    }
  }
  const proef = await api('/api/auth/login', { login: 'iemand@orakel.test', password: 'x' });
  assert.equal(proef.status, 503, 'de pauze hoort na zes bronnen gesprongen te zijn: ' + kort(proef));
}

test('5. de inlogpauze geldt ook voor de aanmelding (laatste toets: de pauze blijft staan)', async () => {
  const code = await kassacode(kikunoi);
  await laatPauzeSpringen();
  for (const pad of ['/api/supplier/staff/join', '/api/supplier/staff/join/']) {
    const r = await api(pad, { bedrijf: zaakNaam, kassacode: code, login: 'pim@orakel.test', password: WW });
    assert.equal(r.status, 503, pad + ' hoort tijdens de pauze dicht te zijn: ' + kort(r));
    assert.match(r.tekst, PAUZE);
  }
  // TEGENPROEF: de pauze sluit de inlog en niet de zaak; de echte status
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  assert.equal(roster.status, 200, 'een gewone zaakroute blijft open: ' + kort(roster));
});
