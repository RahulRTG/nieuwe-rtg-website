/* DEMOCRATIEOS FASE C -- de aanvalsfase (POLITIEK.md par. 18.2).

   Fase B bouwde de burgerlus; fase C probeert hem kapot te maken, tegen een
   echte server en met drie synthetische partijen (Noord, Midden, Zuid) plus een
   vierde actor zonder partij. Er is in fase C geen partijregister: de partij
   van een actor staat alleen in wat hij zelf aanlevert, en dat is precies de
   aanval -- de runtime mag er niets mee.

   DE UITSLAG IS DE TOESTAND EN NIET DE STATUSCODE. Een geweigerde aanval is pas
   geweigerd als de kwestie daarna byte voor byte gelijk is aan ervoor, gelezen
   door een neutrale waarnemer (een kantoormens die er niet bij betrokken is) en
   door de meter.

     C1  partijneutraal     GEEN_PARTIJ = NOORD = MIDDEN = ZUID, op de toestand
     C2  machtsneutraal     eigenaar, kantoor, gedeelde code, zaak, bord: geen
                            enkele rol krijgt voordeel, ook niet in combinatie
     C3  pseudoniem         geen spoor legt burger en kwestie buiten de
                            koppeling om aan elkaar, ook niet de hele opslag

   Draai los: node --test test/democratie-aanval.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody } = require('./helper');
const { PSEUDONIEM } = require('../server/lib/burgerpad');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-democratie-aanval-'));
const DOOS = 'doos-democratie-aanval-sleutel';
const lang = 'Een toelichting van ruim vijftien tekens, met een reden.';

function api(pad, body, token, kop) {
  return fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(kop || {}) },
    body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function registreer(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await api('/api/auth/register', { name: naam, email: 'aanval' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registreren lukt: ' + JSON.stringify(r.body));
  const me = await api('/api/auth/me', {}, r.body.token);
  return { token: r.body.token, key: 'user-' + me.body.user.id, codenaam: me.body.user.codename };
}
/* Een tweede kantoormens op naam, zoals het in productie gaat: de eigenaar
   nodigt uit, het lid koppelt, en start in de kantoorrol. */
async function kantoormens(naam) {
  const p = await registreer(naam);
  const koppel = await api('/api/account/koppel', await kantoorKoppelBody(srv.base, p.token), p.token);
  assert.equal(koppel.status, 200, 'koppelen: ' + JSON.stringify(koppel.body));
  const start = await api('/api/account/start', { rol: 'kantoor' }, p.token);
  assert.ok(start.body.token, 'kantoorrol: ' + JSON.stringify(start.body));
  return Object.assign(p, { kantoor: start.body.token });
}

const P = {
  inbreng: '/api/member/democratie/kwestie/inbreng', mijn: '/api/member/democratie/kwestie/mijn',
  gezien: '/api/member/democratie/kwestie/gezien', intrek: '/api/member/democratie/kwestie/intrek',
  lijst: '/api/office/democratie/kwestie/lijst', behandel: '/api/office/democratie/kwestie/behandel',
  eindstand: '/api/office/democratie/kwestie/eindstand', heropen: '/api/office/democratie/kwestie/heropen',
  meter: '/api/office/democratie/meter'
};

let srv, eigenaar, eigenaarKantoor, waarnemer, behandelaar;
test.before(async () => {
  /* RTG_STORE=json om dezelfde reden als test/vergeten.test.js: de bezem van C3
     leest wat er op SCHIJF staat, zonder een databaseschema te kennen. */
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_STORE: 'json', RTG_DOOS_SLEUTEL: DOOS, OFFICE_CODE: 'KANTOOR-AANVAL-1' } });
  eigenaar = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(eigenaar, 'de eigenaar logt in');
  eigenaarKantoor = (await api('/api/account/start', { rol: 'kantoor' }, eigenaar)).body.token;
  assert.ok(eigenaarKantoor, 'de eigenaar in de kantoorrol');
  waarnemer = await kantoormens('Waarnemer Neutraal');
  behandelaar = await kantoormens('Behandelaar Neutraal');
});
test.after(() => { stop(srv && srv.child); });

/* De toestand zoals een neutrale waarnemer hem ziet, plus de meter. */
async function toestand(id) {
  const k = (await api(P.lijst, {}, waarnemer.kantoor)).body.kwesties.find(x => x.id === id);
  const m = (await api(P.meter, {}, waarnemer.kantoor)).body;
  return JSON.stringify({ k, journaal: m.journaal, onverklaard: m.onverklaard });
}

/* Alles wat per actor MOET verschillen eruit, de rest moet gelijk zijn. */
const LABEL = /Partij (Noord|Midden|Zuid)|zonder partij/g;
function vorm(x) {
  if (Array.isArray(x)) return x.map(vorm);
  if (x && typeof x === 'object') {
    const uit = {};
    for (const k of Object.keys(x)) {
      if (['id', 'at', 'geopend', 'klaargezetOp', 'gewektOp', 'gezienOp', 'door', 'in'].includes(k)) uit[k] = x[k] == null ? null : '·';
      else uit[k] = vorm(x[k]);
    }
    return uit;
  }
  return typeof x === 'string' ? x.replace(LABEL, 'PARTIJ') : x;
}

test('C1. partijneutraal: GEEN_PARTIJ = NOORD = MIDDEN = ZUID, op de toestand en niet alleen op de code', async () => {
  const actoren = ['zonder partij', 'Partij Noord', 'Partij Midden', 'Partij Zuid'];
  const uitslag = [];
  for (const a of actoren) {
    const b = await registreer('Burger ' + a);
    const log = [];
    const r = await api(P.inbreng, { onderwerp: 'Namens ' + a + ': de bushalte aan de dijk is niet toegankelijk', gebied: 'Dijk' }, b.token);
    log.push(r.status);
    const id = r.body.kwestie.id;
    log.push((await api(P.behandel, { id, stand: 'wacht-op-bevoegde' }, behandelaar.kantoor)).status);
    log.push((await api(P.eindstand, { id, stand: 'afgewezen', bevoegdheid: 'wethouder verkeer', toelichting: lang }, behandelaar.kantoor)).status);
    log.push((await api(P.gezien, { id }, b.token)).status);
    log.push((await api(P.heropen, { id, reden: 'Nieuw feit: de halte krijgt een nieuwe dienstregeling.' }, behandelaar.kantoor)).status);
    log.push((await api(P.eindstand, { id, stand: 'samen-opgelost', toelichting: lang }, behandelaar.kantoor)).status);
    const mijn = (await api(P.mijn, {}, b.token)).body.kwesties;
    const kantoor = (await api(P.lijst, {}, waarnemer.kantoor)).body.kwesties.find(k => k.id === id);
    uitslag.push({ a, log, mijn: vorm(mijn), kantoor: vorm(kantoor) });
  }
  const [geen, ...partijen] = uitslag;
  assert.deepEqual(geen.log, [200, 200, 200, 200, 200, 200], 'de lus loopt voor de burger zonder partij');
  for (const p of partijen) {
    assert.deepEqual(p.log, geen.log, p.a + ': andere statuscodes dan zonder partij');
    assert.deepEqual(p.mijn, geen.mijn, p.a + ': de burger ziet een andere toestand dan zonder partij');
    assert.deepEqual(p.kantoor, geen.kantoor, p.a + ': het kantoor ziet een andere toestand dan zonder partij');
  }
});

test('C2. machtsneutraal: eigenaar, kantoor, gedeelde code, zaak en bord krijgen geen voordeel', async () => {
  /* DE EIGENAAR ALS BURGER is een burger: hij ziet zijn eigen kwestie en niet
     die van een ander, en brengt er een in zoals ieder ander. */
  const burger = await registreer('Burger Gewoon');
  const van = (await api(P.inbreng, { onderwerp: 'De speeltuin in het park is al maanden dicht' }, burger.token)).body.kwestie.id;
  const eig = (await api(P.inbreng, { onderwerp: 'De eigenaar brengt ook een kwestie in als burger' }, eigenaar)).body;
  assert.ok(eig.kwestie, 'de eigenaar kan inbrengen als burger: ' + JSON.stringify(eig));
  const eigId = eig.kwestie.id;
  const zijn = (await api(P.mijn, {}, eigenaar)).body.kwesties.map(k => k.id);
  assert.deepEqual(zijn, [eigId], 'de eigenaar ziet als burger alleen zijn eigen kwestie');
  assert.equal((await api(P.gezien, { id: van }, eigenaar)).status, 404, 'en kan die van een ander niet openen');
  assert.equal((await api(P.intrek, { id: van }, eigenaar)).status, 404, 'of intrekken');

  /* W2: WIE INBRACHT, BESLIST NIET -- ook de eigenaar niet, in de kantoorrol. */
  const voor = await toestand(eigId);
  for (const [pad, b] of [[P.behandel, { id: eigId }], [P.eindstand, { id: eigId, stand: 'uitgevoerd', toelichting: lang }]]) {
    const r = await api(pad, b, eigenaarKantoor);
    assert.equal(r.status, 409, pad + ': de eigenaar beslist over zijn eigen kwestie: ' + JSON.stringify(r.body));
  }
  assert.equal(await toestand(eigId), voor, 'W2: de geweigerde poging liet de kwestie niet ongemoeid');
  assert.equal((await api(P.eindstand, { id: eigId, stand: 'onhaalbaar', toelichting: lang }, behandelaar.kantoor)).status, 200,
    'een collega op naam kan hem wel afhandelen (tegenproef: de weigering is geen algemene dichte deur)');
  const heropenEigen = await api(P.heropen, { id: eigId, reden: 'Ik wil mijn eigen kwestie graag opnieuw bekeken zien.' }, eigenaarKantoor);
  assert.equal(heropenEigen.status, 409, 'ook heropenen van de eigen kwestie gaat niet');

  /* W4: WAT DE BURGER INTROK, DRAAIT HET KANTOOR NIET TERUG. */
  assert.equal((await api(P.intrek, { id: van }, burger.token)).status, 200);
  const ingetrokken = await toestand(van);
  const terug = await api(P.heropen, { id: van, reden: 'Het kantoor vindt dat deze kwestie door moet gaan.' }, behandelaar.kantoor);
  assert.equal(terug.status, 409, 'W4: het kantoor heropent een ingetrokken kwestie: ' + JSON.stringify(terug.body));
  assert.equal(await toestand(van), ingetrokken, 'W4: de geweigerde heropening liet de toestand niet ongemoeid');

  /* DE GEDEELDE CODE, EEN ZAAK EN NIEMAND: geen enkele deur, en geen spoor. */
  const lopend = (await api(P.inbreng, { onderwerp: 'Een kwestie die open blijft voor de aanvallers' }, burger.token)).body.kwestie.id;
  const stil = await toestand(lopend);
  const gedeeld = (await api('/api/office/login', { code: 'KANTOOR-AANVAL-1' })).body.token;
  const zaak = (await api('/api/supplier/login', { code: 'demo', pin: '0000' })).body.token;
  for (const [wie, tok] of [['gedeelde code', gedeeld], ['zaak', zaak], ['niemand', null]]) {
    for (const [pad, b] of [[P.behandel, { id: lopend }], [P.eindstand, { id: lopend, stand: 'uitgevoerd', toelichting: lang }],
      [P.intrek, { id: lopend }], [P.gezien, { id: lopend }]]) {
      const r = await api(pad, b, tok);
      assert.ok(r.status === 401 || r.status === 403, wie + ' op ' + pad + ' kwam binnen: ' + r.status);
    }
  }
  assert.equal(await toestand(lopend), stil, 'geen enkele geweigerde rol veranderde de kwestie');

  /* HET BORD: de eigenaar kan democratie alleen voor IEDEREEN uitzetten, nooit
     voor een persoon, plaats, pas of met een canary (C4). */
  for (const as of [{ persoon: burger.codenaam }, { plaats: 'Amsterdam' }, { land: 'NL' }, { doelgroep: 'rtg' }]) {
    const r = await api('/api/boardroom/zet', Object.assign({ id: 'democratie', aan: false }, as), eigenaar);
    assert.equal(r.status, 409, 'het bord zet democratie gericht dicht via ' + Object.keys(as)[0] + ': ' + JSON.stringify(r.body));
  }
  assert.equal((await api(P.inbreng, { onderwerp: 'Na de gerichte pogingen kan deze burger nog steeds spreken' }, burger.token)).status, 200);
  assert.equal((await api('/api/boardroom/zet', { id: 'democratie', aan: false }, eigenaar)).status, 200, 'de globale noodstop bestaat');
  const dicht = await api(P.inbreng, { onderwerp: 'Tijdens de noodstop spreekt niemand, ook de eigenaar niet' }, eigenaar);
  assert.equal(dicht.status, 503, 'de noodstop geldt voor iedereen, ook voor de eigenaar');
  assert.equal((await api(P.inbreng, { onderwerp: 'Tijdens de noodstop spreekt niemand, ook deze burger niet' }, burger.token)).status, 503);
  assert.equal((await api('/api/boardroom/zet', { id: 'democratie', aan: true }, eigenaar)).status, 200);
  assert.equal((await api(P.mijn, {}, burger.token)).status, 200, 'na de noodstop is alles terug');
});

test('C3. pseudoniem: geen spoor, geen kantoorscherm en geen kloon legt burger en kwestie aan elkaar', async () => {
  const b = await registreer('Burger Pseudoniem');
  const id = (await api(P.inbreng, { onderwerp: 'Het riool in de Kerkstraat loopt bij elke bui over' }, b.token)).body.kwestie.id;
  assert.equal((await api(P.eindstand, { id, stand: 'uitgevoerd', toelichting: lang }, behandelaar.kantoor)).status, 200);
  assert.equal((await api(P.gezien, { id }, b.token)).status, 200);

  /* Het handelingsspoor, zoals het kantoor het leest. */
  const h = (await api('/api/office/handelingen', { max: 1000 }, eigenaarKantoor)).body;
  const burgerRegels = (h.regels || []).filter(r => r.pad && r.pad.startsWith('/api/member/democratie/'));
  assert.ok(burgerRegels.length >= 2, 'de burgerhandelingen staan WEL in het spoor (geen spoor is niet de afspraak)');
  for (const r of burgerRegels) {
    assert.equal(r.wie, PSEUDONIEM, 'een burgerregel draagt een sleutel: ' + JSON.stringify(r));
    assert.equal(r.afdruk, '', 'een burgerregel draagt een na te rekenen afdruk: ' + JSON.stringify(r));
    assert.match(r.at, /T00:00:00\.000Z$/, 'een burgerregel draagt meer dan de dag: ' + r.at);
  }
  assert.ok(!(h.regels || []).some(r => r.wie === b.key && /democratie/.test(r.pad)), 'de sleutel staat bij een democratiepad');
  assert.ok((h.regels || []).some(r => r.pad === P.eindstand && r.wie !== PSEUDONIEM),
    'wie namens het kantoor beslist, blijft herleidbaar (tegenproef: pseudoniem geldt alleen de burger)');
  assert.ok(h.keten && h.keten.ok !== false, 'de keten klopt nog');

  /* Het API-spoor. */
  const a = (await api('/api/command/apispoor', { n: 1000 }, eigenaarKantoor)).body;
  const apiBurger = (a.regels || []).filter(r => /\/api\/member\/democratie\//.test(r.actie || ''));
  assert.ok(apiBurger.length >= 2, 'de burgerhandelingen staan WEL in het API-spoor');
  for (const r of apiBurger) {
    assert.equal(r.actor, PSEUDONIEM, 'het API-spoor draagt een sleutel bij een burgerpad: ' + JSON.stringify(r));
    assert.match(r.at, /T00:00:00\.000Z$/, 'het API-spoor draagt meer dan de dag: ' + r.at);
  }

  /* De kloon naar een zaakdoos draagt geen DemocratieOS. */
  const kloon = await fetch(srv.base + '/api/doos/kloon', { headers: { 'x-doos-sleutel': DOOS } }).then(r => r.json());
  assert.ok(kloon.data && typeof kloon.data === 'object', 'de kloon werkt nog (tegenproef)');
  for (const tak of ['democratieKwesties', 'democratieJournaal', 'democratieInbrengers']) {
    assert.ok(!(tak in kloon.data), tak + ' gaat mee in de kloon naar een zaakdoos');
  }

  /* DE HELE OPSLAG, OP SCHIJF: de sleutel van de burger staat nergens samen met
     zijn kwestie of zijn inbrengersnummer, behalve in de koppeling zelf. */
  const bestand = path.join(TMP, 'db.json');
  let data = null;
  for (let i = 0; i < 40; i++) {
    try { data = JSON.parse(fs.readFileSync(bestand, 'utf8')); } catch (e) { data = null; }
    if (data && data.democratieKwesties && data.democratieKwesties[id]) break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.ok(data && data.democratieKwesties && data.democratieKwesties[id], 'de kwestie staat op schijf');
  const ref = data.democratieKwesties[id].inbrenger;
  const treffers = [];
  (function loop(x, pad) {
    if (Array.isArray(x)) return x.forEach((v, i) => loop(v, pad + '[' + i + ']'));
    if (!x || typeof x !== 'object') return;
    const s = JSON.stringify(x);
    const eigen = Object.values(x).some(v => typeof v !== 'object' && String(v) === b.key);
    if (eigen && (s.includes(id) || s.includes(ref))) treffers.push(pad);
    for (const k of Object.keys(x)) loop(x[k], pad + '.' + k);
  })(Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'democratieInbrengers')), 'db');
  assert.deepEqual(treffers, [], 'sleutel en kwestie staan samen in: ' + treffers.join(', '));
  assert.equal(data.democratieInbrengers[ref].sleutel, b.key, 'de koppeling zelf bestaat (tegenproef: de zoeker kan vinden)');
});
