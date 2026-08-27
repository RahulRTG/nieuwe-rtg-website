/* WAT KWAM ER BINNEN -- het gereedschap dat hoort bij "de particulier is zelf
   verantwoordelijk".

   Die positie is een besluit van de eigenaar, en hij heeft een tweede helft: als
   RTG zegt "wij geven alleen de tools", dan moeten die tools er ook zijn. Tot
   kern/pay/inkomsten.js bestond, kon een lid dertig grootboekregels zien en zijn
   saldo -- daar valt geen aangifte mee te doen.

   Wat hier vooral bewezen moet worden is wat het overzicht NIET meetelt. Een
   overzicht dat zich groter voordoet dan het is, laat iemand een verkeerde
   aangifte doen, en dat is erger dan geen overzicht.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de oplaad-uitsluiting eruit
     -> "eigen geld erop zetten is geen inkomen" ZAKT (RAAK)
   WAT HIER NIET GETOETST IS, en dat hoort erbij te staan: de uitsluiting van
   boekingen TUSSEN EIGEN POSITIES (van een budget naar de wallet is geen
   inkomst). Die regel staat in de code en is de spiegel van `besteedDoor` in
   ./poort.js, maar een lid kan langs geen enkele route een tweede positie maken,
   dus er is hier geen manier om hem te laten bewegen. Een mutatie die hem
   weghaalt, zakt dus NIET -- dat is gemeten en niet aangenomen. Zodra
   budgetten een ledenroute krijgen, hoort daar een toets bij.
   - het blok `nietInbegrepen` leeggemaakt
     -> "het overzicht zegt wat er NIET in zit" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/inkomsten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, koper, verkoper, verkoperNaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ink-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})), tekst: null }));
}
function csv(pad, body, token) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, tekst: await r.text(),
      type: r.headers.get('content-type'), naam: r.headers.get('content-disposition') }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'ik' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const codenaamVan = async (t) => ((await api('/api/state', {}, t)).body.state || {}).user.codename;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  koper = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  verkoper = await lid('Verkoper');
  verkoperNaam = await codenaamVan(verkoper);
  // drie echte ontvangsten
  for (const c of [1250, 900, 500]) {
    const r = await api('/api/pay/stuur', { aan: verkoperNaam, centen: c, oms: 'Voor het werk', idem: 'ink-' + c }, koper);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 150));
  }
});
test.after(() => stop(srv));

test('het overzicht telt wat er binnenkwam, met aantallen per soort', async () => {
  const r = await api('/api/pay/inkomsten', {}, verkoper);
  assert.equal(r.status, 200);
  /* HET JAAR APART CONTROLEREN, en niet alleen de bedragen. Deze toets slaagde
     eerst met een KAPOT jaartal ("1787"): RTG Pay gebruikt de huisklok en die
     geeft milliseconden, geen ISO-string, dus `String(at).slice(0, 4)` sneed er
     de eerste vier cijfers van het tijdstempel uit. Alle rijen kregen datzelfde
     verkeerde jaar, dus ze matchten -- en de toets zag niets. */
  assert.equal(r.body.jaar, String(new Date().getUTCFullYear()),
    'het jaar is het huidige jaar en niet de eerste vier cijfers van een tijdstempel');
  assert.match(r.body.regels[0].at, /^\d{4}-\d{2}-\d{2}T/, 'en elke regel draagt een echte datum');
  assert.equal(r.body.aantal, 3);
  assert.equal(r.body.totaalCenten, 2650);
  const p2p = (r.body.perSoort || []).find(s => s.soort === 'p2p');
  assert.ok(p2p, 'de soort staat erbij');
  assert.equal(p2p.aantal, 3, 'met het AANTAL, niet alleen het bedrag');
  assert.match(p2p.naam, /lid/i, 'in gewone woorden en niet als code: ' + p2p.naam);
});

test('eigen geld op je wallet zetten is GEEN inkomen', async () => {
  /* MET HET GEVERIFIEERDE ACCOUNT, en dat is geen detail. Deze toets stond eerst
     op de verse verkoper en accepteerde status 200, 402 OF 403 -- en RTG Pay
     weigert een vers account met 403 (paspoortpoort), dus er werd nooit iets
     opgeladen en de toets bewees niets. Een mutatie die de oplaad-uitsluiting
     weghaalde, liet hem gewoon slagen. Nu moet het opladen ECHT lukken. */
  const voor = (await api('/api/pay/inkomsten', {}, koper)).body;
  const op = await api('/api/pay/oplaad', { centen: 5000, idem: 'ink-oplaad' }, koper);
  assert.equal(op.status, 200, 'het opladen lukt echt: ' + JSON.stringify(op.body).slice(0, 140));
  const saldo = (await api('/api/pay/overzicht', {}, koper)).body.saldo;
  assert.ok(saldo >= 5000, 'en het geld staat er (' + saldo + ')');

  const na = (await api('/api/pay/inkomsten', {}, koper)).body;
  assert.equal(na.totaalCenten, voor.totaalCenten,
    'wie zijn eigen storting als omzet opgeeft, doet een verkeerde aangifte');
  assert.equal(na.aantal, voor.aantal, 'en het telt ook niet als transactie mee');
});

test('het overzicht zegt met zoveel woorden wat er NIET in zit', async () => {
  const r = (await api('/api/pay/inkomsten', {}, verkoper)).body;
  assert.ok(Array.isArray(r.nietInbegrepen) && r.nietInbegrepen.length >= 3,
    'er staat een blok met wat er buiten valt');
  const alles = r.nietInbegrepen.join(' ');
  assert.match(alles, /contant|bankoverschrijving|betaalprovider/i, 'geld buiten RTG Pay om');
  assert.match(alles, /wallet|zelf/i, 'eigen stortingen');
  assert.match(alles, /gekost|overgehouden/i, 'dat dit omzet is en geen winst');
  assert.match(r.let, /geen belastingaangifte en geen advies/i,
    'en dat dit geen aangifte en geen advies is');
});

test('een ander jaar is leeg, en zegt dat gewoon', async () => {
  const r = (await api('/api/pay/inkomsten', { jaar: '2019' }, verkoper)).body;
  assert.equal(r.jaar, '2019');
  assert.equal(r.aantal, 0);
  assert.equal(r.totaalCenten, 0);
  assert.ok(r.nietInbegrepen.length, 'de grenzen staan er ook bij een leeg jaar');
});

test('de uitdraai is een echte csv, en draagt zijn eigen grenzen mee', async () => {
  const r = await csv('/api/pay/inkomsten.csv', {}, verkoper);
  assert.equal(r.status, 200);
  assert.match(r.type || '', /text\/csv/);
  assert.match(r.naam || '', /rtg-inkomsten-\d{4}\.csv/, 'met een bestandsnaam die je terugvindt');
  assert.match(r.tekst, /datum;soort;omschrijving;van;bedrag/, 'een kop die een boekhouder herkent');
  assert.match(r.tekst, /12,50/, 'bedragen in euro met een komma, niet in centen');
  assert.match(r.tekst, /TOTAAL/);
  /* Een csv belandt los van dit scherm op een bureau. Hij moet zichzelf kunnen
     uitleggen, anders leest iemand hem als een jaaropgave. */
  assert.match(r.tekst, /geen aangifte en geen advies/i);
  assert.match(r.tekst, /Niet inbegrepen:/);
});

test('een gast komt er niet in', async () => {
  const r = await fetch(base + '/api/pay/inkomsten', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.ok(r.status === 401 || r.status === 403, 'zonder token geen inkomstenoverzicht (' + r.status + ')');
});
