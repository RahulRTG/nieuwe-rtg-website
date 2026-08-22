/* De Language Independence Test: dezelfde vraag opnieuw gesteld in de thuistaal.

   De beloftes die hier hard worden gemaakt:

   - de vraag wordt OPNIEUW GESTELD uit dezelfde bouwstenen en niet vertaald,
     dus het antwoord verandert niet -- alleen de zin;
   - bij een taalvak draait de test niet: daar is de zin zelf wat je meet, en
     dan zou de vergelijking de meting weghalen;
   - is er voor deze taal geen vorm van deze opgave, dan gebeurt er niets. Een
     half vertaalde vraag is een andere vraag;
   - de uitkomst is een aanwijzing voor een gesprek: een zin met "lijkt", zonder
     niveau, zonder score en zonder etiket;
   - en er wordt niets opgeslagen. Wat je niet kunt bewaren, kan later niet aan
     een kind blijven plakken.
   Draai los: node --experimental-sqlite --test test/taalcheck.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { inTaal, talenVoor } = require('../server/kern/leerstof-taalvorm');
const { mag, duiding, paren, VRAGEN } = require('../server/kern/taalcheck');
const { opgave } = require('../server/kern/leerstof-gen');
const { DOELEN } = require('../server/kern/leerstof');

let srv, base, sch, leraar, klas, gezin, kind, kindToken, sleutel;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taalcheck-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Horizon', plaats: 'Tilburg' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Mentor Dara', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '6C', trap: 'po', fase: 'po-g6' })).body;
  gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Horizon', naam: 'Ouder Horizon', pin: '4321' })).body;
  kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Amir', rol: 'kind', groep: 'kind' })).body;
  kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
  sleutel = (await kl('/school/klas')).body.leerlingen[0].sleutel;
  // de thuistaal van dit kind
  await fnd('/school/taal', { code: gezin.code, token: kindToken, klasCode: klas.code, taal: 'en' });
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- de vorm: opnieuw gesteld, niet vertaald ---------- */
test('dezelfde bouwstenen leveren dezelfde som, in beide talen', () => {
  for (let i = 0; i < 20; i++) {
    for (const gen of [{ soort: 'procent', procenten: [25] }, { soort: 'metriek' },
      { soort: 'afronden', stappen: [10] }, { soort: 'negatief', max: 8 }]) {
      const o = opgave(gen);
      const en = inTaal(o.feit, 'en');
      assert.ok(en, 'geen Engelse vorm voor ' + gen.soort);
      assert.notEqual(en, o.v, 'de zin hoort te verschillen, anders is er niets gesteld');
      /* De kern: het ANTWOORD verandert niet. Het volgt uit de bouwstenen en
         niet uit de zin -- daarom is dit opnieuw stellen en geen vertalen. */
      assert.equal(inTaal(o.feit, 'nl'), o.v, 'de Nederlandse vorm hoort de oorspronkelijke vraag terug te geven');
    }
  }
  /* Een kale som heeft geen taal: daar is de zin in beide talen identiek, en
     dan valt er niets te vergelijken. Dat is geen tekortkoming maar de reden
     dat de test zich daar terugtrekt. */
  const tafel = opgave({ soort: 'tafel', tafels: [7] });
  assert.equal(inTaal(tafel.feit, 'en'), tafel.v, '7 x 7 = heeft in geen enkele taal een andere zin');
  // en voor wat er niet is, komt er niets
  assert.equal(inTaal({ soort: 'tafel', n: 3, t: 7 }, 'zz'), null);
  assert.equal(inTaal({ soort: 'lezen' }, 'en'), null);
  assert.deepEqual(talenVoor({ soort: 'tafel' }), ['nl', 'en']);
});

/* ---------- de poort ---------- */
test('bij een taalvak draait de test niet, en dat wordt uitgelegd', () => {
  const reken = mag(DOELEN['rekenen.g7.procenten'], 'en', {});
  assert.equal(reken.mag, true);

  const taal = mag(DOELEN['taal.g7.leestekens'], 'en', {});
  assert.equal(taal.mag, false);
  assert.match(taal.waarom, /taal zelf/i);
  assert.match(taal.waarom, /meting weghalen/i, 'een leerling hoort te horen waarom iets niet kan');

  // een school die de steun heeft dichtgezet, krijgt de test ook niet
  assert.equal(mag(DOELEN['rekenen.g6.kommagetallen'], 'en', { rekenen: 'geen' }).mag, false);
  assert.equal(mag(DOELEN['rekenen.g7.procenten'], null, {}).mag, false);
  assert.equal(mag(null, 'en', {}).mag, false);
});

test('zonder vorm, of met dezelfde zin, gebeurt er niets', () => {
  // geen feit: geen vorm, dus geen vergelijking
  assert.equal(paren({ gen: { soort: 'lezen' } }, 'en', () => ({ a: 'x', v: 'y', feit: null })), null);
  // wel een vorm, maar dezelfde zin: dan meet de vergelijking twee keer hetzelfde
  assert.equal(paren(DOELEN['rekenen.g5.tafels-tot-10'], 'en', opgave), null,
    'bij een kale som hoort de test zich terug te trekken');
  // en waar de zin echt verschilt, kan het wel
  assert.ok(paren(DOELEN['rekenen.g7.procenten'], 'en', opgave), 'bij procenten verschilt de zin wel');
});

/* ---------- de duiding: een aanwijzing en geen oordeel ---------- */
test('de uitkomst is een aanwijzing voor een gesprek, zonder niveau of etiket', () => {
  const beter = duiding(1, 3, 3);
  assert.equal(beter.soort, 'taal-lijkt-relevanter');
  assert.match(beter.zin, /lijkt/, 'een conclusie zonder "lijkt" is een diagnose');
  assert.match(beter.watNu, /gesprek/i);

  assert.equal(duiding(3, 3, 3).soort, 'geen-verschil');
  assert.equal(duiding(0, 0, 3).soort, 'stof-zelf');
  assert.match(duiding(0, 0, 3).watNu, /voorkennis/i, 'bij beide moeilijk hoort de leerlijn het antwoord te zijn');
  assert.equal(duiding(3, 0, 3).soort, 'onduidelijk');

  /* Geen niveau, geen score, geen etiket -- in geen van de vier uitkomsten. */
  for (const [nl, th] of [[1, 3], [3, 3], [0, 0], [3, 0]]) {
    const d = duiding(nl, th, 3);
    assert.doesNotMatch(JSON.stringify(d), /niveau|taalachterstand|zwak|score|percentage|\bNT2\b/i,
      'er komt een etiket uit de taalvergelijking');
  }
});

/* ---------- en door de machine heen ---------- */
test('zes vragen, dezelfde sommen, en er blijft niets achter', async () => {
  const start = await kl('/school/taalcheck/start', { leerling: sleutel, doel: 'rekenen.g7.procenten' });
  assert.equal(start.status, 200, JSON.stringify(start.body).slice(0, 160));
  assert.equal(start.body.totaal, VRAGEN * 2);
  assert.equal(start.body.ronde, 'nl');
  assert.equal(start.body.taal, 'en');

  // alles fout: dan wijst het naar de stof en niet naar de taal
  let r = start.body;
  for (let i = 0; i < VRAGEN * 2; i++) r = (await kl('/school/taalcheck/antwoord', { leerling: sleutel, antwoord: 'fout' })).body;
  assert.equal(r.klaar, true);
  assert.equal(r.uitkomst.soort, 'stof-zelf');
  assert.match(r.uitleg, /niets vastgelegd/i);

  // de sessie is weg: een afgeronde vergelijking blijft niet liggen
  assert.equal((await kl('/school/taalcheck/antwoord', { leerling: sleutel, antwoord: 'x' })).status, 400);

  /* En er wordt niets vastgelegd. Dat is op de MODULE gemeten en niet op een
     antwoord: een uitkomst die stil in de database belandt komt niet
     noodzakelijk terug in het klasoverzicht, en juist die zou aan een kind
     blijven plakken. Deze module kan niet opslaan -- er staat geen save(). */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'school', 'taalcheck.js'), 'utf8');
  assert.doesNotMatch(bron, /\bsave\(/, 'de taalvergelijking kan opeens opslaan');
  assert.doesNotMatch(bron, /\.taalcheck\s*=|\.taalniveau\s*=/, 'er wordt een uitkomst aan een leerling gehangen');

  // een taalvak wordt geweigerd met een uitleg
  const nee = await kl('/school/taalcheck/start', { leerling: sleutel, doel: 'taal.g7.leestekens' });
  assert.equal(nee.status, 400);
  assert.match(nee.body.error, /taal zelf/i);
});
