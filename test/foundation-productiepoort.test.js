'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const maakPoort = require('../server/middleware/foundation-productiepoort');
const { COMMIT, maakGetekendeVrijgave } = require('./foundation-vrijgave-fixture');

async function serverVoor({ productie = true, env = {}, root } = {}) {
  const geraakt = [];
  const poort = maakPoort({ productie, env, root });
  return { geraakt, poort, sluit:async () => {} };
}

async function vraag(s, pad, { methode = 'POST', body = {} } = {}) {
  const req = { method:methode, path:new URL(pad, 'http://rtg.test').pathname, body };
  const koppen = {};
  return new Promise(resolve => {
    const res = {
      statusCode:200,
      set(naam, waarde) { koppen[String(naam).toLowerCase()] = String(waarde); return res; },
      status(status) { res.statusCode = status; return res; },
      json(antwoord) { resolve({ status:res.statusCode, cache:koppen['cache-control'] || null, body:antwoord }); return res; }
    };
    s.poort(req, res, () => {
      s.geraakt.push({ methode:req.method, pad:req.path, body:req.body });
      res.status(200).json({ ok:true, pad:req.path });
    });
  });
}

const DICHT = Object.freeze([
  '/api/foundation/gezin/bericht', '/api/foundation/school/toets/start',
  '/api/foundation/les/maak', '/api/foundation/mail/stuur', '/api/foundation/markt/chat',
  '/api/rtf/leerling/paspoort', '/api/rtf/baby/boek', '/api/rtf/tiener/toetsen',
  '/api/rtf/welzijn/dagboek', '/api/rtf/leren/project-maak', '/api/rtf/spel/nieuw',
  '/api/rtf/social/dm', '/api/rtf/kantoorpakket/open', '/api/rtf/leven/kring',
  '/api/rtf/apply/chat', '/api/rtf/solliciteer', '/api/rtfos/casussen',
  '/api/rtfos/bescherming/lees', '/api/rtfos/activiteiten',
  '/api/lab2/mijn/meting', '/api/lab2/bewijs/dataset', '/api/lab2/bewoner/stem',
  '/api/lab2/publicatie/zet', '/api/les/maak',
  '/api/member/sport/ticket/koop', '/api/sport/scan',
  '/api/foundation/registratie/status'
]);

test('productie sluit iedere expliciete minderjarigen-, moderatie- en DPIA-familie vóór de handler', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  for (const pad of DICHT) {
    const r = await vraag(s, pad);
    assert.equal(r.status, maakPoort.STATUS, pad);
    assert.deepEqual(r.body, maakPoort.ANTWOORD, pad);
    assert.equal(r.cache, 'no-store', pad);
  }
  assert.deepEqual(s.geraakt, [], 'geen gesloten aanvraag bereikte een domeinhandler');
});

test('publieke catalogi, volwassen FoundationOS en voorbereidend bestuur blijven open', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  const open = [
    ['/api/foundation/health', { methode:'GET' }],
    ['/api/foundation/bespaartip', { methode:'GET' }],
    ['/api/rtfos/boom', {}],
    ['/api/rtfos/ruil/plaats', {}],
    ['/api/rtf/bieb/catalogus', {}],
    ['/api/rtf/geloof/catalogus', {}],
    ['/api/rtf/beroepen/catalogus', {}],
    ['/api/rtf/toegang', {}],
    ['/api/lab2/ethiek/privacy', {}],
    ['/api/lab2/bewoner/labs', {}],
    ['/api/lab2/publiek/apparatuur', {}]
  ];
  for (const [pad, opties] of open) {
    const r = await vraag(s, pad, opties);
    assert.equal(r.status, 200, pad);
    assert.equal(r.body.ok, true, pad);
  }
  assert.equal(s.geraakt.length, open.length);
});

test('intrekken, wissen, melden, blokkeren en terugtrekken blijven veilige uitgangen', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  const open = [
    '/api/foundation/gezin/profiel/verwijder',
    '/api/foundation/gezin/uitnodiging/intrek',
    '/api/foundation/gezin/locatie/stop',
    '/api/foundation/gezin/wissen',
    '/api/foundation/markt/verwijder',
    '/api/foundation/markt/meld',
    '/api/foundation/markt/blokkeer',
    '/api/foundation/school/personeel/toegang/intrek',
    '/api/foundation/school/machtiging/stop',
    '/api/foundation/school/incident/meld',
    '/api/foundation/school/calamiteit',
    '/api/rtf/school/weg',
    '/api/rtf/samen/weg',
    '/api/rtf/social/block',
    '/api/rtf/leven/band/verbreek',
    '/api/rtf/ontkoppel',
    '/api/rtfos/activiteit/afmelden',
    '/api/rtfos/portaal/deelnemer/intrekken',
    '/api/rtfos/bescherming/toestemming-weg',
    '/api/rtfos/ruil/meld',
    '/api/lab2/mijn/terugtrekken',
    '/api/lab2/mens/weg',
    '/api/lab2/bewoner/klacht',
    '/api/lab2/publicatie/intrekken',
    '/api/lab2/ethiek/stilleggen'
  ];
  for (const pad of open) assert.equal((await vraag(s, pad)).status, 200, pad);
  assert.equal(s.geraakt.length, open.length);
});

test('gemengde routes vertrouwen ook minderjarig=false niet als leeftijdsbewijs', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  for (const pad of ['/api/foundation/registratie/aanvragen', '/api/rtfos/activiteit/inschrijven']) {
    assert.equal((await vraag(s, pad, { body:{} })).status, 503, pad + ' zonder leeftijd');
    assert.equal((await vraag(s, pad, { body:{ minderjarig:true } })).status, 503, pad + ' minderjarig');
    assert.equal((await vraag(s, pad, { body:{ minderjarig:false } })).status, 503, pad + ' client beweert volwassen');
  }
  assert.equal(s.geraakt.length, 0, 'geen client-body omzeilt de poort');
});

test('een gedeelde mutatieroute laat alleen de beperkende richting door', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  const paren = [
    ['/api/rtf/talent/interesse', { actief:false }, { actief:true }],
    ['/api/rtf/social/goedkeuren', { akkoord:false }, { akkoord:true }],
    ['/api/rtf/social/kind/boardroom/zet', { aan:false }, { aan:true }],
    ['/api/rtfos/activiteit/status', { status:'afgelast' }, { status:'open' }]
  ];
  for (const [pad, veilig, actief] of paren) {
    assert.equal((await vraag(s, pad, { body:veilig })).status, 200, pad + ' beperken');
    assert.equal((await vraag(s, pad, { body:actief })).status, 503, pad + ' activeren');
  }
  assert.equal(s.geraakt.length, paren.length);
});

test('een env-vlag zonder extern dossier opent beschermde functies nooit', async t => {
  const ongeldig = ['', 'true', 'TRUE', '01', ' 1 '];
  for (const waarde of ongeldig) {
    const s = await serverVoor({ env:{ [maakPoort.ENV_NAAM]:waarde } });
    t.after(() => s.sluit());
    assert.equal((await vraag(s, '/api/rtf/leerling/paspoort')).status, 503, JSON.stringify(waarde));
    assert.equal(s.geraakt.length, 0);
  }
  const vrij = await serverVoor({ env:{ [maakPoort.ENV_NAAM]:'1' } });
  t.after(() => vrij.sluit());
  assert.equal((await vraag(vrij, '/api/rtf/leerling/paspoort')).status, 503);
  assert.equal(vrij.geraakt.length, 0);
});

test('alleen een PASS-dossier van exact de releasecommit opent de routepoort', async t => {
  const env = { [maakPoort.ENV_NAAM]:'1' };
  const foutRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-fout-'));
  const goedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-goed-'));
  t.after(() => fs.rmSync(foutRoot, { recursive:true, force:true }));
  t.after(() => fs.rmSync(goedRoot, { recursive:true, force:true }));
  maakGetekendeVrijgave(foutRoot, { commit:'c'.repeat(40), runtimeCommit:COMMIT });
  fs.writeFileSync(path.join(foutRoot, '.release', 'release-bewijs.json'), JSON.stringify({
    formaat:'rtg-release-bewijs-v1', bron:{ commit:COMMIT, gewijzigd:false }
  }));
  const fout = await serverVoor({ env, root:foutRoot });
  t.after(() => fout.sluit());
  assert.equal((await vraag(fout, '/api/rtf/leerling/paspoort')).status, 503, 'andere commit blijft dicht');
  assert.equal(fout.geraakt.length, 0);

  maakGetekendeVrijgave(goedRoot);
  const goed = await serverVoor({ env, root:goedRoot });
  t.after(() => goed.sluit());
  assert.equal((await vraag(goed, '/api/rtf/leerling/paspoort')).status, 200);
  assert.equal((await vraag(goed, '/api/rtf/samen/mee')).status, 200,
    'de gemigreerde 128-bit Samen-credential blijft juridisch beschermd maar is niet technisch hard gesloten');
  for (const pad of ['/api/foundation/gezin/inloggen', '/api/foundation/school/school/activeren',
    '/api/lab2/mijn', '/api/lab2/bewoner/paspoort',
    '/api/les/mee', '/api/member/sport/tickets', '/api/sport/scan',
    '/api/foundation/registratie/status', '/api/rtf/social/stream']) {
    assert.equal((await vraag(goed, pad)).status, 503,
      pad + ' blijft technisch dicht ondanks juridische vrijgave');
  }
  assert.equal((await vraag(goed, '/api/office/foundation/registratie/besluit',
    { body:{ action:'goedkeuren' } })).status, 503,
  'een besluit mag geen oude school- of portaalcredential uitgeven');
  assert.equal((await vraag(goed, '/api/office/foundation/registratie/besluit',
    { body:{ action:'afwijzen' } })).status, 200,
  'een afwijzing beperkt verwerking en blijft mogelijk');
  assert.equal((await vraag(goed, '/api/foundation/gezin/wissen')).status, 200,
    'een echte verwijderuitgang blijft mogelijk');
  assert.equal((await vraag(goed, '/api/foundation/registratie/aanvragen',
    { body:{ minderjarig:false } })).status, 503, 'clientleeftijd blijft ook na procesvrijgave onbruikbaar');
  assert.equal(goed.geraakt.length, 4);
});

test('iedere bekende onvolwassen Foundation-credential heeft een blijvende productiesluiting', () => {
  const gesloten = (methode, pad, body) =>
    maakPoort.isGemengdeRoute(methode, pad) ||
    maakPoort.isNogGeslotenCredentialroute(methode, pad, body);
  const routes = [
    'POST /api/lab2/mijn', 'POST /api/lab2/mijn/observatie',
    'POST /api/lab2/mijn/venster', 'POST /api/lab2/mijn/meting',
    'POST /api/lab2/mijn/reflectie',
    'POST /api/lab2/bewoner/paspoort', 'POST /api/lab2/bewoner/paspoort-maak',
    'POST /api/les/maak', 'POST /api/les/leraar', 'POST /api/les/volgende',
    'POST /api/les/sluit', 'POST /api/les/mee', 'POST /api/les/kijk',
    'POST /api/les/antwoord',
    'POST /api/foundation/gezin/maak', 'POST /api/foundation/gezin/inloggen',
    'POST /api/foundation/gezin/profiel/kies', 'GET /api/foundation/gezin/x/mij',
    'GET /api/foundation/gezin/x/berichten',
    'POST /api/foundation/gezin/uitnodiging/maak',
    'POST /api/foundation/gezin/uitnodigingen',
    'POST /api/foundation/gezin/uitnodiging/bekijk',
    'POST /api/foundation/gezin/uitnodiging/accepteer',
    'GET /api/rtf/social/stream',
    'POST /api/foundation/school/school/activeren',
    'POST /api/foundation/school/school/overzicht',
    'POST /api/foundation/school/personeel/status',
    'POST /api/foundation/school/personeel/uitnodig',
    'POST /api/foundation/school/personeel/uitnodiging/bekijk',
    'POST /api/foundation/school/personeel/uitnodiging/accepteer',
    'POST /api/foundation/school/personeel/inloglink',
    'POST /api/foundation/school/personeel/inlog/accepteer',
    'POST /api/foundation/school/leraar/klas/maak',
    'POST /api/foundation/school/leraar/overzicht',
    'POST /api/foundation/school/klas', 'POST /api/foundation/school/koppel',
    'POST /api/foundation/registratie/aanvragen',
    'POST /api/foundation/registratie/status',
    'POST /api/office/foundation/registratie/besluit',
    'POST /api/member/sport/ticket/koop', 'POST /api/member/sport/tickets',
    'POST /api/sport/scan'
  ];
  for (const route of routes) {
    const spatie = route.indexOf(' '), methode = route.slice(0, spatie), pad = route.slice(spatie + 1);
    assert.equal(gesloten(methode, pad, { action:'goedkeuren' }), true, route);
  }
  assert.equal(maakPoort.isNogGeslotenCredentialroute('POST', '/api/rtf/samen/mee'), false,
    'de gemigreerde Samen-bearer staat niet langer tussen de technisch onvolwassen credentials');
  assert.equal(maakPoort.isBeschermdeRoute('POST', '/api/rtf/samen/mee'), true,
    'Samen blijft wel achter de afzonderlijke juridische, DPIA- en minderjarigenvrijgave');
});

test('development en test zijn zonder vrijgave expliciet open', async t => {
  for (const nodeEnv of ['development', 'test']) {
    const s = await serverVoor({ productie:false, env:{ NODE_ENV:nodeEnv } });
    t.after(() => s.sluit());
    for (const pad of DICHT.slice(0, 4)) assert.equal((await vraag(s, pad)).status, 200, pad);
    assert.equal(s.geraakt.length, 4);
  }
});

test('routefamilies stoppen op de segmentgrens en raken geen gelijknamige openbare route', async t => {
  const s = await serverVoor();
  t.after(() => s.sluit());
  const open = [
    '/api/foundation/gezinnen-openbaar',
    '/api/foundation/schoolplein',
    '/api/foundation/lessenaanbod',
    '/api/rtf/schoolplein',
    '/api/rtf/samenvatting',
    '/api/lab2/mijnbouw',
    '/api/lab2/menselijk',
    '/api/lab2/bewijsbaar'
  ];
  for (const pad of open) assert.equal((await vraag(s, pad)).status, 200, pad);
  assert.equal(s.geraakt.length, open.length);
});

test('de poort is één keer gemount na JSON en vóór idem, spoor en alle routefamilies', () => {
  const root = path.join(__dirname, '..');
  const lijf = fs.readFileSync(path.join(root, 'server/opzet/lijfpoort.js'), 'utf8');
  const keten = fs.readFileSync(path.join(root, 'server/opzet/verzoekketen.js'), 'utf8');
  const wachters = fs.readFileSync(path.join(root, 'server/opzet/poortwachters.js'), 'utf8');
  const dwars = fs.readFileSync(path.join(root, 'server/opzet/routes-dwars.js'), 'utf8');
  const aanbouw = fs.readFileSync(path.join(root, 'server/opzet/aanbouw.js'), 'utf8');
  const poort = lijf.indexOf("require('../middleware/foundation-productiepoort')()");
  assert.ok(poort > lijf.indexOf("express.json({ limit: '8mb' })"), 'poort moet een begrensde body kunnen lezen');
  assert.ok(poort < lijf.indexOf("require('../lib/idem-poort')()"), 'poort moet voor idemopslag staan');
  assert.ok(poort < lijf.indexOf("require('../lib/handelingsspoor')"), 'poort moet voor het handelingsspoor staan');
  assert.ok(keten.indexOf("require('./lijfpoort')") < keten.indexOf("require('./handeling').hervat()"));
  assert.ok(wachters.includes("app.use('/api/foundation', rtf.router)"), 'vroege Foundation-router ontbreekt');
  assert.ok(dwars.includes("require('../routes/rtfleerling')") && dwars.includes("require('../routes/livinglab')"),
    'latere leerling- of Living-Lab-router ontbreekt');
  assert.ok(aanbouw.includes("require('../routes/rtfschool')") && aanbouw.includes("require('../routes/rtfos')"),
    'latere school- of FoundationOS-router ontbreekt');
  assert.equal((lijf.match(/foundation-productiepoort/gi) || []).length, 2,
    'de modulenaam hoort één keer in uitleg en één keer in de mount te staan');
});
