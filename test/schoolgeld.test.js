/* De enterprise-laag van RTG School, deel 3: geld en personeelszaken.

   De belofte die deze toets bewaakt, is de belangrijkste van de hele
   financiele laag: GELD RAAKT NOOIT HET ONDERWIJS. Een openstaande factuur
   haalt een kind niet uit de klas, blokkeert geen toegang en verbergt geen
   cijfer -- en elk antwoord zegt dat er zelf bij, zodat een koppelend systeem
   het niet kan verzinnen.

   Verder: een vrijwillige ouderbijdrage wordt hooguit EEN keer herinnerd, een
   leeg kantinesaldo weigert geen eten, een ziekmelding vraagt geen reden, en
   een personeelsdossier gaat alleen open met het recht 'hr' en met een reden.
   Draai los: node --test test/schoolgeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geld-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let D, leraar, klas, leerling;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const sch = (await api('/school/school/maak', { naam: 'Het Baken', plaats: 'Zwolle' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };
  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Meester Bram', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: '2C' })).body;
  leerling = (await api('/school/leerling/aanmeld', Object.assign({ naam: 'Fatima El Amrani' }, D))).body.leerling;
  await api('/school/leerling/besluit', Object.assign({ leerlingId: leerling.id, besluit: 'plaatsen', klasCode: klas.code }, D));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een openstaande factuur verandert niets aan het onderwijs van het kind', async () => {
  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'schoolgeld',
    bedrag: 125.5, omschrijving: 'Schoolgeld periode 1', vervalt: '2020-01-01' }, D))).body;
  assert.equal(f.factuur.centen, 12550, 'bedragen staan in centen');
  assert.equal(f.blokkeertOnderwijs, false);

  // de leerling staat gewoon in de klas, met dezelfde rechten als daarvoor
  const kd = (await api('/school/klas', { klasCode: klas.code, personeelToken: leraar.personeelToken })).body;
  assert.ok(kd.leerlingen.some(x => x.naam === 'Fatima El Amrani'));
  const dossier = (await api('/school/dossier', Object.assign({ leerlingId: leerling.id }, D))).body;
  assert.equal(dossier.leerling.status, 'ingeschreven');
  assert.notEqual(dossier.leerling.toegang, 'gesloten');

  const deb = (await api('/school/debiteuren', D)).body;
  assert.equal(deb.aantal, 1);
  assert.equal(deb.teLaat, 1);
  assert.equal(deb.blokkeertOnderwijs, false);
});

test('betalen en terugbetalen lopen over dezelfde weg; te veel terugbetalen kan niet', async () => {
  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'excursie',
    bedrag: 40, omschrijving: 'Excursie Naturalis' }, D))).body.factuur;
  const betaald = (await api('/school/factuur/boek', Object.assign({ factuurId: f.id, bedrag: 40, wijze: 'ideal' }, D))).body;
  assert.equal(betaald.factuur.open, 0);
  assert.equal(betaald.factuur.status, 'voldaan');

  const teveel = await api('/school/factuur/boek', Object.assign({ factuurId: f.id, bedrag: 60, terugbetaling: true }, D));
  assert.equal(teveel.status, 400);

  const terug = (await api('/school/factuur/boek', Object.assign({ factuurId: f.id, bedrag: 40, terugbetaling: true,
    reden: 'excursie afgelast' }, D))).body;
  assert.equal(terug.factuur.open, 4000, 'na terugbetaling staat het bedrag weer open');
});

test('de vrijwillige ouderbijdrage wordt hooguit een keer herinnerd', async () => {
  const f = (await api('/school/factuur/maak', Object.assign({ leerlingId: leerling.id, soort: 'ouderbijdrage',
    bedrag: 55, omschrijving: 'Vrijwillige ouderbijdrage' }, D))).body;
  assert.equal(f.factuur.vrijwillig, true);
  assert.match(f.let, /vrijwillig/);

  assert.equal((await api('/school/factuur/herinner', Object.assign({ factuurId: f.factuur.id }, D))).body.herinneringen, 1);
  const tweede = await api('/school/factuur/herinner', Object.assign({ factuurId: f.factuur.id }, D));
  assert.equal(tweede.status, 409);
  assert.match(tweede.body.error, /vrijwillig/);
});

test('kantine: een leeg saldo weigert geen eten, het verschil wordt een factuur', async () => {
  const uit = (await api('/school/kantine/saldo', Object.assign({ leerlingId: leerling.id, af: 3.5 }, D))).body;
  assert.equal(uit.saldo, 0);
  assert.equal(uit.mutaties[0].watNiet, 350, 'wat niet gedekt was, staat apart');
  assert.ok(uit.mutaties[0].factuur, 'en is een factuur geworden');
  assert.equal(uit.blokkeertOnderwijs, false);

  const bij = (await api('/school/kantine/saldo', Object.assign({ leerlingId: leerling.id, bij: 10 }, D))).body;
  assert.equal(bij.saldo, 1000);
});

test('budget, subsidie en de export naar de boekhouding', async () => {
  await api('/school/budget/zet', Object.assign({ id: 'ict', naam: 'ICT', bedrag: 1000 }, D));
  const over = (await api('/school/budget/zet', Object.assign({ id: 'ict', naam: 'ICT', besteding: 1200, wat: 'laptops' }, D))).body;
  assert.equal(over.budget.overschreden, true);
  await api('/school/subsidie/zet', Object.assign({ naam: 'Nationaal Programma Onderwijs', verstrekker: 'OCW', bedrag: 25000, ontvangen: 12500 }, D));

  const r = (await api('/school/financien/rapport', D)).body;
  assert.ok(r.totalen.gefactureerd > 0);
  assert.ok(r.perSoort.some(s => s.soort === 'schoolgeld'));
  assert.ok(r.subsidies.some(s => s.verstrekker === 'OCW'));
  assert.ok(r.export.every(e => typeof e.centen === 'number' && e.nummer), 'elke exportregel is compleet');
  assert.equal(r.blokkeertOnderwijs, false);
});

test('financien zijn dicht voor een docent, ook lezen', async () => {
  assert.equal((await api('/school/debiteuren', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).status, 403);
  assert.equal((await api('/school/factuur/maak', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    leerlingId: leerling.id, bedrag: 10, omschrijving: 'test' })).status, 403);
});

test('HR: het dossier is van HR, met reden; de medewerker mag altijd bij het zijne', async () => {
  const hrpers = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'HR Hakim', rol: 'ondersteuning' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: hrpers.personeelId, akkoord: true }, D));
  await api('/school/personeel/rollen', Object.assign({ personeelId: hrpers.personeelId, rollen: ['hr'] }, D));
  const H = { schoolCode: D.schoolCode, personeelToken: hrpers.personeelToken };

  await api('/school/hr/zet', Object.assign({ personeelId: leraar.personeelId,
    contract: { soort: 'vast', uren: 32, functie: 'Docent Nederlands' }, bevoegdheid: 'eerstegraads Nederlands', geldigTot: '2020-01-01' }, H));

  // een collega-docent komt er niet in
  assert.equal((await api('/school/hr/dossier', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    personeelId: leraar.personeelId, reden: 'nieuwsgierig' })).status, 403);
  // HR wel, maar niet zonder reden
  assert.equal((await api('/school/hr/dossier', Object.assign({ personeelId: leraar.personeelId }, H))).status, 400);
  const met = (await api('/school/hr/dossier', Object.assign({ personeelId: leraar.personeelId, reden: 'contractverlenging' }, H))).body;
  assert.equal(met.dossier.contract.uren, 32);

  // de medewerker zelf heeft geen recht 'hr' nodig voor zijn eigen dossier
  const eigen = (await api('/school/hr/mijn', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken })).body;
  assert.equal(eigen.dossier.contract.functie, 'Docent Nederlands');

  // een verlopen bevoegdheid staat als signaal in het HR-overzicht
  const ov = (await api('/school/hr/overzicht', H)).body;
  assert.ok(ov.bevoegdhedenLet.some(b => b.verlopen && /Nederlands/.test(b.wat)));
});

test('ziekmelding vraagt geen reden, en vervanging zet de waarnemer op de klas', async () => {
  const ziek = (await api('/school/hr/afwezig', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, soort: 'ziek' })).body;
  assert.equal(ziek.verlof.soort, 'ziek');
  assert.equal(ziek.verlof.toelichting, null, 'er is geen veld voor een medische reden');
  assert.match(ziek.let, /geen reden/);

  // een tweede docent is beschikbaar en wordt waarnemer
  const invaller = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Meester Youssef', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: invaller.personeelId, akkoord: true }, D));
  const vrij = (await api('/school/hr/vervanging', Object.assign({ klasCode: klas.code }, D))).body;
  assert.ok(vrij.beschikbaar.some(p => p.naam === 'Meester Youssef'));

  const gezet = (await api('/school/hr/vervanging', Object.assign({ klasCode: klas.code, personeelId: invaller.personeelId }, D))).body;
  assert.equal(gezet.waarnemer.naam, 'Meester Youssef');
  const kd = (await api('/school/klas', { klasCode: klas.code, personeelToken: leraar.personeelToken })).body;
  assert.equal(kd.waarnemer.naam, 'Meester Youssef', 'de klas kent maar een plek waar de waarnemer staat');

  // een zieke collega kan niet als vervanger worden aangewezen
  const nee = await api('/school/hr/vervanging', Object.assign({ klasCode: klas.code, personeelId: leraar.personeelId }, D));
  assert.equal(nee.status, 409);
});

test('een gesprek legt afspraken vast, geen cijfer, en de medewerker mag reageren', async () => {
  const g = (await api('/school/hr/gesprek', Object.assign({ personeelId: leraar.personeelId,
    besproken: 'Werkdruk in periode 2 en de begeleiding van de nieuwe collega.',
    afspraken: ['een uur per week roostervrij voor begeleiding'] }, D))).body;
  assert.equal(g.gesprek.afspraken.length, 1);
  assert.ok(!('score' in g.gesprek) && !('cijfer' in g.gesprek), 'geen score in een gespreksverslag');

  const reactie = (await api('/school/hr/gesprek/reactie', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken,
    gesprekId: g.gesprek.id, reactie: 'Eens met de afspraak; ik wil er de toetsweek bij betrekken.' })).body;
  assert.match(reactie.gesprek.reactie.tekst, /toetsweek/);
});
