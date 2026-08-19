/* Belasting: de donderdag van de leerling en de week van de docent.

   De beloftes die hier hard worden gemaakt:

   - een dag telt over vakken EN klassen heen. Zes docenten die onafhankelijk
     huiswerk geven, zien elk hun eigen vak; het kind ziet de donderdag;
   - van een andere klas telt alleen het AANTAL: geen titel, geen vak, geen
     leraar. Een docent hoort te zien dat er iets elders valt, niet wat;
   - er wordt niets bewaard: geen geschiedenis van hoe snel iemand zijn stapel
     wegwerkt, en dat kan er ook niet later bij komen;
   - het advies gaat over verplaatsen en niet over harder werken;
   - een item zonder datum telt niet mee: een deadline zonder dag is er geen.
   Draai los: node --experimental-sqlite --test test/belasting.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { week, DREMPEL } = require('../server/kern/belasting');

let srv, base, sch, leraar, klas, klasB, gezin, kind, kindToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-belasting-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));
const dagOver = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Spil', plaats: 'Venlo' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Rein', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '3A', trap: 'vo', fase: 'havo' })).body;
  klasB = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: 'Wiskunde 3', trap: 'vo', fase: 'havo' })).body;

  gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Spil', naam: 'Ouder Spil', pin: '4321' })).body;
  kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Tycho', rol: 'kind', groep: 'kind' })).body;
  kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  for (const k of [klas, klasB]) {
    await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: k.code, profielId: kind.profiel.id });
    await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: k.code, akkoord: true });
  }
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de telling los ---------- */
test('een dag loopt vol bij drie stukken, en het advies gaat over verplaatsen', () => {
  const d = '2026-09-10';
  const twee = week([{ datum: d, soort: 'huiswerk' }, { datum: d, soort: 'so' }], d, 3);
  assert.equal(twee.dagen[0].aantal, 2);
  assert.equal(twee.dagen[0].vol, false);
  assert.deepEqual(twee.volle, []);
  assert.match(twee.advies, /geen dag vol/i);

  const drie = week([{ datum: d, soort: 'huiswerk' }, { datum: d, soort: 'so' }, { datum: d, soort: 'toets' }], d, 3);
  assert.equal(drie.dagen[0].vol, true);
  assert.deepEqual(drie.volle, [d]);
  /* Het advies gaat over VERPLAATSEN. "Werk het weg" zou van hulp een meetlat
     maken, en dat is precies wat grens 8 verbiedt. */
  assert.match(drie.advies, /verplaatsen/i);
  assert.doesNotMatch(drie.advies, /achterstand|te traag|sneller|wegwerken/i);
  assert.equal(DREMPEL, 3, 'de drempel is verschoven; is dat bewust?');

  // een stuk zonder datum telt niet mee: een deadline zonder dag is er geen
  const zonder = week([{ soort: 'huiswerk' }, { datum: null, soort: 'toets' }], d, 3);
  assert.equal(zonder.dagen.reduce((n, r) => n + r.aantal, 0), 0);
});

test('de telling ziet geen titel en geen naam', () => {
  const d = '2026-09-10';
  const met = week([{ datum: d, soort: 'huiswerk', titel: 'Hoofdstuk 4 maken', naam: 'Tycho' }], d, 1);
  const zonder = week([{ datum: d, soort: 'huiswerk' }], d, 1);
  assert.deepEqual(met, zonder, 'de telling neemt iets over dat er niet in hoort');
  assert.doesNotMatch(JSON.stringify(met), /Hoofdstuk|Tycho/);
});

/* ---------- en door de machine heen ---------- */
test('de donderdag van de leerling telt over klassen heen, zonder wat elders staat', async () => {
  const donderdag = dagOver(3);
  await kl('/school/huiswerk/maak', { titel: 'Verslag natuurkunde', vak: 'natuurkunde', deadline: donderdag });
  await kl('/school/toets/maak', { soort: 'so', naam: 'SO breuken', doelen: ['rekenen.g7.procenten'], datum: donderdag });
  // en in de andere klas van hetzelfde kind zet een collega er nog iets op
  await fnd('/school/huiswerk/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    klasCode: klasB.code, titel: 'Geheime opdracht van de collega', vak: 'wiskunde', deadline: donderdag });

  const r = await kl('/school/belasting/klas');
  assert.equal(r.status, 200);
  const dag = r.body.dagen.find(x => x.datum === donderdag);
  assert.equal(dag.aantal, 3, 'de donderdag telt over klassen heen');
  assert.equal(dag.eigen, 2);
  assert.equal(dag.elders, 1);
  assert.equal(dag.vol, true);
  assert.deepEqual(r.body.volle, [donderdag]);

  /* Van de andere klas komt alleen het aantal mee. Dat wordt op TWEE plekken
     dichtgehouden -- school/belasting.js zet het vak van een andere klas op
     null, en kern/belasting.js geeft alleen het AANTAL vakken door -- dus meet
     deze toets de uitkomst en niet een van die twee lagen: er komt geen
     vaknaam en geen titel uit, van welke klas dan ook. */
  assert.equal(typeof dag.vakken, 'number', 'de weekweergave noemt vakken bij naam');
  assert.doesNotMatch(JSON.stringify(r.body), /Geheime opdracht|wiskunde|natuurkunde/i,
    'het werk van een collega lekt in de weekweergave');
  assert.match(r.body.uitleg, /alleen het aantal/i);
});

test('de week van de docent is planning en houdt niets bij', async () => {
  const een = await fnd('/school/belasting/mij', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken });
  assert.equal(een.status, 200);
  assert.equal(een.body.klassen, 2);
  assert.ok(een.body.dagen.length >= 7);
  assert.match(een.body.uitleg, /niet bijgehouden hoe snel/i);

  const twee = await fnd('/school/belasting/mij', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken });
  assert.deepEqual(een.body.dagen, twee.body.dagen, 'het beeld wordt uitgerekend en niet bewaard');

  /* De sterkste vorm van die belofte staat in de module zelf: hij schrijft
     niet, dus er valt geen geschiedenis van te maken. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'school', 'belasting.js'), 'utf8');
  assert.doesNotMatch(bron, /\bsave\(/, 'de belastingweergave kan opeens opslaan');
  assert.doesNotMatch(JSON.stringify(een.body), /score|tempo|doorlooptijd|gemiddeld/i);
});
