/* DE ROME-SCHAKELS OVER DE DRAAD -- ronde 2 van het afbouwprogramma.

   scripts/romeproef.js loopt de hele keten en duurt minuten; dit bestand zet
   de vijf schakels die in ronde 2 in de PRODUCTcode dichtgingen elk tegen een
   echte server, zodat elke nieuwe route in een gewone toetsronde minstens een
   treffer heeft (LAT.md: geen nieuwe HTTP-route zonder):

     13  het reisadvies wijst geen andere stad aan dan gevraagd
         (kern/reisbureau-advies.js; op de oude code wees "een weekend Rome"
         Gstaad aan -- toets 1 zakt daar)
      7  een venster dat het lid zelf opgeeft (kern/genootschap/bijeenkomst.js)
     12  de budgettoets met toestemming (kern/geldbeleid/budgettoets.js, B2)
     18  boeken per deelnemer (kern/reisbureau-deelnemers.js, B3)
     19  Rahul stelt samen en voert niets uit (kern/socialecommand/samenstel.js)

   Draai los: node --test test/romeschakels.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-romeschakels-'));
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let srv, base, kantoor, A, B, C, GROEP, BIJEENKOMST, REIS, POT, AANVRAAG, DEEL_B, DEEL_C;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function nieuwLid(naam) {
  const u = naam + Date.now().toString().slice(-6);
  const r = await api('/api/auth/register', { name: naam, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const codenaam = r.body && r.body.state && r.body.state.user && r.body.state.user.codename;
  assert.ok(r.body.token && codenaam, naam + ' kon zich niet aanmelden: ' + JSON.stringify(r.body).slice(0, 200));
  await api('/api/reis/gezelschap/kring', {}, r.body.token);   // in de ledengids, anders is hij onvindbaar
  return { naam, token: r.body.token, codenaam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(kantoor, 'het kantoor logt niet in');
  A = await nieuwLid('Anna'); B = await nieuwLid('Bram'); C = await nieuwLid('Cees');
  assert.equal(new Set([A, B, C].map(x => x.codenaam)).size, 3, 'twee leden delen een codenaam');
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('1. schakel 13: een genoemde bestemming die niet in de catalogus staat, wordt geen andere stad', async () => {
  const r = await api('/api/reisbureau/advies', { wens: 'een weekend Rome met vrienden' }, A.token);
  assert.equal(r.status, 200);
  assert.equal(r.body.reis, null, 'het advies wees ' + JSON.stringify(r.body.reis && r.body.reis.bestemming) + ' aan voor een weekend Rome');
  assert.deepEqual(r.body.ontbreekt, { bestemming: 'Rome' });
  assert.match(r.body.reden, /geen reis naar Rome/);
  assert.match(r.body.reden, /niets aangevraagd of geboekt/);
  // een bestemming die er WEL is, wordt gekozen, ook als een ander woord elders beter scoort
  const l = await api('/api/reisbureau/advies', { wens: 'een weekend Lissabon' }, A.token);
  assert.equal(l.body.reis && l.body.reis.bestemming, 'Lissabon');
  assert.equal(l.body.onderbouwing.bestemming, 'Lissabon');
  // en zonder bestemming blijft het advies op woorden werken
  const z = await api('/api/reisbureau/advies', { wens: 'zon, zee en strand op een eiland' }, A.token);
  assert.ok(z.body.reis && z.body.reis.id);
  assert.equal(z.body.onderbouwing.bestemming, null);
});

test('2. schakel 7: het venster komt van het lid zelf, telt per dag zonder namen, en is geen ja', async () => {
  GROEP = (await api('/api/genootschap/richt-op', { naam: 'Weekend weg', soort: 'besloten' }, A.token)).body.groep.id;
  for (const x of [B, C]) {
    assert.equal((await api('/api/genootschap/nodig-uit', { groep: GROEP, wie: x.codenaam }, A.token)).status, 200);
    assert.equal((await api('/api/genootschap/binnen', { groep: GROEP }, x.token)).status, 200);
  }
  BIJEENKOMST = (await api('/api/genootschap/roep-bijeen', { groep: GROEP, wat: 'Weekend', datum: dag(30) }, A.token)).body.bijeenkomst.id;
  const dagen = [dag(30), dag(31), dag(32)];
  const v = await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen }, B.token);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  assert.deepEqual(v.body.bijeenkomst.mijnVenster, dagen);
  // twee keer hetzelfde venster is een keer (mutatiecontract: PROTECTED)
  const twee = await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen }, B.token);
  assert.deepEqual(twee.body.bijeenkomst, v.body.bijeenkomst);
  await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen: [dag(31)] }, C.token);
  const ag = (await api('/api/genootschap/agenda', { groep: GROEP }, A.token)).body.komt.find(b => b.id === BIJEENKOMST);
  assert.equal(ag.venster.opgegeven, 2);
  assert.deepEqual(ag.venster.perDag.find(x => x.dag === dag(31)), { dag: dag(31), aantal: 2 });
  assert.deepEqual(ag.mijnVenster, [], 'de organisator gaf zelf geen venster op');
  assert.ok(!JSON.stringify(ag.venster).includes(B.codenaam), 'de overlap noemt geen namen');
  assert.equal(ag.ja, 0, 'een venster is geen ja');
  // buiten een week van de datum: geweigerd; niet-lid: geweigerd
  assert.equal((await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen: [dag(45)] }, B.token)).status, 400);
  const vreemde = await nieuwLid('Dirk');
  assert.equal((await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen: [dag(30)] }, vreemde.token)).status, 400);
  // Rahul telt de overlap mee in zijn uitleg
  const raad = (await api('/api/genootschap/ai/datum', { groep: GROEP }, A.token)).body;
  assert.equal(raad.meting[0].venster.overlap, 2);
  assert.deepEqual(raad.meting[0].venster.dagen, [dag(31)]);
  // het eigen venster staat in de eigen uitvoer, en een lege lijst wist het
  const mijn = (await api('/api/genootschap/mijn-uitvoer', { groep: GROEP }, B.token)).body;
  assert.deepEqual(mijn.vensters.map(x => x.mijnDagen), [dagen]);
  assert.equal((await api('/api/genootschap/venster', { groep: GROEP, id: BIJEENKOMST, dagen: [] }, C.token)).status, 200);
  const na = (await api('/api/genootschap/agenda', { groep: GROEP }, A.token)).body.komt.find(b => b.id === BIJEENKOMST);
  assert.equal(na.venster.opgegeven, 1);
  // B en C zeggen ja zodat de datum bekend is voor toets 5
  await api('/api/genootschap/antwoord', { groep: GROEP, id: BIJEENKOMST, antwoord: 'ja' }, B.token);
});

test('3. schakel 18: elke deelnemer bevestigt zelf, en een deel staat alleen klaar voor een reisgenoot die ja zei', async () => {
  const zet = await api('/api/office/reisbureau/klaarzetten', { onderdelen: [
    { soort: 'verblijf', titel: 'Hotel', bestemming: 'Rome', van: dag(30), tot: dag(32), kenmerk: 'RM1', herkomst: 'document' }] }, kantoor);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.equal((await api('/api/reis/uitnodiging/eisop', { code: zet.body.link.split('code=')[1] }, A.token)).status, 200);
  REIS = (await api('/api/reis/reizen', {}, A.token)).body.reizen[0].id;
  for (const x of [B, C]) {
    const u = await api('/api/reis/gezelschap/nodig-uit', { reis: REIS, codenaam: x.codenaam, rol: 'reisgenoot' }, A.token);
    if (x === B) assert.equal((await api('/api/reis/gezelschap/antwoord', { id: u.body.lid.id, ja: true }, B.token)).status, 200);
  }
  // Cees zei nog niets: voor hem staat geen deel klaar, en dan ook voor Bram niet (alles of niets)
  const half = await api('/api/reisbureau/deelnemers/klaarzetten', { tripId: 'gstaad-alpien', vertrek: dag(30), reis: REIS,
    deelnemers: [B.codenaam, C.codenaam] }, A.token);
  assert.equal(half.status, 409);
  assert.match(half.body.error, new RegExp(C.codenaam));
  assert.equal(((await api('/api/reisbureau/mijn', {}, A.token)).body.aanvragen || []).length, 0, 'een geweigerde klaarzet boekt niets');
  // en nu Cees zelf ja zegt
  const kring = (await api('/api/reis/gezelschap/kring', {}, C.token)).body.gevraagd[0];
  assert.equal((await api('/api/reis/gezelschap/antwoord', { id: kring.id, ja: true }, C.token)).status, 200);
  const r = await api('/api/reisbureau/deelnemers/klaarzetten', { tripId: 'gstaad-alpien', vertrek: dag(30), reis: REIS,
    deelnemers: [B.codenaam, C.codenaam] }, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  AANVRAAG = r.body.aanvraag;
  const nogEens = await api('/api/reisbureau/deelnemers/klaarzetten', { tripId: 'gstaad-alpien', vertrek: dag(30), reis: REIS,
    deelnemers: [B.codenaam, C.codenaam] }, A.token);
  assert.equal(nogEens.status, 409, 'een tweede klaarzet boekt geen tweede plaats en zet geen tweede deel klaar');
  assert.equal((await api('/api/reisbureau/mijn', {}, B.token)).body.klaargezet.length, 1);
  assert.equal(AANVRAAG.personen, 1, 'de organisator boekt alleen zichzelf');
  assert.deepEqual(r.body.delen.map(d => d.stand), ['klaargezet', 'klaargezet']);
  DEEL_B = (await api('/api/reisbureau/mijn', {}, B.token)).body.klaargezet[0];
  DEEL_C = (await api('/api/reisbureau/mijn', {}, C.token)).body.klaargezet[0];
  assert.ok(DEEL_B && DEEL_C);
  assert.equal(DEEL_B.door, A.codenaam);
  // niemand antwoordt voor een ander
  assert.equal((await api('/api/reisbureau/deelnemers/antwoord', { id: DEEL_B.id, ja: true }, A.token)).status, 404);
  assert.equal((await api('/api/reisbureau/deelnemers/antwoord', { id: DEEL_B.id, ja: true }, C.token)).status, 404);
  // Bram zegt ja en heeft dan ZIJN aanvraag; Cees zegt nee
  const ja = await api('/api/reisbureau/deelnemers/antwoord', { id: DEEL_B.id, ja: true }, B.token);
  assert.equal(ja.status, 200, JSON.stringify(ja.body));
  assert.equal(ja.body.aanvraag.personen, 1);
  assert.equal((await api('/api/reisbureau/deelnemers/antwoord', { id: DEEL_B.id, ja: true }, B.token)).status, 409, 'twee keer ja is geen tweede boeking');
  assert.equal((await api('/api/reisbureau/deelnemers/antwoord', { id: DEEL_C.id, ja: false }, C.token)).status, 200);
  // betalen: alleen de eigen aanvraag, en dus nooit die van een ander
  assert.equal((await api('/api/reisbureau/betaal', { ref: ja.body.aanvraag.ref }, A.token)).status, 404);
  assert.equal((await api('/api/reisbureau/betaal', { ref: ja.body.aanvraag.ref }, B.token)).status, 409, 'onbevestigd wordt niet geind');
  const st = await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token);
  assert.equal(st.status, 200);
  assert.deepEqual(st.body.delen.map(d => [d.codenaam, d.stand]).sort(),
    [[B.codenaam, 'bevestigd'], [C.codenaam, 'geweigerd']].sort());
  assert.doesNotMatch(JSON.stringify(st.body), /centen|betaald|prijs|pp/i, 'de organisator ziet geen geld');
  assert.equal((await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, B.token)).status, 404, 'de stand is van de organisator');
});

test('4. schakel 12: zonder toestemming geen uitkomst; met toestemming ziet alleen de vriend hem, tot hij deelt', async () => {
  POT = (await api('/api/geld/pot/zet', { naam: 'Weekend', doelCenten: 999999 }, B.token)).body.pot;
  assert.deepEqual((await api('/api/geld/budgettoets', {}, B.token)).body.toestemmingen, []);
  const zonder = (await api('/api/reisbureau/mijn', {}, B.token)).body.klaargezet.find(x => x.id === DEEL_B.id);
  assert.equal(zonder.budget.uitkomst, null);
  assert.equal((await api('/api/reisbureau/deelnemers/budget', { id: DEEL_B.id, delen: true }, B.token)).status, 409);
  assert.equal((await api('/api/geld/budgettoets/sta', { potId: 'bestaat-niet' }, B.token)).status, 404);
  const sta = await api('/api/geld/budgettoets/sta', { potId: POT.id }, B.token);
  assert.equal(sta.status, 200, JSON.stringify(sta.body));
  const sta2 = await api('/api/geld/budgettoets/sta', { potId: POT.id }, B.token);
  assert.deepEqual(sta2.body.toestemming, sta.body.toestemming, 'nog eens geven is dezelfde toestemming, met dezelfde einddatum');
  assert.equal((await api('/api/geld/budgettoets', {}, B.token)).body.toestemmingen.length, 1);
  const met = (await api('/api/reisbureau/mijn', {}, B.token)).body.klaargezet.find(x => x.id === DEEL_B.id);
  assert.equal(met.budget.uitkomst, 'past');
  assert.deepEqual(Object.keys(met.budget), ['uitkomst'], 'past draagt geen reden en geen bedrag');
  // de organisator ziet nog niets
  const voor = (await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token)).body.delen.find(d => d.codenaam === B.codenaam);
  assert.equal(voor.budget, null);
  const deel = await api('/api/reisbureau/deelnemers/budget', { id: DEEL_B.id, delen: true }, B.token);
  assert.equal(deel.status, 200);
  assert.equal(deel.body.met, A.codenaam);
  const st1 = (await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token)).body;
  assert.equal((await api('/api/reisbureau/deelnemers/budget', { id: DEEL_B.id, delen: true }, B.token)).status, 200);
  assert.deepEqual((await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token)).body, st1, 'twee keer delen is een keer');
  const na = (await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token)).body;
  assert.equal(na.delen.find(d => d.codenaam === B.codenaam).budget, 'past');
  assert.ok(!JSON.stringify(na).includes('999999') && !JSON.stringify(na).includes('Weekend'), 'geen bedrag en geen potnaam bij de organisator');
  // een andere deelnemer ziet het niet
  assert.ok(!/"past"/.test(JSON.stringify((await api('/api/reisbureau/mijn', {}, C.token)).body)));
  // de toestemming staat op het toestemmingsscherm en gaat daar uit
  const rij = (await api('/api/toestemming', {}, B.token)).body.toestemmingen.find(t => t.laag === 'budgettoets');
  assert.ok(rij && rij.tot, 'de budgettoets staat op het toestemmingsscherm, met een einddatum');
  assert.equal((await api('/api/toestemming/intrek', { laag: 'budgettoets', id: rij.id }, B.token)).status, 200);
  assert.equal((await api('/api/geld/budgettoets', {}, B.token)).body.toestemmingen[0].stand, 'ingetrokken');
  assert.equal((await api('/api/reisbureau/mijn', {}, B.token)).body.klaargezet.find(x => x.id === DEEL_B.id).budget.uitkomst, null);
  // de vriend haalt zijn deling zelf weer weg
  assert.equal((await api('/api/reisbureau/deelnemers/budget', { id: DEEL_B.id, delen: false }, B.token)).status, 200);
  assert.equal((await api('/api/reisbureau/deelnemers/stand', { ref: AANVRAAG.ref }, A.token)).body.delen
    .find(d => d.codenaam === B.codenaam).budget, null);
});

test('5. schakel 19: Rahul stelt samen, met per mens wat hij zelf nog doet, en voert niets uit', async () => {
  const beeld = async () => JSON.stringify([(await api('/api/reisbureau/mijn', {}, A.token)).body,
    (await api('/api/reisbureau/mijn', {}, B.token)).body, (await api('/api/genootschap/agenda', { groep: GROEP }, A.token)).body.komt]);
  const voor = await beeld();
  const r = await api('/api/sociaal/samenstel', { groep: GROEP, reis: REIS }, A.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(await beeld(), voor, 'samenstellen veranderde iets');
  const v = r.body.voorstel;
  assert.equal(v.datum.beste, dag(30));
  assert.equal(v.reis.bestemming, 'Rome');
  assert.deepEqual(Object.keys(v.reis).sort(), ['bestemming', 'id', 'venster'], 'de reis door de poort, en niet meer');
  const b = v.deelnemers.find(d => d.codenaam === B.codenaam);
  assert.equal(b.deel, 'bevestigd');
  assert.equal(b.budget, null, 'niet (meer) gedeeld is null');
  assert.ok(v.plan.stappen.some(s => s.wie === B.codenaam && /betaalt zelf/.test(s.wat)));
  assert.deepEqual(v.uitgevoerd, []);
  assert.equal(v.ai, false);
  assert.ok(!JSON.stringify(v).includes('RM1'), 'het boekingskenmerk gaat niet mee');
  // een reis waarvan de vrager geen eigenaar is, komt er niet in
  const vanB = await api('/api/sociaal/samenstel', { groep: GROEP, reis: REIS }, B.token);
  assert.equal(vanB.status, 200);
  assert.equal(vanB.body.voorstel.reis, null);
  assert.ok(vanB.body.voorstel.deelnemers.every(d => d.deel === null), 'de delen van een ander blijven van die ander');
  // geen lid van de groep: geen voorstel
  assert.equal((await api('/api/sociaal/samenstel', { groep: GROEP, reis: REIS }, (await nieuwLid('Eva')).token)).status, 403);
});

test('6. de samensteller kan structureel niets uitvoeren: geen schrijvende aanroep in de bron', () => {
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'socialecommand', 'samenstel.js'), 'utf8'));
  assert.doesNotMatch(kaal, /save\(|zetKlaar\(|\.antwoord\(|deelBudget\(|nodigUit\(|roepBijeen\(|\bboek\(|betaal\w*\(|bevestig\(|fetch\(|stuurRoep/,
    'samenstel.js roept een schrijvende functie aan; dan is het geen voorstel meer maar een uitvoerder');
});
