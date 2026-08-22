/* De taallaag: niet overal een vertaalknop, en niets naar een gezin zonder dat
   een mens de terugvertaling heeft gezien.

   De beloftes die hier hard worden gemaakt:

   - bij een taalvak kan de steun NOOIT op volledig, wat een school ook
     instelt. Taal leren is iets anders dan leren ondanks een taalbarriere;
   - een teruggezette keuze wordt gemeld en niet stil bijgesteld, want anders
     denkt een school dat het aanstaat;
   - de betekeniscontrole vangt de vier dingen die er nooit uit mogen vallen:
     ontkenning, verplichting, getallen en data. Inclusief het klassieke geval
     waar "moet aanwezig zijn" terugkomt als "zou aanwezig moeten zijn";
   - een vertaald bericht gaat pas weg met een bevestiging EN een naam, en bij
     een verschoven betekenis pas na een aparte bevestiging;
   - elk verstuurd bericht draagt een bon: welk model, wat er wel en niet in
     ging, wanneer en op wiens naam.
   Draai los: node --experimental-sqlite --test test/taallaag.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { vergelijk, moetGezienWorden } = require('../server/kern/betekenis');
const { steunVoor, maximum, schoonBeleid, isTaalvak } = require('../server/kern/taalbeleid');

let srv, base, sch, leraar, klas;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taal-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const kl = (pad, body) => fnd(pad, Object.assign({ klasCode: klas.code,
  personeelToken: leraar.personeelToken, schoolCode: sch.schoolCode }, body || {}));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Toren', plaats: 'Almere' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
  leraar = (await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Ilias', rol: 'leraar' })).body;
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    personeelId: leraar.personeelId, akkoord: true });
  klas = (await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken,
    naam: '8A', trap: 'po', fase: 'po-g8' })).body;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- het beleid: de regel die geen instelling is ---------- */
test('bij een taalvak kan de steun nooit op volledig, wat een school ook instelt', () => {
  assert.equal(steunVoor('rekenen', {}), 'volledig', 'bij een concept meet je niet de taal');
  assert.equal(steunVoor('taal', {}), 'instructie');
  assert.equal(steunVoor('nederlands', {}), 'instructie');

  // een school die het toch probeert, krijgt het maximum van het vak
  assert.equal(steunVoor('nederlands', { nederlands: 'volledig' }), 'instructie',
    'een school kan de meting van zijn eigen taalonderwijs uitzetten');
  assert.equal(steunVoor('engels', { engels: 'volledig' }), 'instructie');
  // naar beneden mag wel: scholen verschillen
  assert.equal(steunVoor('rekenen', { rekenen: 'geen' }), 'geen');
  assert.equal(steunVoor('taal', { taal: 'geen' }), 'geen');

  // en wat we niet kennen valt op de veilige middenweg terug
  assert.equal(steunVoor('ditvakbestaatniet', {}), 'instructie');
  assert.equal(maximum('wiskunde'), 'volledig');
  assert.equal(maximum('frans'), 'instructie');
  assert.equal(isTaalvak('DUITS'), true);

  // het opslaan zet het al terug, zodat er niets ligt wat niet mag
  assert.deepEqual(schoonBeleid({ nederlands: 'volledig', rekenen: 'volledig', onzin: 'watdanook' }),
    { nederlands: 'instructie', rekenen: 'volledig' });
});

test('een teruggezette keuze wordt gemeld en niet stil bijgesteld', async () => {
  const r = await fnd('/school/taalbeleid/zet', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken,
    beleid: { nederlands: 'volledig', rekenen: 'geen' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.beleid.nederlands, 'instructie');
  assert.equal(r.body.beleid.rekenen, 'geen');
  assert.deepEqual(r.body.teruggezet, ['nederlands'], 'stil bijstellen laat een school denken dat het aanstaat');
  assert.match(r.body.uitleg, /taal zelf/i);

  const lijst = (await kl('/school/taalbeleid')).body;
  const nl = lijst.vakken.find(v => v.vak === 'nederlands');
  assert.equal(nl.steun, 'instructie');
  assert.equal(nl.maximum, 'instructie');
  assert.match(nl.reden, /taal zelf/i, 'een leerling hoort te weten waarom er geen vertaling is');
  assert.equal(lijst.vakken.find(v => v.vak === 'rekenen').steun, 'geen');
});

/* ---------- de betekeniscontrole, los ---------- */
test('de vier dingen die er nooit uit mogen vallen, worden gevangen', () => {
  // het klassieke geval uit SCHOOL.md: tellen alleen vangt dit niet
  const zwak = vergelijk('Uw kind moet morgen aanwezig zijn.', 'Uw kind zou morgen aanwezig moeten zijn.');
  assert.equal(zwak.length, 1);
  assert.equal(zwak[0].soort, 'verplichting');
  assert.equal(moetGezienWorden(zwak), true);

  assert.equal(vergelijk('De avond is niet op 12-09.', 'De avond is op 12-09.')[0].soort, 'ontkenning');
  assert.equal(vergelijk('De bijdrage is 12,50 euro.', 'De bijdrage is 1250 euro.')[0].soort, 'getal');
  assert.equal(vergelijk('De excursie is op 12 september.', 'De excursie is in het najaar.')
    .map(v => v.soort).includes('datum'), true);

  // en een vertaling die hetzelfde zegt, levert niets op
  assert.deepEqual(vergelijk('Uw kind moet morgen aanwezig zijn.', 'Uw kind moet er morgen zijn.'), []);
  assert.equal(moetGezienWorden([]), false);
});

/* ---------- de poort naar het gezin ---------- */
test('een vertaald bericht gaat niet weg zonder mens, en draagt een bon', async () => {
  const c = await kl('/school/bericht/controleer', { tekst: 'Uw kind moet morgen om 8 uur aanwezig zijn.', taal: 'en' });
  assert.equal(c.status, 200, JSON.stringify(c.body).slice(0, 160));
  assert.ok(c.body.vertaling && c.body.terug, 'de terugvertaling hoort erbij');
  assert.ok(Array.isArray(c.body.verschillen));

  /* De vertaal-AI ziet alleen de tekst: dat staat op de bon, en de bon zegt met
     zoveel woorden wat er NIET in ging. */
  assert.ok(c.body.bon.nietGebruikt.includes('het leerlingdossier'));
  assert.deepEqual(c.body.bon.gebruikt, ['de tekst van dit bericht']);

  // zonder naam gaat er niets weg
  assert.equal((await kl('/school/bericht/verstuur', { bevestigd: true, tekst: 'x', vertaling: 'y' })).status, 400);
  // en zonder bevestiging ook niet
  const zonder = await kl('/school/bericht/verstuur', { door: 'Meester Ilias', tekst: 'x', vertaling: 'y' });
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /terugvertaling/i);

  // bij een verschoven betekenis is bevestigen niet genoeg
  const verschoven = [{ soort: 'verplichting', ernst: 'hoog', wat: 'afgezwakt' }];
  const stop = await kl('/school/bericht/verstuur', { bevestigd: true, door: 'Meester Ilias',
    tekst: 'Uw kind moet morgen aanwezig zijn.', vertaling: 'Your child should be there.', taal: 'en', verschillen: verschoven });
  assert.equal(stop.status, 409);
  assert.match(stop.body.error, /apart/i);

  const weg = await kl('/school/bericht/verstuur', { bevestigd: true, verschillenGezien: true, door: 'Meester Ilias',
    tekst: 'Uw kind moet morgen aanwezig zijn.', vertaling: 'Your child must be present tomorrow.',
    taal: 'en', verschillen: verschoven, model: 'woordenboek' });
  assert.equal(weg.status, 200);
  assert.equal(weg.body.bon.door, 'Meester Ilias', 'geen bonnetje, geen bericht');
  assert.equal(weg.body.bon.gezien, true);
  assert.ok(weg.body.bon.op);
  assert.deepEqual(weg.body.bon.verschillen, ['verplichting']);
});
