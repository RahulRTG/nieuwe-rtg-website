/* De drie Foundation-persoonsportalen delen een codelevenscyclus. Deze toets
   bewaakt zowel de motor als de echte routes: verval, intrekking, rotatie en
   gebruik zijn geen UI-belofte, maar sluiten de serverdeur. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const maakLevenscyclus = require('../server/kern/codelevenscyclus');
const { startServer, stop, stopHard, kantoorAlsPersoon } = require('./helper');

function motor() {
  const rijen = [];
  let klok = Date.parse('2026-09-04T12:00:00.000Z');
  let volg = 0;
  let opslagFaalt = false;
  const cyclus = maakLevenscyclus({
    opslag: () => rijen,
    nu: () => new Date(klok).toISOString(),
    rid: () => 'code-' + (++volg),
    crypto, save: () => { if (opslagFaalt) throw new Error('opslag faalt'); }
  });
  return { rijen, cyclus, verder: ms => { klok += ms; },
    laatOpslagFalen: aan => { opslagFaalt = aan; } };
}

test('de gedeelde motor bewaart de volledige levenscyclus en weigert een verlopen code', () => {
  const m = motor();
  const uit = m.cyclus.uitgeven({ prefix: 'RTFV', issuer: 'user-1',
    doel: 'foundation-persoonsportaal', scope: ['lezen', 'wijzigen'],
    onderwerp: { soort: 'vrijwilliger', id: 'v-1' }, geldig_dagen: 1, max_gebruik: 3 });
  assert.equal(uit.ok, true);
  assert.deepEqual(Object.keys(uit.toegang).sort(), [
    'doel', 'expires_at', 'gebruik', 'id', 'ingetrokken_at', 'issued_at',
    'issuer', 'max_gebruik', 'rotatie', 'scope'
  ]);
  assert.equal(uit.toegang.issuer, 'user-1');
  assert.equal(uit.toegang.doel, 'foundation-persoonsportaal');
  assert.equal(uit.toegang.gebruik, 0);
  assert.equal(uit.toegang.max_gebruik, 3);
  assert.equal(uit.toegang.rotatie, 1);
  assert.equal(JSON.stringify(m.rijen).includes(uit.code), false, 'de kale code staat op schijf');
  assert.equal(m.cyclus.controleer(uit.code, { doel: uit.toegang.doel,
    soort: 'vrijwilliger', scope: 'lezen' }).ok, true);
  m.verder(86400001);
  const laat = m.cyclus.controleer(uit.code, { doel: uit.toegang.doel,
    soort: 'vrijwilliger', scope: 'lezen' });
  assert.equal(laat.status, 403);
  assert.equal(laat.reden, 'verlopen');
});

test('intrekken, roteren en max-use sluiten de oude code server-side', () => {
  const m = motor();
  const oud = m.cyclus.uitgeven({ prefix: 'RTFD', issuer: 'user-1', doel: 'foundation-persoonsportaal',
    scope: ['lezen'], onderwerp: { soort: 'deelnemer', id: 'c-1' }, max_gebruik: 1 });
  assert.equal(m.cyclus.controleer(oud.code, { doel: oud.toegang.doel,
    soort: 'deelnemer', scope: 'lezen' }).ok, true);
  assert.equal(m.cyclus.controleer(oud.code, { doel: oud.toegang.doel,
    soort: 'deelnemer', scope: 'lezen' }).reden, 'opgebruikt');
  assert.equal(m.cyclus.intrekken(oud.toegang.id, 'user-2', 'verloren').toegang.ingetrokken_at !== null, true);
  const nieuw = m.cyclus.roteer(oud.toegang.id, { prefix: 'RTFD', issuer: 'user-2', reden: 'heruitgifte' });
  assert.equal(nieuw.toegang.rotatie, 2);
  assert.equal(nieuw.vorige.ingetrokken_at !== null, true);
  assert.equal(m.cyclus.controleer(oud.code, { doel: oud.toegang.doel,
    soort: 'deelnemer', scope: 'lezen' }).reden, 'ingetrokken');
  assert.equal(m.cyclus.controleer(nieuw.code, { doel: nieuw.toegang.doel,
    soort: 'deelnemer', scope: 'lezen' }).ok, true);
});

test('een mislukte rotatie laat de huidige code en opslag exact intact', () => {
  const m = motor();
  const oud = m.cyclus.uitgeven({ prefix: 'RTFV', issuer: 'user-1',
    doel: 'foundation-persoonsportaal', scope: ['lezen'],
    onderwerp: { soort: 'vrijwilliger', id: 'v-1' } });
  const voor = JSON.stringify(m.rijen);
  m.laatOpslagFalen(true);
  assert.throws(() => m.cyclus.roteer(oud.toegang.id,
    { prefix: 'RTFV', issuer: 'user-2', reden: 'heruitgifte' }), /opslag faalt/);
  assert.equal(JSON.stringify(m.rijen), voor, 'rotatie liet een nieuwe of half ingetrokken rij achter');
  assert.equal(m.cyclus.stand(oud.toegang.id).ok, true, 'de huidige code werd bij de fout gesloten');
  m.laatOpslagFalen(false);
  assert.equal(m.cyclus.controleer(oud.code, { doel: oud.toegang.doel,
    soort: 'vrijwilliger', scope: 'lezen' }).ok, true);
});

test('scope- en onderwerp-mismatches falen dicht zonder gebruik te tellen', () => {
  const m = motor();
  const uit = m.cyclus.uitgeven({ prefix: 'RTFV', issuer: 'user-1',
    doel: 'foundation-persoonsportaal', scope: ['vrijwilliger:lezen'],
    onderwerp: { soort: 'vrijwilliger', id: 'v-1' } });
  const scope = m.cyclus.controleer(uit.code, { doel: uit.toegang.doel,
    soort: 'vrijwilliger', scope: 'vrijwilliger:wijzigen' });
  assert.equal(scope.status, 403);
  assert.equal(scope.reden, 'scope-ontbreekt');
  const onderwerp = m.cyclus.controleer(uit.code, { doel: uit.toegang.doel,
    soort: 'deelnemer', scope: 'vrijwilliger:lezen' });
  assert.equal(onderwerp.status, 403);
  assert.equal(onderwerp.reden, 'verkeerd-onderwerp');
  const los = m.cyclus.controleer(uit.code, { doel: uit.toegang.doel,
    soort: 'vrijwilliger', scope: 'vrijwilliger:lezen' }, () => null);
  assert.equal(los.reden, 'binding-ontbreekt');
  assert.equal(m.rijen[0].gebruik, 0);
});

test('collectiepublicatie bewaart live en externe overlap, laat security-commit winnen en houdt DB-basis eerlijk', async () => {
  const maak = require('../server/pg/collectietransactie');
  const cacheBase = { vrijwilligers: [{ id: 'v-1', persoonscode_id: null, code: 'legacy-code' }],
    codelevenscycli: [], audit: [], lokaalVeld: 'db-basis', externVeld: 'cache-oud' };
  const dbBase = JSON.parse(JSON.stringify(cacheBase));
  dbBase.externVeld = 'extern-vers';
  const dataNu = { rtfos: JSON.parse(JSON.stringify(cacheBase)) };
  /* Deze gewone wijziging bestond al toen de transactie haar werkkopie maakte.
     Een tweede wijziging tijdens COMMIT moet daartegen, niet tegen db-basis,
     worden vergeleken. */
  dataNu.rtfos.lokaalVeld = 'open-voor-tx';
  const toegepast = new Map([['rtfos', 7]]);
  const laatsteJson = new Map([['rtfos', JSON.stringify(cacheBase)]]);
  const laatsteGrootte = new Map(), laatsteLengte = new Map(), laatsteCheck = new Map();
  let commitBereikt, commitVrij;
  const bijCommit = new Promise(r => { commitBereikt = r; });
  const wachtCommit = new Promise(r => { commitVrij = r; });
  let opgeslagen = null;
  const client = {
    async query(sql, params) {
      if (/SELECT val, ver, weg/.test(sql)) return { rows: [{ val: JSON.stringify(dbBase), ver: 7, weg: false }] };
      if (/nextval/.test(sql)) return { rows: [{ v: 8 }] };
      if (/INSERT INTO kv/.test(sql)) { opgeslagen = params[1]; return { rows: [] }; }
      if (sql === 'COMMIT') { commitBereikt(); await wachtCommit; return { rows: [] }; }
      return { rows: [] };
    },
    release() {}
  };
  const tx = maak({ pool: { connect: async () => client },
    uitStore: x => x, naarStore: x => x, toegepast, laatsteJson,
    laatsteGrootte, laatsteLengte, laatsteCheck });
  const bezig = tx.bewerkCollectie('rtfos', dataNu, staat => {
    staat.vrijwilligers[0].persoonscode_id = 'code-commit';
    delete staat.vrijwilligers[0].code;
    return { ok: true };
  });
  await bijCommit;
  /* Een gewone route schrijft terwijl COMMIT op I/O wacht. Ook een botsende,
     verouderde codebinding wordt uitgelokt: de securitycommit moet die winnen. */
  dataNu.rtfos.audit.unshift({ id: 'gewone-mutatie', wat: 'naast-de-tx' });
  dataNu.rtfos.lokaalVeld = 'nieuw-tijdens-commit';
  dataNu.rtfos.vrijwilligers[0].persoonscode_id = 'stale-live';
  dataNu.rtfos.vrijwilligers[0].code = 'stale-legacy-code';
  commitVrij();
  await bezig;
  assert.equal(dataNu.rtfos.vrijwilligers[0].persoonscode_id, 'code-commit');
  assert.equal(Object.hasOwn(dataNu.rtfos.vrijwilligers[0], 'code'), false,
    'live wijziging liet een door de securitycommit verwijderd geheim herrijzen');
  assert.equal(dataNu.rtfos.lokaalVeld, 'nieuw-tijdens-commit',
    'publicatie vergeleek niet tegen de echte live-basis');
  assert.equal(dataNu.rtfos.externVeld, 'extern-vers',
    'publicatie draaide verse DB-staat terug omdat die nog niet in live stond');
  assert.equal(dataNu.rtfos.audit[0].id, 'gewone-mutatie', 'onafhankelijke live mutatie ging verloren');
  assert.equal(JSON.parse(opgeslagen).vrijwilligers[0].persoonscode_id, 'code-commit');
  assert.equal(JSON.parse(laatsteJson.get('rtfos')).audit.length, 0,
    'laatsteJson deed ten onrechte alsof openstaand live werk al gecommit was');
  assert.notEqual(JSON.stringify(dataNu.rtfos), laatsteJson.get('rtfos'),
    'de volgende flush kan het openstaande verschil niet meer zien');
});

test('collectiepublicatie maakt bij een lege no-op geen undefined collectiekey', () => {
  const publiceer = require('../server/db/collectie-publicatie');
  const data = {}, toegepast = new Map(), laatsteJson = new Map();
  const r = publiceer({ dataNu: data, sleutel: 'nogAfwezig', basisJson: '{}',
    commitWaarde: {}, commitJson: '{}', versie: null, toegepast, laatsteJson });
  assert.equal(r.waarde, undefined);
  assert.equal(Object.hasOwn(data, 'nogAfwezig'), false,
    'een no-op liet een serialiseerbare collectiekey met undefined achter');
  assert.doesNotThrow(() => {
    for (const k of Object.keys(data)) void JSON.stringify(data[k]).length;
  });
});

function foundationHarness(aanvang) {
  let store = JSON.parse(JSON.stringify(aanvang));
  const db = { writable: true, data: { rtfos: JSON.parse(JSON.stringify(store)) } };
  let keten = Promise.resolve(), eerste = true, laatEersteLos = null, eersteBegon = null;
  let faalVolgende = false;
  const begonnen = new Promise(r => { eersteBegon = r; });
  const poort = new Promise(r => { laatEersteLos = r; });
  let blokkeerEerste = false;
  const bewerkCollectie = (sleutel, werk) => {
    const isEerste = eerste; eerste = false;
    const run = keten.then(async () => {
      if (isEerste && blokkeerEerste) { eersteBegon(); await poort; }
      const draft = JSON.parse(JSON.stringify(store));
      const antwoord = werk(draft);
      if (faalVolgende) { faalVolgende = false; throw new Error('uitgelokte commitfout'); }
      store = draft;
      db.data.rtfos = JSON.parse(JSON.stringify(store));
      return antwoord;
    });
    keten = run.catch(() => {});
    return run;
  };
  const ctx = require('../server/kern/rtfos/basis')({ db, save() {}, bewerkCollectie,
    crypto, boardroomWie: req => req && req.key, magBoardroom: () => false });
  return { db, ctx, store: () => store,
    blokkeerEerste() { blokkeerEerste = true; }, begonnen,
    laatEersteLos, faalVolgende() { faalVolgende = true; } };
}

const codeStaat = soort => ({
  steden: [{ id: 's-1', naam: 'Stad', status: 'actief',
    vlaggen: ['volunteer_management', 'individual_cases', 'donations'] }],
  zetels: [{ key: 'werker-1', stad: 's-1', rol: 'stadsbestuur' }],
  vrijwilligers: soort === 'vrijwilliger'
    ? [{ id: 'v-1', stad: 's-1', naam: 'Vera', status: 'actief', projecten: [], uren: [] }] : [],
  casussen: soort === 'deelnemer'
    ? [{ id: 'c-1', stad: 's-1', codenaam: 'HV-1', status: 'toestemming', soort: 'hulp',
      vraag: 'vraag', toestemming: { tekst: 'toestemming', at: '2026-01-01', door: 'werker-1' }, stappen: [] }] : [],
  bronnen: [], projecten: [], activiteiten: [], uitleen: [], partners: [], codelevenscycli: [], audit: []
});

test('office-autorisatie wordt na wachten opnieuw uit transactionele zetels afgeleid', async () => {
  const h = foundationHarness(codeStaat('vrijwilliger'));
  h.blokkeerEerste();
  const portaal = require('../server/kern/rtfos/vrijwilligerportaal')(h.ctx);
  const bezig = portaal.codeVoor({ key: 'werker-1' }, 'v-1', {});
  await h.begonnen;
  /* De zetel verdwijnt terwijl de aanvraag op het transactieslot wacht. */
  h.db.data.rtfos.zetels = [];
  /* De echte store/tx-stand ziet dezelfde intrekking door een andere schrijver. */
  h.store().zetels.splice(0);
  h.laatEersteLos();
  const antwoord = await bezig;
  assert.equal(antwoord.status, 403);
  assert.equal(h.store().codelevenscycli.length, 0, 'oude precheck gaf na zetelintrekking toch een code uit');
});

test('gelijktijdig uitgeven en intrekken serialiseert; de uitgegeven code eindigt dicht', async () => {
  const h = foundationHarness(codeStaat('vrijwilliger'));
  h.blokkeerEerste();
  const portaal = require('../server/kern/rtfos/vrijwilligerportaal')(h.ctx);
  const uitgifte = portaal.codeVoor({ key: 'werker-1' }, 'v-1', {});
  await h.begonnen;
  /* Deze precheck ziet nog geen code; de beslissing binnen het slot moet na
     uitgifte toch de actuele binding intrekken. */
  const intrekking = portaal.codeIntrekken({ key: 'werker-1' }, 'v-1', 'raceproef');
  h.laatEersteLos();
  const [uit, dicht] = await Promise.all([uitgifte, intrekking]);
  assert.equal(uit.ok, true);
  assert.equal(dicht.ok, true);
  const na = await portaal.portaal(uit.code);
  assert.equal(na.status, 403);
  assert.equal(h.store().codelevenscycli[0].ingetrokken_at !== null, true);
});

test('codegebruik, toestemming en audit rollen samen terug bij een commitfout', async () => {
  const h = foundationHarness(codeStaat('deelnemer'));
  const portaal = require('../server/kern/rtfos/deelnemerportaal')(h.ctx,
    { toestemmingWegDirect: require('../server/kern/rtfos/casus-keten')(h.ctx, {
      vind: () => null, beeld: c => c, KETEN: {}, EIST_TOESTEMMING: [], BEWAARDAGEN: 730
    }).toestemmingWegDirect });
  const uit = await portaal.codeVoor({ key: 'werker-1' }, 'c-1', {});
  h.faalVolgende();
  await assert.rejects(portaal.trekIn(uit.code, 'stop'), /uitgelokte commitfout/);
  let staat = h.store();
  assert.ok(staat.casussen[0].toestemming, 'toestemming verdween ondanks rollback');
  assert.equal(staat.codelevenscycli[0].gebruik, 0, 'codegebruik bleef staan ondanks rollback');
  assert.equal(staat.audit.some(x => x.wat === 'casus.toestemming-ingetrokken'), false,
    'audit bleef staan ondanks rollback');
  const goed = await portaal.trekIn(uit.code, 'stop');
  assert.equal(goed.ok, true);
  staat = h.store();
  assert.equal(staat.casussen[0].toestemming, null);
  assert.equal(staat.codelevenscycli[0].gebruik, 1);
  assert.equal(staat.audit.filter(x => x.wat === 'casus.toestemming-ingetrokken').length, 1);
});

test('legacy plain codes van alle drie persoonsportalen falen dicht', () => {
  const m = motor();
  const staat = { vrijwilligers: [{ id: 'v-oud', stad: 's-1', naam: 'Oud', status: 'actief',
    code: 'RTFV-LEGACY', uren: [], projecten: [] }],
  casussen: [{ id: 'c-oud', code: 'RTFD-LEGACY' }],
  bronnen: [{ id: 'b-oud', donateurcode: 'RTFS-LEGACY' }],
  projecten: [], activiteiten: [], uitleen: [] };
  const ctx = {
    nu: () => new Date().toISOString(), schoon: v => String(v || ''), S: () => staat,
    audit: () => {}, save: () => {}, stadVan: () => ({ naam: 'Stad' }), vogGeldig: () => true,
    codelevenscyclus: m.cyclus, wie: () => ({ key: 'user-1' }), poort: () => ({ ok: true }),
    euro: c => c / 100
  };
  const vrijwilliger = require('../server/kern/rtfos/vrijwilligerportaal')(ctx);
  const deelnemer = require('../server/kern/rtfos/deelnemerportaal')(ctx,
    { toestemmingWegDirect: () => ({ ok: true }) });
  const donateur = require('../server/kern/rtfos/donateur')(ctx, { cijfersVan: () => ({}) });
  for (const r of [vrijwilliger.portaal('RTFV-LEGACY'), deelnemer.portaal('RTFD-LEGACY'),
    donateur.portaal('RTFS-LEGACY')]) {
    assert.equal(r.status, 404);
    assert.match(r.error, /niet geldig|nieuwe code/i);
  }
});

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-persoonscodes-'));
const OFFICE_CODE = 'PERSOONSCODES-KEURING';
let srv, BASE, LAND, STAD, VRIJW, CASUS, BRON;

const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rtf = (pad, body, tok) => post('/api/rtfos/' + pad, body, tok === undefined ? LAND : tok);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  STAD = (await rtf('stad/maak', { naam: 'Levenscyclusstad' })).body.stad.id;
  await rtf('stad/status', { id: STAD, status: 'actief' });
  for (const vlag of ['volunteer_management', 'individual_cases', 'donations']) {
    await rtf('stad/module', { id: STAD, vlag, aan: true });
  }
  VRIJW = (await rtf('vrijwilliger/maak', { stad: STAD, naam: 'Vera Vrijwilliger' })).body.vrijwilliger.id;
  await rtf('vrijwilliger/zet', { id: VRIJW, status: 'actief', gedragscode: true });
  CASUS = (await rtf('casus/maak', { stad: STAD, soort: 'digitale_hulp', vraag: 'hulp bij formulieren',
    contact: 'persoonlijk' })).body.casus.id;
  BRON = (await rtf('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Gever Een', bedrag: 25 })).body.bron.id;
});

test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de office-routes trekken in en roteren; oude codes kunnen daarna niets muteren', async () => {
  const geenDeur = await rtf('vrijwilliger/code/roteren', { id: VRIJW }, null);
  assert.ok([401, 403].includes(geenDeur.status), 'roteren stond buiten de bestaande officedeur');

  const v = await rtf('vrijwilliger/code', { id: VRIJW, max_gebruik: 8, geldig_dagen: 30 });
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.equal(v.body.toegang.issuer.length > 0, true);
  assert.deepEqual(v.body.toegang.scope.sort(),
    ['vrijwilliger:lezen', 'vrijwilliger:uren', 'vrijwilliger:wijzigen']);
  assert.equal(v.body.toegang.max_gebruik, 8);
  assert.equal((await post('/api/rtfos/portaal/vrijwilliger', { code: v.body.code })).status, 200);

  const dicht = await rtf('vrijwilliger/code/intrekken', { id: VRIJW, reden: 'telefoon kwijt' });
  assert.equal(dicht.status, 200);
  assert.ok(dicht.body.toegang.ingetrokken_at);
  const mutatie = await post('/api/rtfos/portaal/vrijwilliger/zet', {
    code: v.body.code, beschikbaar: ['di-a']
  });
  assert.equal(mutatie.status, 403, 'een ingetrokken code wijzigde nog persoonsgegevens');
  const kantoor = await rtf('vrijwilligers', { stad: STAD });
  assert.deepEqual(kantoor.body.vrijwilligers.find(x => x.id === VRIJW).beschikbaar, []);

  const v2 = await rtf('vrijwilliger/code/roteren', { id: VRIJW, reden: 'heruitgifte' });
  assert.equal(v2.status, 200, JSON.stringify(v2.body));
  assert.equal(v2.body.toegang.rotatie, 2);
  assert.notEqual(v2.body.code, v.body.code);
  assert.equal((await post('/api/rtfos/portaal/vrijwilliger', { code: v.body.code })).status, 403);
  assert.equal((await post('/api/rtfos/portaal/vrijwilliger', { code: v2.body.code })).status, 200);

  const d = await rtf('casus/code', { id: CASUS, max_gebruik: 1 });
  assert.equal((await post('/api/rtfos/portaal/deelnemer', { code: d.body.code })).status, 200);
  assert.equal((await post('/api/rtfos/portaal/deelnemer', { code: d.body.code })).status, 403,
    'max-use liet een extra toegang toe');
  const d2 = await rtf('casus/code/roteren', { id: CASUS, reden: 'gebruikslimiet bereikt' });
  assert.equal(d2.body.toegang.rotatie, 2);
  await rtf('casus/code/intrekken', { id: CASUS, reden: 'dossier overgedragen' });
  assert.equal((await post('/api/rtfos/portaal/deelnemer/intrekken', {
    code: d2.body.code, reden: 'stop'
  })).status, 403, 'een ingetrokken deelnemerscode muteerde nog toestemming');

  const s = await rtf('donateur/code', { bronId: BRON, max_gebruik: 5 });
  assert.equal((await post('/api/rtfos/portaal/donateur', { code: s.body.code })).status, 200);
  await rtf('donateur/code/intrekken', { bronId: BRON, reden: 'gever verzocht dit' });
  assert.equal((await post('/api/rtfos/portaal/donateur', { code: s.body.code })).status, 403);
  const s2 = await rtf('donateur/code/roteren', { bronId: BRON, reden: 'persoonlijk heruitgegeven' });
  assert.equal(s2.body.toegang.rotatie, 2);
  assert.equal((await post('/api/rtfos/portaal/donateur', { code: s2.body.code })).status, 200);

  for (const wat of ['vrijwilliger.code-ingetrokken', 'vrijwilliger.code-geroteerd',
    'casus.code-ingetrokken', 'donateur.code-ingetrokken']) {
    const spoor = await rtf('audit', { wat });
    assert.ok(spoor.body.regels.length >= 1, wat + ' liet geen auditspoor na');
  }
});

test('donateurcodes groeperen op een stabiel subject en nooit stil op een vrije naam', async () => {
  const a = await rtf('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Dezelfde Naam', bedrag: 11 });
  const b = await rtf('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Dezelfde Naam', bedrag: 22 });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const ambigu = await rtf('donateur/code', { bronId: a.body.bron.id });
  assert.equal(ambigu.status, 409);
  assert.match(ambigu.body.error, /naam is geen identiteit/i);

  const gebonden = await rtf('donateur/code', {
    bronId: a.body.bron.id, gift_ids: [a.body.bron.id, b.body.bron.id], max_gebruik: 20
  });
  assert.equal(gebonden.status, 200, JSON.stringify(gebonden.body));
  assert.equal(gebonden.body.giften, 2);
  const derde = await rtf('bron/maak', { stad: STAD, soort: 'donatie', gever: 'Dezelfde Naam', bedrag: 999 });
  assert.equal(derde.status, 200);
  const portaal = await post('/api/rtfos/portaal/donateur', { code: gebonden.body.code });
  assert.equal(portaal.status, 200);
  assert.equal(portaal.body.donateur.aantal, 2, 'latere naamgenoot lekte in bestaand portaal');
  assert.equal(portaal.body.donateur.totaal, 33);
  assert.equal(JSON.stringify(portaal.body).includes('donateur_subject_id'), false,
    'intern subject-id lekte naar het portaal');
});

test('transactionele toestemming en audit overleven een harde SQLite-herstart', async () => {
  const nieuw = await rtf('casus/maak', { stad: STAD, soort: 'digitale_hulp',
    vraag: 'toestemming duurzaam intrekken', contact: 'persoonlijk' });
  assert.equal(nieuw.status, 200);
  const id = nieuw.body.casus.id;
  assert.equal((await rtf('casus/status', { id, status: 'intake' })).status, 200);
  assert.equal((await rtf('casus/status', { id, status: 'toestemming',
    toestemming: 'gegevens delen met gekozen hulporganisatie' })).status, 200);
  const toegang = await rtf('casus/code', { id, max_gebruik: 20 });
  assert.equal(toegang.status, 200);
  const ingetrokken = await post('/api/rtfos/portaal/deelnemer/intrekken', {
    code: toegang.body.code, reden: 'duurzaam stoppen'
  });
  assert.equal(ingetrokken.status, 200, JSON.stringify(ingetrokken.body));

  await stopHard(srv.child);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  const na = await post('/api/rtfos/portaal/deelnemer', { code: toegang.body.code });
  assert.equal(na.status, 200, JSON.stringify(na.body));
  assert.equal(na.body.hulpvraag.toestemming, null);
  assert.equal(na.body.hulpvraag.ingetrokken.at != null, true);
  const spoor = await rtf('audit', { wat: 'casus.toestemming-ingetrokken' });
  assert.ok(spoor.body.regels.some(x => x.doel === nieuw.body.casus.codenaam),
    'transactionele auditregel ontbrak na harde herstart');
});
