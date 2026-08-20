/* Binnenkomen: de vervanger en de nieuwe docent.

   De beloftes die hier hard worden gemaakt:

   - een vervanger krijgt de klas, wat er vandaag speelt en het materiaal, plus
     wat eerdere lessen erover schreven -- en verder NIETS. Geen zorgdossier,
     geen incidenten, geen leerlingdossier;
   - de briefing zegt zelf wat er niet in staat. Een vervanger die denkt dat hij
     alles ziet, gaat ervan uit dat er niets speelt;
   - een waarneming verloopt vanzelf. Een overname zonder einde is een tweede
     vaste leraar via de achterdeur;
   - een nieuwe docent krijgt hoogstens vijf stappen, afgeleid uit de stand van
     zaken, en er wordt niet bijgehouden hoe ver hij is.
   Draai los: node --experimental-sqlite --test test/instap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { HUISREGELS, stappenVan } = require('../server/school/instap');
const { loopt, totWanneer, MAX_DAGEN } = require('../server/school/waarneming');

let srv, base, sch, leraar, inval, klas, gezin, kind, kindToken;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-instap-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Brug', plaats: 'Gouda' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  const maak = async (naam) => {
    const p = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam, rol: 'leraar' })).body;
    await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
      personeelId: p.personeelId, akkoord: true });
    return p;
  };
  leraar = await maak('Meester Joris');
  inval = await maak('Invaller Kim');
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '7B', trap: 'po', fase: 'po-g7' })).body;

  gezin = (await fnd('/gezin/maak', { gezinsnaam: 'Familie Brug', naam: 'Ouder Brug', pin: '4321' })).body;
  kind = (await fnd('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Joep', rol: 'kind', groep: 'kind' })).body;
  kindToken = (await fnd('/gezin/profiel/kies', { code: gezin.code, profielId: kind.profiel.id })).body.token;
  await fnd('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kind.profiel.id });
  await fnd('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* De regel zelf, los. Via de API is een verlopen waarneming niet te maken --
   je kunt er geen datum in het verleden aan geven -- dus zou een toets die
   alleen door de machine heen loopt nooit merken dat de vervaldatum wordt
   genegeerd. Daarom staat de regel op een plek en wordt hij hier nagerekend. */
test('een verlopen waarneming geeft geen toegang meer', () => {
  const nu = '2026-08-19T12:00:00.000Z';
  assert.equal(loopt({ id: 'a', tot: '2026-09-01T00:00:00.000Z' }, nu), true);
  assert.equal(loopt({ id: 'a', tot: '2026-08-18T00:00:00.000Z' }, nu), false, 'een afgelopen waarneming geeft nog toegang');
  assert.equal(loopt(null, nu), false);
  // waarnemingen van voor deze regel dragen geen datum en blijven staan tot iemand ze stopt
  assert.equal(loopt({ id: 'a' }, nu), true);
  // en de bovengrens is negentig dagen, hoeveel je ook vraagt
  const ver = new Date(totWanneer(3650, Date.parse(nu))) - Date.parse(nu);
  assert.equal(Math.round(ver / 86400000), MAX_DAGEN);
});

test('een waarneming verloopt vanzelf, en dat staat erbij', async () => {
  const o = await fnd('/school/klas/overname', { schoolCode: sch.schoolCode,
    personeelToken: inval.personeelToken, klasCode: klas.code });
  assert.equal(o.status, 200);
  assert.ok(o.body.waarnemer.tot, 'een overname zonder einde is een tweede vaste leraar via de achterdeur');
  assert.ok(o.body.waarnemer.tot > new Date().toISOString());
  assert.match(o.body.uitleg, /stopt dan vanzelf/i);

  // en langer dan drie maanden kan niet, ook niet als je erom vraagt
  const lang = await fnd('/school/klas/overname', { schoolCode: sch.schoolCode,
    personeelToken: inval.personeelToken, klasCode: klas.code, dagen: 3650 });
  const dagen = (new Date(lang.body.waarnemer.tot) - Date.now()) / 86400000;
  assert.ok(dagen <= 91, 'een waarneming van tien jaar: ' + Math.round(dagen) + ' dagen');
});

test('de vervanger krijgt de les en het materiaal, en verder niets', async () => {
  await kl('/school/huiswerk/maak', { titel: 'Procenten', doel: 'rekenen.g7.procenten',
    deadline: new Date().toISOString().slice(0, 10) });
  await kl('/school/les/rond-af', { bevestigd: true, door: 'Meester Joris', doelen: ['rekenen.g7.procenten'],
    werkte: 'eerst met een strook van honderd hokjes', liepVast: 'het woord "van" in "20% van"' });

  const b = await fnd('/school/vervanging/briefing', { klasCode: klas.code, personeelToken: inval.personeelToken });
  assert.equal(b.status, 200, 'de waarnemer komt er niet in: ' + JSON.stringify(b.body).slice(0, 120));
  assert.equal(b.body.klas.naam, '7B');
  assert.ok(b.body.namen.includes('Joep'), 'zonder naam kan een vervanger niemand aanspreken');
  assert.ok(b.body.materiaal.length >= 1, 'het materiaal van vandaag hoort erbij');
  assert.ok(b.body.materiaal[0].les.length > 20);
  assert.ok(b.body.materiaal[0].uitleg.length >= 1, 'juist een vervanger heeft aan een tweede uitleg wat');

  // Teaching Memory: wat de vaste leraar over deze stof opschreef
  assert.equal(b.body.eerder.length, 1);
  assert.match(b.body.eerder[0].werkte, /strook van honderd/);
  assert.equal(b.body.eerder[0].door, 'Meester Joris');

  /* De Child Context Firewall, gemeten op de VORM van de briefing en niet op
     losse woorden: die laatste manier struikelt over het veld dat juist zegt
     wat er niet in staat. Dit is de hele briefing; er een zorgveld bij zetten
     laat deze toets zakken. */
  assert.deepEqual(Object.keys(b.body).sort(),
    ['eerder', 'klas', 'materiaal', 'namen', 'nietHierin', 'ok', 'uitleg', 'vandaag', 'waarnemer'],
    'de vorm van de briefing is veranderd; kijk of er iets bij zit dat een vervanger niet hoort te zien');
  assert.deepEqual(Object.keys(b.body.klas).sort(), ['code', 'fase', 'leerlingen', 'naam']);
  // en de briefing zegt zelf wat er niet in staat: zonder die zin denkt een
  // vervanger dat hij alles ziet, en dus dat er niets speelt
  assert.ok(b.body.nietHierin.includes('het zorgdossier'));
  assert.ok(b.body.nietHierin.includes('incidenten'));
  assert.match(b.body.uitleg, /bewust niet/i);
});

test('de nieuwe docent krijgt hoogstens vijf dingen, uit de stand van zaken', async () => {
  const nieuw = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Sanne', rol: 'leraar' })).body;

  // nog niet goedgekeurd: dan is dat het eerste dat er staat
  const wacht = (await fnd('/school/personeel/start', { schoolCode: sch.schoolCode, personeelToken: nieuw.personeelToken })).body;
  assert.match(wacht.stappen[0].wat, /goedkeuring/i);
  assert.ok(wacht.stappen.length <= 5);

  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: nieuw.personeelId, akkoord: true });
  const na = (await fnd('/school/personeel/start', { schoolCode: sch.schoolCode, personeelToken: nieuw.personeelToken })).body;

  // wat af is valt weg: de goedkeuring staat er niet meer
  assert.equal(na.stappen.filter(s => /goedkeuring/i.test(s.wat)).length, 0);
  assert.match(na.stappen[0].wat, /nog niet op een klas/i, 'zonder klas is dat het eerste');
  for (const s of na.stappen) assert.ok(s.waarom.length > 20, 'elke stap zegt waarom hij er staat');

  // de drie huisregels staan erbij, en het zijn er drie
  assert.equal(na.huisregels.length, 3);
  assert.deepEqual(na.huisregels, HUISREGELS);
  assert.match(na.huisregels.join(' '), /geen wedstrijd/i);

  // en er wordt niet bijgehouden hoe ver iemand is
  assert.doesNotMatch(JSON.stringify(na), /voltooid|voortgang|\d\s*van de 5|percentage/i);
  const twee = (await fnd('/school/personeel/start', { schoolCode: sch.schoolCode, personeelToken: nieuw.personeelToken })).body;
  assert.deepEqual(na.stappen, twee.stappen, 'de lijst wordt uitgerekend en niet bewaard');
});

/* "Vijf dingen, niet vijfhonderd" is geen afkapgrens maar een EIGENSCHAP: er
   kunnen er maar vijf tegelijk waar zijn. Een afkapgrens bij vijf zou verbergen
   dat er een zesde bijkwam; deze toets loopt alle standen langs en rekent het
   na. Er een stap bij zetten laat hem dus zakken, en dat is de bedoeling. */
test('over alle standen zijn het er nooit meer dan vijf', () => {
  let grootste = 0;
  for (const actief of [true, false])
    for (const klassen of [0, 1, 3])
      for (const hulp of [0, 2])
        for (const zonderPresentie of [[], ['5A'], ['5A', '5B']]) {
          const rij = stappenVan({ actief, klassen, hulp, zonderPresentie });
          grootste = Math.max(grootste, rij.length);
          for (const s of rij) assert.ok(s.wat && s.waarom, 'een stap zonder reden');
        }
  assert.equal(grootste, 5, 'er kunnen nu ' + grootste + ' dingen tegelijk waar zijn; vijf is de belofte');

  // en wat af is valt weg: goedgekeurd en met een klas is de lijst korter
  const net = stappenVan({ actief: false, klassen: 0, hulp: 0, zonderPresentie: [] });
  const later = stappenVan({ actief: true, klassen: 2, hulp: 0, zonderPresentie: [] });
  assert.ok(later.length < net.length + 1);
  assert.equal(net.filter(s => /goedkeuring/i.test(s.wat)).length, 1);
  assert.equal(later.filter(s => /goedkeuring/i.test(s.wat)).length, 0);
});
