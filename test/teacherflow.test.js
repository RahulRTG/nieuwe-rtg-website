/* Teacher Flow en het Attention OS: administratie als bijproduct.

   De beloftes die hier hard worden gemaakt:

   - de aandachtslijst staat in drie bakken met een REGEL erachter, en er staat
     een regel per SOORT met een aantal -- geen zevenenvijftig meldingen;
   - er staat niets over een kind in: geen naam, geen sleutel, geen tekst van
     een melding. Een lijst die de noodkreet van een kind citeert, wordt gelezen
     door iedereen die over een schouder meekijkt;
   - er wordt niets bewaard: werkdruk is hulp en geen beoordeling, dus er is
     geen geschiedenis van hoe snel een leraar zijn lijst leegwerkt;
   - een les rondt zichzelf niet af. Zonder bevestiging van een mens met zijn
     naam erbij gebeurt er niets;
   - een lesverslag gaat over de LES: alleen de telling van de presentie, geen
     leerlingsleutel en geen naam;
   - wat een les opschrijft, komt terug bij hetzelfde leerdoel (Teaching Memory).
   Draai los: node --experimental-sqlite --test test/teacherflow.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { verslagVan, VELDEN } = require('../server/school/les');

let srv, base, sch, leraar, klas, gezin, kind, kindToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-teacher-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));
const vandaag = () => new Date().toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Wissel', plaats: 'Ede' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Wilma', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '6A', trap: 'po', fase: 'po-g6' })).body;

  gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Wissel', naam: 'Ouder Wissel', pin: '4321' })).body;
  kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Fien', rol: 'kind', groep: 'kind' })).body;
  kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('de aandachtslijst staat in drie bakken, met een regel per soort', async () => {
  const r = await kl('/school/aandacht');
  assert.equal(r.status, 200);
  for (const bak of ['nu', 'vandaag', 'kanWachten']) assert.ok(Array.isArray(r.body[bak]), 'bak ' + bak + ' ontbreekt');

  // er zit een leerling in de klas en er is nog geen presentie: dat staat in "nu"
  const presentie = r.body.nu.find(x => /presentie/i.test(x.wat));
  assert.ok(presentie, 'een klas zonder aftekening van vandaag hoort bovenaan te staan');
  assert.ok(presentie.waarom.length > 30, 'elke regel zegt waarom hij er staat');
  assert.ok(presentie.waarheen, 'en waar het hoort');

  // zodra de presentie er staat, is die regel weg -- de lijst is geen inbox die volloopt
  await fnd('/school/aanwezigheid/zet', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klas.code, uur: 1, regels: [{ leerling: 'x', stand: 'aanwezig' }] })
    .then(async () => {
      const kla = (await kl('/school/klas')).body;
      await fnd('/school/aanwezigheid/zet', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
        klasCode: klas.code, uur: 1, regels: [{ leerling: kla.leerlingen[0].sleutel, stand: 'aanwezig' }] });
    });
  const na = (await kl('/school/aandacht')).body;
  assert.equal(na.nu.filter(x => /presentie/i.test(x.wat)).length, 0, 'de regel blijft staan nadat hij is gedaan');
});

test('de aandachtslijst draagt geen inhoud over een kind', async () => {
  // een kind gebruikt de hulplijn met een tekst die nergens mag opduiken
  const melding = await fnd('/school/hulplijn', { code: gezin.code, token: kindToken, klasCode: klas.code,
    tekst: 'ik word gepest door iemand uit groep acht', acuut: true });
  assert.equal(melding.status, 200);

  const r = (await kl('/school/aandacht')).body;
  const rij = r.nu.find(x => /hulplijn/i.test(x.wat));
  assert.ok(rij, 'een acute melding hoort in de bak "nu"');
  assert.equal(rij.aantal, 1);

  /* De grens: wat er wacht en hoeveel, en verder niets. Geen naam van het kind,
     geen sleutel, en zeker niet de tekst van de melding zelf. */
  const tekst = JSON.stringify(r);
  assert.doesNotMatch(tekst, /gepest|groep acht/i, 'de tekst van een hulpvraag staat in de aandachtslijst');
  assert.doesNotMatch(tekst, /Fien|sleutel|profielId/i, 'de aandachtslijst noemt een kind');
});

test('de aandachtslijst bewaart niets: geen geschiedenis van hoe snel iemand hem leegwerkt', async () => {
  const een = (await kl('/school/aandacht')).body;
  const twee = (await kl('/school/aandacht')).body;
  assert.deepEqual(een.nu, twee.nu, 'de lijst wordt uitgerekend en niet bewaard');
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'school', 'aandacht.js'), 'utf8');
  assert.doesNotMatch(bron, /\bsave\(/, 'de aandachtslijst kan opeens opslaan');
  assert.doesNotMatch(JSON.stringify(een), /doorlooptijd|sinds|opgelost|gemiddelde/i);
});

test('een les rondt zichzelf niet af, en het verslag gaat over de les', async () => {
  await kl('/school/huiswerk/maak', { titel: 'Breuken', doel: 'rekenen.g6.breuken-vergelijken', deadline: vandaag() });

  const concept = (await kl('/school/les/concept')).body;
  assert.equal(concept.presentie.gezet, true, 'de presentie van vandaag staat in het concept');
  assert.ok(concept.presentie.telling.aanwezig >= 1);
  assert.ok(concept.doelen.length >= 1, 'wat vandaag aan de orde was, staat erin');
  assert.match(concept.uitleg, /niets vastgelegd tot u het bevestigt/i);
  assert.equal(concept.alAfgerond, false);

  // zonder bevestiging gebeurt er niets
  const zonder = await kl('/school/les/rond-af', { doelen: concept.doelen, door: 'Juf Wilma' });
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /mens die bevestigt/i);
  // en zonder naam ook niet
  assert.equal((await kl('/school/les/rond-af', { bevestigd: true, doelen: concept.doelen })).status, 400);

  const af = await kl('/school/les/rond-af', { bevestigd: true, door: 'Juf Wilma', doelen: concept.doelen,
    telling: concept.presentie.telling, werkte: 'de strook op het bord werkte beter dan de uitleg in het boek',
    liepVast: 'gelijknamig maken bleef hangen' });
  assert.equal(af.status, 200);

  const geheugen = (await kl('/school/les/geheugen', { doel: concept.doelen[0] })).body;
  assert.doesNotMatch(JSON.stringify(geheugen), /Fien|sleutel|profielId/i);
});

/* Het verslag blijft jaren liggen, dus er hoort geen kind in. Op de OPSLAGVORM
   gemeten en niet op het antwoord: het geheugen-antwoord kiest zelf een paar
   velden uit, dus een presentieregel met namen die stil in de database belandt
   komt daar gewoon doorheen. Deze toets zet de sleutelverzameling vast. */
test('een lesverslag draagt alleen de telling, nooit een leerling', () => {
  const scho = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 200);
  const klasje = { code: 'K1', naam: '6A', fase: 'po-g6',
    leerlingen: [{ sleutel: 'abc', naam: 'Fien' }] };
  const les = verslagVan(klasje, { door: 'Juf Wilma', doelen: ['rekenen.g6.breuken-vergelijken'],
    telling: { aanwezig: 24, ziek: 2 }, werkte: 'de strook', liepVast: 'gelijknamig maken',
    /* wat een client er ook bijstuurt, het hoort er niet in te komen */
    regels: [{ leerling: 'abc', naam: 'Fien', stand: 'ziek' }], leerlingen: ['abc'] },
    'id1', '2026-08-19T10:00:00.000Z', scho);

  assert.deepEqual(Object.keys(les).sort(), VELDEN.slice().sort(), 'de vorm van een lesverslag is veranderd');
  assert.deepEqual(les.aanwezig, { aanwezig: 24, ziek: 2 }, 'alleen de telling gaat mee');
  assert.doesNotMatch(JSON.stringify(les), /Fien|abc/, 'er belandt een leerling in het lesverslag');
  assert.equal(les.door, 'Juf Wilma', 'met de eigenaar erbij');
});

test('wat een les opschrijft, komt terug bij hetzelfde leerdoel', async () => {
  const g = (await kl('/school/les/geheugen', { doel: 'rekenen.g6.breuken-vergelijken' })).body;
  assert.equal(g.eerder.length, 1);
  assert.match(g.eerder[0].werkte, /strook op het bord/);
  assert.match(g.eerder[0].liepVast, /gelijknamig/);
  assert.equal(g.eerder[0].door, 'Juf Wilma', 'met de naam van wie het opschreef');
  assert.ok(g.eerder[0].datum);

  // bij een leerdoel waarover niets is opgeschreven, staat dat er eerlijk
  const leeg = (await kl('/school/les/geheugen', { doel: 'taal.g6.cht-ch' })).body;
  assert.equal(leeg.eerder.length, 0);
  assert.match(leeg.uitleg, /nog niets opgeschreven/i);
});
