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
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { maakAuthenticator } = require('./webauthn-authenticator');
const { PIN_ACTIES, ZWARE_ACTIES } = require('../server/kern/webauthn-acties');

const OWNER = 'zwaar-eigenaar@x.nl';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zwaar-'));
let srv, base, tech, lid, gast, gastKey, gastWw, rpID, origin, sleutel;
const KANTOORCODE = 'ZWAAR-KANTOOR';

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
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_OWNER_EMAIL: OWNER, OFFICE_CODE: KANTOORCODE } });
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
  gastWw = 'geheim123';
  assert.ok(g.body.token, 'het tweede account staat er');
  gastKey = 'user-' + g.body.state.user.id;
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

/* De andere richting: een route die een zware ceremonie EIST voor een naam die
   niet in de lijst staat, kan nooit worden bevestigd -- de ceremonie weigert de
   naam. Zolang de eigenaar geen passkey heeft valt dat niet op; daarna is de
   route dicht voor precies de mens die hem mag gebruiken. Zo ging het met de
   kantooruitnodiging, de doossleutels en de incassoronde (23 september 2026).
   Deze lezing is de tweede lijn: de eerste is kern/zwaarbewijs.js, die een
   onbekende naam bij de EERSTE aanroep weigert, ook zonder passkey. */
test('0b. elke naam die een route als zware ceremonie eist, staat in de lijst', () => {
  const namen = new Set();
  const loop = (map) => {
    for (const n of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, n.name);
      if (n.isDirectory()) { if (n.name !== 'data' && n.name !== 'node_modules') loop(p); continue; }
      if (!n.name.endsWith('.js')) continue;
      const bron = fs.readFileSync(p, 'utf8');
      for (const m of bron.matchAll(/\b(?:eis|eisZwaar)\(\s*[^'()]*(?:\([^()]*\))?[^'()]*,\s*'([a-z][a-z.-]+)'/g)) namen.add(m[1]);
      // de doorgeefvorm: eigenaarZwaar(req, res, '<naam>', ...) in routes/kantoren/doossleutels.js
      for (const m of bron.matchAll(/\beigenaarZwaar\(\s*req\s*,\s*res\s*,\s*'([a-z][a-z.-]+)'/g)) namen.add(m[1]);
    }
  };
  loop(path.join(__dirname, '..', 'server'));
  assert.ok(namen.size >= 13, 'de meter vindt de zware routes (' + [...namen].join(', ') + ')');
  assert.deepEqual([...namen].filter(a => !ZWARE_ACTIES.includes(a)), [],
    'een zware route met een naam die de ceremonie niet kent');
});

test('0c. de zware poort weigert een naam die hij niet kent, ook zonder passkey', async () => {
  const zw = require('../server/kern/zwaarbewijs')({ zwaarBeveiliging: { nodig: () => false },
    appUrl: () => 'http://localhost', log: null, beveiligVan: () => null });
  const req = { body: {}, get: () => '' };
  const onbekend = await zw.eis({ id: 1 }, 'eigenaar-bestaat-niet', 's', req);
  assert.equal(onbekend.status, 500, 'een fout in de code zakt bij de eerste aanroep, niet pas met een passkey');
  const bekend = await zw.eis({ id: 1 }, 'passkey-weg', 's', req);
  assert.deepEqual(bekend, { ok: true, bewezen: false }, 'een bekende naam gaat zonder passkey op de terugval');
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

test('10. het boardroom-loket is dezelfde ceremonie achter een andere deur', async () => {
  const dicht = await api('/api/office/boardroom/bevestig/opties', { actie: 'eigenaar-boardroomtoegang' });
  assert.equal(dicht.status, 401, 'zonder sessie komt er geen challenge uit');

  const r = await api('/api/office/boardroom/bevestig/opties', { actie: 'eigenaar-boardroomtoegang' }, lid);
  assert.equal(r.status, 200, 'de eigenaar krijgt er een: ' + JSON.stringify(r.body).slice(0, 160));
  assert.ok(r.body.ceremonie, 'met een ceremoniesleutel');
  assert.equal(r.body.opties.rpId, rpID, 'gebonden aan dit domein en niet aan een kop uit het verzoek');

  const pin = await api('/api/office/boardroom/bevestig/opties', { actie: 'rtg-pin-vernieuw' }, lid);
  assert.equal(pin.status, 400, 'ook hier kent de zware poort de PIN-woordenlijst niet');
});

test('9. de eigendomsoverdracht vraagt het wachtwoord EN de passkey', async () => {
  const fout = await api('/api/techniek/eigenaar', { email: gast, wachtwoord: 'nietgoed' }, tech);
  assert.equal(fout.status, 401, 'een fout wachtwoord blijft het eerste slot');
  const geen = await api('/api/techniek/eigenaar', { email: gast, wachtwoord: 'Imran' }, tech);
  assert.equal(geen.status, 401, 'het juiste wachtwoord alleen is niet meer genoeg');
  assert.equal(geen.body.actie, 'eigenaar-overdracht');
});

/* ============================================================================
   DE KANTOORSLEUTELS. Tot 23 september 2026 kon iedereen die van de eigenaar de
   boardroomsleutel kreeg, via /api/office/balie/zetel zichzelf of een ander bij
   de ledendossiers zetten: de route vroeg alleen `boardroomAuth`, en alleen het
   SCHERM verborg de knop voor wie niet de eigenaar was. Intrekken van
   boardroomtoegang vroeg ook geen vinger. Deze toetsen houden de drie grendels
   vast: alleen de eigenaar, een verse passkey, en meteen weg na intrekken.
   ========================================================================== */

/* Een zware ceremonie achter de BOARDROOMdeur. De ceremonie is gebonden aan de
   sessie die hem vraagt, dus hij komt van dezelfde (leden)sessie die daarna de
   handeling doet -- niet van de technische pagina. */
async function bevestigBoard(actie) {
  const o = await api('/api/office/boardroom/bevestig/opties', { actie }, lid);
  assert.equal(o.status, 200, 'boardroomceremonie voor ' + actie + ': ' + JSON.stringify(o.body).slice(0, 160));
  return { ceremonie: o.body.ceremonie,
    antwoord: sleutel.loginAntwoord(o.body.opties.challenge, origin, ++teller) };
}

/* Het tweede account opent de kantoordeur op zijn EIGEN naam: de kantoorrol een
   keer koppelen met een uitnodiging van de eigenaar, dan een kantoorsessie munten die zijn sleutel draagt. */
async function kantoorsessieVanGast() {
  const l = await api('/api/auth/login', { login: gast, password: gastWw, pasApp: 'rtg' });
  assert.ok(l.body.token, 'het tweede account logt in: ' + JSON.stringify(l.body).slice(0, 160));
  const k = await api('/api/account/koppel', await kantoorKoppelBody(base, l.body.token, null,
    { eigenaar: lid, bevestig: () => bevestigBoard('eigenaar-kantooruitnodiging') }), l.body.token);
  assert.equal(k.status, 200, 'koppelen met de kantoorcode: ' + JSON.stringify(k.body).slice(0, 160));
  const s = await api('/api/account/start', { rol: 'kantoor' }, l.body.token);
  assert.equal(s.status, 200, 'de kantoorsessie op naam: ' + JSON.stringify(s.body).slice(0, 160));
  return s.body.token;
}

test('11. een baliezetel geven of intrekken vraagt de passkey van de eigenaar', async () => {
  const kaal = await api('/api/office/balie/zetel', { key: gastKey }, lid);
  assert.equal(kaal.status, 401, 'zonder bewijs geen zetel: ' + JSON.stringify(kaal.body).slice(0, 160));
  assert.equal(kaal.body.bevestigingNodig, true);
  assert.equal(kaal.body.actie, 'eigenaar-baliezetel');

  const geef = await api('/api/office/balie/zetel', { key: gastKey, ...(await bevestigBoard('eigenaar-baliezetel')) }, lid);
  assert.equal(geef.status, 200, 'met de vinger wel: ' + JSON.stringify(geef.body).slice(0, 160));
  assert.ok((geef.body.zetels || []).some(z => z.key === gastKey), 'de zetel staat erop');

  const wegKaal = await api('/api/office/balie/zetel', { key: gastKey, weg: true }, lid);
  assert.equal(wegKaal.status, 401, 'intrekken is even zwaar als geven');
  const weg = await api('/api/office/balie/zetel', { key: gastKey, weg: true, ...(await bevestigBoard('eigenaar-baliezetel')) }, lid);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  assert.ok(!(weg.body.zetels || []).some(z => z.key === gastKey), 'de zetel is weg');
});

test('12. een boardroomlid dat niet de eigenaar is, deelt GEEN baliezetels uit', async () => {
  const gastLogin = await api('/api/auth/login', { login: gast, password: gastWw, pasApp: 'rtg' });
  const codenaam = gastLogin.body.state && gastLogin.body.state.user && gastLogin.body.state.user.codename;
  assert.ok(codenaam, 'het tweede account heeft een codenaam: ' + JSON.stringify(gastLogin.body).slice(0, 200));
  // de gids leert een codenaam bij het eerste ingelogde verzoek (kern/gids.js, dirTouch)
  await api('/api/auth/me', {}, gastLogin.body.token);
  const geef = await api('/api/office/boardroom/toegang/geef',
    { codenaam, ...(await bevestigBoard('eigenaar-boardroomtoegang')) }, lid);
  assert.equal(geef.status, 200, 'de eigenaar geeft het tweede account de boardroom: ' + JSON.stringify(geef.body).slice(0, 160));

  const kantoor = await kantoorsessieVanGast();
  const binnen = await api('/api/office/boardroom', {}, kantoor);
  assert.equal(binnen.status, 200, 'het boardroomlid komt binnen');
  assert.equal(binnen.body.baas, false, 'maar is niet de eigenaar');

  /* DE AANVAL: zichzelf bij de ledendossiers zetten. Dit gaf 200 tot deze fix. */
  const zelf = await api('/api/office/balie/zetel', { key: gastKey }, kantoor);
  assert.equal(zelf.status, 403, 'een boardroomlid zet zichzelf niet aan de balie: ' + JSON.stringify(zelf.body).slice(0, 160));
  const ander = await api('/api/office/balie/zetel', { key: gastKey, weg: true }, kantoor);
  assert.equal(ander.status, 403, 'en trekt er ook niemand weg');

  /* Intrekken van de boardroom: zwaar, en daarna METEEN dicht. */
  const wegKaal = await api('/api/office/boardroom/toegang/weg', { codenaam }, lid);
  assert.equal(wegKaal.status, 401, 'boardroomtoegang intrekken vraagt de vinger');
  assert.equal(wegKaal.body.actie, 'eigenaar-boardroomtoegang-weg');
  const weg = await api('/api/office/boardroom/toegang/weg',
    { codenaam, ...(await bevestigBoard('eigenaar-boardroomtoegang-weg')) }, lid);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 160));
  /* En sinds AUTHORITY.md fase 3 niet alleen de kamer maar ook de deur: de open
     kantoorsessie zelf is ingetrokken (test/kantoorintrekking.test.js). */
  const nu = await api('/api/office/boardroom', {}, kantoor);
  assert.equal(nu.status, 401, 'dezelfde, nog open sessie is direct dicht');
  assert.equal(weg.body.sessiesGesloten, 1, 'het antwoord zegt hoeveel sessies er dichtgingen');
});

