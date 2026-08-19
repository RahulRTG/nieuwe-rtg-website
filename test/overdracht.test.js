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
     genoeg als het antwoord het verzwijgt;
   - en elke veldnaam zegt WAAR HIJ VANDAAN KOMT. Tot 19 augustus 2026 stonden
     hier verzonnen veldnamen die eruitzagen als een standaard. Een naam die
     niemand heeft nagekeken mag bestaan, maar nooit zonder dat etiket: geen
     antwoord uit deze module reist zonder `bevestigd`, en een onbevestigde
     naam trekt altijd een waarschuwing.
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
  assert.match(uit.weggelaten.find(x => x.veld === 'geboren').waarom, /geboorteattribuut/i);
  assert.ok(uit.kanNiet.length);
  assert.equal(naarBuiten({}, 'ditbestaatniet').status, 400);
});

/* ---------- waar een veldnaam vandaan komt ----------

   DE FOUT DIE HIER IS GEMAAKT. Deze kaarten droegen namen die niemand had
   nagekeken: eduPersonOrgUnit (bestaat niet; eduPersonOrgUnitDN wel),
   eduPersonAffiliation als opleiding (dat is een soort persoon, geen
   opleiding), en voor Edu-V een complete leerlingkaart die verzonnen was.
   Deze toetsen houden de correctie vast EN de regel eronder: een onbevestigde
   naam reist nooit zonder etiket. */
test('elke veldnaam draagt een staat en elke standaard een bron', () => {
  for (const [id, s] of Object.entries(STANDAARDEN)) {
    assert.equal(typeof s.bron, 'string', id + ' heeft geen bronvermelding');
    assert.ok(s.bron.length > 20, id + ' is te vaag over zijn bron');
    assert.equal(typeof s.gelezen, 'boolean', id + ' zegt niet of de specificatie is gelezen');
    for (const [veld, r] of Object.entries(s.heen)) {
      assert.ok(['bevestigd', 'onbevestigd'].includes(r.staat),
        id + '.' + veld + ' heeft geen staat; een derde staat bestaat niet');
      assert.ok(r.waarom && r.waarom.length > 20, id + '.' + veld + ' zegt niet waarom');
      /* Een null is ook een bewering: die mag alleen staan met een reden erbij,
         en een BEVESTIGDE null zegt "wij hebben nagekeken dat het er niet is". */
      if (r.veld !== null) assert.equal(typeof r.veld, 'string', id + '.' + veld);
    }
  }
});

test('een onbevestigde veldnaam reist nooit zonder waarschuwing', () => {
  /* Entree is de enige kaart waarvan de specificatie is gelezen. Gaat er niets
     onbevestigds mee, dan is het antwoord bevestigd en zwijgt het. */
  const stil = naarBuiten({ geboren: '2016-03-02' }, 'entree');
  assert.equal(stil.bevestigd, true);
  assert.equal(stil.waarschuwing, null);
  assert.deepEqual(stil.onbevestigd, []);

  /* Reist er wel een onbevestigde naam mee, dan staat dat er drie keer bij:
     de vlag, de lijst en de zin. */
  const wel = naarBuiten({ naam: 'Iris' }, 'entree');
  assert.equal(wel.bevestigd, false);
  assert.deepEqual(wel.onbevestigd.map(x => x.veld), ['naam']);
  assert.match(wel.waarschuwing, /niet nagekeken/i);
  assert.match(wel.waarschuwing, /geen koppeling/i);

  /* En een standaard waarvan de specificatie NOOIT is gelezen, is nooit
     bevestigd -- ook niet als er toevallig geen veld meereist. Anders zou een
     lege vertaling uit een ongelezen kaart er betrouwbaar uitzien. */
  const leeg = naarBuiten({ zorg: 'x' }, 'eduv');
  assert.deepEqual(leeg.velden, {});
  assert.equal(leeg.bevestigd, false, 'een ongelezen kaart is nooit bevestigd');
  assert.match(leeg.waarschuwing, /nooit gelezen/i);

  /* Dezelfde regel de andere kant op: inlezen mag net zo min doen alsof. */
  const binnen = naarBinnen({ naam: 'Iris' }, 'oso');
  assert.equal(binnen.bevestigd, false);
  assert.deepEqual(binnen.onbevestigd.map(x => x.extern), ['naam']);
  assert.ok(binnen.bron.length > 20);
});

test('de namen die fout waren, staan er niet meer', () => {
  /* Alleen de VELDNAMEN, niet de uitleg eromheen: die noemt de oude fout met
     zoveel woorden en hoort dat te blijven doen. */
  const namen = Object.values(STANDAARDEN)
    .flatMap(s => Object.values(s.heen).map(r => r.veld)).filter(Boolean);
  /* eduPersonOrgUnit bestaat niet in eduPerson 202208; eduPersonOrgUnitDN wel. */
  for (const n of namen) assert.doesNotMatch(n, /^eduPersonOrgUnit$/,
    'eduPersonOrgUnit bestaat niet: eduPerson 202208 kent alleen eduPersonOrgUnitDN');
  /* eduPersonAffiliation mag genoemd worden, maar niet als opleiding gebruikt:
     de toegestane waarden zijn soorten personen. */
  assert.equal(STANDAARDEN.entree.heen.opleiding.veld, null);
  assert.equal(STANDAARDEN.entree.heen.klasCode.veld, null);
  assert.equal(STANDAARDEN.entree.heen.geboren.veld, null);
  for (const [veld, r] of Object.entries(STANDAARDEN.entree.heen)) {
    if (r.veld) assert.notEqual(r.veld, 'eduPersonAffiliation', veld + ' gebruikt een soort persoon als gegeven');
  }
  /* En Edu-V draagt geen verzonnen leerlingkaart meer. */
  for (const [veld, r] of Object.entries(STANDAARDEN.eduv.heen)) {
    assert.equal(r.veld, null, 'Edu-V.' + veld + ' draagt weer een niet-nagekeken veldnaam');
  }
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
  /* De herkomst reist mee tot op het scherm. Een lijst van vier standaarden
     zonder bron laat een school denken dat er vier koppelingen klaarliggen. */
  assert.ok(kaart.body.standaarden.every(s => typeof s.bron === 'string' && s.bron.length > 20),
    'de kaart noemt de standaarden zonder te zeggen waar hun veldnamen vandaan komen');
  assert.deepEqual(kaart.body.standaarden.filter(s => s.gelezen).map(s => s.id), ['entree'],
    'alleen de Entree-kaart is tegen een specificatie gehouden');
  assert.match(kaart.body.uitleg, /geen dossier mee/i);

  const l = (await bh('/school/leerling/aanmeld', { naam: 'Iris', geboren: '2016-03-02' })).body;
  const p = await bh('/school/overdracht/pakket', { leerlingId: l.leerling.id, doel: 'continuiteit', standaard: 'oso' });
  assert.equal(p.status, 200);
  assert.ok(p.body.velden.naam);
  assert.ok(p.body.vorm.velden.naam, 'de vorm van OSO gebruikt zijn eigen veldnamen');
  assert.ok(p.body.vorm.kanNiet.length);
  assert.equal(p.body.vorm.bevestigd, false, 'de OSO-veldnamen zijn nooit nagekeken');
  assert.match(p.body.vorm.waarschuwing, /nooit gelezen/i);
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
