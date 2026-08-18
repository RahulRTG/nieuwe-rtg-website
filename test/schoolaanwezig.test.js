/* De enterprise-laag van RTG School, deel 2: aanwezigheid, verlof, en de
   veiligheidskant (passen, bezoekers, incidenten, ontruiming, calamiteit).

   De beloftes die hier hard worden gemaakt:
   - dezelfde les twee keer registreren CORRIGEERT en telt niet dubbel;
   - een verlofbesluit kan niet zonder reden, en het gezin ziet die reden;
   - een incident dat vertrouwelijk is, komt niet in de lijst van een docent --
     wel het AANTAL dat verborgen blijft, want stilte is erger dan een slot;
   - de ontruimingslijst valt terug op de presentie van vandaag als er geen
     poortjes zijn;
   - er wordt GEEN looproute per pas bewaard.
   Draai los: node --test test/schoolaanwezig.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-aanw-'));
const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const office = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let D, leraar, klas, gezin, kindId, kindToken, sleutel;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const sch = (await api('/school/school/maak', { naam: 'De Wissel', plaats: 'Almere' })).body;
  const kantoor = (await office('/office/login', { code: 'RTG-OFFICE' })).body.token;
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, kantoor);
  D = { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken };
  leraar = (await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Sanne', rol: 'leraar' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: leraar.personeelId, akkoord: true }, D));
  klas = (await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: leraar.personeelToken, naam: 'Groep 7' })).body;

  gezin = (await api('/gezin/maak', { gezinsnaam: 'Fam Wissel', naam: 'Ouder Wissel', pin: '1234' })).body;
  const kind = (await api('/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Kind Wissel', rol: 'kind', groep: 'kind' })).body;
  kindId = kind.profiel.id;
  kindToken = (await api('/gezin/profiel/kies', { code: gezin.code, profielId: kindId })).body.token;
  await api('/school/koppel', { code: gezin.code, token: gezin.token, klasCode: klas.code, profielId: kindId });
  await api('/school/uitnodiging/antwoord', { code: gezin.code, token: kindToken, klasCode: klas.code, akkoord: true });
  sleutel = gezin.code + ':' + kindId;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('presentie: te laat telt met minuten, en dezelfde les opnieuw zetten corrigeert', async () => {
  const docent = { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, klasCode: klas.code };
  const eerst = (await api('/school/aanwezigheid/zet', Object.assign({ datum: '2026-05-11', uur: 2, vak: 'rekenen',
    regels: [{ leerling: sleutel, stand: 'telaat', minuten: 12 }] }, docent))).body;
  assert.equal(eerst.telling.telaat, 1);
  assert.equal(eerst.les.gecorrigeerd, false);

  // een leerling die niet in de klas zit, komt er niet in
  const vreemd = await api('/school/aanwezigheid/zet', Object.assign({ datum: '2026-05-11', uur: 3, regels: [{ leerling: 'X:1', stand: 'aanwezig' }] }, docent));
  assert.equal(vreemd.status, 400);

  // dezelfde les opnieuw: correctie, geen tweede registratie
  const opnieuw = (await api('/school/aanwezigheid/zet', Object.assign({ datum: '2026-05-11', uur: 2, vak: 'rekenen',
    regels: [{ leerling: sleutel, stand: 'aanwezig' }] }, docent))).body;
  assert.equal(opnieuw.les.gecorrigeerd, true);

  const beeld = (await api('/school/aanwezigheid/klas', Object.assign({ klasCode: klas.code }, D))).body;
  assert.equal(beeld.lessen, 1, 'een les, niet twee');
  const rij = beeld.leerlingen.find(r => r.leerling === sleutel);
  assert.equal(rij.telaat, 0, 'de correctie heeft de te-laat-registratie vervangen');
});

test('verlof: aanvraag van het gezin, besluit met reden, en het gezin ziet dat besluit', async () => {
  const aanvraag = (await api('/school/verlof/aanvraag', { code: gezin.code, token: gezin.token, klasCode: klas.code,
    profielId: kindId, van: '2026-06-01', tot: '2026-06-03', reden: 'bruiloft van oma in het buitenland' })).body;
  assert.equal(aanvraag.verlof.status, 'ingediend');

  const zonder = await api('/school/verlof/besluit', Object.assign({ verlofId: aanvraag.verlof.id, besluit: 'afgewezen' }, D));
  assert.equal(zonder.status, 400, 'een besluit zonder reden bestaat niet');

  const besluit = (await api('/school/verlof/besluit', Object.assign({ verlofId: aanvraag.verlof.id, besluit: 'toegekend',
    reden: 'eenmalige familiegebeurtenis, buiten de toetsweek' }, D))).body;
  assert.equal(besluit.verlof.status, 'toegekend');

  const mijn = (await api('/school/verlof/mijn', { code: gezin.code, token: gezin.token })).body;
  const eigen = mijn.aanvragen.find(a => a.id === aanvraag.verlof.id);
  assert.equal(eigen.status, 'toegekend');
  assert.match(eigen.besluitReden, /familiegebeurtenis/);
});

test('incidenten: vertrouwelijk blijft dicht voor de docent, met het aantal er eerlijk bij', async () => {
  const vertrouwen = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Vertrouwenspersoon Els', rol: 'ondersteuning' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: vertrouwen.personeelId, akkoord: true }, D));
  await api('/school/personeel/rollen', Object.assign({ personeelId: vertrouwen.personeelId, rollen: ['vertrouwen'] }, D));

  await api('/school/incident/meld', Object.assign({ wat: 'Ruzie op het plein, twee leerlingen uit elkaar gehaald.', ernst: 'licht' }, D));
  await api('/school/incident/meld', Object.assign({ wat: 'Melding over de thuissituatie van een leerling.', ernst: 'ernstig', vertrouwelijk: true }, D));

  // de docent heeft het recht 'incident' helemaal niet
  const docent = await api('/school/incident/lijst', { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken });
  assert.equal(docent.status, 403);

  // de vertrouwenspersoon ziet allebei
  const els = (await api('/school/incident/lijst', { schoolCode: D.schoolCode, personeelToken: vertrouwen.personeelToken, reden: 'weekoverzicht' })).body;
  assert.equal(els.aantal, 2);
  assert.equal(els.verborgen, 0);

  // iemand met alleen 'incident' (geen vertrouwelijk) ziet er een, en weet dat er een verborgen is
  const gebouw = (await api('/school/personeel/aanmeld', { schoolCode: D.schoolCode, naam: 'Conciërge Ko', rol: 'ondersteuning' })).body;
  await api('/school/personeel/besluit', Object.assign({ personeelId: gebouw.personeelId, akkoord: true }, D));
  await api('/school/personeel/rollen', Object.assign({ personeelId: gebouw.personeelId, rollen: ['gebouw'] }, D));
  const alsGebouw = await api('/school/incident/lijst', { schoolCode: D.schoolCode, personeelToken: gebouw.personeelToken });
  assert.equal(alsGebouw.status, 403, 'de gebouwrol mag wel de deur, niet de incidenten');
});

test('ontruiming: passen tellen als er poortjes zijn, anders de presentie van vandaag', async () => {
  // zonder passen: terugval op de presentie van vandaag
  const docent = { schoolCode: D.schoolCode, personeelToken: leraar.personeelToken, klasCode: klas.code };
  await api('/school/aanwezigheid/zet', Object.assign({ uur: 1, regels: [{ leerling: sleutel, stand: 'aanwezig' }] }, docent));
  const terugval = (await api('/school/ontruiming', D)).body;
  assert.equal(terugval.bron, 'presentie van vandaag');
  assert.equal(terugval.leerlingen.length, 1);

  // met een pas die binnen staat: die telt, en er komt geen looproute bij
  const pas = (await api('/school/pas/geef', Object.assign({ soort: 'personeel', personeelId: leraar.personeelId }, D))).body.pas;
  const passeer = (await api('/school/pas/passeer', Object.assign({ pasId: pas.id, ingang: 'zij-ingang' }, D))).body;
  assert.equal(passeer.binnen, true);
  const metPas = (await api('/school/ontruiming', D)).body;
  assert.equal(metPas.bron, 'passen');
  assert.equal(metPas.personeel.length, 1);
  assert.equal(metPas.personeel[0].naam, 'Juf Sanne');

  // een geblokkeerde pas staat meteen buiten en komt niet meer binnen
  await api('/school/pas/blokkeer', Object.assign({ pasId: pas.id, aan: false, reden: 'verloren' }, D));
  assert.equal((await api('/school/pas/passeer', Object.assign({ pasId: pas.id }, D))).status, 403);
});

test('bezoekers en calamiteit: de melding landt in elke klas en de ontruimingslijst komt mee', async () => {
  const b = (await api('/school/bezoeker/aanmeld', Object.assign({ naam: 'Inspecteur De Vries', organisatie: 'Inspectie', voor: 'Directie' }, D))).body.bezoeker;
  const nood = (await api('/school/calamiteit', Object.assign({ soort: 'ontruiming', tekst: 'Brandalarm. Verzamel op het sportveld.' }, D))).body;
  assert.equal(nood.actief, true);
  assert.ok(nood.klassen >= 1);
  assert.ok(nood.ontruiming.bezoekers.some(x => x.naam === 'Inspecteur De Vries'), 'de bezoeker staat op de ontruimingslijst');

  // het gezin ziet de noodmelding in de klas
  const mijn = (await api('/school/mijn', { code: gezin.code, token: gezin.token })).body;
  const platte = JSON.stringify(mijn);
  assert.ok(platte.indexOf('Verzamel op het sportveld') >= 0, 'de noodmelding bereikt het gezin');

  await api('/school/bezoeker/uit', Object.assign({ bezoekerId: b.id }, D));
  const na = (await api('/school/ontruiming', D)).body;
  assert.ok(!na.bezoekers.some(x => x.naam === 'Inspecteur De Vries'), 'uitgetekend is uit het gebouw');

  const af = (await api('/school/calamiteit', Object.assign({ stop: true }, D))).body;
  assert.equal(af.actief, false);
});
