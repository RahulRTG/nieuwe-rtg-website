/* De enterprise-laag van RTG School, deel 1: rollen en rechten, het
   inzagejournaal, en de leerlingadministratie (aanmelding -> wachtlijst ->
   plaatsing -> uitschrijving -> overstap).

   Wat hier bewezen wordt, zijn beloftes en geen functies:
   - een docent komt NIET in het zorgdeel van een dossier, en de
     systeembeheerder komt nergens in een dossier;
   - het zorgdeel gaat alleen open MET een reden, en die reden staat daarna in
     het journaal (de inhoud niet);
   - een volle opleiding levert een wachtlijst met een plek, geen stille
     plaatsing;
   - uitschrijven haalt de leerling uit de klas maar WIST het dossier niet.
   Draai los: node --test test/schoolenterprise.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ent-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let D = null;      // directie-sleutelbos
let leraar = null; // een toegelaten docent
let klas = null;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const sch = (await api('/school/school/maak', { naam: 'Het Nieuwe Lyceum', plaats: 'Rotterdam' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };
  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Joris', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '4A' })).body;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('rollen: de directie kent toe, niemand kent zichzelf de directie-rol toe', async () => {
  const kaart = (await api('/school/rollen', D)).body;
  assert.equal(kaart.mijn.rollen[0], 'directie');
  assert.ok(kaart.rollen.some(r => r.id === 'zorg'), 'de zorgcoordinator staat op de rollenkaart');

  // een docent heeft standaard alleen de docentrechten
  const mijn = (await api('/school/mijn-rechten', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).body;
  assert.deepEqual(mijn.rollen, ['leraar']);
  assert.ok(mijn.rechten.includes('leerling') && !mijn.rechten.includes('zorg'));

  // de directie-rol is niet toe te kennen: die hangt aan het beheer-token
  const fout = await api('/school/personeel/rollen', Object.assign({ personeelId: leraar.personeelId, rollen: ['directie'] }, D));
  assert.equal(fout.status, 400);
  assert.match(fout.body.error, /directie-rol/);
});

test('het zorgdeel: dicht voor de docent, open met een reden, en de reden staat in het journaal', async () => {
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Noor Bakker' }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: l.id, besluit: 'plaatsen', klasCode: klas.code }, D));

  // de docent ziet de basis, maar het zorgdeel is afgeschermd
  const alsDocent = (await api('/school/dossier', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, leerlingId: l.id })).body;
  assert.equal(alsDocent.leerling.naam, 'Noor Bakker');
  assert.equal(alsDocent.zorg, null);
  assert.match(alsDocent.zorgToegang, /afgeschermd/);

  // zonder reden gaat het zorgdeel ook voor de directie niet open
  const zonder = await api('/school/dossier', Object.assign({ leerlingId: l.id, zorg: true }, D));
  assert.equal(zonder.status, 400);
  assert.equal(zonder.body.redenNodig, true);
  // en wie het zorgdeel niet opvraagt, krijgt het ook niet zomaar mee
  const basis = (await api('/school/dossier', Object.assign({ leerlingId: l.id }, D))).body;
  assert.equal(basis.zorg, null);

  await api('/school/zorg/zet', Object.assign({ leerlingId: l.id, behoefte: 'extra tijd bij toetsen',
    doel: 'zelfstandig een toets afronden', reden: 'intakegesprek' }, D));
  const met = (await api('/school/dossier', Object.assign({ leerlingId: l.id, zorg: true, reden: 'voorbereiding zorgoverleg' }, D))).body;
  assert.equal(met.zorg.behoefte, 'extra tijd bij toetsen');
  assert.equal(met.zorg.doelen.length, 1);

  // het journaal kent de reden en NIET de inhoud
  const j = (await api('/school/journaal', Object.assign({ wat: 'zorgdossier-geopend' }, D))).body;
  assert.ok(j.rijen.some(r => r.reden === 'voorbereiding zorgoverleg' && r.over === l.id));
  assert.ok(JSON.stringify(j.rijen).indexOf('extra tijd bij toetsen') < 0, 'het journaal bewaart geen dossierinhoud');
});

test('de systeembeheerder beheert de omgeving en komt niet in een dossier', async () => {
  const beheer = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Systeembeheer', rol: 'ondersteuning' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: beheer.personeelId, akkoord: true }, D));
  await api('/school/personeel/rollen', Object.assign({ personeelId: beheer.personeelId, rollen: ['beheerder'] }, D));

  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Tim Jansen' }, D))).body.leerling;
  const sleutels = { schoolCode: D.schoolCode, personeelToken: beheer.personeelToken };

  const dossier = await api('/school/dossier', Object.assign({ leerlingId: l.id, zorg: true, reden: 'even kijken' }, sleutels));
  assert.equal(dossier.status, 403, 'de systeembeheerder komt niet in een leerlingdossier');
  const lijst = await api('/school/leerling/lijst', sleutels);
  assert.equal(lijst.status, 403);
  // wat hij wel mag: de koppelingen en het journaal
  assert.equal((await api('/school/webhook/lijst', sleutels)).status, 200);
  assert.equal((await api('/school/journaal', sleutels)).status, 200);
});

test('wachtlijst: een volle opleiding plaatst niet stilletjes, maar geeft een plek in de rij', async () => {
  await api('/school/opleiding/zet', Object.assign({ id: 'vwo', naam: 'Vwo', plaatsen: 1 }, D));
  const a = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Eerste Kind', opleiding: 'vwo' }, D))).body.leerling;
  const b = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Tweede Kind', opleiding: 'vwo' }, D))).body.leerling;
  assert.equal(a.status, 'aanmelding', 'een aanmelding is nog geen plaats');

  assert.equal((await api('/school/leerling/besluit', Object.assign({ leerlingId: a.id, besluit: 'plaatsen', klasCode: klas.code }, D))).body.leerling.status, 'ingeschreven');
  const vol = await api('/school/leerling/besluit', Object.assign({ leerlingId: b.id, besluit: 'plaatsen', klasCode: klas.code }, D));
  assert.equal(vol.status, 409);
  assert.equal(vol.body.vol, true);
  const wacht = (await api('/school/leerling/besluit', Object.assign({ leerlingId: b.id, besluit: 'wachtlijst' }, D))).body;
  assert.equal(wacht.plek, 1);
  assert.equal(wacht.vanTotaal, 1);

  const org = (await api('/school/organisatie', D)).body;
  const vwo = org.opleidingen.find(o => o.id === 'vwo');
  assert.equal(vwo.bezet, 1); assert.equal(vwo.wachtlijst, 1); assert.equal(vwo.vol, true);
});

test('uitschrijven haalt uit de klas, sluit de toegang en laat het dossier staan', async () => {
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Vertrekker Vera' }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: l.id, besluit: 'plaatsen', klasCode: klas.code }, D));
  const inKlas = (await api('/school/klas', { klasCode: klas.code, personeelToken: leraar.personeelToken })).body;
  assert.ok(inKlas.leerlingen.some(x => x.naam === 'Vertrekker Vera'));

  const zonderReden = await api('/school/leerling/uitschrijf', Object.assign({ leerlingId: l.id }, D));
  assert.equal(zonderReden.status, 400, 'uitschrijven zonder reden kan niet');

  const uit = (await api('/school/leerling/uitschrijf', Object.assign({ leerlingId: l.id, reden: 'verhuizing naar Spanje' }, D))).body;
  assert.equal(uit.leerling.status, 'uitgeschreven');
  const na = (await api('/school/klas', { klasCode: klas.code, personeelToken: leraar.personeelToken })).body;
  assert.ok(!na.leerlingen.some(x => x.naam === 'Vertrekker Vera'), 'uit de klaslijst');

  // maar het dossier bestaat nog, met de reden en de einddatum
  const dossier = (await api('/school/dossier', Object.assign({ leerlingId: l.id }, D))).body;
  assert.equal(dossier.leerling.naam, 'Vertrekker Vera');
  assert.ok(dossier.leerling.uitgeschrevenAt, 'de einddatum staat in het dossier');
});

test('overstap laat een spoor na: van welke klas naar welke', async () => {
  const tweede = (await api('/school/leraar/klas/maak', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, naam: '4B' })).body;
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Wissel Wim' }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: l.id, besluit: 'plaatsen', klasCode: klas.code }, D));
  const over = (await api('/school/leerling/overstap', Object.assign({ leerlingId: l.id, naarKlas: tweede.code, reden: 'betere match' }, D))).body;
  assert.equal(over.leerling.klasCode, tweede.code);
  assert.equal(over.overstappen.length, 1);
  assert.equal(over.overstappen[0].van.klas, klas.code);
  const oud = (await api('/school/klas', { klasCode: klas.code, personeelToken: leraar.personeelToken })).body;
  assert.ok(!oud.leerlingen.some(x => x.naam === 'Wissel Wim'), 'hij zit niet meer in twee klassen tegelijk');
});

test('de schooljaarovergang is een voorstel dat een mens uitvoert, en maar een keer', async () => {
  const naarVijf = (await api('/school/leraar/klas/maak', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, naam: '5A' })).body;
  const l = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Overgang Olaf' }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: l.id, besluit: 'plaatsen', klasCode: klas.code }, D));

  const voorstel = (await api('/school/schooljaar/voorstel', Object.assign({ paden: [{ van: klas.code, naar: naarVijf.code }] }, D))).body;
  assert.ok(voorstel.voorstelId);
  assert.ok(voorstel.regels.some(r => r.leerlingId === l.id && r.naar === naarVijf.code));

  const zonder = await api('/school/schooljaar/voer-uit', Object.assign({ voorstelId: voorstel.voorstelId }, D));
  assert.equal(zonder.status, 400, 'zonder bevestiging gebeurt er niets');

  const uit = (await api('/school/schooljaar/voer-uit', Object.assign({ voorstelId: voorstel.voorstelId, bevestig: 'OVERGANG' }, D))).body;
  assert.ok(uit.verplaatst >= 1);
  const weer = await api('/school/schooljaar/voer-uit', Object.assign({ voorstelId: voorstel.voorstelId, bevestig: 'OVERGANG' }, D));
  assert.equal(weer.status, 409, 'een voorstel wordt hooguit een keer uitgevoerd');
});
