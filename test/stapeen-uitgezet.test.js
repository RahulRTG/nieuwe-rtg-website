/* ============================================================================
   STAP EEN GEEFT EEN UITGEZET ACCOUNT NIETS -- regressie voor N31 uit de
   V1-audit (RTG-V1-RELEASE-READINESS-AUDIT.md, ronde 5).

   DE FOUT: twee inlogdeuren keken in stap een niet naar `actief`. De
   techniekinlog (/api/techniek/inloggen) gaf een uitgezet account (uit dienst
   gemeld door de organisatie, via SCIM) na het juiste wachtwoord gewoon een
   tech2-bewijs, of zonder tweede factor een techniektoken. En SSO
   (sso/binnenkomst.js binnen() met sso/index.js aanmelden()) draaide voor zo'n
   account de tenantbrug, logde 'sso.inlog' en logInlog('sso', true) als
   geslaagd, en gaf een overdrachtsbewijs uit. Sinds N20 telt dat bewijs niet
   meer bij het eerste gebruik, maar de inlog stond al als gelukt in het spoor
   en de groepen waren al naar de werkruimtes gebracht.

   DE FIX (besluit van de eigenaar): de techniekinlog weigert een uitgezet
   account met hetzelfde antwoord als een fout wachtwoord (geen orakel), telt
   het mee in de rem en zet de echte reden op het veiligheidsbord. SSO weigert
   in aanmelden(), dus voor de tenantbrug, voor elke log 'gelukt' en voor de
   koppeling van een subject, met de bestaande weigervorm (401, logInlog('sso',
   false)). Beide lezen accounts.isActief / uitgezet() uit
   server/accounts/sessiegrens.js, de ene opvatting sinds N20.

   Deel A is binnen() met de ECHTE aanmelden en echte accounts, zonder server,
   zodat de tenantbrug en de logs te tellen zijn, plus de opbouwgrendel van de
   techniekdeur. Deel B en C zijn de techniekdeur en de SAML-deur tegen een
   echte server, met een echte SCIM-PATCH. Alle drie zakken zonder de fix.

   Draai los: node --test test/stapeen-uitgezet.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Verse, geisoleerde datamap VOOR de modules laden (zoals sso.test.js). */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stapeen-'));
process.env.RTG_DATA_DIR = TMP;
process.env.NODE_ENV = 'test';

const accounts = require('../server/accounts');
accounts.init();
const koppelingen = require('../server/sso/koppelingen');
const sso = require('../server/sso');
sso.zorgTabel();
const binnenkomst = require('../server/sso/binnenkomst');
const scimGroepen = require('../server/scim/groepen');

const { startServer, stop, kantoorAlsPersoon } = require('./helper');
const { totpCode } = require('../server/kern/totp');
const idp = require('./saml-idp');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------------------------------------------------------------------------
   DEEL A -- binnen() met de echte aanmelden: wat er WEL en NIET gebeurt.

   De tenant is gebonden, dus bij een geslaagde aanmelding loopt de brug. De
   brug, het bewijs, de terugreis en de logregels worden geteld; de rest is
   echt (accounts, koppelingen, sso_identiteiten).
   ------------------------------------------------------------------------- */
const ORG = 'n31a';
koppelingen.zet({ org: ORG, naam: 'Uitdienst A BV', issuer: 'https://idp.n31a.test',
  clientId: 'rtg-n31a', domeinen: 'n31a.test', actief: true });

function opzet() {
  const stand = { brug: 0, bewijs: 0, gelukt: 0, mislukt: 0, redirect: 0 };
  /* Echte accounts, alleen het uitgeven van het bewijs wordt geteld. */
  const telAccounts = new Proxy(accounts, { get(doel, naam) {
    if (naam === 'issueActionToken') return (...a) => { stand.bewijs++; return doel.issueActionToken(...a); };
    return doel[naam];
  } });
  const kern = {
    db: { data: { werkruimtes: {} } },
    accounts: telAccounts,
    tenant: {
      register: { haal: () => ({ org: ORG, actief: true, werkruimtes: ['W1'] }) },
      brug: { uitClaims() { stand.brug++; return { ok: true, werkruimtes: [] }; } }
    },
    logInlog(soort, gelukt) { assert.equal(soort, 'sso'); if (gelukt) stand.gelukt++; else stand.mislukt++; }
  };
  const res = { redirect() { stand.redirect++; } };
  return { kern, res, stand };
}
const claimsVoor = (sub, email) => ({ sub, email, email_verified: true, name: 'N31 ' + sub, groups: ['Uitvoering'] });

/* De SCIM-groepen staan in een eigen tabel; die doet hier niet ter zake. */
async function zonderScimTabel(werk) {
  const oud = { groepenVan: scimGroepen.groepenVan, syncKlaar: scimGroepen.syncKlaar };
  scimGroepen.groepenVan = () => [];
  scimGroepen.syncKlaar = () => {};
  try { return await werk(); } finally { Object.assign(scimGroepen, oud); }
}

/* Wacht tot de klok een andere ISO-tijd geeft dan `iso`, zodat een nieuwe
   legVast() aantoonbaar een ANDERE laatste_inlog zou schrijven. Een toestand in
   een lus, geen vaste wachttijd. */
async function naKlokVan(iso) {
  while (new Date().toISOString() === iso) await new Promise(r => setImmediate(r));
}

test('A. SSO: een uitgezet account krijgt geen tenantbrug, geen log "gelukt", geen bewijs; weer aan en het werkt', async () => {
  await zonderScimTabel(async () => {
    const claims = claimsVoor('n31a-sub-1', 'pia@n31a.test');

    // tegenproef: actief loopt alles, en het account ontstaat hier
    const eerst = opzet();
    const u = await binnenkomst.binnen(eerst.kern, koppelingen.vind(ORG), claims, {}, eerst.res, '/', 'oidc');
    assert.deepEqual(eerst.stand, { brug: 1, bewijs: 1, gelukt: 1, mislukt: 0, redirect: 1 },
      'voorwaarde: een actief account loopt de hele weg');

    const uit = accounts.zetActief(u.id, false);
    assert.equal(uit.actief, 0, 'voorwaarde: het account staat op non-actief');
    const voor = sso.vindIdentiteit(ORG, claims.sub).laatste_inlog;
    await naKlokVan(voor);

    const daarna = opzet();
    let fout = null;
    await assert.rejects(
      () => binnenkomst.binnen(daarna.kern, koppelingen.vind(ORG), claims, {}, daarna.res, '/', 'saml'),
      e => { fout = e; return true; });
    assert.deepEqual(daarna.stand, { brug: 0, bewijs: 0, gelukt: 0, mislukt: 0, redirect: 0 },
      'een uitgezet account: geen tenantbrug, geen overdrachtsbewijs, geen terugreis en geen log "gelukt"');
    assert.equal(sso.vindIdentiteit(ORG, claims.sub).laatste_inlog, voor,
      'er staat ook geen nieuwe "laatste inlog" in de identiteitskoppeling: die inlog is er niet geweest');

    /* De bestaande weigervorm van SSO: de route vertaalt de fout naar 401 met
       een tekst die niets verklapt, en logt dan zelf logInlog('sso', false).
       Geen 503: dat zou "probeer het straks opnieuw" zeggen. */
    const antwoord = binnenkomst.foutAntwoord(fout);
    assert.equal(antwoord.status, 401);
    assert.equal(antwoord.retryAfter, null);
    assert.equal(antwoord.bericht, 'Inloggen via uw organisatie is niet gelukt.');
    assert.ok(!/actief|dienst/i.test(antwoord.bericht), 'de reden staat in het logboek en niet in het antwoord');

    // weer aan: uitzetten is geen wissen, dezelfde claims werken weer
    accounts.zetActief(u.id, true);
    const weer = opzet();
    const terug = await binnenkomst.binnen(weer.kern, koppelingen.vind(ORG), claims, {}, weer.res, '/', 'oidc');
    assert.equal(terug.id, u.id);
    assert.deepEqual(weer.stand, { brug: 1, bewijs: 1, gelukt: 1, mislukt: 0, redirect: 1 });
  });
});

test('A. SSO: een uitgezet RTG-account wordt ook niet aan een nieuw subject gekoppeld', async () => {
  await zonderScimTabel(async () => {
    /* De tweede weg in aanmelden(): er is nog geen subject, wel een account op
       dit adres. Dat koppelen is een schrijfactie op naam van iemand die uit
       dienst is gemeld, en die hoort er niet te komen. */
    const bestaand = await accounts.createUser({ email: 'kees@n31a.test', password: 'geheim12345',
      tier: 'rtg', realName: 'Kees Uitdienst' });
    accounts.zetActief(bestaand.id, false);
    const { kern, res, stand } = opzet();
    await assert.rejects(() => binnenkomst.binnen(kern, koppelingen.vind(ORG),
      claimsVoor('n31a-sub-kees', 'kees@n31a.test'), {}, res, '/', 'oidc'));
    assert.deepEqual(stand, { brug: 0, bewijs: 0, gelukt: 0, mislukt: 0, redirect: 0 });
    assert.equal(sso.vindIdentiteit(ORG, 'n31a-sub-kees'), null, 'geen koppeling tussen subject en uitgezet account');

    // tegenproef: actief wordt hetzelfde account gewoon gekoppeld
    accounts.zetActief(bestaand.id, true);
    const weer = opzet();
    const u = await binnenkomst.binnen(weer.kern, koppelingen.vind(ORG),
      claimsVoor('n31a-sub-kees', 'kees@n31a.test'), {}, weer.res, '/', 'oidc');
    assert.equal(u.id, bestaand.id);
    assert.equal(sso.vindIdentiteit(ORG, 'n31a-sub-kees').user_id, bestaand.id);
  });
});

test('A. de techniekdeur gaat niet open zonder accounts.isActief', () => {
  /* Zonder die vraag kan de deur een uitgezet account niet weigeren. Dan liever
     bij het opbouwen hard stoppen dan bij elke inlog stil of met een 500. */
  const tctx = { app: { post() {} }, accounts: {}, kern: { tweefactor: { rem: {} } } };
  assert.throws(() => require('../server/routes/techniek/inlog')(tctx), /isActief/);
  tctx.accounts.isActief = () => true;
  assert.doesNotThrow(() => require('../server/routes/techniek/inlog')(tctx), 'tegenproef: met isActief bouwt hij gewoon op');
});

/* ---------------------------------------------------------------------------
   DEEL B en C -- tegen een echte server, met SCIM als de organisatie.
   ------------------------------------------------------------------------- */
const kp = idp.sleutelpaar('n31.test');
const UITGEVER = 'https://idp.n31-org.test/meta';
const ONS_ADRES = 'https://rtg.test';
const ACS = ONS_ADRES + '/api/sso/saml/acs';
const ONS = ONS_ADRES + '/saml/metadata';
const EORG = 'n31org';
const ONJUIST = { error: 'Onjuiste inloggegevens.' };
let srv, dir, base, tech, eigenaarLid, scimKop;

async function vraag(pad, body, token, ip) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (ip) headers['X-Forwarded-For'] = ip;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function scimActief(email, waarde) {
  const zoek = await fetch(base + '/api/scim/v2/Users?filter=' + encodeURIComponent('userName eq "' + email + '"'), { headers: scimKop });
  const lijst = await zoek.json();
  const id = lijst.Resources && lijst.Resources[0] && lijst.Resources[0].id;
  assert.ok(id, 'de organisatie vindt ' + email + ': ' + JSON.stringify(lijst).slice(0, 200));
  const r = await fetch(base + '/api/scim/v2/Users/' + encodeURIComponent(id), { method: 'PATCH', headers: scimKop,
    body: JSON.stringify({ schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: waarde }] }) });
  assert.equal(r.status, 200, 'SCIM active=' + waarde);
  assert.equal((await r.json()).active, waarde);
}
async function bord() {
  const r = await fetch(base + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + tech } });
  assert.equal(r.status, 200);
  return (await r.json()).beveiliging.recent;
}

test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stapeen-e2e-'));
  srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '', RTG_OWNER_EMAIL: '', APP_URL: ONS_ADRES } });
  base = srv.base;
  const t = await vraag('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' });
  assert.ok(t.body.token, 'de eigenaar op de techniekpagina: ' + JSON.stringify(t.body).slice(0, 160));
  tech = t.body.token;
  const eig = await vraag('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  assert.ok(eig.body.token, 'de eigenaar logt in: ' + JSON.stringify(eig.body).slice(0, 160));
  eigenaarLid = eig.body.token;

  const k = await vraag('/api/techniek/sso', { org: EORG, naam: 'Uitdienst BV', issuer: 'https://idp.n31-org.test',
    clientId: 'rtg-n31', domeinen: 'n31-org.test', actief: true }, tech);
  assert.equal(k.status, 200, 'SSO-koppeling: ' + JSON.stringify(k.body).slice(0, 200));
  const s = await vraag('/api/techniek/sso/saml', { org: EORG, entityId: UITGEVER,
    ssoUrl: 'https://idp.n31-org.test/sso', certificaat: kp.cert }, tech);
  assert.equal(s.status, 200, 'SAML: ' + JSON.stringify(s.body).slice(0, 200));
  const sl = await vraag('/api/techniek/sso/scimsleutel', { org: EORG }, tech);
  assert.equal(sl.status, 200, 'SCIM-sleutel: ' + JSON.stringify(sl.body).slice(0, 200));
  scimKop = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sl.body.sleutel };
});
test.after(async () => {
  await stop(srv);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
});

test('B. techniek stap een: een uitgezet account krijgt het antwoord van een fout wachtwoord en geen token of bewijs', async () => {
  const email = 'n31-tech@n31-org.test', ww = 'geheim12';
  const reg = await vraag('/api/auth/register', { name: 'Tech Uitdienst', email, password: ww, geboortedatum: '1990-01-01' });
  assert.ok(reg.body.token, 'registratie: ' + JSON.stringify(reg.body).slice(0, 160));
  const verleen = await vraag('/api/techniek/toegang', { email }, eigenaarLid);
  assert.equal(verleen.status, 200, 'de eigenaar verleent toegang: ' + JSON.stringify(verleen.body).slice(0, 160));
  const fout = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: 'verkeerd-ww' });
  assert.equal(fout.status, 401);
  assert.deepEqual(fout.body, ONJUIST, 'voorwaarde: zo klinkt een fout wachtwoord');

  // ZONDER tweede factor: de deur geeft meteen een token
  const actief = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: ww });
  assert.equal(actief.status, 200, 'tegenproef, actief: ' + JSON.stringify(actief.body).slice(0, 160));
  assert.ok(actief.body.token);
  await scimActief(email, false);
  const uit = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: ww });
  assert.equal(uit.status, 401, 'uitgezet is dicht (kreeg ' + uit.status + ', token: ' + !!uit.body.token + ')');
  assert.deepEqual(uit.body, fout.body, 'exact het antwoord van een fout wachtwoord: geen orakel');

  /* De echte reden staat op het veiligheidsbord, op de identiteitssleutel en
     zonder de echte naam (die staat in de kluis). */
  const melding = (await bord()).find(m => m.type === 'tech-login-uitgezet');
  assert.ok(melding, 'het bord kent de echte reden');
  assert.equal(melding.ernst, 'kritiek');
  assert.match(melding.tekst, /^Account user-\d+ /);
  assert.ok(!melding.tekst.includes('Tech Uitdienst'), 'geen echte naam op het bord');

  // MET tweede factor: het bewijs uit stap een blijft weg
  await scimActief(email, true);
  const begin = await vraag('/api/mijn/tweefactor/begin', { huidig: ww }, reg.body.token);
  assert.ok(begin.body.geheim, 'tweede factor beginnen: ' + JSON.stringify(begin.body).slice(0, 160));
  const aan = await vraag('/api/mijn/tweefactor/bevestig', { code: totpCode(begin.body.geheim, Date.now(), 30) }, reg.body.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  const stap1 = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: ww });
  assert.equal(stap1.status, 200);
  assert.ok(stap1.body.bewijs && !stap1.body.token, 'tegenproef, actief met tweede factor: een bewijs');
  await scimActief(email, false);
  const zonder = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: ww });
  assert.equal(zonder.status, 401, 'uitgezet geeft geen bewijs (kreeg ' + zonder.status + ', bewijs: ' + !!zonder.body.bewijs + ')');
  assert.deepEqual(zonder.body, ONJUIST);
});

test('B. techniek stap een: een uitgezet account telt mee in de rem', async () => {
  /* Anders is het juiste wachtwoord van een uit dienst gemeld account een
     gratis orakel: elke poging kost niets. Een eigen IP, want de tiende
     poging slaat het brute-force-alarm aan. */
  const email = 'n31-tech@n31-org.test', ip = '198.51.100.31';
  const remAlarm = (lijst) => lijst.filter(m => m.type === 'brute-force' && m.tekst.includes('(tech)')).length;
  assert.equal(remAlarm(await bord()), 0, 'voorwaarde: de rem van deze deur sloeg nog niet aan');
  for (let i = 1; i <= 10; i++) {
    const r = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: 'geheim12' }, null, ip);
    assert.equal(r.status, 401, 'poging ' + i);
  }
  /* De tiende poging zette de rem van deze deur op slot, en dat is een
     brute-force-alarm op het bord (de tekst noemt de deur, "(tech)"). Dat
     alarm zet de bron in quarantaine (kern/wacht/afweer.js), dus de elfde
     poging komt niet eens meer bij de deur: 403 van het schild, en niet 401. */
  assert.equal(remAlarm(await bord()), 1, 'de rem sloeg aan: de pogingen op een uitgezet account telden');
  const dicht = await vraag('/api/techniek/inloggen', { login: email, wachtwoord: 'geheim12' }, null, ip);
  assert.equal(dicht.status, 403, 'na tien pogingen op een uitgezet account staat deze bron in quarantaine');
});

/* De SAML-heenreis en het antwoord van de provider, zoals in samlacs.test.js. */
async function heenreis() {
  const r = await fetch(base + '/api/sso/saml/start?org=' + EORG + '&terug=%2Fapps%2Fwerk.html', { redirect: 'manual' });
  assert.equal(r.status, 302, 'de heenreis stuurt door');
  return new URL(r.headers.get('location')).searchParams.get('RelayState');
}
async function samlInlog(sub, email) {
  const relay = await heenreis();
  const { xml } = idp.geldig({ id: '_a-' + Math.random().toString(16).slice(2, 10), issuer: UITGEVER, sub,
    acs: ACS, inResponseTo: relay, publiek: ONS, email, naam: 'Saml Uitdienst', groepen: ['Uitvoering'], key: kp.key });
  return fetch(base + '/api/sso/saml/acs', { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ SAMLResponse: Buffer.from(xml, 'utf8').toString('base64'), RelayState: relay }) });
}

test('C. SAML: een uitgezet account krijgt geen overdracht en geen geslaagde inlog in het spoor; weer aan en het werkt', async () => {
  const kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'een kantoormens om het inlogspoor te lezen');
  const ssoRegels = async () => {
    const r = await vraag('/api/office/securitylog', {}, kantoor);
    assert.equal(r.status, 200);
    const sso = r.body.log.filter(x => x.kanaal === 'sso' && x.wie === EORG);
    return { gelukt: sso.filter(x => x.ok).length, mislukt: sso.filter(x => !x.ok).length };
  };
  const email = 'n31-saml@n31-org.test', sub = 'n31-saml-sub';

  const eerst = await samlInlog(sub, email);
  assert.equal(eerst.status, 302, 'tegenproef: actief komt binnen');
  assert.ok(new URL(eerst.headers.get('location'), base).searchParams.get('sso'), 'met een overdrachtsbewijs');
  const na1 = await ssoRegels();
  assert.equal(na1.gelukt, 1, 'voorwaarde: de geslaagde inlog staat in het spoor');

  await scimActief(email, false);
  const uit = await samlInlog(sub, email);
  assert.equal(uit.status, 401, 'een uitgezet account komt niet binnen (kreeg ' + uit.status + ')');
  assert.equal(uit.headers.get('location'), null, 'geen terugreis, dus ook geen overdrachtsbewijs');
  assert.deepEqual(await uit.json(), { error: 'Inloggen via uw organisatie is niet gelukt.' });
  const na2 = await ssoRegels();
  assert.equal(na2.gelukt, na1.gelukt, 'geen geslaagde SSO-inlog in het spoor');
  assert.equal(na2.mislukt, na1.mislukt + 1, 'wel een mislukte: logInlog("sso", false)');

  await scimActief(email, true);
  const weer = await samlInlog(sub, email);
  assert.equal(weer.status, 302, 'weer aan: hetzelfde subject komt weer binnen');
  const bewijs = new URL(weer.headers.get('location'), base).searchParams.get('sso');
  const w = await vraag('/api/sso/wissel', { sso: bewijs });
  assert.equal(w.status, 200, 'en het overdrachtsbewijs levert een sessie');
  assert.ok(w.body.token);
});
