/* De Integration Fabric: wat gaat er mee bij een overstap, en in welke vorm.

   De beloftes die hier hard worden gemaakt:

   - er gaat geen dossier mee maar een pakket per doel, en het pakket zegt
     ALTIJD wat er niet in zit en waarom;
   - zorg, incidenten en het journaal staan op "nooit" en gaan ook MET
     toestemming niet mee;
   - toestemming is een handeling met een naam, geen stand: zonder genoteerde
     toestemming gaan die velden niet mee;
   - een gegeven dat niet op de kaart staat, glijdt er niet stilletjes in;
   - een veld van buiten dat wij niet kennen wordt geweigerd en gemeld: ons
     model groeit niet mee met wat een leverancier stuurt (grens 12);
   - elke standaard zegt wat hij NIET kan dragen -- eerlijk in de code is niet
     genoeg als het antwoord het verzwijgt.
   Draai los: node --experimental-sqlite --test test/overdracht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stop } = require('./helper');
const { pakket, KAART } = require('../server/kern/overdracht');
const { naarBuiten, naarBinnen, STANDAARDEN } = require('../server/kern/koppelvlak');

let srv, base, sch;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-overdracht-'));
const fnd = (pad, body) => fetch(base + '/api/foundation' + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const bh = (pad, body) => fnd(pad, Object.assign({ schoolCode: sch.schoolCode, beheerToken: sch.beheerToken }, body || {}));

const KIND = { naam: 'Iris', geboren: '2016-03-02', herkomst: 'De Vlinder', opleiding: 'po',
  klasCode: 'K1', overstappen: [{ at: 'x' }], contact: { telefoon: '0612345678' },
  documenten: [{ id: 'd1' }], zorg: { plan: 'extra leestijd' }, incidenten: [{ wat: 'ruzie' }],
  journaal: [{ wie: 'directie' }], signalen: [{ soort: 'verzuim' }] };

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  sch = (await fnd('/school/school/maak', { naam: 'De Vonk', plaats: 'Zutphen' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: sch.schoolCode, action: 'goedkeuren' }) });
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ---------- wat gaat er mee ---------- */
test('zorg, incidenten en het journaal gaan ook met toestemming niet mee', () => {
  const alles = { door: 'Ouder Iris', velden: Object.keys(KAART) };
  const p = pakket(KIND, 'continuiteit', alles);

  for (const veld of ['zorg', 'incidenten', 'journaal', 'signalen']) {
    assert.equal(p.velden[veld], undefined, veld + ' gaat mee terwijl dat nooit mag');
    const reden = p.weggelaten.find(x => x.veld === veld);
    assert.equal(reden.klasse, 'nooit');
    assert.ok(reden.waarom.length > 30, 'er hoort een reden bij en niet alleen een vinkje');
  }
  assert.doesNotMatch(JSON.stringify(p.velden), /extra leestijd|ruzie/, 'de inhoud van een zorgplan lekt mee');
});

test('toestemming is een handeling met een naam, geen stand', () => {
  const zonder = pakket(KIND, 'inschrijving', null);
  assert.equal(zonder.velden.contact, undefined);
  assert.match(zonder.weggelaten.find(x => x.veld === 'contact').waarom, /geen toestemming genoteerd/i);
  assert.equal(zonder.toestemmingDoor, null);

  // een vlag zonder naam is geen toestemming
  const naamloos = pakket(KIND, 'inschrijving', { velden: ['contact'] });
  assert.equal(naamloos.velden.contact, undefined, 'toestemming zonder iemand die hem gaf');

  const met = pakket(KIND, 'inschrijving', { door: 'Ouder Iris', velden: ['contact'] });
  assert.ok(met.velden.contact, 'met een genoteerde toestemming gaat contact wel mee');
  assert.equal(met.velden.documenten, undefined, 'maar alleen de velden waar het over ging');
  assert.equal(met.toestemmingDoor, 'Ouder Iris');
});

test('het doel bepaalt wat er meegaat, en onbekende velden glijden er niet in', () => {
  const in1 = pakket(KIND, 'inschrijving', null);
  assert.ok(in1.velden.naam && in1.velden.geboren);
  assert.equal(in1.velden.opleiding, undefined, 'continuiteit hoort niet bij een inschrijving');
  assert.match(in1.weggelaten.find(x => x.veld === 'opleiding').waarom, /vraagt er niet om/i);

  const con = pakket(KIND, 'continuiteit', null);
  assert.ok(con.velden.opleiding && con.velden.klasCode && con.velden.naam);

  // iets wat niemand op de kaart heeft gezet, gaat niet mee -- en wordt gemeld
  const raar = pakket(Object.assign({ geheimVeld: 'x' }, KIND), 'continuiteit', null);
  assert.equal(raar.velden.geheimVeld, undefined);
  assert.equal(raar.weggelaten.find(x => x.veld === 'geheimVeld').klasse, 'onbekend');
  assert.match(raar.uitleg, /weggelaten-lijst/i, 'het pakket hoort zelf te zeggen dat er een restlijst is');
});

/* ---------- in welke vorm ---------- */
test('elke standaard zegt wat hij niet kan dragen', () => {
  for (const [id, s] of Object.entries(STANDAARDEN)) {
    assert.ok(s.kanNiet.length >= 2, id + ' doet alsof hij alles kan');
    for (const zin of s.kanNiet) assert.ok(zin.length > 15, id + ' is te vaag over wat hij niet kan');
  }
  const uit = naarBuiten({ naam: 'Iris', geboren: '2016-03-02' }, 'entree');
  assert.equal(uit.velden.displayName, 'Iris');
  assert.equal(uit.velden.geboortedatum, undefined, 'Entree is een inlogfederatie, geen administratie');
  assert.match(uit.weggelaten.find(x => x.veld === 'geboren').waarom, /geen veld voor/i);
  assert.ok(uit.kanNiet.length);
  assert.equal(naarBuiten({}, 'ditbestaatniet').status, 400);
});

test('een veld van buiten dat wij niet kennen wordt geweigerd en gemeld', () => {
  const r = naarBinnen({ naam: 'Iris', geboortedatum: '2016-03-02',
    risicoprofiel: 'hoog', leerlingVolgnummer: 42 }, 'oso');
  assert.equal(r.velden.naam, 'Iris');
  assert.equal(r.velden.geboren, '2016-03-02');
  assert.equal(r.velden.risicoprofiel, undefined, 'ons model groeit mee met wat een leverancier stuurt');
  assert.deepEqual(r.geweigerd.map(x => x.veld).sort(), ['leerlingVolgnummer', 'risicoprofiel']);
  assert.match(r.uitleg, /volgt geen koppelvlak/i);
  /* En geweigerd is echt weg: niet "voor later" ergens bewaard. */
  assert.doesNotMatch(JSON.stringify(r.velden), /hoog|42/);
});

/* ---------- en door de machine heen ---------- */
test('de kaart en het pakket staan achter de leerlingpoort', async () => {
  const kaart = await bh('/school/overdracht/kaart');
  assert.equal(kaart.status, 200, JSON.stringify(kaart.body).slice(0, 140));
  assert.equal(kaart.body.velden.filter(v => v.klasse === 'nooit').length >= 4, true);
  assert.ok(kaart.body.standaarden.every(s => s.kanNiet.length));
  assert.match(kaart.body.uitleg, /geen dossier mee/i);

  const l = (await bh('/school/leerling/aanmeld', { naam: 'Iris', geboren: '2016-03-02' })).body;
  const p = await bh('/school/overdracht/pakket', { leerlingId: l.leerling.id, doel: 'continuiteit', standaard: 'oso' });
  assert.equal(p.status, 200);
  assert.ok(p.body.velden.naam);
  assert.ok(p.body.vorm.velden.naam, 'de vorm van OSO gebruikt zijn eigen veldnamen');
  assert.ok(p.body.vorm.kanNiet.length);
  assert.match(p.body.uitleg, /niets verstuurd/i, 'het antwoord hoort te zeggen dat er niets de deur uit ging');

  const in1 = await bh('/school/overdracht/inlezen', { standaard: 'oso', velden: { naam: 'Iris', onzin: 1 } });
  assert.equal(in1.status, 200);
  assert.deepEqual(in1.body.geweigerd.map(x => x.veld), ['onzin']);
  assert.match(in1.body.uitleg, /plaatsen doet de administratie/i);
  assert.equal((await bh('/school/overdracht/inlezen', { standaard: 'zomaarwat', velden: {} })).status, 400);
});

/* ---------- de werkende overstap tussen twee RTG-scholen ---------- */
test('een pakket is geadresseerd, verloopt, en is weg na ophalen', async () => {
  const b = (await fnd('/school/school/maak', { naam: 'De Sprong', plaats: 'Ede' })).body;
  const kantoor = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RTG-OFFICE' }) }).then(r => r.json());
  await fetch(base + '/api/office/school/decide', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor.token },
    body: JSON.stringify({ code: b.schoolCode, action: 'goedkeuren' }) });
  const bh2 = (pad, body) => fnd(pad, Object.assign({ schoolCode: b.schoolCode, beheerToken: b.beheerToken }, body || {}));

  const l = (await bh('/school/leerling/aanmeld', { naam: 'Sem', geboren: '2015-05-05', herkomst: 'De Vonk' })).body;
  /* Met een echt zorgdossier erbij, anders bewijst de restlijst niets: een
     verse leerling heeft nog geen zorg, en dan valt er ook niets weg te laten.
     Juist dit is wat over een overstap NIET mee hoort te gaan. */
  const zorg = await bh('/school/zorg/zet', { leerlingId: l.leerling.id,
    behoefte: 'extra leestijd bij begrijpend lezen', plan: 'twee keer per week met de RT-er' });
  assert.equal(zorg.status, 200, 'de zorgnotitie moest gezet kunnen worden: ' + JSON.stringify(zorg.body).slice(0, 120));

  // zonder naam gaat er niets de deur uit, en zonder geadresseerde ook niet
  assert.equal((await bh('/school/overdracht/klaarzetten',
    { leerlingId: l.leerling.id, naarSchool: b.schoolCode })).status, 400);
  assert.equal((await bh('/school/overdracht/klaarzetten',
    { leerlingId: l.leerling.id, door: 'Administratie Vonk' })).status, 404);

  const zet = await bh('/school/overdracht/klaarzetten', { leerlingId: l.leerling.id,
    naarSchool: b.schoolCode, door: 'Administratie Vonk', doel: 'continuiteit' });
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));
  assert.ok(zet.body.code.startsWith('OD-'));
  /* Verlopen betekent binnen een VENSTER en niet "ooit een keer": een datum in
     het jaar 9999 ligt ook in de toekomst. Veertien dagen is de belofte, dus
     hier het harde getal en niet de constante uit de module zelf. */
  const dagen = (Date.parse(zet.body.tot) - Date.now()) / 86400000;
  assert.ok(dagen > 0 && dagen <= 15, 'een pakket hoort binnen twee weken te verlopen, niet over ' + Math.round(dagen) + ' dagen');
  assert.match(zet.body.uitleg, /Alleen die school/i);

  // het staat klaar bij de verzender, met zijn vervaldatum
  const klaar = (await bh('/school/overdracht/klaarstaand')).body;
  assert.equal(klaar.pakketten.filter(p => p.code === zet.body.code).length, 1);

  // een derde school kan hem niet ophalen: het pakket is geadresseerd
  const derde = await bh('/school/overdracht/ophalen', { code: zet.body.code, vanSchool: sch.schoolCode });
  assert.equal(derde.status, 403);
  assert.match(derde.body.error, /andere school geadresseerd/i);

  // de geadresseerde wel, en krijgt de restlijst mee
  const op = await bh2('/school/overdracht/ophalen', { code: zet.body.code, vanSchool: sch.schoolCode });
  assert.equal(op.status, 200);
  assert.equal(op.body.velden.naam, 'Sem');
  assert.equal(op.body.door, 'Administratie Vonk');
  assert.ok(op.body.weggelaten.some(x => x.veld === 'zorg' && x.klasse === 'nooit'),
    'de restlijst reist mee de overstap over');
  /* En de inhoud van dat zorgdossier gaat nergens heen -- ook niet over een
     echte overstap tussen twee scholen. */
  assert.doesNotMatch(JSON.stringify(op.body), /extra leestijd|RT-er/,
    'het zorgdossier reist mee over de overstap');
  assert.match(op.body.uitleg, /niemand automatisch ingeschreven/i);

  /* Weg bij de verzender: een overdracht is een overdracht en geen archief. */
  assert.equal((await bh2('/school/overdracht/ophalen', { code: zet.body.code, vanSchool: sch.schoolCode })).status, 404);
  assert.equal((await bh('/school/overdracht/klaarstaand')).body.pakketten
    .filter(p => p.code === zet.body.code).length, 0);
});
