/* RTG Vonk: dating op codenaam met de Salon-veiligheidslat. 18+ met een
   geverifieerd paspoort, een eindige dagselectie die wederzijds bij de
   wensen past, wederzijdse like = match + chatlijn + automatisch een tafel
   rond het geografische midden, EUR 10 p.p. vooraf (EUR 5 RTG, EUR 5 zaak),
   en blokkeren + melden met backoffice-opvolging. Draai los:
   node --experimental-sqlite --test test/vonk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vonk-'));
let srv, base, office, A, B;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function nieuwLid(verifieer = true) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Vonklid ' + seq, email: 'v' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const token = reg.body.token;
  let st = await api('/api/state', {}, token);
  let codename = st.body.state.user.codename;
  if (verifieer) {
    await api('/api/verify/upload', { image: PNG }, token);
    await api('/api/verify/selfie', { image: PNG }, token);
    const pend = await api('/api/office/verifications', {}, office);
    const mij = (pend.body.pending || []).find(p => p.codename === codename);
    await api('/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true, geslacht: 'v' }, office);
    // bij goedkeuring kan de kluis een nieuwe (passende) codenaam uitgeven
    st = await api('/api/state', {}, token);
    codename = st.body.state.user.codename;
  }
  return { token, codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  A = await nieuwLid(); B = await nieuwLid();
  assert.ok(office && A.token && B.token, 'backoffice en twee geverifieerde leden');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de poort: zonder geverifieerd paspoort geen Vonk; met wel', async () => {
  const los = await nieuwLid(false);
  const dicht = await api('/api/vonk/profiel', { over: 'hoi' }, los.token);
  assert.equal(dicht.status, 403, 'zonder KYC blijft de deur dicht');
  const open = await api('/api/vonk/profiel', { over: 'Zeezeiler, altijd in voor sushi.', stad: 'Sant Antoni',
    lat: 38.98, lng: 1.30, leeftijdMin: 25, leeftijdMax: 60, maxKm: 100, interesses: ['zeilen', 'sushi'] }, A.token);
  assert.equal(open.status, 200);
  assert.equal(open.body.profiel.stad, 'Sant Antoni', 'alleen de stad, nooit een adres');
});

test('2. de dagselectie is wederzijds passend en eindig', async () => {
  await api('/api/vonk/profiel', { over: 'Jazz en de zee.', stad: 'Cala Jondal', lat: 38.88, lng: 1.37,
    leeftijdMin: 25, leeftijdMax: 60, maxKm: 100, interesses: ['sushi', 'jazz'] }, B.token);
  const s = await api('/api/vonk/selectie', {}, A.token);
  assert.equal(s.status, 200);
  assert.ok(s.body.mensen.length <= 6, 'een eindige dagselectie, geen oneindige stroom');
  // Vonk toont gids-codenamen (nooit echte namen); de test praat dus op die naam
  const b = s.body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  assert.ok(b, 'B staat in de selectie van A (wederzijds passend)');
  B.vonkNaam = b.codenaam;
  assert.deepEqual(b.gemeen, ['sushi'], 'gedeelde interesses zichtbaar');
  assert.ok(!('geslacht' in b), 'wensen van de ander blijven prive');
});

test('3. wederzijdse like = match + automatisch een tafel rond het midden', async () => {
  const l1 = await api('/api/vonk/like', { codenaam: B.vonkNaam }, A.token);
  assert.equal(l1.status, 200, 'like op de getoonde codenaam werkt');
  assert.equal(l1.body.match, false, 'een kant is nog geen match');
  const sB = await api('/api/vonk/selectie', {}, B.token);
  const aInB = sB.body.mensen.find(m => (m.gemeen || []).includes('sushi'));
  assert.ok(aInB, 'A staat in de selectie van B');
  const l2 = await api('/api/vonk/like', { codenaam: aInB.codenaam }, B.token);
  assert.equal(l2.body.match, true, 'wederzijds: een vonk');
  assert.ok(l2.body.tafel && l2.body.tafel.supplierName, 'er staat automatisch een tafel klaar');
  // de chatlijn is open (en alleen voor de twee zelf)
  const c = await api('/api/vonk/bericht', { id: l2.body.id, tekst: 'Zin in!' }, A.token);
  assert.equal(c.status, 200);
  const derde = await nieuwLid();
  const inbreker = await api('/api/vonk/bericht', { id: l2.body.id, tekst: 'hoi' }, derde.token);
  assert.equal(inbreker.status, 404, 'een derde komt de chat niet in');
});

test('4. beide betalen EUR 10 vooraf; dan pas staat de reservering vast', async () => {
  const mijnA = await api('/api/vonk/mijn', {}, A.token);
  const m = mijnA.body.matches[0];
  assert.equal(m.status, 'wacht-op-betaling');
  await api('/api/pay/oplaad', { centen: 2000 }, A.token);
  await api('/api/pay/oplaad', { centen: 2000 }, B.token);
  const b1 = await api('/api/vonk/betaal', { id: m.id }, A.token);
  assert.equal(b1.status, 200);
  assert.notEqual(b1.body.status2, 'bevestigd', 'een kant betaald is nog niet vast');
  const b2 = await api('/api/vonk/betaal', { id: m.id }, B.token);
  assert.equal(b2.body.status2, 'bevestigd', 'allebei betaald: de date staat');
  const na = await api('/api/vonk/mijn', {}, A.token);
  assert.equal(na.body.matches[0].status, 'bevestigd');
});

test('5. blokkeren en melden: Salon-niveau opvolging bij de backoffice', async () => {
  const blok = await api('/api/vonk/blokkeer', { codenaam: B.vonkNaam, meld: 'ongepast bericht' }, A.token);
  assert.equal(blok.status, 200);
  const s = await api('/api/vonk/selectie', {}, A.token);
  assert.ok(!s.body.mensen.some(m => m.codenaam === B.vonkNaam), 'geblokkeerd = nooit meer in de selectie');
  const meldingen = await api('/api/office/vonk/meldingen', {}, office);
  assert.ok(meldingen.body.meldingen.some(x => x.over === B.vonkNaam && x.reden === 'ongepast bericht'), 'de melding ligt bij kantoor');
  // en een gast komt er sowieso niet in
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/vonk/selectie', {}, gast)).status, 403, 'de gratis app heeft geen Vonk');
});

/* ---- DE VOORKEURSTAAL (kern/vonk/wensen.js, ONTMOETEN.md fase 1) ----
   Verplicht / sterke voorkeur / leuk meegenomen, met wat een lid van een ander
   vraagt gescheiden van wat het over zichzelf toont. */

/* Elke toets krijgt zijn EIGEN uithoek. De dagselectie is met opzet eindig (zes),
   en de pool groeit met elk toetslid; zonder eigen plek zakt de kandidaat waar het
   om gaat uit beeld en meet de toets iets anders dan hij beweert. Tien graden
   uit elkaar is ruim duizend kilometer, en maxKm staat op 50 -- de leden van de
   ene toets zien die van de andere dus in geen van beide richtingen. */
let plekTeller = 0;
const nieuwePlek = () => ({ lat: -60 + (plekTeller++ * 10), lng: 30, maxKm: 50 });

async function lidMetProfiel(extra, plek) {
  const l = await nieuwLid();
  const r = await api('/api/vonk/profiel', Object.assign({
    over: 'Toetslid', stad: 'Eivissa', leeftijdMin: 18, leeftijdMax: 99
  }, plek || nieuwePlek(), extra || {}), l.token);
  assert.equal(r.status, 200, 'profiel bewaard');
  l.codenaam = r.body.profiel.codenaam;
  return l;
}
const selectieVan = async t => (await api('/api/vonk/selectie', {}, t)).body;
const zieIn = (s, naam) => (s.mensen || []).find(m => m.codenaam === naam);

test('6. een verplichte eis haalt een uitgesproken tegenpool weg, maar niet wie niets zei', async () => {
  const hier = nieuwePlek();
  const tegen = await lidMetProfiel({ kenmerken: { kinderen: 'wilNiet' } }, hier);
  const stil = await lidMetProfiel({}, hier);                 // heeft er niets over gezegd
  const ik = await lidMetProfiel({
    kenmerken: { kinderen: 'wil' },
    wensen: { kinderen: { in: ['wil', 'heeftWilMeer'], gewicht: 'verplicht' } }
  }, hier);
  const s = await selectieVan(ik.token);
  assert.ok(!zieIn(s, tegen.codenaam), 'wie stellig het tegenovergestelde wil, valt weg');
  const z = zieIn(s, stil.codenaam);
  assert.ok(z, 'wie er niets over zei blijft staan; een leeg veld is geen tegenstelling');
  assert.ok((z.waarom.open || []).some(t => /kinderen.*niet ingevuld/.test(t)),
    'en het staat als open punt bij de reden');
});

test('7. de harde eis werkt wederzijds: ook de eis van de ander filtert', async () => {
  const hier = nieuwePlek();
  const streng = await lidMetProfiel({
    kenmerken: { roken: 'nee' },
    wensen: { roken: { in: ['nee'], gewicht: 'verplicht' } }
  }, hier);
  const roker = await lidMetProfiel({ kenmerken: { roken: 'ja' } }, hier);
  assert.ok(!zieIn(await selectieVan(streng.token), roker.codenaam), 'de roker valt weg bij wie het eist');
  assert.ok(!zieIn(await selectieVan(roker.token), streng.codenaam),
    'en andersom net zo goed -- de eis van de ander telt ook zonder dat u hem heeft');
});

test('8. wat u van een ander vraagt, ziet niemand', async () => {
  const hier = nieuwePlek();
  const geheim = await lidMetProfiel({
    kenmerken: { relatievorm: 'serieus' },
    wensen: { relatievorm: { in: ['serieus'], gewicht: 'sterk' } }
  }, hier);
  const ander = await lidMetProfiel({ kenmerken: { relatievorm: 'serieus' } }, hier);
  const kaart = zieIn(await selectieVan(ander.token), geheim.codenaam);
  assert.ok(kaart, 'de kandidaat staat er');
  assert.ok(!('wensen' in kaart), 'zijn eisen staan er niet bij');
  assert.ok(!('zicht' in kaart), 'en zijn zichtbaarheidskeuzes ook niet');
  // maar de eigenaar krijgt ze wel terug
  const eigen = (await selectieVan(geheim.token)).profiel;
  assert.equal(eigen.wensen.relatievorm.gewicht, 'sterk', 'de eigenaar ziet zijn eigen eisen wel');
});

test('9. een as op "pas na een match" blijft weg uit de selectie en lekt niet via de reden', async () => {
  const hier = nieuwePlek();
  const dicht = await lidMetProfiel({
    kenmerken: { geloof: 'islam', relatievorm: 'serieus' },
    zicht: { geloof: 'match', relatievorm: 'kandidaten' }
  }, hier);
  const kijker = await lidMetProfiel({
    kenmerken: { geloof: 'islam' },
    wensen: { geloof: { in: ['islam'], gewicht: 'sterk' } }
  }, hier);
  const kaart = zieIn(await selectieVan(kijker.token), dicht.codenaam);
  assert.ok(kaart, 'de kandidaat staat er');
  assert.ok(!kaart.kenmerken.geloof, 'het geloof staat niet op de kaart');
  assert.ok(kaart.kenmerken.relatievorm, 'wat wel op "iedereen" stond, staat er wel');
  const regels = (kaart.waarom.ja || []).concat(kaart.waarom.open || []).join(' | ');
  assert.ok(/geloof: komt overeen/.test(regels), 'de reden zegt DAT het overeenkomt');
  assert.ok(!/islam/i.test(regels), 'maar noemt de waarde niet');

  // na een wederzijdse like gaat hij wel open
  await api('/api/vonk/like', { codenaam: dicht.codenaam }, kijker.token);
  const s2 = await selectieVan(dicht.token);
  const terug = zieIn(s2, kijker.codenaam);
  assert.ok(terug, 'de kijker staat in de selectie van de ander');
  const l = await api('/api/vonk/like', { codenaam: kijker.codenaam }, dicht.token);
  assert.equal(l.body.match, true, 'wederzijds');
  const mijn = await api('/api/vonk/mijn', {}, kijker.token);
  const rij = mijn.body.matches.find(m => m.met === dicht.codenaam);
  assert.equal(rij.kenmerken.geloof.waarde, 'islam', 'na de match is het geloof wel zichtbaar');
});

test('10. een lege dag zegt waarom, en wijst de eisen alleen aan als die het deden', async () => {
  // niemand voldoet: iedereen in de pool is 18+, dus een eis op "onder de 18" bestaat niet.
  // We gebruiken een as: deze eist iets wat de enige passende kandidaat niet heeft.
  const eenzaam = await lidMetProfiel({ kenmerken: { geloof: 'boeddhisme' } });  // eigen uithoek
  const s = await selectieVan(eenzaam.token);
  assert.equal(s.mensen.length, 0, 'niemand in de buurt');
  assert.match(s.leeg, /Morgen kijken we weer/,
    'zonder dat een eis iemand weghaalde, wijst de melding niet naar de eisen');

  const hier = nieuwePlek();
  const kieskeurig = await lidMetProfiel({ kenmerken: { roken: 'nee' } }, hier);
  const enige = await lidMetProfiel({ kenmerken: { roken: 'ja' } }, hier);
  assert.ok(zieIn(await selectieVan(kieskeurig.token), enige.codenaam), 'eerst staat hij er nog');
  await api('/api/vonk/profiel', { wensen: { roken: { in: ['nee'], gewicht: 'verplicht' } } }, kieskeurig.token);
  const na = await selectieVan(kieskeurig.token);
  assert.ok(!zieIn(na, enige.codenaam), 'na de eis is hij weg');
});

test('11. de selectie draagt geen cijfer over een mens', async () => {
  const hier = nieuwePlek();
  const a = await lidMetProfiel({ kenmerken: { relatievorm: 'serieus' },
    wensen: { relatievorm: { in: ['serieus'], gewicht: 'verplicht' } } }, hier);
  await lidMetProfiel({ kenmerken: { relatievorm: 'serieus' } }, hier);
  const s = await selectieVan(a.token);
  assert.ok(s.mensen.length, 'er staat iemand');
  for (const m of s.mensen)
    for (const veld of ['score', 'orde', 'percentage', 'match'])
      assert.ok(!(veld in m), 'geen ' + veld + ' op een kandidaat (ONTMOETEN.md par. 4.4)');
  assert.deepEqual(s.nietGebruikt, ['politieke voorkeur', 'inkomen', 'populariteit'],
    'en het scherm kan tonen wat er NIET meeweegt');
});

/* ---- DE TAFEL IN HET MIDDEN, los van de server ----
   Dit stuk draaide lang niet: lib/geo.haversine wil twee punten {lat,lng} en
   kreeg vier losse getallen, dus hij gaf null -- en `null < Infinity` is waar,
   zodat de EERSTE zaak uit de lijst won en het berekende midden werd weggegooid.
   De integratietoets hierboven merkte dat niet, want die keek alleen of er een
   naam stond. Deze toets legt drie zaken op bekende plekken neer en eist de
   juiste, en hij heeft de oude code zien zakken. */
test('12. de tafel staat bij de zaak het dichtst bij het geografische midden', async () => {
  const { maakVonk } = require('../server/kern/vonk');
  const { haversine } = require('../server/lib/geo');
  const db = { data: { suppliers: {
    // A woont in Amsterdam, B in Parijs; het midden ligt bij Brussel/Rijsel.
    ver:    { code: 'ver',    name: 'Ver weg',  loc: { lat: 41.39, lng: 2.17, label: 'Barcelona' }, tables: [{ id: 't' }] },
    midden: { code: 'midden', name: 'Bij het midden', loc: { lat: 50.85, lng: 4.35, label: 'Brussel' }, tables: [{ id: 't' }] },
    noord:  { code: 'noord',  name: 'Noordelijk', loc: { lat: 55.68, lng: 12.57, label: 'Kopenhagen' }, tables: [{ id: 't' }] }
  } } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1990-05-05' }) };
  const api = maakVonk({
    db, save() {}, crypto: require('crypto'), schoon: (t, n) => String(t == null ? '' : t).slice(0, n),
    accounts, leeftijdVan: () => 36, codenaamVan: k => k, keyVanCodenaam: async n => ({ key: n }),
    haversine, reserveerTafel: () => ({}), pay: {}, notify() {}, sseToCustomer() {}, sseToOffice() {}
  });
  api.vonkProfielZet('user-1', { stad: 'Amsterdam', lat: 52.37, lng: 4.89 });
  api.vonkProfielZet('user-2', { stad: 'Parijs', lat: 48.86, lng: 2.35 });
  await api.vonkLike('user-1', 'user-2', true);
  const r = await api.vonkLike('user-2', 'user-1', true);
  assert.equal(r.match, true, 'wederzijds is een match');
  assert.equal(r.tafel.supplierCode, 'midden',
    'niet de eerste uit de lijst, maar de zaak bij het geografische midden');
  assert.ok(r.tafel.middenAfstandKm > 0 && r.tafel.middenAfstandKm < 200,
    'en de afstand tot het midden wordt echt gerekend, in kilometers');
});

test('13. een onbekende afstand is geen nabije afstand', async () => {
  const { maakVonk } = require('../server/kern/vonk');
  const { haversine } = require('../server/lib/geo');
  const db = { data: { suppliers: {} } };
  const accounts = { getUserById: () => ({ id: 1, verified: 'verified' }), getMemberState: () => ({ geboren: '1990-05-05' }) };
  const api = maakVonk({
    db, save() {}, crypto: require('crypto'), schoon: (t, n) => String(t == null ? '' : t).slice(0, n),
    accounts, leeftijdVan: () => 36, codenaamVan: k => k, keyVanCodenaam: async n => ({ key: n }),
    haversine, reserveerTafel: () => ({}), pay: {}, notify() {}, sseToCustomer() {}, sseToOffice() {}
  });
  // twee mensen ver uit elkaar, allebei met een krappe straal
  api.vonkProfielZet('user-1', { stad: 'Amsterdam', lat: 52.37, lng: 4.89, maxKm: 50 });
  api.vonkProfielZet('user-2', { stad: 'Athene', lat: 37.98, lng: 23.73, maxKm: 50 });
  assert.equal(api.vonkSelectie('user-1').mensen.length, 0, 'buiten de straal telt de straal echt');
  // en wie geen plaats opgaf, wordt niet stilzwijgend als dichtbij behandeld
  api.vonkProfielZet('user-3', { stad: 'Onbekend' });
  const zonder = api.vonkSelectie('user-3');
  assert.equal(zonder.mensen.length, 2, 'zonder plaats filtert afstand niemand weg');
});
